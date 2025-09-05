// backend/utils/geoPush.js
import PushToken from '../models/PushToken.js';
import OfferVisibility from '../models/OfferVisibility.js';
import { sendOffersPushSafe } from './push.js';
import { isOfferActiveNow } from './isOfferActiveNow.js';

// Environment / Defaults
const PROJECT_ID =
  process.env.EXPO_PROJECT_ID ||
  process.env.EXPO_PROJECT ||
  process.env.PROJECT_ID ||
  null;

// Sanity-Puffer (Meter), um GPS-Flattern zu berücksichtigen
const SANITY_BUFFER_M = (() => {
  const n = Number(process.env.PUSH_SANITY_BUFFER_M ?? 12);
  return Number.isFinite(n) && n >= 0 ? n : 12;
})();

/**
 * Sendet sofort Pushes an alle Tokens, deren lastLocation innerhalb des Offer-Radius liegt.
 * Respektiert OfferVisibility.shouldNotify / markNotified und isOfferActiveNow (Europe/Vienna).
 */
export async function sendPushToNearbyTokensForOffer(offer, { now = new Date() } = {}) {
  try {
    // 0) Offer-Geo vorhanden?
    if (!offer?.location?.coordinates || !Array.isArray(offer.location.coordinates)) {
      return { ok: false, reason: 'offer-has-no-geo' };
    }
    const [lng, lat] = offer.location.coordinates;
    const radiusM = Number(offer.radius || 0);
    if (!(radiusM > 0)) return { ok: false, reason: 'offer-has-no-radius' };

    // 1) Aktivitätscheck strikt in Europe/Vienna
    if (!isOfferActiveNow(offer, 'Europe/Vienna', now)) {
      return { ok: true, total: 0, sent: 0, skipped: 0, reason: 'offer-inactive-now' };
    }

    const maxDistance = Math.max(0, radiusM + SANITY_BUFFER_M);

    // 2) Kandidaten im (Radius + Puffer), optional mit projectId-Filter
    const baseQuery = {
      disabled: { $ne: true },
      lastLocation: {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: maxDistance,
        },
      },
    };
    if (PROJECT_ID) {
      baseQuery.projectId = PROJECT_ID;
    }

    const candidates = await PushToken.find(
      baseQuery,
      { _id: 1, token: 1, platform: 1, disabled: 1, deviceId: 1, projectId: 1 }
    )
      .limit(1000)
      .lean();

    if (!candidates.length) {
      return {
        ok: true,
        total: 0,
        sent: 0,
        skipped: 0,
        meta: { projectScoped: Boolean(PROJECT_ID), maxDistance },
      };
    }

    // 3) Cooldown / Dedupe via OfferVisibility.shouldNotify
    const eligible = [];
    let cooldownSkips = 0;

    for (const t of candidates) {
      const may = await OfferVisibility.shouldNotify(t._id, offer._id, now);
      if (may) eligible.push(t);
      else cooldownSkips++;
    }

    if (!eligible.length) {
      return {
        ok: true,
        total: candidates.length,
        sent: 0,
        skipped: candidates.length,
        meta: { projectScoped: Boolean(PROJECT_ID), maxDistance, cooldownSkips },
      };
    }

    // 4) Versand (ein Request mit allen Tokens) – sendOffersPushSafe erwartet { tokens: [...] }
    const tokens = eligible.map((e) => e.token);
    const title = 'Angebot in deiner Nähe';
    const body = `${offer.name ?? 'Angebot'} – tippen für Details.`;
    const payload = { offerId: String(offer._id), route: `/offers/${offer._id}`, source: 'geoPush' };

    const resp = await sendOffersPushSafe({
      tokens,
      title,
      body,
      data: payload,
      channelId: 'offers',
      sound: 'default',
      priority: 'high',
    });

    // 5) Markiere alle adressierten als "notified" (wir gehen davon aus, dass der Send-Versuch erfolgt ist)
    // Optional: Man könnte Tickets/Receipts auswerten und nur "ok" markieren – hier minimal-invasiv und robust.
    const markOps = eligible.map((t) => OfferVisibility.markNotified(t._id, offer._id, now));
    await Promise.allSettled(markOps);

    const total = candidates.length;
    const sent = resp?.sent || 0; // Anzahl Adressen, an das Gateway geschickt
    const skipped = total - eligible.length + 0 /* evtl. weitere Filter später */;

    // 6) Summary
    return {
      ok: true,
      total,
      sent,
      skipped,
      meta: {
        projectScoped: Boolean(PROJECT_ID),
        maxDistance,
        cooldownSkips,
        okCount: resp?.okCount ?? 0,
        errors: resp?.errors ?? [],
      },
    };
  } catch (e) {
    console.error('[geoPush] error:', e);
    return { ok: false, error: String(e) };
  }
}

export default { sendPushToNearbyTokensForOffer };
