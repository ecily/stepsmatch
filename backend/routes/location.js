// stepsmatch/backend/routes/location.js
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

/** Normalisiert Interessen-Tokens (Array ODER CSV-String).
 * - lowercased
 * - Diakritika entfernt (NFD + strip)
 * - Mehrfachspaces gekürzt
 */
function normalizeInterests(input) {
  if (input == null) return [];
  const arr = Array.isArray(input) ? input : String(input).split(/[,;|]/);
  return arr
    .map((s) =>
      String(s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // diacritics
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter(Boolean);
}

/** Leitet die benötigten Tags aus dem Offer ab:
 *  1) bevorzugt offer.interestsRequired (falls befüllt)
 *  2) Fallback auf [subcategory, category]
 */
function deriveRequiredFromOffer(offer) {
  try {
    const explicit = Array.isArray(offer?.interestsRequired) ? offer.interestsRequired : [];
    const fallback = [offer?.subcategory, offer?.category].filter(Boolean);
    const merged = explicit.length ? explicit : fallback;
    return normalizeInterests(merged);
  } catch {
    return [];
  }
}

/** Prüft, ob Device-Interessen (vom PushToken) zu den Offer-Anforderungen passen.
 *  - Wenn Offer keinerlei Anforderungen hat → true (keine Einschränkung)
 *  - Wenn Anforderungen existieren, Device aber keine Interessen → false
 *  - Match, sobald mind. 1 Tag übereinstimmt (OR-Logik)
 */
function interestsMatch(offer, tokenDoc) {
  const required = deriveRequiredFromOffer(offer);
  if (required.length === 0) return true;

  const have = new Set(normalizeInterests(tokenDoc?.interests));
  if (have.size === 0) return false;

  return required.some((r) => have.has(r));
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

// Mindest-Booster & Toleranz an den Client angeglichen
const SERVER_MIN_ACCURACY_BOOST_M = Number(process.env.SERVER_MIN_ACCURACY_BOOST_M ?? 60);
const SERVER_TOLERANCE_M = Number(process.env.SERVER_TOLERANCE_M ?? 5);

// Fresh-Token Retry Delays (ms), default: 90s, 5min
const FRESH_RETRY_DELAYS_MS = String(process.env.FRESH_RETRY_DELAYS_MS || '90000,300000')
  .split(',')
  .map(s => Number(s.trim()))
  .filter(n => Number.isFinite(n) && n > 0);

/* ───────────────── Retry-Helper (Heartbeat) ─────────────────
   Scheduled Retries für DeviceNotRegistered beim Heartbeat-Push.
   Prüft vor jedem Retry:
   - Offer noch aktiv?
   - Token nicht disabled & existiert?
   - OfferVisibility (keine Doppel-Pushs)
   Markiert bei Erfolg OfferVisibility=notified.
---------------------------------------------------------------- */
function scheduleHeartbeatRetries({ offer, pushTokenId, tokenString }) {
  try {
    if (!FRESH_RETRY_DELAYS_MS.length || !offer?._id || (!pushTokenId && !tokenString)) return;

    for (const delayMs of FRESH_RETRY_DELAYS_MS) {
      setTimeout(async () => {
        try {
          // 1) Offer noch aktiv?
          const now = new Date();
          const stillActive = isOfferActiveNow(offer, TZ, now);
          if (!stillActive) {
            console.log('[hb-retry] offer not active anymore -> skip', String(offer?._id || ''));
            return;
          }

          // 2) Token laden/prüfen (aktuellster Stand)
          let tokenDoc = null;
          if (pushTokenId) {
            tokenDoc = await PushToken.findOne({ _id: pushTokenId }).select('_id token disabled projectId interests').lean();
          }
          if (!tokenDoc && tokenString) {
            tokenDoc = await PushToken.findOne({ token: tokenString }).select('_id token disabled projectId interests').lean();
          }
          if (!tokenDoc || tokenDoc.disabled) {
            console.log('[hb-retry] token missing/disabled -> skip', tokenString ? String(tokenString).slice(0,22)+'…' : String(pushTokenId));
            return;
          }
          if (PROJECT_ID && tokenDoc.projectId && String(tokenDoc.projectId) !== String(PROJECT_ID)) {
            console.log('[hb-retry] projectId mismatch -> skip');
            return;
          }

          // 3) OfferVisibility-Dedupe
          const cutoff = new Date(offer?.updatedAt || offer?.createdAt || 0);
          const exists = await OfferVisibility.findOne({
            offerId: offer._id,
            deviceToken: tokenDoc._id,
            $or: [
              { status: 'snoozed', remindAt: { $gt: now } },
              { status: { $in: ['notified', 'dismissed'] }, lastNotifiedAt: { $gte: cutoff } },
            ],
          }).select('_id').lean();
          if (exists) {
            console.log('[hb-retry] dedup -> already seen/notified, skip', String(offer._id));
            return;
          }

          // 4) Push senden
          const title = offer.name || 'Angebot in deiner Nähe';
          const body  = 'Tippe, um Details zu sehen.';
          const data  = {
            type: 'offer',
            offerId: String(offer._id),
            route: `/offers/${offer._id}`,
            source: 'heartbeat-retry',
          };

          const diagRetry = await sendPushAndCheckReceipts({
            tokens: [tokenDoc.token],
            title, body, data,
            channelId: process.env.PUSH_CHANNEL_ID || 'offers',
            priority: process.env.PUSH_PRIORITY || 'high',
            sound: process.env.PUSH_SOUND || 'default',
            delayMs: 1500,
          });

          const tickets = Array.isArray(diagRetry?.sent?.tickets) ? diagRetry.sent.tickets : [];
          const ok = tickets.some(t => t?.status === 'ok');

          if (ok) {
            await OfferVisibility.updateOne(
              { offerId: offer._id, deviceToken: tokenDoc._id },
              {
                $setOnInsert: { offerId: offer._id, deviceToken: tokenDoc._id, firstSeenAt: now },
                $set: { status: 'notified', lastNotifiedAt: now, updatedAt: now, remindAt: null },
              },
              { upsert: true }
            );
          }

          // disable invalid tokens if any
          if (Array.isArray(diagRetry?.disabledTokens) && diagRetry.disabledTokens.length > 0) {
            await PushToken.updateMany({ token: { $in: diagRetry.disabledTokens } }, { $set: { disabled: true } });
          }

          const summary = diagRetry?.receipts?.summary || {};
          console.log(
            `[hb-retry] offer=${offer._id} token=${String(tokenDoc.token).slice(0,22)}… ok=${ok ? 1 : 0} receipts=${JSON.stringify(summary)}`
          );
        } catch (err) {
          console.error('[hb-retry] error:', err?.message || err);
        }
      }, delayMs);
    }
  } catch (e) {
    console.error('[hb-retry] schedule error:', e?.message || e);
  }
}

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
              category: 1,
              subcategory: 1,
              distanceMeters: 1
            }
          },
          { $sort: { distanceMeters: 1 } },
          { $limit: 100 }
        ]);
      } catch (aggErr) {
        // fallback ohne $geoNear
        const all = await Offer.find(
          {},
          'name location radius validDays validTimes validDates interestsRequired category subcategory'
        ).lean();
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

          // Interessen / Kategorien (mit Fallback auf category/subcategory)
          if (!interestsMatch(o, pushTokenDoc)) continue;

          const baseR = Number(o.radius || 0) || DEFAULT_RADIUS_M;
          const accClamped = Math.max(0, Math.min(Number(accuracy || 0), ACCURACY_TOKEN_CAP));
          const effR = baseR + Math.max(accClamped, SERVER_MIN_ACCURACY_BOOST_M) + SERVER_TOLERANCE_M;

          const d = distanceMeters(lng, lat, olng, olat);
          if (d <= effR) {
            activeCandidates.push({ offer: o, d, effR });
            // optionales Diagnoselog
            console.log(`[hb-geofence-diag] inside offer=${String(o._id)} d=${Math.round(d)} effR=${Math.round(effR)} baseR=${baseR} acc=${accClamped}`);
          } else {
            // optionales Diagnoselog
            console.log(`[hb-geofence-diag] outside offer=${String(o._id)} d=${Math.round(d)} effR=${Math.round(effR)} baseR=${baseR} acc=${accClamped}`);
          }
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
          } else {
            // Fresh-Token-Case? -> Retry schedulen, wenn DeviceNotRegistered
            try {
              const summary = diag?.receipts?.summary || {};
              const dnr = summary?.errors?.DeviceNotRegistered ? Number(summary.errors.DeviceNotRegistered) : 0;
              if (dnr > 0) {
                console.log('[hb-retry] schedule DeviceNotRegistered', {
                  offerId: String(x.offer._id),
                  token: String(pushTokenDoc.token).slice(0,22) + '…',
                  delays: FRESH_RETRY_DELAYS_MS
                });
                scheduleHeartbeatRetries({
                  offer: x.offer,
                  pushTokenId: pushTokenDoc._id,
                  tokenString: pushTokenDoc.token
                });
              }
            } catch (e) {
              console.log('[hb-retry] scheduling failed (non-fatal):', e?.message || e);
            }
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

/* ───────────────── Geofence-Enter → Local-first Dedupe (kein Remote-Push) ─────────────────
   Body: { token?, deviceId?, offerId, lat?, lng?, accuracy?, projectId?, platform? }
   - akzeptiert token ODER deviceId (mind. eines erforderlich)
   - upsertet Token-Dokument (mit optionaler Location)
   - **sendet KEINEN Remote-Push**
   - markiert OfferVisibility als 'notified' (damit Heartbeat/Fresh-Pipeline nicht doppelt pushen)
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
      console.log('[geofence-enter] offer not active now, record only', offerId);
      return res.json({ ok: 1, pushed: 0, recorded: 1, reason: 'offer_not_active' });
    }

    // Ziel-Token bestimmen (jüngster aktiver Token je deviceId / Fallback: rawToken)
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

    // Interessen/Kategorien prüfen (mit Fallback auf category/subcategory)
    if (targetDoc && !interestsMatch(offer, targetDoc)) {
      // Wir markieren nicht als notified, um spätere gültige Fälle nicht zu blocken
      return res.json({ ok: 1, pushed: 0, recorded: 0, reason: 'interests_mismatch' });
    }

    // Sichtbarkeit / Duplikatschutz markieren (ohne Remote-Push)
    if (targetDoc?._id) {
      await OfferVisibility.updateOne(
        { offerId: offer._id, deviceToken: targetDoc._id },
        {
          $setOnInsert: { offerId: offer._id, deviceToken: targetDoc._id, firstSeenAt: now },
          $set: { status: 'notified', lastNotifiedAt: now, updatedAt: now, remindAt: null },
        },
        { upsert: true }
      );
    }

    console.log(
      `[geofence-enter] recorded offer=${offer._id} dev=${targetDoc?.deviceId || deviceId || ''} token=${String(targetDoc?.token || rawToken).slice(0,22)}…`
    );

    return res.json({
      ok: 1,
      pushed: 0,
      recorded: targetDoc?._id ? 1 : 0,
      reason: 'local_first_recorded'
    });
  } catch (e) {
    console.error('[geofence-enter] error', e?.message || e);
    return res.status(500).json({ ok: 0, error: 'server_error' });
  }
});

/* ───────────────── Ping ───────────────── */
router.get('/ping', (_req, res) => res.json({ ok: true }));

export default router;
