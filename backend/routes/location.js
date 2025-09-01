// backend/routes/location.js
import { Router } from 'express';
import mongoose from 'mongoose';
import PushToken from '../models/PushToken.js';

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
  try { return !!v && mongoose.Types.ObjectId.isValid(String(v)); } catch { return false; }
}

/**
 * Toleranter Heartbeat:
 * Body akzeptiert:
 *  - { token, lat, lng, accuracy?, speed?, ts?, projectId?, deviceId?, platform?, source? }
 *  - { token, lastLocation: { type:'Point', coordinates:[lng,lat] }, accuracy?, ... }
 *
 * Wirkung:
 *  - setzt lastLocation (GeoJSON), lastHeartbeatAt = now
 *  - setzt optional: lastLocationAccuracy, lastLocationSpeed, lastLocationAt
 *  - hebt disabled=false an, lastSeenAt aktualisiert
 *  - kann projectId/deviceId/platform mitschreiben
 */
router.post('/heartbeat', async (req, res) => {
  try {
    const b = req.body || {};
    const token = String(b.token || '').trim();
    const source = String(b.source || 'hb').trim();

    if (!token.startsWith('ExponentPushToken[')) {
      return res.status(400).json({ ok: false, error: 'token_invalid_or_missing' });
    }

    let lat = toNum(b.lat);
    let lng = toNum(b.lng);

    // Fallback: GeoJSON
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

    // Range-Check (sanity)
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ ok: false, error: 'coords_out_of_range' });
    }

    const accuracy = isValidNumber(toNum(b.accuracy)) ? Number(toNum(b.accuracy)) : undefined;
    const speed = isValidNumber(toNum(b.speed)) ? Number(toNum(b.speed)) : undefined;
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
      ...(platform ? { platform } : {}),
    };

    const $setOnInsert = { platform: platform || 'android' };

    const doc = await PushToken.findOneAndUpdate(
      { token },
      { $set, $setOnInsert },
      { new: true, upsert: true }
    ).lean();

    // kompaktes Log
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

/** Optional: simpler Ping */
router.get('/ping', (_req, res) => res.json({ ok: true }));

export default router;
