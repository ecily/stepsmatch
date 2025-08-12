// backend/routes/location.js
import express from 'express';
import mongoose from 'mongoose';
import Offer from '../models/Offer.js';

// Neu: Push-Utility + DeviceToken
import { sendOffersPushAsync } from '../utils/push.js';
import DeviceToken from '../models/DeviceToken.js';

const router = express.Router();

/**
 * POST /api/location/geofence-enter
 * Body: { offerId: string, lat: number, lng: number, eventType?: 'enter'|'exit', token?: string }
 *
 * Ablauf (MVP):
 * 1) Angebot laden und Distanz prüfen (Haversine).
 * 2) Wenn "inside": Empfänger ermitteln
 *    - bevorzugt: Body.token (direkter Rück-Push an dieses Gerät)
 *    - sonst: falls Auth vorhanden -> DeviceTokens via userId
 * 3) Push senden (Titel/Body/Deep-Link).
 */
router.post('/geofence-enter', async (req, res) => {
  try {
    const { offerId, lat, lng, eventType = 'enter', token: inlineToken } = req.body || {};

    if (!offerId || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ success: false, error: 'offerId, lat, lng erforderlich' });
    }

    if (!mongoose.Types.ObjectId.isValid(offerId)) {
      return res.status(400).json({ success: false, error: 'Ungültige offerId' });
    }

    // Angebot laden (nur benötigte Felder)
    const offer = await Offer.findById(
      offerId,
      'location radius name provider subcategory'
    ).lean();

    if (!offer) {
      return res.status(404).json({ success: false, error: 'Angebot nicht gefunden' });
    }

    const coords = offer?.location?.coordinates; // [lng, lat]
    const radius = offer?.radius || 0;

    if (!Array.isArray(coords) || coords.length !== 2 || radius <= 0) {
      return res.status(422).json({ success: false, error: 'Angebot hat keine gültige Geoposition/Radius' });
    }

    // --- Distanz berechnen (Haversine) ---
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371000; // m
    const dLat = toRad(lat - coords[1]);
    const dLon = toRad(lng - coords[0]);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(coords[1])) * Math.cos(toRad(lat)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceMeters = R * c;

    const inside = distanceMeters <= radius;

    // --- Empfänger bestimmen ---
    let tokens = [];
    if (inlineToken) {
      // Direkt an den vom Client angegebenen Expo Push Token senden
      tokens = [inlineToken];
    } else if (req.user?._id) {
      // Optionaler Weg: alle Tokens des eingeloggten Users (falls Auth aktiv)
      const devices = await DeviceToken.find({ userId: req.user._id, disabled: false }).lean();
      tokens = devices.map((d) => d.token).filter(Boolean);
    }

    // Logging
    console.log(
      '[GEOFENCE_ENTER] offerId=%s inside=%s d=%dm radius=%dm eventType=%s recipients=%d',
      offerId, inside, Math.round(distanceMeters), Math.round(radius), eventType, tokens.length
    );

    // Wenn nicht im Radius oder keine Empfänger -> nur Info zurückgeben, kein Push
    if (!inside || tokens.length === 0) {
      return res.json({
        success: true,
        offerId,
        inside,
        distanceMeters: Math.round(distanceMeters),
        radiusMeters: radius,
        eventType,
        pushSent: false,
        reason: !inside ? 'outside-radius' : 'no-recipients'
      });
    }

    // --- Push aufbauen & senden ---
    const title = 'Angebot in deiner Nähe';
    const body = `${offer.name ?? 'Angebot'} – ${Math.round(distanceMeters)} m entfernt. Tippen für Details.`;
    const url = `/offers/${offerId}`; // expo-router Deep-Link

    const tickets = await sendOffersPushAsync(tokens, {
      title,
      body,
      url,
      channelId: 'offers',
      sound: 'default'
    });

    return res.json({
      success: true,
      offerId,
      inside,
      distanceMeters: Math.round(distanceMeters),
      radiusMeters: radius,
      eventType,
      pushSent: true,
      tickets
    });
  } catch (err) {
    console.error('Fehler bei /location/geofence-enter:', err);
    return res.status(500).json({ success: false, error: 'Serverfehler bei geofence-enter' });
  }
});

export default router;
