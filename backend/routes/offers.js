import express from 'express';
import Offer from '../models/Offer.js';
import haversine from 'haversine-distance';

const router = express.Router();

// ✅ TEST-ROUTE: Gibt bis zu 3 Angebote zurück
router.get('/test-offers', async (req, res) => {
  try {
    const offers = await Offer.find().limit(3);
    res.json({ success: true, offers });
  } catch (error) {
    console.error('Fehler beim Abrufen:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ GEO-Abfrage ohne Subkategorie-Filter, sortiert nach Distanz
router.get('/nearby', async (req, res) => {
  const { lat, lng, categories } = req.query;  // Kein "radius" mehr hier

  try {
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Fehlende Parameter: lat oder lng' });  // Nur lat und lng benötigt
    }

    const userLocation = {
      lat: parseFloat(lat),
      lng: parseFloat(lng),
    };

    // 🔧 Kategorien-Filter: immer als Array behandeln
    let filterCategories = [];
    if (categories) {
      filterCategories = Array.isArray(categories)
        ? categories
        : [categories];
    }

    console.log('🎯 Abfrage: Kategorien (Filter):', filterCategories);  // Log zum Überprüfen der Kategorien

    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // z. B. "14:30"
    const currentDay = now.toLocaleDateString('de-DE', { weekday: 'long' }); // z. B. "Montag"

    // MongoDB-Suche (Ort ohne Subkategorie)
    const roughOffers = await Offer.find({
      location: {
        $geoWithin: {
          $centerSphere: [[userLocation.lng, userLocation.lat], 3963.2],  // Radius wird nicht mehr verwendet
        },
      },
    }).populate('provider');

    console.log('🎯 Roh-Angebote:', roughOffers.length); // Log zum Überprüfen der gefilterten Angebote

    // Zusätzliche Prüfungen: Distanz, Zeit und Gültigkeit
    const filtered = roughOffers
      .map((offer) => {
        const coords = {
          lat: offer.location.coordinates[1],
          lng: offer.location.coordinates[0],
        };
        const distance = haversine(userLocation, coords);  // Berechnet die Distanz zu jedem Angebot

        const validDates = offer.validDates || {};
        const validTimes = offer.validTimes || {};
        const validDays = offer.validDays || [];

        const fromDate = new Date(validDates.from);
        const toDate = new Date(validDates.to);
        const isInDateRange = now >= fromDate && now <= toDate;

        const isValidDay = validDays.includes(currentDay);
        const isValidTime =
          (!validTimes.from || !validTimes.to) ||
          (currentTime >= validTimes.from && currentTime <= validTimes.to);

        const isDistanceValid = distance <= offer.radius;  // Nur die Distanz des Angebots wird hier verwendet

        const isValid = isInDateRange && isValidDay && isValidTime && isDistanceValid;

        return isValid ? { offer, distance } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.distance - b.distance)  // Sortiere nach Distanz
      .map((entry) => entry.offer);

    console.log('🎯 Gefilterte und sortierte Angebote:', filtered.length);  // Log zum Überprüfen der endgültigen gefilterten Ergebnisse

    res.json(filtered);
  } catch (err) {
    console.error('Fehler beim Abrufen der Angebote:', err);
    res.status(500).json({ error: 'Fehler beim Abrufen der Angebote' });
  }
});

// Neues Angebot speichern
router.post('/', async (req, res) => {
  try {
    const offer = new Offer(req.body);
    const saved = await offer.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Alle Angebote abrufen
router.get('/', async (req, res) => {
  try {
    const offers = await Offer.find();
    res.json(offers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Alle Angebote eines Providers
router.get('/provider/:providerId', async (req, res) => {
  try {
    const offers = await Offer.find({ provider: req.params.providerId });
    res.json(offers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Laden der Angebote.' });
  }
});

// GET ein bestimmtes Angebot nach ID
router.get('/:id', async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({ error: 'Angebot nicht gefunden' });
    }
    res.json(offer);
  } catch (error) {
    console.error('Fehler beim Abrufen eines Angebots:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// PUT: Angebot aktualisieren
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

// DELETE: Angebot löschen
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

export default router;
