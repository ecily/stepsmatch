// /controllers/matchController.js
import User from '../models/User.js';
import Offer from '../models/Offer.js';
import NotificationLog from '../models/NotificationLog.js';
import sendPushNotification from '../utils/sendPushNotification.js';
import haversine from 'haversine-distance';
import moment from 'moment';

export const checkForMatchingOffers = async (req, res) => {
  console.log('📥 Match-Check gestartet mit:', req.body);

  try {
    const { userId, location } = req.body;
    if (!userId || !location) {
      return res.status(400).json({ message: 'userId und location erforderlich' });
    }

    const user = await User.findById(userId);
    if (!user || !user.expoPushToken) {
      return res.status(404).json({ message: 'User oder Push-Token nicht gefunden' });
    }

    const userInterests = user.interests || [];
    const maxRadius = user.preferredRadius || 500;

    const offers = await Offer.find({
      category: { $in: userInterests },
      'location.coordinates': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [location.lng, location.lat]
          },
          $maxDistance: maxRadius
        }
      }
    });

    const now = moment();
    const weekday = now.format('dddd');

    let sent = 0;

    for (const offer of offers) {
      // 🔒 Zeitlich gültig?
      const { validDates, validDays, validTimes } = offer;

      if (
        !validDays.includes(weekday) ||
        !now.isBetween(moment(validDates.from), moment(validDates.to).endOf('day')) ||
        !isWithinTimeRange(validTimes.start, validTimes.end, now)
      ) {
        continue;
      }

      const alreadyNotified = await NotificationLog.findOne({
        userId,
        offerId: offer._id,
        date: { $gte: moment().startOf('day').toDate() }
      });

      if (alreadyNotified) continue;

      await sendPushNotification(user.expoPushToken, {
        title: `🎯 Neues Angebot: ${offer.name}`,
        body: offer.description || 'Jetzt in deiner Nähe aktiv!',
        data: { offerId: offer._id }
      });

      await NotificationLog.create({
        userId,
        offerId: offer._id,
        date: new Date()
      });

      sent++;
    }

    res.json({ message: `✅ ${sent} Notification(s) gesendet.` });
  } catch (err) {
    console.error('❌ Match-Check Fehler:', err);
    res.status(500).json({ message: 'Serverfehler beim Matching.' });
  }
};

// ⏱️ Hilfsfunktion zur Zeitprüfung
function isWithinTimeRange(startTime, endTime, now) {
  const format = 'HH:mm';
  const start = moment(startTime, format);
  const end = moment(endTime, format);
  return now.isBetween(start, end);
}
