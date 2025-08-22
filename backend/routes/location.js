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

/* In‑Memory Guards */
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
  validationErrors: 0, errors: 0,
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

/* 🔎 NEU: Model/DB‑Check */
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

/* 🔎 NEU: Direkter Upsert‑Test (kein Offer nötig) */
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

/* Route: Geofence Enter */
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

    const distanceMeters = haversineMeters(lat, lng, coords[1], coords[0]);
    const inside = distanceMeters <= radius;

    // Empfänger ermitteln
    let tokens = [];
    let recipientKey = null;
    let deviceTokenDoc = null;

    if (typeof inlineToken === 'string' && inlineToken.trim()) {
      // 🔎 log mini
      // console.log('[geofence-enter] inlineToken len:', inlineToken.trim().length);

      deviceTokenDoc = await PushToken.findOneAndUpdate(
        { token: inlineToken.trim() },
        { $setOnInsert: { platform: 'android' }, $set: { disabled: false, lastSeenAt: new Date() } },
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
      recipientKey = deviceTokenDoc.token;
    } else if (req.user?._id) {
      const devices = await PushToken.find(
        { userId: req.user._id, disabled: false },
        { token: 1 }
      ).sort({ updatedAt: -1 }).lean();

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

      const latest = await PushToken.findOne({ userId: req.user._id, disabled: false })
        .sort({ updatedAt: -1 }).lean();
      if (latest) deviceTokenDoc = latest;
    } else {
      stats.noRecipients += 1;
      return res.json({
        success: true, offerId, inside,
        distanceMeters: Math.round(distanceMeters),
        radiusMeters: radius, eventType,
        pushSent: false, reason: 'no-inline-token'
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
        distanceMeters: Math.round(distanceMeters),
        radiusMeters: radius, eventType,
        pushSent: false, reason
      });
    }

    const pairKey = `${recipientKey ?? tokens[0]}::${offerId}`;

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

    const url = `/offers/${offerId}`;
    const title = 'Angebot in deiner Nähe';
    const body  = `${offer.name ?? 'Angebot'} – ${Math.round(distanceMeters)} m entfernt. Tippen für Details.`;

    const metaFull = await sendOffersPushSafe(tokens, {
      title, body, url, channelId: 'offers', sound: 'default'
    });

    const notified = metaFull.sent > 0;

    if (notified) {
      await OfferVisibility.markNotified(deviceTokenId, offerId, new Date());
      markAnyPushed(recipientKey);
      markPairPushed(pairKey);
      stats.sent += 1;
    }

    let reason = undefined;
    if (!notified) {
      const disabledCount = (metaFull.disabledTokens?.length || metaFull.disabled?.length || 0);
      if (disabledCount > 0 && disabledCount >= (tokens?.length || 1)) {
        reason = 'device-token-disabled';
        stats.tokenDisabled += 1;
      } else if (Array.isArray(metaFull.errors) && metaFull.errors.length) {
        reason = `push-service-error: ${String(metaFull.errors[0]?.message || metaFull.errors[0])}`.slice(0, 180);
      } else if ((metaFull.tickets?.length || 0) === 0) {
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
          sent: metaFull.sent,
          tickets: Array.isArray(metaFull.tickets) ? metaFull.tickets.slice(0, 2) : undefined,
          errors: Array.isArray(metaFull.errors) ? metaFull.errors.slice(0, 2) : undefined,
          disabled: metaFull.disabledTokens || metaFull.disabled || undefined,
        }
      });
    }

    const meta = {
      sent: metaFull.sent,
      tickets: Array.isArray(metaFull.tickets) ? metaFull.tickets.length : undefined,
      errors: Array.isArray(metaFull.errors) ? metaFull.errors.slice(0, 1) : undefined,
      disabled: metaFull.disabledTokens || metaFull.disabled || undefined,
    };

    return res.json({
      success: true,
      offerId,
      inside,
      distanceMeters: Math.round(distanceMeters),
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

export default router;

