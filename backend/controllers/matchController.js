import moment from 'moment';
import User from '../models/User.js';
import Offer from '../models/Offer.js';
import NotificationLog from '../models/NotificationLog.js';
import sendPushNotification from '../utils/sendPushNotification.js';
import { buildPushEligibleOfferMatch, isOfferMatchableForPush } from '../utils/offerPolicy.js';
import {
  NEARBY_ATTENTION_CHANNEL_CONFIG,
  NEARBY_ATTENTION_CHANNEL_ID,
  NEARBY_ATTENTION_CHANNEL_VERSION,
} from '../utils/notificationChannels.js';

function distanceMeters(lng1, lat1, lng2, lat2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export const checkForMatchingOffers = async (req, res) => {
  console.log('[match] check started', req.body);

  try {
    const { userId, location } = req.body;
    if (!userId || !location?.lat || !location?.lng) {
      return res.status(400).json({ message: 'userId und vollstaendige location erforderlich' });
    }

    const user = await User.findById(userId);
    if (!user || !user.expoPushToken) {
      return res.status(404).json({ message: 'User oder Push-Token nicht gefunden' });
    }

    const userInterests = user.interests || [];
    const maxRadius = user.preferredRadius || 500;

    const offers = await Offer.find({
      ...buildPushEligibleOfferMatch(),
      subcategory: { $in: userInterests },
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [location.lng, location.lat],
          },
          $maxDistance: maxRadius,
        },
      },
    });

    const now = moment();

    for (const offer of offers) {
      const coords = offer?.location?.coordinates || [];
      const [offerLng, offerLat] = coords.map(Number);
      const distance = Number.isFinite(offerLng) && Number.isFinite(offerLat)
        ? distanceMeters(location.lng, location.lat, offerLng, offerLat)
        : Infinity;

      if (!isOfferMatchableForPush(offer, { now: now.toDate(), timeZone: 'Europe/Vienna', distanceMeters: distance })) {
        console.log(`[match] offer skipped by policy offer=${offer._id}`);
        continue;
      }

      const alreadyNotified = await NotificationLog.findOne({
        userId,
        offerId: offer._id,
        date: { $gte: moment().startOf('day').toDate() },
      });

      if (alreadyNotified) {
        console.log(`[match] already notified offer=${offer._id}`);
        continue;
      }

      const payload = {
        title: offer.name || 'Angebot in deiner Naehe',
        body: offer.description || 'Tippe, um Details zu sehen.',
        channelId: NEARBY_ATTENTION_CHANNEL_ID,
        sound: 'default',
        priority: 'high',
        data: {
          screen: 'OfferDetails',
          offerId: offer._id.toString(),
          channelId: NEARBY_ATTENTION_CHANNEL_ID,
          channelVersion: NEARBY_ATTENTION_CHANNEL_VERSION,
          channelConfig: NEARBY_ATTENTION_CHANNEL_CONFIG,
        },
      };

      console.log(
        `[notify] strongNearby channel=${NEARBY_ATTENTION_CHANNEL_ID} version=${NEARBY_ATTENTION_CHANNEL_VERSION} ` +
          `source=matchController reason=matching-offer offer=${offer._id}`
      );

      const result = await sendPushNotification(user.expoPushToken, payload);
      console.log('[match] push result:', result);

      await NotificationLog.create({
        userId,
        offerId: offer._id,
        date: new Date(),
      });

      return res.json({
        message: `Notification: ${offer.name}`,
        offerId: offer._id.toString(),
      });
    }

    return res.json({ message: 'Keine passenden Angebote im Radius & Zeitfenster gefunden.' });
  } catch (err) {
    console.error('[match] check failed:', err);
    return res.status(500).json({ message: 'Serverfehler beim Matching.' });
  }
};
