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

// Projekt-Scope (optional, empfohlen setzen)
const PROJECT_ID =
  process.env.EXPO_PROJECT_ID ||
  process.env.EXPO_PROJECT ||
  process.env.PROJECT_ID ||
  null;

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
      (projectId || PROJECT_ID) ? `pid=${projectId || PROJECT_ID}` : '',
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
      projectId: projectId ?? doc?.projectId ?? PROJECT_ID ?? null,
      deviceId: deviceId ?? doc?.deviceId ?? null,
    });
  } catch (e) {
    console.error('[hb] error', e?.message || e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

/* ───────────────── Geofence-Enter → Sofort-Push ─────────────────
   Body: { token?, deviceId?, offerId, lat?, lng?, accuracy?, projectId? }
   Robust:
   - akzeptiert token ODER deviceId (mind. eines erforderlich)
   - upsertet Token-Dokument bei Location-Update
   - sendet an den neuesten aktiven Token je deviceId/project (falls möglich)
   - nutzt sendPushAndCheckReceipts (mit DeviceNotRegistered-Retry)
*/
router.post('/geofence-enter', async (req, res) => {
  try {
    const b = req.body || {};
    const rawToken = String(b.token || '').trim();
    const hasToken = rawToken && rawToken.startsWith('ExponentPushToken[');
    const deviceId = b.deviceId ? String(b.deviceId) : null;
    const projectIdReq = b.projectId ? String(b.projectId) : null;
    const projectFilter = projectIdReq || PROJECT_ID || null;

    const offerId = String(b.offerId || '').trim();
    if (!isValidObjectId(offerId)) {
      return res.status(400).json({ ok: 0, error: 'offerId_invalid' });
    }
    if (!hasToken && !deviceId) {
      return res.status(400).json({ ok: 0, error: 'token_or_deviceId_required' });
    }

    // Optional: Location aktualisieren (+ Token-Dokument anlegen, falls es noch keines gibt)
    let lat = toNum(b.lat);
    let lng = toNum(b.lng);
    const haveCoords =
      isValidNumber(lat) && isValidNumber(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

    if (haveCoords && hasToken) {
      const now = new Date();
      const $set = {
        lastLocation: { type: 'Point', coordinates: [lng, lat] },
        lastHeartbeatAt: now,
        lastSeenAt: now,
        disabled: false,
        ...(projectFilter ? { projectId: projectFilter } : {}),
        ...(deviceId ? { deviceId } : {}),
      };
      const $setOnInsert = {
        platform: b.platform ? String(b.platform).toLowerCase() : 'android',
      };
      await PushToken.findOneAndUpdate(
        { token: rawToken },
        { $set, $setOnInsert },
        { upsert: true, new: true }
      ).lean();
    }

    // Offer laden + Zeitfenster prüfen
    const offer = await Offer.findById(offerId).lean();
    if (!offer) return res.status(404).json({ ok: 0, error: 'offer_not_found' });
    if (!isOfferActiveNow(offer, 'Europe/Vienna', new Date())) {
      console.log('[geofence] offer not active now, skip push', offerId);
      return res.json({ ok: 1, pushed: 0, reason: 'offer_not_active' });
    }

    // Ziel-Token bestimmen:
    // 1) Bevorzugt: neuester aktiver Token per deviceId (+ project)
    // 2) Fallback: angegebenes rawToken, sofern nicht disabled
    let targetDoc = null;

    if (deviceId) {
      const q = { deviceId, disabled: { $ne: true } };
      if (projectFilter) q.projectId = projectFilter;
      targetDoc = await PushToken.findOne(q)
        .sort({ lastSeenAt: -1, updatedAt: -1 })
        .select('_id token deviceId projectId')
        .lean();
    }
    if (!targetDoc && hasToken) {
      targetDoc = await PushToken.findOne({ token: rawToken, disabled: { $ne: true } })
        .select('_id token deviceId projectId')
        .lean();
    }

    // Falls gar kein Dokument (z. B. brandneues Token noch nicht registriert):
    // mit rohem Token versuchen (sendPushAndCheckReceipts kümmert sich um Disable/Retry)
    const sendToken = targetDoc?.token || (hasToken ? rawToken : null);
    if (!sendToken) {
      return res.status(404).json({ ok: 0, error: 'no_deliverable_token' });
    }

    // Sichtbarkeit / Duplikatschutz
    // Wenn wir ein konkretes Token-Dokument haben, können wir granular prüfen
    if (targetDoc?._id) {
      const canPush = await OfferVisibility.shouldNotify(targetDoc._id, offer._id, new Date());
      if (!canPush) {
        return res.json({ ok: 1, pushed: 0, reason: 'visibility_blocked' });
      }
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
      tokens: [sendToken],
      title,
      body,
      data,
      channelId: process.env.PUSH_CHANNEL_ID || 'offers',
      priority: process.env.PUSH_PRIORITY || 'high',
      sound: process.env.PUSH_SOUND || 'default',
      delayMs: 2500,
    });

    // Ermitteln, ob der initiale Send "ok" war
    const tickets = Array.isArray(diag?.sent?.tickets) ? diag.sent.tickets : [];
    const okFirst = tickets.find((t) => t?.status === 'ok') ? 1 : 0;

    // OfferVisibility setzen:
    // - Wenn initial ok: markiere für den (bekannten) Token
    // - Wenn initial fail & Retry erfolgreich: markiere für den neuesten aktiven Token der deviceId
    let pushed = okFirst;
    if (okFirst && targetDoc?._id) {
      await OfferVisibility.markNotified(targetDoc._id, offer._id, new Date());
    } else if (!okFirst && (diag?.retry?.succeeded || 0) > 0) {
      pushed = 1;
      // jüngsten aktiven Token je deviceId holen (falls deviceId bekannt) & markieren
      const dev = targetDoc?.deviceId || deviceId || null;
      if (dev) {
        const q = { deviceId: dev, disabled: { $ne: true } };
        if (projectFilter) q.projectId = projectFilter;
        const newest = await PushToken.findOne(q).sort({ lastSeenAt: -1, updatedAt: -1 }).select('_id token').lean();
        if (newest?._id) {
          await OfferVisibility.markNotified(newest._id, offer._id, new Date());
        }
      }
    }

    const summary = diag?.receipts?.summary || {};
    console.log(
      `[geofence] offer=${offer._id} token=${String(sendToken).slice(0, 22)}… pushed=${pushed} receipts=${JSON.stringify(
        summary
      )}${diag?.retry && diag.retry.count > 0 ? ` retry=${JSON.stringify(diag.retry)}` : ''}`
    );

    return res.json({
      ok: 1,
      pushed,
      receipts: summary,
      retry: diag?.retry || { count: 0, succeeded: 0 },
    });
  } catch (e) {
    console.error('[geofence] error', e?.message || e);
    return res.status(500).json({ ok: 0, error: 'server_error' });
  }
});

/* ───────────────── Ping ───────────────── */
router.get('/ping', (_req, res) => res.json({ ok: true }));

export default router;
