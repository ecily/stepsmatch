// backend/jobs/offerPoller.js
import Offer from '../models/Offer.js';
import PushToken from '../models/PushToken.js';
import OfferVisibility from '../models/OfferVisibility.js';
import { sendOffersPushSafe } from '../utils/push.js';
import { isOfferActiveNow } from '../utils/isOfferActiveNow.js'; // ✅ zentraler TZ-sicherer Helper

/* ───────── Helpers ───────── */
function envMs(name, def) {
  const v = process.env[name];
  if (v === undefined) return def;
  const s = String(v).trim().toLowerCase();
  if (['', '0', 'false', 'off', 'null', 'none'].includes(s)) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : def;
}

function normalizeInterests(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((s) => String(s || '').toLowerCase().normalize('NFKD').trim())
    .filter(Boolean);
}

function interestsMatch(offer, token) {
  const req = normalizeInterests(offer?.interestsRequired);
  if (req.length === 0) return true; // kein Filter
  const have = new Set(normalizeInterests(token?.interests));
  if (have.size === 0) return false;
  return req.some((r) => have.has(r));
}

/* ───────── Konfig ───────── */
const INTERVAL_MS = envMs('PUSH_POLLER_INTERVAL_MS', 60_000);
const NEW_OFFER_WINDOW_MS = envMs('PUSH_NEW_OFFER_WINDOW_MS', 15 * 60_000);
const LAST_LOCATION_MAX_AGE_MS = envMs('PUSH_LAST_LOCATION_MAX_AGE_MS', 30 * 60_000);
const MAX_DISTANCE_M_DEFAULT = Number(process.env.PUSH_MAX_DISTANCE_M ?? 1500);
const TZ = 'Europe/Vienna';

let timer = null;

/* ───────── Start/Stop ───────── */
export function startOfferPoller() {
  if (timer) return;

  const DEBUG = process.env.DEBUG_OFFER_POLLER === '1';

  async function doCycle() {
    const t0 = Date.now();
    try {
      const since = new Date(Date.now() - NEW_OFFER_WINDOW_MS);

      // 1) Neu/aktualisierte Offers (wir holen genug Felder für Aktiv- & Geo-Check)
      const candidateOffers = await Offer.find({
        $or: [{ createdAt: { $gte: since } }, { updatedAt: { $gte: since } }],
      })
        .select(
          '_id name location radiusMeters radius validDates validTimes validDays weekdays category subcategory interestsRequired'
        )
        .lean();

      const now = new Date();
      // ✅ EINHEITLICHER Aktiv-Check (TZ-fest, erkennt Einzeltage / Nachtfenster / Wochentage)
      const activeOffers = candidateOffers.filter((o) => isOfferActiveNow(o, TZ, now));

      // 2) Tokens mit frischer Location
      const freshSince = new Date(Date.now() - LAST_LOCATION_MAX_AGE_MS);
      const tokensFresh = await PushToken.find({
        disabled: { $ne: true },
        'lastLocation.coordinates.0': { $exists: true },
        $or: [
          { lastHeartbeatAt: { $gte: freshSince } },
          { lastSeenAt: { $gte: freshSince } },
          { updatedAt: { $gte: freshSince } },
        ],
      })
        .select('_id token platform interests lastLocation')
        .lean();

      if (DEBUG) {
        console.log(
          `[offerPoller][debug] candidates=${candidateOffers.length} active=${activeOffers.length} tokensFresh=${tokensFresh.length}`
        );
      }

      if (!activeOffers.length || !tokensFresh.length) {
        if (DEBUG) console.log('[offerPoller][debug] nothing to do');
        if (!DEBUG && process.env.NODE_ENV !== 'production') {
          console.log(
            `[offerPoller] cycle ok — offers=${activeOffers.length} tokens=${tokensFresh.length} took=${Date.now() - t0}ms`
          );
        }
        return;
      }

      // 3) Für jedes Offer → Tokens im Radius
      for (const offer of activeOffers) {
        const coords = offer?.location?.coordinates;
        const [lng, lat] = Array.isArray(coords) ? coords : [];
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

        // Radius: erst radiusMeters, dann radius, sonst Default
        const radiusM = Number(offer.radiusMeters ?? offer.radius ?? MAX_DISTANCE_M_DEFAULT);
        if (!Number.isFinite(radiusM) || radiusM <= 0) continue;

        if (DEBUG)
          console.log(
            `[offerPoller][debug] offer=${offer._id} using radiusM=${radiusM} @ [${lat.toFixed(
              5
            )},${lng.toFixed(5)}]`
          );

        // Geo-Query gegen frische Tokens
        const nearTokens = await PushToken.find({
          _id: { $in: tokensFresh.map((t) => t._id) },
          lastLocation: {
            $near: {
              $geometry: { type: 'Point', coordinates: [lng, lat] },
              $maxDistance: radiusM,
            },
          },
        })
          .select('_id token platform interests lastLocation')
          .lean();

        // Interessen-Matching
        const matched = nearTokens.filter((t) => interestsMatch(offer, t));

        if (DEBUG) {
          console.log(
            `[offerPoller][debug] offer=${offer._id} near=${nearTokens.length} matched=${matched.length} radius=${radiusM}`
          );
        }
        if (!matched.length) continue;

        // 4) Spam-Schutz via OfferVisibility
        // blockiere:
        // - notified (bereits gepusht)
        // - dismissed (nie wieder)
        // - snoozed (solange remindAt > now)
        const vis = await OfferVisibility.find({
          offerId: offer._id,
          deviceToken: { $in: matched.map((t) => t._id) }, // deviceToken referenziert PushToken._id
          $or: [{ status: 'notified' }, { status: 'dismissed' }, { status: 'snoozed', remindAt: { $gt: now } }],
        })
          .select('deviceToken status remindAt')
          .lean();

        const already = new Set(vis.map((v) => String(v.deviceToken)));
        const toNotify = matched.filter((t) => !already.has(String(t._id)));
        if (DEBUG) console.log(`[offerPoller][debug] offer=${offer._id} toNotify=${toNotify.length}`);
        if (!toNotify.length) continue;

        // 5) Push senden + Visibility setzen
        await sendOffersPushSafe(
          toNotify.map((t) => ({ token: t.token, platform: t.platform })),
          {
            title: offer.name ?? 'Neues Angebot in deiner Nähe',
            body: 'Tippe, um Details zu sehen.',
            data: { type: 'offer', offerId: String(offer._id) },
          }
        );

        // Upsert Visibility (idempotent)
        const nowIso = new Date();
        const bulk = toNotify.map((t) => ({
          updateOne: {
            filter: { offerId: offer._id, deviceToken: t._id },
            update: {
              $setOnInsert: { offerId: offer._id, deviceToken: t._id, firstSeenAt: nowIso },
              $set: { status: 'notified', remindAt: null, lastNotifiedAt: nowIso, updatedAt: nowIso },
            },
            upsert: true,
          },
        }));
        if (bulk.length) await OfferVisibility.bulkWrite(bulk);
      }

      if (!DEBUG && process.env.NODE_ENV !== 'production') {
        console.log(
          `[offerPoller] cycle ok — offers=${activeOffers.length} tokens=${tokensFresh.length} took=${Date.now() - t0}ms`
        );
      }
      if (DEBUG) {
        console.log(`[offerPoller][debug] took=${Date.now() - t0}ms`);
      }
    } catch (e) {
      console.error('[offerPoller] cycle error:', e?.message || e);
    }
  }

  console.log(`[offerPoller] started — every ${INTERVAL_MS}ms`);
  // sofortiger erster Lauf + Intervall
  doCycle();
  timer = setInterval(doCycle, INTERVAL_MS);
}

export function stopOfferPoller() {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.log('[offerPoller] stopped');
  }
}
