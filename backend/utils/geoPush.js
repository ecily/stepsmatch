// backend/utils/geoPush.js
import mongoose from 'mongoose';
import PushToken from '../models/PushToken.js';
import OfferVisibility from '../models/OfferVisibility.js';
import { sendPushAndCheckReceipts } from './push.js'; // robust mit Receipts/Retry/Disable
import { isOfferActiveNow } from './isOfferActiveNow.js';

/* ────────────────────────────────────────────────────────────
   ENV / Defaults
   ──────────────────────────────────────────────────────────── */
const PROJECT_ID =
  process.env.EXPO_PROJECT_ID ||
  process.env.EXPO_PROJECT ||
  process.env.PROJECT_ID ||
  null;

const PUSH_CHANNEL_ID = process.env.PUSH_CHANNEL_ID || 'offers';
const PUSH_PRIORITY   = process.env.PUSH_PRIORITY   || 'high';
const PUSH_SOUND      = process.env.PUSH_SOUND      || 'default';

// Standort-Freshness (Standard 10 Min)
const LAST_LOCATION_MAX_AGE_MS = Number(process.env.PUSH_LAST_LOCATION_MAX_AGE_MS || 10 * 60_000);

// ➕ globale/individuelle Accuracy-Puffer (analog zum Poller)
const ACCURACY_BUFFER_MAX = Number(process.env.PUSH_ACCURACY_BUFFER_MAX ?? 15); // m
const ACCURACY_TOKEN_CAP  = Number(process.env.PUSH_ACCURACY_TOKEN_CAP  ?? 60); // m
const SEARCH_BUFFER       = Math.max(ACCURACY_BUFFER_MAX, ACCURACY_TOKEN_CAP);

// Re-Notify nach Offer-Update erlauben? (Default: ON)
const OFFER_NOTIFY_RESET_ON_UPDATE = !['0', 'false', 'off'].includes(
  String(process.env.OFFER_NOTIFY_RESET_ON_UPDATE ?? '1').toLowerCase()
);

/* ────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────── */
function toRad(d) { return (d * Math.PI) / 180; }
function haversineMeters(lng1, lat1, lng2, lat2) {
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

/* ────────────────────────────────────────────────────────────
   Sofort-Push an Tokens in Radius (mit Freshness, Accuracy-Puffer,
   OfferVisibility-Dedupe und robusten Expo-Receipts).
   ──────────────────────────────────────────────────────────── */
export async function sendPushToNearbyTokensForOffer(offer, { now = new Date() } = {}) {
  try {
    // 0) Sanity: Geo & Radius & Zeitfenster
    const coords = offer?.location?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) {
      return { ok: false, reason: 'offer-has-no-geo' };
    }
    const [lng, lat] = coords.map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { ok: false, reason: 'offer-geo-invalid' };
    }
    const baseRadiusM = Number(offer.radius ?? offer.radiusMeters ?? 0);
    if (!(baseRadiusM > 0)) return { ok: false, reason: 'offer-has-no-radius' };

    if (!isOfferActiveNow(offer, 'Europe/Vienna', now)) {
      return { ok: false, reason: 'offer-not-active' };
    }

    // 1) Frische Tokens (Project-Scope + Freshness)
    const freshSince = new Date(now.getTime() - LAST_LOCATION_MAX_AGE_MS);
    const tokenQuery = {
      disabled: { $ne: true },
      'lastLocation.coordinates.0': { $exists: true },
      $or: [
        { lastHeartbeatAt: { $gte: freshSince } },
        { lastSeenAt:      { $gte: freshSince } },
        { updatedAt:       { $gte: freshSince } },
      ],
    };
    if (PROJECT_ID) tokenQuery.projectId = PROJECT_ID;

    const freshTokens = await PushToken.find(tokenQuery)
      .select('_id token platform interests lastLocation projectId deviceId lastLocationAccuracy')
      .lean();

    if (!freshTokens.length) {
      return { ok: true, total: 0, tried: 0, sent: 0, skipped: 0, reason: 'no-fresh-tokens' };
    }

    // 2) Vorselektion per $near mit großzügigem Suchpuffer
    const searchRadiusM = Math.max(1, baseRadiusM + SEARCH_BUFFER);
    const nearDocs = await PushToken.find({
      _id: { $in: freshTokens.map((t) => t._id) },
      lastLocation: {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: searchRadiusM,
        },
      },
    })
      .select('_id token platform interests lastLocation lastLocationAccuracy')
      .lean();

    if (!nearDocs.length) {
      return { ok: true, total: 0, tried: 0, sent: 0, skipped: 0, reason: 'no-near-tokens' };
    }

    // 3) Interests-Filter
    let matched = nearDocs.filter((t) => interestsMatch(offer, t));
    if (!matched.length) {
      return { ok: true, total: nearDocs.length, tried: 0, sent: 0, skipped: nearDocs.length, reason: 'interests-no-match' };
    }

    // 4) Nachfilter (exakte Haversine + per-Token Accuracy-Cap)
    matched = matched.filter((t) => {
      const [tlng, tlat] = (t?.lastLocation?.coordinates || []);
      if (!Number.isFinite(tlng) || !Number.isFinite(tlat)) return false;
      const acc = Number(t?.lastLocationAccuracy);
      const capAcc = Number.isFinite(acc) && acc > 0 ? Math.min(acc, ACCURACY_TOKEN_CAP) : 0;
      const effForToken = baseRadiusM + capAcc;
      const d = haversineMeters(lng, lat, tlng, tlat);
      return d <= effForToken;
    });

    if (!matched.length) {
      return { ok: true, total: nearDocs.length, tried: 0, sent: 0, skipped: nearDocs.length, reason: 'outside-after-accuracy' };
    }

    // 5) OfferVisibility-Dedupe
    const cutoff = OFFER_NOTIFY_RESET_ON_UPDATE
      ? new Date(offer?.updatedAt || offer?.createdAt || 0)
      : new Date(0);

    const vis = await OfferVisibility.find({
      offerId: offer._id,
      deviceToken: { $in: matched.map((t) => t._id) },
      $or: [
        { status: 'snoozed', remindAt: { $gt: now } }, // Snooze aktiv → block
        { status: { $in: ['notified', 'dismissed'] }, lastNotifiedAt: { $gte: cutoff } }, // schon nach letztem Update benachrichtigt/weggewischt
      ],
    })
      .select('deviceToken status remindAt lastNotifiedAt')
      .lean();

    const already = new Set(vis.map((v) => String(v.deviceToken)));
    const toNotifyDocs = matched.filter((t) => !already.has(String(t._id)));

    if (!toNotifyDocs.length) {
      return { ok: true, total: matched.length, tried: 0, sent: 0, skipped: matched.length, reason: 'dedup' };
    }

    // 6) Push senden (robust)
    const tokens = toNotifyDocs.map((t) => t.token).filter(Boolean);
    if (!tokens.length) {
      return { ok: true, total: toNotifyDocs.length, tried: 0, sent: 0, skipped: toNotifyDocs.length, reason: 'no-pushable-tokens' };
    }

    const title = offer.name || 'Angebot in deiner Nähe';
    const body = 'Tippe, um Details zu sehen.';
    const data = {
      type: 'offer',
      offerId: String(offer._id),
      route: `/offers/${offer._id}`,
      source: 'offer-update',
    };

    const diag = await sendPushAndCheckReceipts({
      tokens,
      title,
      body,
      data,
      channelId: PUSH_CHANNEL_ID,
      priority: PUSH_PRIORITY,
      sound: PUSH_SOUND,
      delayMs: 2500,
    });

    // 7) Welche Tokens „ok“?
    const sentTokens = [];
    const tickets = Array.isArray(diag?.sent?.tickets) ? diag.sent.tickets : [];
    const idToToken = diag?.sent?.idToToken || {};
    for (const t of tickets) {
      if (t?.status === 'ok' && t?.id && idToToken[t.id]) {
        sentTokens.push(idToToken[t.id]);
      }
    }

    // 8) OfferVisibility auf „notified“ setzen
    if (sentTokens.length) {
      const sentDocs = await PushToken.find({ token: { $in: sentTokens } }, { _id: 1, token: 1 }).lean();
      const byToken = new Map(sentDocs.map((d) => [d.token, d._id]));
      const nowIso = new Date();
      const bulk = sentTokens
        .map((tok) => {
          const deviceTokenId = byToken.get(tok);
          if (!deviceTokenId) return null;
          return {
            updateOne: {
              filter: { offerId: offer._id, deviceToken: deviceTokenId },
              update: {
                $setOnInsert: { offerId: offer._id, deviceToken: deviceTokenId, firstSeenAt: nowIso },
                $set: { status: 'notified', remindAt: null, lastNotifiedAt: nowIso, updatedAt: nowIso },
              },
              upsert: true,
            },
          };
        })
        .filter(Boolean);
      if (bulk.length) await OfferVisibility.bulkWrite(bulk);
    }

    // 9) Tokens ggf. deaktivieren
    const disabledCount = Array.isArray(diag?.disabledTokens) ? diag.disabledTokens.length : 0;
    if (disabledCount > 0) {
      await PushToken.updateMany({ token: { $in: diag.disabledTokens } }, { $set: { disabled: true } });
    }

    const summary = diag?.receipts?.summary || {};
    console.log(
      `[geoPush] offer=${offer._id} fresh=${freshTokens.length} near=${nearDocs.length} ` +
      `matched=${matched.length} tried=${tokens.length} sentOk=${sentTokens.length} ` +
      `disabled=${disabledCount} receipts=${JSON.stringify(summary)}${
        diag?.retry && diag.retry.count > 0 ? ` retry=${JSON.stringify(diag.retry)}` : ''
      }`
    );

    return {
      ok: true,
      total: matched.length,
      tried: tokens.length,
      sent: sentTokens.length,
      skipped: matched.length - sentTokens.length,
      receipts: summary,
    };
  } catch (e) {
    console.error('[geoPush] error:', e?.message || e, e?.stack || '');
    return { ok: false, error: String(e?.message || e) };
  }
}
