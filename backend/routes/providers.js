import express from 'express';
import Provider from '../models/Provider.js';

const router = express.Router();

// GET /api/providers – alle Anbieter abrufen (z. B. für Expo Go Test)
router.get('/', async (req, res) => {
  try {
    const providers = await Provider.find();
    res.json(providers);
  } catch (err) {
    console.error('❌ Fehler beim Laden der Anbieter:', err);
    res.status(500).json({ error: 'Serverfehler beim Abrufen der Anbieter' });
  }
});

// Anbieter anlegen
router.post('/', async (req, res) => {
  console.log('📥 POST /providers payload:', req.body); // Logging des Eingangs

  try {
    const { name, category, location, address, description, contact, user } = req.body;

    // Pflichtfelder prüfen
    if (!name || !category || !location || !address || !user) {
      console.warn('❌ Fehlende Pflichtfelder beim Anbieter anlegen');
      return res.status(400).json({ error: 'Fehlende Pflichtfelder' });
    }

    const newProvider = new Provider({
      name,
      category,
      location,
      address,
      description,
      contact,
      user
    });

    await newProvider.save();
    console.log('✅ Anbieter erfolgreich gespeichert:', newProvider);
    res.status(201).json(newProvider);
  } catch (error) {
    console.error('❌ Fehler beim Anlegen des Anbieters:', error);
    res.status(400).json({ error: 'Fehler beim Anlegen des Anbieters.' });
  }
});

// Anbieter nach ID abrufen
// GET /api/providers/:id
router.get('/:id', async (req, res) => {
  try {
    const provider = await Provider.findById(req.params.id);
    if (!provider) return res.status(404).json({ error: 'Anbieter nicht gefunden' });
    res.json(provider);
  } catch (err) {
    console.error('❌ Fehler beim Laden des Anbieters:', err);
    res.status(500).json({ error: 'Fehler beim Abrufen des Anbieters' });
  }
});

// GET /api/providers/user/:userId
router.get('/user/:userId', async (req, res) => {
  try {
    const provider = await Provider.findOne({ user: req.params.userId });
    if (!provider) {
      return res.status(404).json({ error: 'Anbieter nicht gefunden' });
    }
    res.json(provider);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

export default router;
