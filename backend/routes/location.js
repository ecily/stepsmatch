// backend/routes/location.js
import express from 'express';
import mongoose from 'mongoose';
import Offer from '../models/Offer.js';
import { sendOffersPushSafe } from '../utils/push.js';
import PushToken from '../models/PushToken.js';
import OfferVisibility, { OFFER_VISIBILITY_STATUS as VIS } from '../models/OfferVisibility.js';

const router = express.Router();

/* Helpers */
function envMs(name, def) {
  const v = process.env[name];
  if (v === undefined) return def;
  const s = String(v).trim().toLowerCase();
  if (s === '' || s === '0' || s === 'false' || s === 'off' || s === 'null' || s === 'none') return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : def;
}
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

/** Server-seitig: ist das Offer *jetzt* aktiv? (robust wie im Client) */
function isOfferActiveNowServer(o, tz = 'Europe/Vienna') {
  // Minimal robust ohne externe Lib: prüfe Felder, die bei euch vorkommen
  const now = new Date();
  const keysStart = ['activeStart','validFrom','startAt','startTime','dateFrom','activeWindowStart'];
  const keysEnd   = ['activeUntil','activeEnd','validUntil','endAt','endTime','dateTo','activeWindowEnd','validTo'];
  const vd = o?.validDates && typeof o.validDates === 'object' ? o.validDates : null;

  const parseDate = (v) => {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d) ? null : d;
  };

  let start = null, end = null;
  if (vd) {
    start = parseDate(vd.from ?? vd.start ?? vd.fromDate ?? vd.startDate);
    end   = parseDate(vd.to   ?? vd.end   ?? vd.toDate   ?? vd.endDate);
  }
  if (!start) for (const k of keysStart) { const d = parseDate(o?.[k]); if (d) { start = d; break; } }
  if (!end)   for (const k of keysEnd)   { const d = parseDate(o?.[k]); if (d) { end   = d; break; } }

  if (start && now < start) return false;
  if (end   && now > end)   return false;
  return true; // wenn keine Grenzen gesetzt, als aktiv werten
}

/* In-Memory Guards */
const PAIR_COOLDOWN_MS = envMs('PAIR_COOLDOWN_MS', 10 * 60 * 1000);
const MIN_PUSH_INTERVAL_MS = envMs('MIN_PUSH_INTERVAL_MS', 10_000);

const pairLastPushAt = new Map(); // `${recipientKey}::${offerId}` -> ts
const anyLastPushAt  = new Map(); // recipientKey -> ts

const isPairAllowed = (key) => {
  if (PAIR_COOLDOWN_MS <= 0) return true;
  const last = pairLastPushAt.get(key) || 0;
  return Date.now() - last >= PAIR_COOLDOWN_MS;
};
const isAnyAllowed = (recipientKey) => {
  if (MIN_PUSH_INTERVAL_MS <= 0) return true;
  const last = anyLastPushAt.get(recipientKey) || 0;
  return Date.now() - last >= MIN_PUSH_INTERVAL_MS;
};
const markPairPushed = (key) => pairLastPushAt.set(key, Date.now());
const markAnyPushed  = (recipientKey) => anyLastPushAt.set(recipientKey, Date.now());

/* Telemetry */
const bootAt = Date.now();
const stats = {
  received: 0, sent: 0, cooldown: 0, perReload: 0,
  seenOrMuted: 0, outside: 0, noRecipients: 0, tokenDisabled: 0,
  validationErrors: 0, errors: 0, inactive: 0,
};

/* Debug: windows */
router.get('/debug-stats', (_req, res) => {
  res.json({
    ok: true,
    uptimeSec: Math.round((Date.now() - bootAt) / 1000),
    envRaw: {
      MIN_PUSH_INTERVAL_MS: process.env.MIN_PUSH_INTERVAL_MS ?? null,
      PAIR_COOLDOWN_MS: process.env.PAIR_COOLDOWN_MS ?? null,
    },
    windows: {
      anyCooldownMs: Number.isFinite(MIN_PUSH_INTERVAL_MS) ? MIN_PUSH_INTERVAL_MS : 0,
      pairCooldownMs: Number.isFinite(PAIR_COOLDOWN_MS) ? PAIR_COOLDOWN_MS : 0,
    },
    stats,
  });
});

/* 🔎 Model/DB-Check */
router.get('/debug-model', async (_req, res) => {
  try {
    const db = mongoose.connection?.db;
    const dbName = db?.databaseName || mongoose.connection?.name || null;
    const modelName = PushToken?.modelName;
    const collectionName = PushToken?.collection?.collectionName;
    res.json({ ok: true, dbName, modelName, collectionName });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

/* 🔎 Direkter Upsert-Test (kein Offer nötig) */
router.post('/debug-upsert-token', async (req, res) => {
  try {
    const { token, platform = 'android' } = req.body || {};
    if (!token) return res.status(400).json({ ok: false, error: 'token required' });

    const doc = await PushToken.findOneAndUpdate(
      { token: token.trim() },
      { $setOnInsert: { platform }, $set: { disabled: false, lastSeenAt: new Date() } },
      { new: true, upsert: true }
    ).lean();

    res.json({
      ok: true,
      modelName: PushToken.modelName,
      collectionName: PushToken.collection?.collectionName,
      saved: doc ? { _id: String(doc._id), token: doc.token, disabled: doc.disabled, updatedAt: doc.updatedAt } : null,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

/* ✅ Heartbeat – Position & Präsenz eines Geräts speichern */
router.get('/heartbeat/ping', (_req, res) => {
  res.json({ ok: true, now: new Date().toISOString() });
});

router.post('/heartbeat', async (req, res) => {
  try {
    const { token, platform = 'android', lat, lng, accuracy, at } = req.body || {};

    if (!token || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ ok: false, error: 'token, lat, lng erforderlich' });
    }

    const now = at ? new Date(at) : new Date();

    const doc = await PushToken.findOneAndUpdate(
      { token: token.trim() },
      {
        $setOnInsert: { platform },
        $set: {
          disabled: false,
          lastSeenAt: now,
          ...(typeof accuracy === 'number' ? { accuracy } : {}),
          lastLocation: { type: 'Point', coordinates: [lng, lat] }, // [lng, lat]
        },
      },
      { new: true, upsert: true }
    ).lean();

    return res.json({
      ok: true,
      id: String(doc._id),
      platform: doc.platform,
      lastSeenAt: doc.lastSeenAt ?? now,
      lastLocation: doc.lastLocation || { type: 'Point', coordinates: [lng, lat] },
    });
  } catch (e) {
    console.error('Fehler bei /location/heartbeat:', e);
    return res.status(500).json({ ok: false, error: 'Serverfehler bei heartbeat' });
  }
});

/* ▶️ Geofence Enter – robust & idempotent */
router.post('/geofence-enter', async (req, res) => {
  stats.received += 1;

  try {
    const { offerId, lat, lng, eventType = 'enter', token: inlineToken, platform } = req.body || {};
    if (!offerId || !mongoose.Types.ObjectId.isValid(String(offerId))) {
      stats.validationErrors += 1;
      return res.status(400).json({ success: false, error: 'Ungültige oder fehlende offerId' });
    }

    // 1) Offer laden & prüfen
    const offer = await Offer.findById(offerId, 'location provider radius name validDates category subcategory activeUntil activeEnd startAt startTime endAt endTime validFrom validTo dateFrom dateTo').lean();
    if (!offer) {
      stats.validationErrors += 1;
      return res.status(404).json({ success: false, error: 'Angebot nicht gefunden' });
    }
    if (!isOfferActiveNowServer(offer)) {
      stats.inactive += 1;
      return res.json({ success: true, offerId, pushSent: false, reason: 'offer-inactive' });
    }

    // 2) Offer Geodaten + Radius robust
    const offerCoords =
      (Array.isArray(offer?.location?.coordinates) && offer.location.coordinates.length >= 2 && offer.location.coordinates) ||
      (Array.isArray(offer?.provider?.location?.coordinates) && offer.provider.location.coordinates.length >= 2 && offer.provider.location.coordinates) ||
      null; // [lng, lat]

    const radius =
      Number(offer?.radius) ||
      Number(offer?.provider?.radius) ||
      Number(offer?.provider?.radiusMeters) ||
      0;

    if (!offerCoords || !(radius > 0)) {
      stats.validationErrors += 1;
      return res.status(422).json({ success: false, error: 'Angebot hat keine gültige Geoposition/Radius' });
    }

    // 3) Device Token auflösen (inlineToken bevorzugt). Upsert + lastSeen refresh.
    let deviceTokenDoc = null;
    if (typeof inlineToken === 'string' && inlineToken.trim()) {
      deviceTokenDoc = await PushToken.findOneAndUpdate(
        { token: inlineToken.trim() },
        { $setOnInsert: { platform: platform || 'android' }, $set: { disabled: false, lastSeenAt: new Date() } },
        { new: true, upsert: true }
      ).lean();
    } else if (req.user?._id) {
      deviceTokenDoc = await PushToken.findOne(
        { userId: req.user._id, disabled: false },
        { token: 1, platform: 1, disabled: 1, lastLocation: 1 }
      ).sort({ updatedAt: -1 }).lean();
    }

    if (!deviceTokenDoc) {
      stats.noRecipients += 1;
      return res.json({ success: true, offerId, pushSent: false, reason: 'no-device-token' });
    }
    if (deviceTokenDoc.disabled) {
      stats.tokenDisabled += 1;
      return res.json({ success: true, offerId, pushSent: false, reason: 'device-token-disabled' });
    }

    const recipientKey = req.user?._id ? `user:${req.user._id}` : deviceTokenDoc.token;
    const tokens = [{ token: deviceTokenDoc.token, platform: deviceTokenDoc.platform, disabled: false }];

    // 4) Positionsquelle priorisieren: body.lat/lng -> token.lastLocation -> kein Distance-Check
    let latNum = Number(lat);
    let lngNum = Number(lng);
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      const lastLoc = deviceTokenDoc?.lastLocation?.coordinates; // [lng, lat]
      if (Array.isArray(lastLoc) && lastLoc.length >= 2) {
        lngNum = Number(lastLoc[0]);
        latNum = Number(lastLoc[1]);
      } else {
        latNum = null;
        lngNum = null;
      }
    }

    let distanceMeters = null;
    let inside = true; // wenn OS Enter feuert, tendieren wir zu true; wenn wir Koordinaten haben, verifizieren wir
    if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
      distanceMeters = haversineMeters(latNum, lngNum, offerCoords[1], offerCoords[0]);
      inside = distanceMeters <= radius;
    }

    if (!inside) {
      stats.outside += 1;
      return res.json({
        success: true, offerId, inside,
        distanceMeters: distanceMeters != null ? Math.round(distanceMeters) : null,
        radiusMeters: radius, eventType,
        pushSent: false, reason: 'outside-radius'
      });
    }

    // 5) OfferVisibility (Seen/Muted/Notified) – *vor* den Cooldowns
    const deviceTokenId = deviceTokenDoc?._id;
    if (!deviceTokenId) {
      stats.noRecipients += 1;
      return res.json({ success: true, offerId, pushSent: false, reason: 'no-device-token-id' });
    }

    await OfferVisibility.upsertSeen(deviceTokenId, offerId);
    const now = new Date();
    const mayNotify = await OfferVisibility.shouldNotify(deviceTokenId, offerId, now);
    if (!mayNotify) {
      stats.seenOrMuted += 1;
      const doc = await OfferVisibility.findOne({ deviceToken: deviceTokenId, offerId }).lean();
      let reason = 'blocked';
      if (doc) {
        if (doc.status === VIS.DISMISSED) reason = 'dismissed';
        else if (doc.status === VIS.SNOOZED) reason = doc.remindAt && doc.remindAt > now ? 'snoozed-not-due' : 'snoozed';
        else if (doc.status === VIS.NOTIFIED) reason = 'already-notified';
        else if (doc.status === VIS.SEEN) reason = 'seen-no-push';
      }
      return res.json({
        success: true, offerId, inside,
        distanceMeters: distanceMeters != null ? Math.round(distanceMeters) : null,
        radiusMeters: radius, eventType,
        pushSent: false, reason
      });
    }

    // 6) In-Memory Cooldowns
    if (!isAnyAllowed(recipientKey)) {
      stats.perReload += 1;
      const last = anyLastPushAt.get(recipientKey) || 0;
      const since = Date.now() - last;
      return res.json({
        success: true, offerId, inside,
        distanceMeters: distanceMeters != null ? Math.round(distanceMeters) : null,
        radiusMeters: radius, eventType,
        pushSent: false, reason: 'per-reload-limit',
        meta: { windowMs: MIN_PUSH_INTERVAL_MS, sinceMs: since }
      });
    }
    const pairKey = `${recipientKey}::${offerId}`;
    if (!isPairAllowed(pairKey)) {
      stats.cooldown += 1;
      const last = pairLastPushAt.get(pairKey) || 0;
      const since = Date.now() - last;
      return res.json({
        success: true, offerId, inside,
        distanceMeters: distanceMeters != null ? Math.round(distanceMeters) : null,
        radiusMeters: radius, eventType,
        pushSent: false, reason: 'cooldown-active',
        meta: { windowMs: PAIR_COOLDOWN_MS, sinceMs: since }
      });
    }

    // 7) Push zusammenstellen
    const url = `/offers/${offerId}`;
    const prettyDistance =
      distanceMeters == null ? '' : ` – ${Math.max(1, Math.round(distanceMeters))} m entfernt`;
    const title = 'Angebot in deiner Nähe';
    const body  = `${offer.name ?? 'Angebot'}${prettyDistance}. Tippen für Details.`;

    const metaFull = await sendOffersPushSafe(tokens, {
      title,
      body,
      url,
      channelId: 'offers',
      sound: 'default',
      data: { offerId: String(offerId) }
    });

    const notified = (metaFull?.sent || 0) > 0;

    if (notified) {
      await OfferVisibility.markNotified(deviceTokenId, offerId, new Date());
      markAnyPushed(recipientKey);
      markPairPushed(pairKey);
      stats.sent += 1;
    }

    let reason = undefined;
    if (!notified) {
      const disabledCount = (metaFull?.disabledTokens?.length || 0);
      if (disabledCount > 0 && disabledCount >= (tokens?.length || 1)) {
        reason = 'device-token-disabled';
        stats.tokenDisabled += 1;
      } else if (Array.isArray(metaFull?.errors) && metaFull.errors.length) {
        reason = `push-service-error: ${String(metaFull.errors[0])}`.slice(0, 180);
      } else if ((metaFull?.tickets?.length || 0) === 0) {
        reason = 'no-tickets';
      } else {
        reason = 'delivery-failed';
      }
      console.warn('[geofence-enter] send failed', {
        offerId: String(offerId),
        recipient: recipientKey,
        tokens: tokens.length,
        reason,
        meta: {
          sent: metaFull?.sent,
          tickets: Array.isArray(metaFull?.tickets) ? metaFull.tickets.slice(0, 2) : undefined,
          errors: Array.isArray(metaFull?.errors) ? metaFull.errors.slice(0, 2) : undefined,
          disabled: metaFull?.disabledTokens || undefined,
        }
      });
    }

    const meta = {
      sent: metaFull?.sent || 0,
      tickets: Array.isArray(metaFull?.tickets) ? metaFull.tickets.length : undefined,
      errors: Array.isArray(metaFull?.errors) ? metaFull.errors.slice(0, 1) : undefined,
      disabled: metaFull?.disabledTokens || undefined,
    };

    return res.json({
      success: true,
      offerId,
      inside,
      distanceMeters: distanceMeters != null ? Math.round(distanceMeters) : null,
      radiusMeters: radius,
      eventType,
      pushSent: notified,
      ...(reason ? { reason } : {}),
      meta,
    });
  } catch (err) {
    stats.errors += 1;
    console.error('Fehler bei /location/geofence-enter:', err);
    return res.status(500).json({ success: false, error: 'Serverfehler bei geofence-enter' });
  }
});

/* ▶️ Notification-Action (➡️ / ❌ / 💤) */
router.post('/notify-action', async (req, res) => {
  try {
    const { offerId, action, token, snoozeMinutes } = req.body || {};
    if (!offerId || typeof action !== 'string' || !token) {
      return res.status(400).json({ ok: false, error: 'offerId, action, token erforderlich' });
    }
    if (!mongoose.Types.ObjectId.isValid(offerId)) {
      return res.status(400).json({ ok: false, error: 'Ungültige offerId' });
    }

    const devTok = await PushToken.findOne({ token: token.trim() }).lean();
    if (!devTok || devTok.disabled) {
      return res.status(404).json({ ok: false, error: 'device token nicht gefunden/disabled' });
    }
    const deviceTokenId = devTok._id;

    let status = 'noop';

    if (action === 'dismiss') {
      await OfferVisibility.dismiss(deviceTokenId, offerId);
      status = 'dismissed';
    } else if (action === 'snooze') {
      const minutes = Number.isFinite(Number(snoozeMinutes)) ? Number(snoozeMinutes) : 180; // Default 3h
      await OfferVisibility.snooze(deviceTokenId, offerId, minutes);
      status = `snoozed-${minutes}m`;
    } else if (action === 'go') {
      await OfferVisibility.markNotified(deviceTokenId, offerId, new Date());
      status = 'opened';
    } else {
      return res.status(400).json({ ok: false, error: 'unbekannte action' });
    }

    return res.json({ ok: true, action, status });
  } catch (e) {
    console.error('Fehler bei /location/notify-action:', e);
    return res.status(500).json({ ok: false, error: 'Serverfehler bei notify-action' });
  }
});

// GET /api/location/debug-visibility?token=...&offerId=...&status=...&includeHistory=1&limit=50
router.get('/debug-visibility', async (req, res) => {
  try {
    const { token, offerId, status, includeHistory, limit = 50 } = req.query || {};
    const q = {};
    if (offerId && mongoose.Types.ObjectId.isValid(String(offerId))) {
      q.offerId = new mongoose.Types.ObjectId(String(offerId));
    }
    if (status) q.status = status;

    if (token) {
      const dev = await PushToken.findOne({ token: String(token).trim() }, { _id: 1 }).lean();
      if (!dev) return res.json({ ok: true, items: [] });
      q.deviceToken = dev._id;
    }

    const items = await OfferVisibility.find(q)
      .sort({ updatedAt: -1 })
      .limit(Math.min(Number(limit) || 50, 200))
      .lean();

    const mapped = items.map(i => ({
      offerId: String(i.offerId),
      deviceToken: String(i.deviceToken),
      status: i.status,
      remindAt: i.remindAt ?? null,
      lastNotifiedAt: i.lastNotifiedAt ?? null,
      firstSeenAt: i.firstSeenAt ?? null,
      ...(includeHistory ? { } : {})
    }));

    res.json({ ok: true, items: mapped });
  } catch (e) {
    console.error('/debug-visibility error', e);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

export default router;
