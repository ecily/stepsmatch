// backend/routes/location.js
import express from 'express';
import mongoose from 'mongoose';
import Offer from '../models/Offer.js';

// Robuster Sender mit Receipts/Deaktivierung
import { sendOffersPushSafe } from '../utils/push.js';

// ✅ Token-Model
import PushToken from '../models/PushToken.js';

// Persistente Sichtbarkeit pro (deviceToken × offerId)
import OfferVisibility, { OFFER_VISIBILITY_STATUS as VIS } from '../models/OfferVisibility.js';

const router = express.Router();

/* ──────────────────────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────────────────────── */

// ENV → Zahl, "0" bleibt 0, Default nur wenn undefined
const toMs = (v, def) => (v === undefined ? def : Number(v));

/* Haversine (Meter) */
function haversineMeters(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/* ──────────────────────────────────────────────────────────────
 * In‑Memory Guards (pro Prozess)
 * ────────────────────────────────────────────────────────────── */

// A) Pair‑Cooldown (pro Empfänger×Offer), ENV-gesteuert
const PAIR_COOLDOWN_MS = toMs(process.env.PAIR_COOLDOWN_MS, 10 * 60 * 1000);
const pairLastPushAt = new Map(); // key: `${recipientKey}::${offerId}` -> ts
const isPairAllowed = (key) => {
  if (PAIR_COOLDOWN_MS <= 0) return true;
  const last = pairLastPushAt.get(key) || 0;
  return Date.now() - last >= PAIR_COOLDOWN_MS;
};
const markPairPushed = (key) => pairLastPushAt.set(key, Date.now());

// B) Global‑Guard „pro Reload max. 1 Push“ (pro Empfänger), ENV-gesteuert
const MIN_PUSH_INTERVAL_MS = toMs(process.env.MIN_PUSH_INTERVAL_MS, 10_000);
const anyLastPushAt = new Map(); // key: recipientKey -> ts
const isAnyAllowed = (recipientKey) => {
  if (MIN_PUSH_INTERVAL_MS <= 0) return true;
  const last = anyLastPushAt.get(recipientKey) || 0;
  return Date.now() - last >= MIN_PUSH_INTERVAL_MS;
};
const markAnyPushed = (recipientKey) => anyLastPushAt.set(recipientKey, Date.now());

/* ──────────────────────────────────────────────────────────────
 * In‑Memory Telemetry (startet bei 0 nach Restart)
 * ────────────────────────────────────────────────────────────── */
const bootAt = Date.now();
const stats = {
  received: 0,          // Anzahl eingehender Requests
  sent: 0,              // erfolgreich gesendete Pushes (>=1 Ticket ok)
  cooldown: 0,          // blockiert wegen Pair‑Cooldown
  perReload: 0,         // blockiert wegen Global‑Guard
  seenOrMuted: 0,       // blocked durch OfferVisibility (dismissed/snoozed/notified)
  outside: 0,           // außerhalb des Radius
  noRecipients: 0,      // kein aktives Device
  tokenDisabled: 0,     // konkretes Token ist disabled
  validationErrors: 0,  // 400/422 Fälle
  errors: 0,            // 500 Serverfehler
};

/**
 * GET /api/location/debug-stats
 * Kein Auth (nur Testphase). Liefert aktuelle In‑Memory‑Zähler.
 */
router.get('/debug-stats', (_req, res) => {
  res.json({
    ok: true,
    uptimeSec: Math.round((Date.now() - bootAt) / 1000),
    windows: {
      pairCooldownMs: PAIR_COOLDOWN_MS,
      anyCooldownMs: MIN_PUSH_INTERVAL_MS,
    },
    stats,
  });
});

/**
 * POST /api/location/geofence-enter
 * Body: { offerId, lat, lng, eventType?, token? }
 */
router.post('/geofence-enter', async (req, res) => {
  stats.received += 1;

  try {
    const { offerId, lat, lng, eventType = 'enter', token: inlineToken } = req.body || {};
    if (!offerId || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      stats.validationErrors += 1;
      return res.status(400).json({ success: false, error: 'offerId, lat, lng erforderlich' });
    }
    if (!mongoose.Types.ObjectId.isValid(offerId)) {
      stats.validationErrors += 1;
      return res.status(400).json({ success: false, error: 'Ungültige offerId' });
    }

    // Offer holen (nur was wir brauchen)
    const offer = await Offer.findById(offerId, 'location radius name').lean();
    if (!offer) {
      stats.validationErrors += 1;
      return res.status(404).json({ success: false, error: 'Angebot nicht gefunden' });
    }

    const coords = offer?.location?.coordinates; // [lng, lat]
    const radius = Number(offer?.radius || 0);
    if (!Array.isArray(coords) || coords.length !== 2 || !(radius > 0)) {
      stats.validationErrors += 1;
      return res.status(422).json({ success: false, error: 'Angebot hat keine gültige Geoposition/Radius' });
    }

    // Radius-Check
    const distanceMeters = haversineMeters(lat, lng, coords[1], coords[0]);
    const inside = distanceMeters <= radius;

    // Empfänger ermitteln
    let tokens = [];
    let recipientKey = null;
    let deviceTokenDoc = null;

    if (typeof inlineToken === 'string' && inlineToken.trim()) {
      // Token in DB anlegen/aktualisieren (lastSeenAt)
      deviceTokenDoc = await PushToken.findOneAndUpdate(
        { token: inlineToken.trim() },
        {
          $setOnInsert: { platform: 'android' },
          $set: { disabled: false, lastSeenAt: new Date() },
        },
        { new: true, upsert: true }
      ).exec();

      if (deviceTokenDoc?.disabled) {
        stats.tokenDisabled += 1;
        return res.json({
          success: true, offerId, inside,
          distanceMeters: Math.round(distanceMeters),
          radiusMeters: radius, eventType,
          pushSent: false, reason: 'device-token-disabled'
        });
      }

      tokens = [deviceTokenDoc.token];
      recipientKey = deviceTokenDoc.token; // pro-Recipient Guard
    } else if (req.user?._id) {
      const devices = await PushToken.find(
        { userId: req.user._id, disabled: false },
        { token: 1 }
      )
        .sort({ updatedAt: -1 })
        .lean();

      tokens = devices.map(d => d.token).filter(Boolean);

      if (!tokens.length) {
        stats.noRecipients += 1;
        return res.json({
          success: true, offerId, inside,
          distanceMeters: Math.round(distanceMeters),
          radiusMeters: radius, eventType,
          pushSent: false, reason: 'no-active-device-tokens'
        });
      }

      recipientKey = `user:${req.user._id}`;

      // Für OfferVisibility brauchen wir ein konkretes deviceTokenId → nimm das „neueste“:
      const latest = await PushToken.findOne({ userId: req.user._id, disabled: false })
        .sort({ updatedAt: -1 })
        .lean();
      if (latest) deviceTokenDoc = latest;
    } else {
      stats.noRecipients += 1;
      return res.json({
        success: true, offerId, inside,
        distanceMeters: Math.round(distanceMeters),
        radiusMeters: radius, eventType,
        pushSent: false, reason: 'no-recipients'
      });
    }

    if (!inside) {
      stats.outside += 1;
      return res.json({
        success: true, offerId, inside,
        distanceMeters: Math.round(distanceMeters),
        radiusMeters: radius, eventType,
        pushSent: false, reason: 'outside-radius'
      });
    }

    // Persistente Neuheits‑Logik
    const deviceTokenId = deviceTokenDoc?._id;
    if (!deviceTokenId) {
      stats.noRecipients += 1;
      return res.json({
        success: true, offerId, inside,
        distanceMeters: Math.round(distanceMeters),
        radiusMeters: radius, eventType,
        pushSent: false, reason: 'no-device-token-id'
      });
    }

    // 1) „gesehen“ anlegen, falls neu
    await OfferVisibility.upsertSeen(deviceTokenId, offerId);

    // 2) Darf benachrichtigt werden? (respektiert snooze/dismiss/notified)
    const now = new Date();
    const mayNotify = await OfferVisibility.shouldNotify(deviceTokenId, offerId, now);
    if (!mayNotify) {
      stats.seenOrMuted += 1;

      // statusgenaue Reason
      const doc = await OfferVisibility.findOne({ deviceToken: deviceTokenId, offerId }).lean();
      let reason = 'blocked';
      if (doc) {
        if (doc.status === VIS.DISMISSED) {
          reason = 'dismissed';
        } else if (doc.status === VIS.SNOOZED) {
          reason = doc.remindAt && doc.remindAt > now ? 'snoozed-not-due' : 'snoozed';
        } else if (doc.status === VIS.NOTIFIED) {
          reason = 'already-notified';
        } else if (doc.status === VIS.SEEN) {
          reason = 'seen-no-push';
        }
      }

      return res.json({
        success: true, offerId, inside,
        distanceMeters: Math.round(distanceMeters),
        radiusMeters: radius, eventType,
        pushSent: false, reason
      });
    }

    // Keys für Guards
    const pairKey = `${recipientKey ?? tokens[0]}::${offerId}`;

    // 3) Global‑Guard – prüft nur, markiert NICHT
    if (!isAnyAllowed(recipientKey)) {
      stats.perReload += 1;
      const last = anyLastPushAt.get(recipientKey) || 0;
      const since = Date.now() - last;
      return res.json({
        success: true, offerId, inside,
        distanceMeters: Math.round(distanceMeters),
        radiusMeters: radius, eventType,
        pushSent: false, reason: 'per-reload-limit',
        meta: { windowMs: MIN_PUSH_INTERVAL_MS, sinceMs: since }
      });
    }

    // 4) Pair‑Guard – prüft nur, markiert NICHT
    if (!isPairAllowed(pairKey)) {
      stats.cooldown += 1;
      const last = pairLastPushAt.get(pairKey) || 0;
      const since = Date.now() - last;
      return res.json({
        success: true, offerId, inside,
        distanceMeters: Math.round(distanceMeters),
        radiusMeters: radius, eventType,
        pushSent: false, reason: 'cooldown-active',
        meta: { windowMs: PAIR_COOLDOWN_MS, sinceMs: since }
      });
    }

    // 5) Push senden
    const url = `/offers/${offerId}`;
    const title = 'Angebot in deiner Nähe';
    const body  = `${offer.name ?? 'Angebot'} – ${Math.round(distanceMeters)} m entfernt. Tippen für Details.`;

    const meta = await sendOffersPushSafe(tokens, {
      title, body, url, channelId: 'offers', sound: 'default'
    });

    const notified = meta.sent > 0;

    // 6) Zustände & Guards nur bei Erfolg markieren
    if (notified) {
      await OfferVisibility.markNotified(deviceTokenId, offerId, new Date());
      // Guards „armen“ NACH erfolgreichem Send
      markAnyPushed(recipientKey);
      markPairPushed(pairKey);
      stats.sent += 1;
    }

    return res.json({
      success: true,
      offerId,
      inside,
      distanceMeters: Math.round(distanceMeters),
      radiusMeters: radius,
      eventType,
      pushSent: notified,
      meta
    });
  } catch (err) {
    stats.errors += 1;
    console.error('Fehler bei /location/geofence-enter:', err);
    return res.status(500).json({ success: false, error: 'Serverfehler bei geofence-enter' });
  }
});

export default router;
