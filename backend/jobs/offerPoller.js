// backend/jobs/offerPoller.js
import Offer from '../models/Offer.js';
import PushToken from '../models/PushToken.js';
import OfferVisibility from '../models/OfferVisibility.js';
import { sendOffersPushSafe } from '../utils/push.js';

/* ───────── Helpers ───────── */
function envMs(name, def) {
  const v = process.env[name];
  if (v === undefined) return def;
  const s = String(v).trim().toLowerCase();
  if (s === '' || s === '0' || s === 'false' || s === 'off' || s === 'null' || s === 'none') return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : def;
}
function toHM(str) {
  if (!str) return null;
  const [h, m] = String(str).split(':').map(Number);
  if (Number.isFinite(h) && Number.isFinite(m)) return { h, m };
  return null;
}
function nowInMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}
function isWithinTimeWindow(validTimes) {
  if (!validTimes) return true;
  const start = toHM(validTimes.start);
  const end = toHM(validTimes.end);
  if (!start || !end) return true;
  const nowM = nowInMinutes();
  const startM = start.h * 60 + start.m;
  const endM = end.h * 60 + end.m;
  if (startM <= endM) return nowM >= startM && nowM <= endM;
  return nowM >= startM || nowM <= endM; // über Mitternacht
}
function isWithinDateWindow(validDates) {
  if (!validDates) return true;
  const { from, to } = validDates;
  const now = new Date();
  if (from && now < new Date(from)) return false;
  if (to && now > new Date(to)) return false;
  return true;
}
function weekdayMatch(weekdays) {
  if (!Array.isArray(weekdays) || weekdays.length === 0) return true;
  const jsDay = new Date().getDay(); // 0=So … 6=Sa
  return weekdays.includes(jsDay) || weekdays.includes(((jsDay + 6) % 7) + 1);
}
function interestsMatch(offer, token) {
  if (!offer?.interestsRequired || offer.interestsRequired.length === 0) return true;
  if (!token?.interests || token.interests.length === 0) return false;
  const set = new Set(token.interests);
  return offer.interestsRequired.some((i) => set.has(i));
}

/* ───────── Konfig ───────── */
const INTERVAL_MS = envMs('PUSH_POLLER_INTERVAL_MS', 60_000);
const NEW_OFFER_WINDOW_MS = envMs('PUSH_NEW_OFFER_WINDOW_MS', 15 * 60_000);
const LAST_LOCATION_MAX_AGE_MS = envMs('PUSH_LAST_LOCATION_MAX_AGE_MS', 30 * 60_000);
const MAX_DISTANCE_M_DEFAULT = Number(process.env.PUSH_MAX_DISTANCE_M ?? 1500);

let timer = null;

/* ───────── Start/Stop ───────── */
export function startOfferPoller() {
  if (timer) return;

  const DEBUG = process.env.DEBUG_OFFER_POLLER === '1';

  async function doCycle() {
    const t0 = Date.now();
    try {
      const since = new Date(Date.now() - NEW_OFFER_WINDOW_MS);

      // 1) Neu/aktualisierte Offers
      const candidateOffers = await Offer.find({
        $or: [{ createdAt: { $gte: since } }, { updatedAt: { $gte: since } }],
      })
        .select('_id title location radiusMeters radius validDates validTimes weekdays interestsRequired')
        .lean();

      const activeOffers = candidateOffers.filter(
        (o) => isWithinDateWindow(o.validDates) && isWithinTimeWindow(o.validTimes) && weekdayMatch(o.weekdays)
      );

      // 2) Tokens mit frischer Location
      const freshSince = new Date(Date.now() - LAST_LOCATION_MAX_AGE_MS);
      const tokensFresh = await PushToken.find({
        disabled: { $ne: true },
        'lastLocation.coordinates.0': { $exists: true }, // robustere Existenzprüfung
        $or: [
          { lastHeartbeatAt: { $gte: freshSince } }, // falls vorhanden
          { lastSeenAt: { $gte: freshSince } },      // ✔ dein Schema hat das Feld
          { updatedAt: { $gte: freshSince } },       // Fallback
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
        const [lng, lat] = offer?.location?.coordinates || [];
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

        // Radius-Fix: erst radiusMeters, dann radius, sonst Default
        const radiusM = Number(offer.radiusMeters ?? offer.radius ?? MAX_DISTANCE_M_DEFAULT);
        if (DEBUG) console.log(`[offerPoller][debug] offer=${offer._id} using radiusM=${radiusM}`);

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

        const matched = nearTokens.filter((t) => interestsMatch(offer, t));

        if (DEBUG) {
          console.log(
            `[offerPoller][debug] offer=${offer._id} near=${nearTokens.length} matched=${matched.length} radius=${radiusM}`
          );
        }
        if (!matched.length) continue;

        // 4) Spam-Schutz via OfferVisibility
        const vis = await OfferVisibility.find({
          offerId: offer._id,
          deviceTokenId: { $in: matched.map((t) => t._id) },
          status: { $in: ['notified', 'muted', 'seen'] },
        })
          .select('deviceTokenId')
          .lean();

        const already = new Set(vis.map((v) => String(v.deviceTokenId)));
        const toNotify = matched.filter((t) => !already.has(String(t._id)));
        if (DEBUG) console.log(`[offerPoller][debug] offer=${offer._id} toNotify=${toNotify.length}`);
        if (!toNotify.length) continue;

        // 5) Push senden + Visibility setzen
        await sendOffersPushSafe(
          toNotify.map((t) => ({ token: t.token, platform: t.platform })),
          {
            title: offer.title ?? 'Neues Angebot in deiner Nähe',
            body: 'Tippe, um Details zu sehen.',
            data: { type: 'offer', offerId: String(offer._id) },
          }
        );

        const bulk = toNotify.map((t) => ({
          updateOne: {
            filter: { offerId: offer._id, deviceTokenId: t._id },
            update: {
              $setOnInsert: { offerId: offer._id, deviceTokenId: t._id },
              $set: { status: 'notified', remindAt: null, updatedAt: new Date() },
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
