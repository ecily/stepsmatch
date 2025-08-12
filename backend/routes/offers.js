import express from 'express';
import Offer from '../models/Offer.js';
import haversine from 'haversine-distance';
import cloudinary from '../utils/cloudinary.js';

const router = express.Router();

// ✅ TEST-ROUTE: Gibt bis zu 3 Angebote (mit Bildern)
router.get('/test-offers', async (req, res) => {
  try {
    const offers = await Offer.find(
      {},
      'name description category subcategory location radius validDays validTimes validDates provider images'
    ).limit(3);
    res.json({ success: true, offers });
  } catch (error) {
    console.error('Fehler beim Abrufen:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ GEO-Abfrage mit Interessenfilter (mit Bildern)
router.post('/nearby', async (req, res) => {
  try {
    const { lat, lng, interests } = req.body;

    if (!lat || !lng || !interests || !Array.isArray(interests)) {
      return res.status(400).json({ error: 'Ungültige Parameter' });
    }

    const allOffers = await Offer.find(
      {},
      'name description category subcategory location radius validDays validTimes validDates provider images'
    );
    const userLocation = { lat, lng };
    const normalizedInterests = interests.map((i) => i.toLowerCase().trim());

    const filtered = allOffers.filter((offer) => {
      const coords = offer.location?.coordinates;
      const subcategory = offer.subcategory;
      if (!coords || coords.length !== 2 || !subcategory || !offer.radius) return false;
      const distance = haversine(userLocation, { lat: coords[1], lng: coords[0] });
      return distance <= offer.radius && normalizedInterests.includes(subcategory.toLowerCase().trim());
    });

    res.json(filtered);
  } catch (err) {
    console.error('Fehler bei Nearby-Abfrage:', err);
    res.status(500).json({ error: 'Serverfehler bei Nearby-Abfrage' });
  }
});

// ✅ Öffentliche Nearby-Route ohne Interessenfilter (mit Bildern)
router.post('/nearby-noauth', async (req, res) => {
  try {
    const { lat, lng } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Ungültige Parameter' });
    }

    const allOffers = await Offer.find(
      {},
      'name description category subcategory location radius validDays validTimes validDates provider images'
    );
    const userLocation = { lat, lng };

    const filtered = allOffers.filter((offer) => {
      const coords = offer.location?.coordinates;
      if (!coords || coords.length !== 2 || !offer.radius) return false;
      const distance = haversine(userLocation, { lat: coords[1], lng: coords[0] });
      return distance <= offer.radius;
    });

    res.json(filtered);
  } catch (err) {
    console.error('Fehler bei Nearby-NoAuth-Abfrage:', err);
    res.status(500).json({ error: 'Serverfehler bei Nearby-NoAuth' });
  }
});

/**
 * ✅ Leichtgewichtige Nearby-Route für Geofencing (nur Koordinaten + Radius)
 *    Nutzung: GET /offers/nearby-geofence?lat=47.0707&lng=15.4395&limit=50&maxDistance=5000
 *    Response: { success, count, geofences: [{ offerId, latitude, longitude, radiusMeters, distanceMeters }] }
 *
 *    - Primär nutzt $geoNear (setzt 2dsphere-Index auf Offer.location voraus).
 *    - Fällt automatisch auf Node-Haversine zurück, wenn Aggregation nicht verfügbar ist.
 *    - Liefert nur die minimal nötigen Felder, damit der Client Geofences registrieren kann.
 */
router.get('/nearby-geofence', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 100); // hard cap 100
    const maxDistance = parseInt(req.query.maxDistance || '5000', 10);  // Meter

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ success: false, error: 'Ungültige Parameter: lat/lng erforderlich' });
    }

    // 1) Schneller Weg: $geoNear Aggregation
    try {
      const rows = await Offer.aggregate([
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [lng, lat] },
            distanceField: 'distanceMeters',
            spherical: true,
            maxDistance: maxDistance
          }
        },
        // Nur Felder für Geofencing projizieren
        {
          $project: {
            _id: 1,
            radiusMeters: '$radius',
            distanceMeters: 1,
            longitude: { $arrayElemAt: ['$location.coordinates', 0] },
            latitude:  { $arrayElemAt: ['$location.coordinates', 1] }
          }
        },
        // Nur vollständige Datensätze
        {
          $match: {
            radiusMeters: { $gt: 0 },
            latitude: { $type: 'number' },
            longitude: { $type: 'number' }
          }
        },
        { $sort: { distanceMeters: 1 } },
        { $limit: limit }
      ]);

      const geofences = rows.map(r => ({
        offerId: String(r._id),
        latitude: r.latitude,
        longitude: r.longitude,
        radiusMeters: r.radiusMeters,
        distanceMeters: Math.round(r.distanceMeters ?? 0)
      }));

      return res.json({ success: true, geofences, count: geofences.length });
    } catch (aggErr) {
      // 2) Fallback: Node.js Haversine (langsamer, aber robust)
      console.warn('nearby-geofence: $geoNear nicht verfügbar, Fallback auf Node-Berechnung:', aggErr?.message);
      const allOffers = await Offer.find({}, 'location radius').lean();
      const userLoc = { lat, lng };

      const filtered = allOffers
        .filter(o => Array.isArray(o?.location?.coordinates) && o.location.coordinates.length === 2 && o.radius > 0)
        .map(o => {
          const [olng, olat] = o.location.coordinates;
          const distance = haversine(userLoc, { lat: olat, lng: olng }); // Meter
          return {
            offerId: String(o._id),
            latitude: olat,
            longitude: olng,
            radiusMeters: o.radius,
            distanceMeters: distance
          };
        })
        .filter(r => r.distanceMeters <= maxDistance)
        .sort((a, b) => a.distanceMeters - b.distanceMeters)
        .slice(0, limit);

      return res.json({ success: true, geofences: filtered, count: filtered.length });
    }
  } catch (err) {
    console.error('Fehler bei /offers/nearby-geofence:', err);
    res.status(500).json({ success: false, error: 'Serverfehler bei nearby-geofence' });
  }
});

// ✅ Neues Angebot speichern
router.post('/', async (req, res) => {
  try {
    const offer = new Offer(req.body);
    const saved = await offer.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ✅ Alle Angebote abrufen (mit Bildern)
router.get('/', async (req, res) => {
  try {
    const offers = await Offer.find(
      {},
      'name description category subcategory location radius validDays validTimes validDates images'
    );
    res.json(offers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Alle Angebote eines Providers (mit Bildern)
router.get('/provider/:providerId', async (req, res) => {
  try {
    const offers = await Offer.find(
      { provider: req.params.providerId },
      'name description category subcategory location radius validDays validTimes validDates images'
    );
    res.json(offers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Laden der Angebote.' });
  }
});

// ✅ Einzelnes Angebot (mit Bildern)
router.get('/:id', async (req, res) => {
  try {
    const offer = await Offer.findById(
      req.params.id,
      'name description category subcategory location radius validDays validTimes validDates provider images'
    );
    if (!offer) {
      return res.status(404).json({ error: 'Angebot nicht gefunden' });
    }
    res.json(offer); // Antwort enthält nun auch die 'images'
  } catch (error) {
    console.error('Fehler beim Abrufen eines Angebots:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ✅ Angebot aktualisieren
router.put('/:id', async (req, res) => {
  try {
    const updatedOffer = await Offer.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updatedOffer) {
      return res.status(404).json({ error: 'Angebot nicht gefunden' });
    }

    res.json(updatedOffer);
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Angebots:', error);
    res.status(400).json({ error: 'Fehler beim Aktualisieren des Angebots' });
  }
});

// ✅ Angebot löschen
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Offer.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Angebot nicht gefunden' });
    }
    res.json({ message: 'Angebot gelöscht' });
  } catch (error) {
    console.error('Fehler beim Löschen:', error);
    res.status(500).json({ error: 'Serverfehler beim Löschen' });
  }
});

// ✅ Ziel erreicht Counter
router.post('/found/:id', async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({ error: 'Angebot nicht gefunden' });
    }
    offer.foundCounter = (offer.foundCounter || 0) + 1;
    await offer.save();
    res.json({ success: true, foundCounter: offer.foundCounter });
  } catch (error) {
    console.error('Fehler beim Hochzählen des foundCounters:', error);
    res.status(500).json({ error: 'Serverfehler beim Hochzählen des Counters' });
  }
});

export default router;
