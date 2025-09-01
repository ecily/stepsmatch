// backend/routes/location.js
import { Router } from 'express';
import mongoose from 'mongoose';
import PushToken from '../models/PushToken.js';
import Offer from '../models/Offer.js';
import OfferVisibility from '../models/OfferVisibility.js';
import { sendPushAndCheckReceipts } from '../utils/push.js';
import { isOfferActiveNow } from '../utils/isOfferActiveNow.js';

const router = Router();

function isValidNumber(n) {
  return Number.isFinite(n) && !Number.isNaN(n);
}
function toNum(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v.trim().replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}
function isValidObjectId(v) {
  try {
    return !!v && mongoose.Types.ObjectId.isValid(String(v));
  } catch {
    return false;
  }
}

/* ───────────────── Heartbeat ───────────────── */
router.post('/heartbeat', async (req, res) => {
  try {
    const b = req.body || {};
    const token = String(b.token || '').trim();
    const source = String(b.source || 'hb').trim();

    if (!token || !token.startsWith('ExponentPushToken[')) {
      return res.status(400).json({ ok: false, error: 'token_invalid_or_missing' });
    }

    let lat = toNum(b.lat);
    let lng = toNum(b.lng);
    if (!isValidNumber(lat) || !isValidNumber(lng)) {
      const coords = b?.lastLocation?.coordinates;
      if (Array.isArray(coords) && coords.length === 2) {
        lng = toNum(coords[0]);
        lat = toNum(coords[1]);
      }
    }
    if (!isValidNumber(lat) || !isValidNumber(lng)) {
      return res.status(400).json({ ok: false, error: 'coords_missing' });
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ ok: false, error: 'coords_out_of_range' });
    }

    const accuracyNum = toNum(b.accuracy);
    const accuracy = isValidNumber(accuracyNum) ? Number(accuracyNum) : undefined;
    const speedNum = toNum(b.speed);
    const speed = isValidNumber(speedNum) ? Number(speedNum) : undefined;
    const ts = b.ts ? new Date(b.ts) : new Date();
    const lastLocationAt = isNaN(ts) ? new Date() : ts;

    const projectId = b.projectId ? String(b.projectId) : undefined;
    const deviceId = b.deviceId ? String(b.deviceId) : undefined;
    const platform = b.platform ? String(b.platform).toLowerCase() : undefined;

    const now = new Date();
    const lastLocation = { type: 'Point', coordinates: [lng, lat] };

    const $set = {
      lastLocation,
      lastHeartbeatAt: now,
      lastSeenAt: now,
      disabled: false,
      ...(accuracy !== undefined ? { lastLocationAccuracy: accuracy } : {}),
      ...(speed !== undefined ? { lastLocationSpeed: speed } : {}),
      lastLocationAt,
      ...(projectId ? { projectId } : {}),
      ...(deviceId ? { deviceId } : {}),
      // ⚠️ platform NICHT hier setzen (Konflikt), nur on-insert:
    };

    const $setOnInsert = {
      platform: platform || 'android',
    };

    const doc = await PushToken.findOneAndUpdate(
      { token },
      { $set, $setOnInsert },
      { new: true, upsert: true }
    ).lean();

    console.log(
      '[hb] ok',
      token.slice(0, 22) + '…',
      'at',
      lat.toFixed(5),
      lng.toFixed(5),
      accuracy !== undefined ? `±${Math.round(accuracy)}m` : '',
      deviceId ? `dev=${deviceId}` : '',
      projectId ? `pid=${projectId}` : '',
      source ? `src=${source}` : ''
    );

    return res.json({
      ok: true,
      id: doc?._id,
      lat,
      lng,
      accuracy: accuracy ?? null,
      speed: speed ?? null,
      t: now.getTime(),
      projectId: projectId ?? doc?.projectId ?? null,
      deviceId: deviceId ?? doc?.deviceId ?? null,
    });
  } catch (e) {
    console.error('[hb] error', e?.message || e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

/* ───────────────── Geofence-Enter → Sofort-Push ─────────────────
   Body: { token, offerId, lat?, lng?, accuracy?, deviceId?, projectId? }
*/
router.post('/geofence-enter', async (req, res) => {
  try {
    const b = req.body || {};
    const token = String(b.token || '').trim();
    const offerId = String(b.offerId || '').trim();

    if (!token || !token.startsWith('ExponentPushToken[')) {
      return res.status(400).json({ ok: 0, error: 'token_invalid_or_missing' });
    }
    if (!isValidObjectId(offerId)) {
      return res.status(400).json({ ok: 0, error: 'offerId_invalid' });
    }

    // Optional: Location aktualisieren
    let lat = toNum(b.lat);
    let lng = toNum(b.lng);
    if (isValidNumber(lat) && isValidNumber(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      await PushToken.updateOne(
        { token },
        {
          $set: {
            lastLocation: { type: 'Point', coordinates: [lng, lat] },
            lastHeartbeatAt: new Date(),
            lastSeenAt: new Date(),
            disabled: false,
            ...(b.projectId ? { projectId: String(b.projectId) } : {}),
            ...(b.deviceId ? { deviceId: String(b.deviceId) } : {}),
          },
        }
      );
    }

    const [tokDoc, offer] = await Promise.all([
      PushToken.findOne({ token, disabled: { $ne: true } }, { _id: 1, token: 1 }).lean(),
      Offer.findById(offerId).lean(),
    ]);
    if (!tokDoc) return res.status(404).json({ ok: 0, error: 'token_not_found_or_disabled' });
    if (!offer) return res.status(404).json({ ok: 0, error: 'offer_not_found' });

    // Zeitscheibe prüfen
    if (!isOfferActiveNow(offer, 'Europe/Vienna', new Date())) {
      console.log('[geofence] offer not active now, skip push', offerId);
      return res.json({ ok: 1, pushed: 0, reason: 'offer_not_active' });
    }

    // Sichtbarkeit / Duplikatschutz
    const canPush = await OfferVisibility.shouldNotify(tokDoc._id, offer._id, new Date());
    if (!canPush) {
      return res.json({ ok: 1, pushed: 0, reason: 'visibility_blocked' });
    }

    const title = offer.name ?? 'Neues Angebot in deiner Nähe';
    const body = 'Tippe, um Details zu sehen.';
    const data = {
      type: 'offer',
      offerId: String(offer._id),
      route: `/offers/${offer._id}`,
      source: 'geofence',
      t: Date.now(),
    };

    const diag = await sendPushAndCheckReceipts({
      tokens: [token],
      title,
      body,
      data,
      channelId: process.env.PUSH_CHANNEL_ID || 'offers',
      priority: process.env.PUSH_PRIORITY || 'high',
      sound: process.env.PUSH_SOUND || 'default',
      delayMs: 2500,
    });

    const okTicket = Array.isArray(diag?.sent?.tickets)
      ? diag.sent.tickets.find((t) => t?.status === 'ok')
      : null;
    const pushed = okTicket ? 1 : 0;

    if (pushed) {
      await OfferVisibility.markNotified(tokDoc._id, offer._id, new Date());
    }

    console.log(
      `[geofence] offer=${offer._id} token=${token.slice(0, 22)}… pushed=${pushed} receipts=${JSON.stringify(
        diag?.receipts?.summary || {}
      )}`
    );

    return res.json({
      ok: 1,
      pushed,
      receipts: diag?.receipts?.summary || {},
    });
  } catch (e) {
    console.error('[geofence] error', e?.message || e);
    return res.status(500).json({ ok: 0, error: 'server_error' });
  }
});

/* ───────────────── Ping ───────────────── */
router.get('/ping', (_req, res) => res.json({ ok: true }));

export default router;
