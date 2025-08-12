import express from 'express';
import mongoose from 'mongoose';
import Offer from '../models/Offer.js';

const router = express.Router();

/**
 * POST /api/location/geofence-enter
 * Body: { offerId: string, lat: number, lng: number, eventType?: 'enter'|'exit' }
 *
 * Zweck (MVP):
 * - Validiert, dass der User (lat/lng) im Radius des Angebots ist.
 * - Loggt das Event serverseitig.
 * - (Push-Versand folgt im nächsten Schritt – hier bewusst noch kein Versand.)
 */
router.post('/geofence-enter', async (req, res) => {
  try {
    const { offerId, lat, lng, eventType = 'enter' } = req.body || {};

    if (!offerId || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ success: false, error: 'offerId, lat, lng erforderlich' });
    }

    if (!mongoose.Types.ObjectId.isValid(offerId)) {
      return res.status(400).json({ success: false, error: 'Ungültige offerId' });
    }

    // Angebot laden (nur Felder, die wir brauchen)
    const offer = await Offer.findById(
      offerId,
      'location radius name provider subcategory'
    ).lean();

    if (!offer) {
      return res.status(404).json({ success: false, error: 'Angebot nicht gefunden' });
    }

    const coords = offer?.location?.coordinates;
    const radius = offer?.radius || 0;

    if (!Array.isArray(coords) || coords.length !== 2 || radius <= 0) {
      return res.status(422).json({ success: false, error: 'Angebot hat keine gültige Geoposition/Radius' });
    }

    // Distanz prüfen (Haversine, einfache Implementierung)
    // coords = [lng, lat]
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371000; // Erd-Radius (m)
    const dLat = toRad(lat - coords[1]);
    const dLon = toRad(lng - coords[0]);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(coords[1])) * Math.cos(toRad(lat)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceMeters = R * c;

    const inside = distanceMeters <= radius;

    // MVP: Nur Rückmeldung/loggen. (Push folgt im nächsten Schritt.)
    console.log('[GEOFENCE_ENTER] offerId=%s  inside=%s  d=%dm  radius=%dm  eventType=%s',
      offerId, inside, Math.round(distanceMeters), Math.round(radius), eventType);

    return res.json({
      success: true,
      offerId,
      inside,
      distanceMeters: Math.round(distanceMeters),
      radiusMeters: radius,
      eventType
    });
  } catch (err) {
    console.error('Fehler bei /location/geofence-enter:', err);
    return res.status(500).json({ success: false, error: 'Serverfehler bei geofence-enter' });
  }
});

export default router;
