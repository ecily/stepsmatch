// backend/routes/location.js
import express from 'express';
import mongoose from 'mongoose';
import Offer from '../models/Offer.js';
import { sendOffersPushAsync } from '../utils/push.js';
import DeviceToken from '../models/DeviceToken.js';

const router = express.Router();

// In-Memory Cooldown (10 min)
const lastPushAt = new Map();
const COOLDOWN_MS = 10 * 60 * 1000;
function shouldSendNow(key) {
  const now = Date.now();
  const last = lastPushAt.get(key) || 0;
  if (now - last >= COOLDOWN_MS) { lastPushAt.set(key, now); return true; }
  return false;
}

router.post('/geofence-enter', async (req, res) => {
  try {
    const { offerId, lat, lng, eventType = 'enter', token: inlineToken } = req.body || {};
    if (!offerId || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ success: false, error: 'offerId, lat, lng erforderlich' });
    }
    if (!mongoose.Types.ObjectId.isValid(offerId)) {
      return res.status(400).json({ success: false, error: 'Ungültige offerId' });
    }

    const offer = await Offer.findById(offerId, 'location radius name').lean();
    if (!offer) return res.status(404).json({ success: false, error: 'Angebot nicht gefunden' });

    const coords = offer?.location?.coordinates; // [lng, lat]
    const radius = offer?.radius || 0;
    if (!Array.isArray(coords) || coords.length !== 2 || radius <= 0) {
      return res.status(422).json({ success: false, error: 'Angebot hat keine gültige Geoposition/Radius' });
    }

    // Haversine
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(lat - coords[1]);
    const dLon = toRad(lng - coords[0]);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(coords[1])) * Math.cos(toRad(lat)) * Math.sin(dLon/2)**2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceMeters = R * c;
    const inside = distanceMeters <= radius;

    let tokens = [];
    let recipientKey = null;
    if (inlineToken) { tokens = [inlineToken]; recipientKey = inlineToken; }
    else if (req.user?._id) {
      const devices = await DeviceToken.find({ userId: req.user._id, disabled: false }).lean();
      tokens = devices.map(d => d.token).filter(Boolean);
      recipientKey = `user:${req.user._id}`;
    }

    if (!inside || tokens.length === 0) {
      return res.json({
        success: true, offerId, inside,
        distanceMeters: Math.round(distanceMeters),
        radiusMeters: radius, eventType,
        pushSent: false, reason: !inside ? 'outside-radius' : 'no-recipients'
      });
    }

    const key = `${recipientKey ?? tokens[0]}::${offerId}`;
    if (!shouldSendNow(key)) {
      return res.json({
        success: true, offerId, inside,
        distanceMeters: Math.round(distanceMeters),
        radiusMeters: radius, eventType,
        pushSent: false, reason: 'cooldown-active'
      });
    }

    // ⬇ WICHTIG: Pfad, den deine App wirklich hat (siehe Sitemap): /offers/[id]
    const url = `/offers/${offerId}`;

    const title = 'Angebot in deiner Nähe';
    const body  = `${offer.name ?? 'Angebot'} – ${Math.round(distanceMeters)} m entfernt. Tippen für Details.`;

    const tickets = await sendOffersPushAsync(tokens, { title, body, url, channelId: 'offers', sound: 'default' });

    return res.json({
      success: true, offerId, inside,
      distanceMeters: Math.round(distanceMeters),
      radiusMeters: radius, eventType,
      pushSent: true, tickets
    });
  } catch (err) {
    console.error('Fehler bei /location/geofence-enter:', err);
    return res.status(500).json({ success: false, error: 'Serverfehler bei geofence-enter' });
  }
});

export default router;
