// backend/routes/location.js
import { Router } from 'express';
import mongoose from 'mongoose';
import { Expo } from 'expo-server-sdk';
import PushToken from '../models/PushToken.js';
import Offer from '../models/Offer.js';
import OfferVisibility from '../models/OfferVisibility.js';
import { sendPushAndCheckReceipts } from '../utils/push.js';
import { isOfferActiveNow } from '../utils/isOfferActiveNow.js';

const router = Router();

/* ───────────────────────── helpers ───────────────────────── */
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
function distanceMeters(lng1, lat1, lng2, lat2) {
  function toRad(d) { return (d * Math.PI) / 180; }
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
function normalizeInterests(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(s => String(s || '').toLowerCase().normalize('NFKD').trim()).filter(Boolean);
}
function interestsMatch(offer, tokenDoc) {
  const req = normalizeInterests(offer?.interestsRequired);
  if (req.length === 0) return true;
  const have = new Set(normalizeInterests(tokenDoc?.interests));
  if (have.size === 0) return false;
  return req.some(r => have.has(r));
}

/* ───────────────────────── config ───────────────────────── */
const PROJECT_ID =
  process.env.EXPO_PROJECT_ID ||
  process.env.EXPO_PROJECT ||
  process.env.PROJECT_ID ||
  null;

const HB_MAX_CHECK_DISTANCE_M = Number(process.env.HB_MAX_CHECK_DISTANCE_M ?? 2000);
const ACCURACY_TOKEN_CAP = Number(process.env.PUSH_ACCURACY_TOKEN_CAP ?? 60);
const DEFAULT_RADIUS_M = Number(process.env.DEFAULT_OFFER_RADIUS_M ?? 120);
const TZ = 'Europe/Vienna';

/* ───────────────── Heartbeat + server-side geofence ───────────────── */
router.post('/heartbeat', async (req, res) => {
  try {
    const b = req.body || {};
    const token = String(b.token || '').trim();
    const source = String(b.source || 'hb').trim();

    if (!token || !Expo.isExpoPushToken(token)) {
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
    };
    const $setOnInsert = {
      platform: platform || 'android',
    };

    const pushTokenDoc = await PushToken.findOneAndUpdate(
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

    // ───── server-side geofence check (edge-triggered on heartbeat) ─────
    try {
      const accEff = Math.max(0, Math.min(Number(accuracy || 0), ACCURACY_TOKEN_CAP));
      const nearMax = Math.max(100, HB_MAX_CHECK_DISTANCE_M);

      let rows = [];
      try {
        rows = await Offer.aggregate([
          {
            $geoNear: {
              near: { type: 'Point', coordinates: [lng, lat] },
              distanceField: 'distanceMeters',
              maxDistance: nearMax,
              spherical: true
            }
          },
          {
            $project: {
              _id: 1,
              name: 1,
              location: 1,
              radius: { $ifNull: ['$radius', DEFAULT_RADIUS_M] },
              validDays: 1,
              validTimes: 1,
              validDates: 1,
              interestsRequired: 1,
              distanceMeters: 1
            }
          },
          { $sort: { distanceMeters: 1 } },
          { $limit: 100 }
        ]);
      } catch (aggErr) {
        // fallback ohne $geoNear
        const all = await Offer.find({}, 'name location radius validDays validTimes validDates interestsRequired').lean();
        rows = all
          .filter(o => Array.isArray(o?.location?.coordinates) && o.location.coordinates.length === 2)
          .map(o => {
            const [olng, olat] = o.location.coordinates;
            return {
              ...o,
              distanceMeters: distanceMeters(lng, lat, olng, olat),
              radius: o.radius ?? DEFAULT_RADIUS_M
            };
          })
          .filter(r => r.distanceMeters <= nearMax)
          .sort((a, b) => a.distanceMeters - b.distanceMeters)
          .slice(0, 100);
        console.warn('heartbeat: $geoNear failed, fallback used:', aggErr?.message);
      }

      // Feinauswahl
      const activeCandidates = [];
      for (const o of rows) {
        try {
          if (!isOfferActiveNow(o, TZ, now)) continue;
          const coords = o?.location?.coordinates || [];
          const [olng, olat] = coords;
          if (!isValidNumber(olng) || !isValidNumber(olat)) continue;

          // Interests (optional)
          if (!interestsMatch(o, pushTokenDoc)) continue;

          const baseR = Number(o.radius || 0) || DEFAULT_RADIUS_M;
          const effR = baseR + accEff;
          const d = distanceMeters(lng, lat, olng, olat);
          if (d <= effR) activeCandidates.push({ offer: o, d, effR });
        } catch {}
      }

      if (activeCandidates.length) {
        // Dedup by visibility
        const visDocs = await OfferVisibility.find({
          offerId: { $in: activeCandidates.map(x => x.offer._id) },
          deviceToken: pushTokenDoc._id,
          $or: [
            { status: 'notified' },
            { status: 'dismissed' },
            { status: 'snoozed', remindAt: { $gt: now } },
          ]
        }).select('offerId');
        const already = new Set(visDocs.map(v => String(v.offerId)));
        const toNotify = activeCandidates.filter(x => !already.has(String(x.offer._id)));

        for (const x of toNotify) {
          const title = x.offer.name || 'Angebot in deiner Nähe';
          const body = 'Tippe, um Details zu sehen.';
          const data = {
            type: 'offer',
            offerId: String(x.offer._id),
            route: `/offers/${x.offer._id}`,
            source: 'heartbeat'
          };

          const diag = await sendPushAndCheckReceipts({
            tokens: [pushTokenDoc.token],
            title,
            body,
            data,
            channelId: process.env.PUSH_CHANNEL_ID || 'offers',
            priority: process.env.PUSH_PRIORITY || 'high',
            sound: process.env.PUSH_SOUND || 'default'
          });

          // Erfolg?
          const tickets = Array.isArray(diag?.sent?.tickets) ? diag.sent.tickets : [];
          const okFirst = tickets.some(t => t?.status === 'ok');

          if (okFirst) {
            await OfferVisibility.updateOne(
              { offerId: x.offer._id, deviceToken: pushTokenDoc._id },
              {
                $setOnInsert: { offerId: x.offer._id, deviceToken: pushTokenDoc._id, firstSeenAt: now },
                $set: { status: 'notified', lastNotifiedAt: now, updatedAt: now, remindAt: null }
              },
              { upsert: true }
            );
          }

          const summary = diag?.receipts?.summary || {};
          console.log(
            `[hb-geofence] offer=${x.offer._id} tried=1 sentOk=${okFirst ? 1 : 0} receipts=${JSON.stringify(summary)}`
          );

          // disable invalid tokens if any
          if (Array.isArray(diag?.disabledTokens) && diag.disabledTokens.length > 0) {
            await PushToken.updateMany({ token: { $in: diag.disabledTokens } }, { $set: { disabled: true } });
          }
        }
      }
    } catch (geErr) {
      console.error('[hb] server-side geofence error:', geErr?.message || geErr);
    }

    return res.json({
      ok: true,
      id: pushTokenDoc?._id,
      lat,
      lng,
      accuracy: accuracy ?? null,
      speed: speed ?? null,
      t: now.getTime(),
      projectId: projectId ?? pushTokenDoc?.projectId ?? PROJECT_ID ?? null,
      deviceId: deviceId ?? pushTokenDoc?.deviceId ?? null,
    });
  } catch (e) {
    console.error('[hb] error', e?.message || e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

/* ───────────────── Geofence-Enter → Sofort-Push ─────────────────
   Body: { token?, deviceId?, offerId, lat?, lng?, accuracy?, projectId?, platform? }
   - akzeptiert token ODER deviceId (mind. eines erforderlich)
   - upsertet Token-Dokument (mit optionaler Location)
   - sendet an den neuesten aktiven Token je deviceId/project (Fallback: rawToken)
   - dedupliziert per OfferVisibility
*/
router.post('/geofence-enter', async (req, res) => {
  try {
    const b = req.body || {};
    const rawToken = String(b.token || '').trim();
    const hasToken = rawToken && Expo.isExpoPushToken(rawToken);
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

    if (hasToken) {
      const now = new Date();
      const $set = {
        lastHeartbeatAt: now,
        lastSeenAt: now,
        disabled: false,
        ...(projectFilter ? { projectId: projectFilter } : {}),
        ...(deviceId ? { deviceId } : {}),
      };
      if (haveCoords) {
        $set.lastLocation = { type: 'Point', coordinates: [lng, lat] };
      }
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

    const now = new Date();
    if (!isOfferActiveNow(offer, TZ, now)) {
      console.log('[geofence] offer not active now, skip push', offerId);
      return res.json({ ok: 1, pushed: 0, reason: 'offer_not_active' });
    }

    // Ziel-Token bestimmen
    let targetDoc = null;
    if (deviceId) {
      const q = { deviceId, disabled: { $ne: true } };
      if (projectFilter) q.projectId = projectFilter;
      targetDoc = await PushToken.findOne(q)
        .sort({ lastSeenAt: -1, updatedAt: -1 })
        .select('_id token deviceId projectId interests')
        .lean();
    }
    if (!targetDoc && hasToken) {
      targetDoc =
        (await PushToken.findOne({ token: rawToken, disabled: { $ne: true } })
          .select('_id token deviceId projectId interests')
          .lean()) ||
        (await PushToken.findOne({ token: rawToken })
          .select('_id token deviceId projectId disabled interests')
          .lean());
    }

    const sendToken = targetDoc?.token || (hasToken ? rawToken : null);
    if (!sendToken) {
      return res.status(404).json({ ok: 0, error: 'no_deliverable_token' });
    }

    // Interests (optional)
    if (targetDoc && !interestsMatch(offer, targetDoc)) {
      return res.json({ ok: 1, pushed: 0, reason: 'interests_mismatch' });
    }

    // Sichtbarkeit / Duplikatschutz
    if (targetDoc?._id) {
      const already = await OfferVisibility.findOne({
        offerId: offer._id,
        deviceToken: targetDoc._id,
        $or: [
          { status: 'notified' },
          { status: 'dismissed' },
          { status: 'snoozed', remindAt: { $gt: now } },
        ],
      }).lean();
      if (already) {
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
      t: now.getTime(),
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

    // Erfolg?
    const tickets = Array.isArray(diag?.sent?.tickets) ? diag.sent.tickets : [];
    const okFirst = tickets.find((t) => t?.status === 'ok') ? 1 : 0;

    let pushed = okFirst;
    if (okFirst && targetDoc?._id) {
      await OfferVisibility.updateOne(
        { offerId: offer._id, deviceToken: targetDoc._id },
        {
          $setOnInsert: { offerId: offer._id, deviceToken: targetDoc._id, firstSeenAt: now },
          $set: { status: 'notified', lastNotifiedAt: now, updatedAt: now, remindAt: null },
        },
        { upsert: true }
      );
    } else if (!okFirst && (diag?.retry?.succeeded || 0) > 0) {
      pushed = 1;
      const dev = targetDoc?.deviceId || deviceId || null;
      if (dev) {
        const q = { deviceId: dev, disabled: { $ne: true } };
        if (projectFilter) q.projectId = projectFilter;
        const newest = await PushToken.findOne(q).sort({ lastSeenAt: -1, updatedAt: -1 }).select('_id token').lean();
        if (newest?._id) {
          await OfferVisibility.updateOne(
            { offerId: offer._id, deviceToken: newest._id },
            {
              $setOnInsert: { offerId: offer._id, deviceToken: newest._id, firstSeenAt: now },
              $set: { status: 'notified', lastNotifiedAt: now, updatedAt: now, remindAt: null },
            },
            { upsert: true }
          );
        }
      }
    }

    // disable invalid tokens if any
    if (Array.isArray(diag?.disabledTokens) && diag.disabledTokens.length > 0) {
      await PushToken.updateMany({ token: { $in: diag.disabledTokens } }, { $set: { disabled: true } });
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
