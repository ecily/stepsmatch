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

// ✅ GEO-Abfrage ohne Standortfilter, zeigt alle Angebote an
router.get('/nearby', async (req, res) => {
  try {
    // Alle Angebote ohne Filter zurückgeben
    const offers = await Offer.find().populate('provider');
    
    console.log('🎯 Alle Angebote:', offers.length);

    // Gibt alle Angebote zurück, ohne weitere Filter anzuwenden
    res.json(offers);
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
