import express from 'express';
import Offer from '../models/Offer.js';
import haversine from 'haversine-distance';

const router = express.Router();

// ✅ TEST-ROUTE: Gibt bis zu 3 Angebote zurück (ohne Bilder)
router.get('/test-offers', async (req, res) => {
  try {
    const offers = await Offer.find().limit(3);
    const sanitized = offers.map(({ _id, name, description, category, subcategory, location, radius, validDays, validTimes, validDates }) => ({
      _id, name, description, category, subcategory, location, radius, validDays, validTimes, validDates
    }));
    res.json({ success: true, offers: sanitized });
  } catch (error) {
    console.error('Fehler beim Abrufen:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ GEO-Abfrage mit Interessenfilter (ohne Bilder)
router.post('/nearby', async (req, res) => {
  try {
    const { lat, lng, interests } = req.body;

    if (!lat || !lng || !interests || !Array.isArray(interests)) {
      return res.status(400).json({ error: 'Ungültige Parameter' });
    }

    const allOffers = await Offer.find().populate('provider');
    const userLocation = { lat, lng };
    const normalizedInterests = interests.map((i) => i.toLowerCase().trim());

    const filtered = allOffers.filter((offer) => {
      const coords = offer.location?.coordinates;
      const subcategory = offer.subcategory;
      if (!coords || coords.length !== 2 || !subcategory || !offer.radius) return false;
      const distance = haversine(userLocation, { lat: coords[1], lng: coords[0] });
      return distance <= offer.radius && normalizedInterests.includes(subcategory.toLowerCase().trim());
    });

    const sanitized = filtered.map(({ _id, name, description, category, subcategory, location, radius, validDays, validTimes, validDates }) => ({
      _id, name, description, category, subcategory, location, radius, validDays, validTimes, validDates
    }));

    console.log(`📍 Gefundene Angebote: ${sanitized.length}`);
    res.json(sanitized);
  } catch (err) {
    console.error('Fehler bei Nearby-Abfrage:', err);
    res.status(500).json({ error: 'Serverfehler bei Nearby-Abfrage' });
  }
});

// 🔓 Öffentliche Nearby-Route ohne Interessenfilter (ohne Bilder)
router.post('/nearby-noauth', async (req, res) => {
  try {
    const { lat, lng } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Ungültige Parameter' });
    }

    const allOffers = await Offer.find().populate('provider');
    const userLocation = { lat, lng };

    const filtered = allOffers.filter((offer) => {
      const coords = offer.location?.coordinates;
      if (!coords || coords.length !== 2 || !offer.radius) return false;
      const distance = haversine(userLocation, { lat: coords[1], lng: coords[0] });
      return distance <= offer.radius;
    });

    const sanitized = filtered.map(({ _id, name, description, category, subcategory, location, radius, validDays, validTimes, validDates }) => ({
      _id, name, description, category, subcategory, location, radius, validDays, validTimes, validDates
    }));

    console.log(`🆓 Öffentliche Nearby-Angebote: ${sanitized.length}`);
    res.json(sanitized);
  } catch (err) {
    console.error('Fehler bei Nearby-NoAuth-Abfrage:', err);
    res.status(500).json({ error: 'Serverfehler bei Nearby-NoAuth' });
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

// ✅ Alle Angebote abrufen (ohne Bilder)
router.get('/', async (req, res) => {
  try {
    const offers = await Offer.find();
    const sanitized = offers.map(({ _id, name, description, category, subcategory, location, radius, validDays, validTimes, validDates }) => ({
      _id, name, description, category, subcategory, location, radius, validDays, validTimes, validDates
    }));
    res.json(sanitized);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Alle Angebote eines Providers (ohne Bilder)
router.get('/provider/:providerId', async (req, res) => {
  try {
    const offers = await Offer.find({ provider: req.params.providerId });
    const sanitized = offers.map(({ _id, name, description, category, subcategory, location, radius, validDays, validTimes, validDates }) => ({
      _id, name, description, category, subcategory, location, radius, validDays, validTimes, validDates
    }));
    res.json(sanitized);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Laden der Angebote.' });
  }
});

// ✅ Einzelnes Angebot mit Bildern
router.get('/:id', async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({ error: 'Angebot nicht gefunden' });
    }
    res.json(offer); // enthält Bilder
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

export default router;
