// backend/utils/geoPush.js
import mongoose from 'mongoose';
import PushToken from '../models/PushToken.js';
import OfferVisibility from '../models/OfferVisibility.js';
import { sendPushAndCheckReceipts } from './push.js'; // robuste Variante mit Receipts
import { isOfferActiveNow } from './isOfferActiveNow.js';

// ENV / Defaults
const PROJECT_ID =
  process.env.EXPO_PROJECT_ID ||
  process.env.EXPO_PROJECT ||
  process.env.PROJECT_ID ||
  null;

const PUSH_CHANNEL_ID = process.env.PUSH_CHANNEL_ID || 'offers';
const PUSH_PRIORITY   = process.env.PUSH_PRIORITY   || 'high';
const PUSH_SOUND      = process.env.PUSH_SOUND      || 'default';

// Standort-Freshness (Standard 10 Min wie in routes/offers.js)
const LAST_LOCATION_MAX_AGE_MS = Number(process.env.PUSH_LAST_LOCATION_MAX_AGE_MS || 10 * 60_000);

// Re-Notify nach Offer-Update erlauben? (Default: ON)
const OFFER_NOTIFY_RESET_ON_UPDATE = !['0','false','off'].includes(
  String(process.env.OFFER_NOTIFY_RESET_ON_UPDATE ?? '1').toLowerCase()
);

/**
 * Sofort-Push an alle Tokens im Offer-Radius (mit Freshness, Project-Scope,
 * dedupe vs. OfferVisibility inkl. Re-Notify nach offer.updatedAt).
 */
export async function sendPushToNearbyTokensForOffer(offer, { now = new Date() } = {}) {
  try {
    // Sanity: gültig und zeitlich aktiv?
    if (!offer?.location?.coordinates || !Array.isArray(offer.location.coordinates)) {
      return { ok: false, reason: 'offer-has-no-geo' };
    }
    const [lng, lat] = offer.location.coordinates.map(Number);
    const radiusM = Number(offer.radius ?? offer.radiusMeters ?? 0);
    if (!(radiusM > 0)) return { ok: false, reason: 'offer-has-no-radius' };
    if (!isOfferActiveNow(offer, 'Europe/Vienna', now)) {
      return { ok: false, reason: 'offer-not-active' };
    }

    // 1) Frische Tokens einschränken (Project-Scope + Freshness)
    const freshSince = new Date(now.getTime() - LAST_LOCATION_MAX_AGE_MS);
    const tokenQuery = {
      disabled: { $ne: true },
      'lastLocation.coordinates.0': { $exists: true }, // ⚠️ korrektes Feld (nicht lastKnownLocation)
      $or: [
        { lastHeartbeatAt: { $gte: freshSince } },
        { lastSeenAt:      { $gte: freshSince } },
        { updatedAt:       { $gte: freshSince } },
      ],
    };
    if (PROJECT_ID) tokenQuery.projectId = PROJECT_ID;

    const fresh = await PushToken.find(tokenQuery)
      .select('_id token platform lastLocation projectId deviceId lastLocationAccuracy')
      .lean();
    if (!fresh.length) return { ok: true, total: 0, tried: 0, sent: 0, skipped: 0, reason: 'no-fresh-tokens' };

    // 2) Geo-$near im Radius
    const near = await PushToken.find({
      _id: { $in: fresh.map(t => t._id) },
      lastLocation: {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: radiusM,
        },
      },
    }).select('_id token platform').lean();

    if (!near.length) return { ok: true, total: 0, tried: 0, sent: 0, skipped: 0, reason: 'no-near-tokens' };

    // 3) Dedupe: Snooze respektieren; notified/dismissed nur blocken, wenn NACH Offer-Update
    const cutoff = OFFER_NOTIFY_RESET_ON_UPDATE
      ? new Date(offer?.updatedAt || offer?.createdAt || 0)
      : new Date(0);

    const vis = await OfferVisibility.find({
      offerId: offer._id,
      deviceToken: { $in: near.map(t => t._id) },
      $or: [
        { status: 'snoozed', remindAt: { $gt: now } },
        { status: { $in: ['notified', 'dismissed'] }, lastNotifiedAt: { $gte: cutoff } },
      ],
    }).select('deviceToken status remindAt lastNotifiedAt').lean();

    const already = new Set(vis.map(v => String(v.deviceToken)));
    const toNotifyDocs = near.filter(t => !already.has(String(t._id)));
    if (!toNotifyDocs.length) {
      return { ok: true, total: near.length, tried: 0, sent: 0, skipped: near.length, reason: 'dedup' };
    }

    // 4) Push senden (robust, mit Receipts)
    const tokens = toNotifyDocs.map(t => t.token).filter(Boolean);
    const title = offer.name || 'Angebot in deiner Nähe';
    const body  = 'Tippe, um Details zu sehen.';
    const data  = { type: 'offer', offerId: String(offer._id), route: `/offers/${offer._id}`, source: 'offer-update' };

    const diag = await sendPushAndCheckReceipts({
      tokens,
      title,
      body,
      data,
      channelId: PUSH_CHANNEL_ID,
      priority:  PUSH_PRIORITY,
      sound:     PUSH_SOUND,
      delayMs:   2500,
    });

    // 5) Welche token haben „ok“?
    const sentTokens = [];
    const tickets = Array.isArray(diag?.sent?.tickets) ? diag.sent.tickets : [];
    const idToToken = diag?.sent?.idToToken || {};
    for (const t of tickets) {
      if (t?.status === 'ok' && t?.id && idToToken[t.id]) {
        sentTokens.push(idToToken[t.id]);
      }
    }

    // 6) OfferVisibility auf „notified“ setzen
    if (sentTokens.length) {
      const sentDocs = await PushToken.find({ token: { $in: sentTokens } }, { _id: 1, token: 1 }).lean();
      const byToken = new Map(sentDocs.map(d => [d.token, d._id]));
      const nowIso = new Date();
      const bulk = sentTokens.map(tok => {
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
      }).filter(Boolean);
      if (bulk.length) await OfferVisibility.bulkWrite(bulk);
    }

    const summary = diag?.receipts?.summary || {};
    console.log(
      `[geoPush] offer=${offer._id} near=${near.length} tried=${tokens.length} sentOk=${sentTokens.length} ` +
      `receipts=${JSON.stringify(summary)}${diag?.retry && diag.retry.count > 0 ? ` retry=${JSON.stringify(diag.retry)}` : ''}`
    );

    return { ok: true, total: near.length, tried: tokens.length, sent: sentTokens.length, skipped: near.length - toNotifyDocs.length };
  } catch (e) {
    console.error('[geoPush] error:', e);
    return { ok: false, error: String(e?.message || e) };
  }
}
