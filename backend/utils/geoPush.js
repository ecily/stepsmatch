// backend/utils/geoPush.js
import PushToken from '../models/PushToken.js';
import OfferVisibility from '../models/OfferVisibility.js';
import { sendOffersPushSafe } from './push.js';

/**
 * Sendet sofort Pushes an alle Tokens, deren lastKnownLocation innerhalb des Offer-Radius liegt.
 * Respektiert OfferVisibility.shouldNotify / markNotified.
 */
export async function sendPushToNearbyTokensForOffer(offer, { now = new Date() } = {}) {
  try {
    if (!offer?.location?.coordinates || !Array.isArray(offer.location.coordinates)) {
      return { ok: false, reason: 'offer-has-no-geo' };
    }
    const [lng, lat] = offer.location.coordinates;
    const radiusM = Number(offer.radius || 0);
    if (!(radiusM > 0)) return { ok: false, reason: 'offer-has-no-radius' };

    // Kandidaten im Radius (max. 1000)
    const tokens = await PushToken.find({
      disabled: { $ne: true },
      lastKnownLocation: {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: radiusM
        }
      }
    }, { _id: 1, token: 1, platform: 1, disabled: 1 }).limit(1000).lean();

    if (!tokens.length) return { ok: true, total: 0, sent: 0, skipped: 0 };

    const title = 'Angebot in deiner Nähe';
    const body  = `${offer.name ?? 'Angebot'} – tippen für Details.`;
    const url   = `/offers/${offer._id}`;

    let total = 0, sent = 0, skipped = 0;

    for (const dt of tokens) {
      total++;
      if (!dt?._id || dt.disabled) { skipped++; continue; }

      const may = await OfferVisibility.shouldNotify(dt._id, offer._id, now);
      if (!may) { skipped++; continue; }

      const meta = await sendOffersPushSafe([{ token: dt.token, platform: dt.platform }], {
        title, body, url, channelId: 'offers', sound: 'default',
        data: { offerId: String(offer._id) }
      });

      const delivered = (meta?.sent || 0) > 0;
      if (delivered) {
        await OfferVisibility.markNotified(dt._id, offer._id, now);
        sent++;
      } else {
        skipped++;
      }
    }

    return { ok: true, total, sent, skipped };
  } catch (e) {
    console.error('[geoPush] error:', e);
    return { ok: false, error: String(e) };
  }
}
