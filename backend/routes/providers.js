// C:\Users\Lenovo\stepsmatch\backend\routes\providers.js
import express from 'express';
import mongoose from 'mongoose';
import Provider from '../models/Provider.js';

const { Types } = mongoose;
const router = express.Router();

/** Helper: Teil-Update aus Request-Body bauen */
function buildUpdate(body = {}) {
  const update = {};

  if (typeof body.name === 'string') update.name = body.name;
  if (typeof body.category === 'string') update.category = body.category;
  if (typeof body.description === 'string') update.description = body.description;
  if (typeof body.contact === 'string') update.contact = body.contact;
  if (typeof body.address === 'string') update.address = body.address;

  if (body.location?.coordinates?.length === 2) {
    const [lng, lat] = body.location.coordinates;
    const lngNum = Number(lng);
    const latNum = Number(lat);
    if (Number.isFinite(lngNum) && Number.isFinite(latNum)) {
      update.location = {
        type: 'Point',
        coordinates: [lngNum, latNum], // GeoJSON: [lng, lat]
      };
    }
  }

  if (body.radiusMeters !== undefined) {
    const r = Number(body.radiusMeters);
    if (Number.isFinite(r)) update.radiusMeters = r;
  }

  return update;
}

/** GET /api/providers – alle Anbieter abrufen (z. B. für Expo Go Test) */
router.get('/', async (_req, res) => {
  try {
    const providers = await Provider.find();
    res.json(providers);
  } catch (err) {
    console.error('❌ Fehler beim Laden der Anbieter:', err);
    res.status(500).json({ error: 'Serverfehler beim Abrufen der Anbieter' });
  }
});

/** POST /api/providers – Anbieter anlegen */
router.post('/', async (req, res) => {
  console.log('📥 POST /providers payload:', req.body);

  try {
    const { name, category, location, address, description, contact, user, radiusMeters } = req.body;

    // Pflichtfelder prüfen
    if (!name || !category || !location || !address || !user) {
      console.warn('❌ Fehlende Pflichtfelder beim Anbieter anlegen');
      return res.status(400).json({ error: 'Fehlende Pflichtfelder' });
    }

    // Koordinaten validieren
    const coords = location?.coordinates;
    if (!Array.isArray(coords) || coords.length !== 2) {
      return res.status(400).json({ error: 'Ungültige Location-Koordinaten' });
    }
    const [lng, lat] = coords.map(Number);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return res.status(400).json({ error: 'Ungültige Location-Koordinaten (NaN)' });
    }

    const doc = new Provider({
      name,
      category,
      location: { type: 'Point', coordinates: [lng, lat] },
      address,
      description,
      contact,
      user,
      ...(radiusMeters !== undefined ? { radiusMeters: Number(radiusMeters) } : {}),
    });

    await doc.save();
    console.log('✅ Anbieter erfolgreich gespeichert:', doc._id);
    res.status(201).json(doc);
  } catch (error) {
    console.error('❌ Fehler beim Anlegen des Anbieters:', error);
    res.status(400).json({ error: 'Fehler beim Anlegen des Anbieters.' });
  }
});

/**
 * Wichtig: Reihenfolge beachten!
 * /user/:userId MUSS VOR /:id stehen, sonst fängt /:id "user" ab.
 */

/** GET /api/providers/user/:userId – Anbieter per Benutzer ermitteln */
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const provider = await Provider.findOne({ user: userId });
    if (!provider) {
      return res.status(404).json({ error: 'Anbieter nicht gefunden' });
    }
    res.json(provider);
  } catch (err) {
    console.error('❌ Fehler beim Laden per userId:', err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

/** GET /api/providers/:id – Anbieter nach ID abrufen */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Ungültige ID' });

    const provider = await Provider.findById(id);
    if (!provider) return res.status(404).json({ error: 'Anbieter nicht gefunden' });
    res.json(provider);
  } catch (err) {
    console.error('❌ Fehler beim Laden des Anbieters:', err);
    res.status(500).json({ error: 'Fehler beim Abrufen des Anbieters' });
  }
});

/** PATCH /api/providers/:id – Teil-Update */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Ungültige ID' });

    const update = buildUpdate(req.body);
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'Keine gültigen Felder zum Aktualisieren' });
    }

    const doc = await Provider.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });

    if (!doc) return res.status(404).json({ error: 'Anbieter nicht gefunden' });
    res.json(doc);
  } catch (e) {
    console.error('❌ [PATCH /providers/:id] Fehler:', e);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Anbieters' });
  }
});

/** PUT /api/providers/:id – Ersatz-/Upsert-freies Update (nur vorhandene) */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Ungültige ID' });

    const update = buildUpdate(req.body);
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'Keine gültigen Felder zum Aktualisieren' });
    }

    const doc = await Provider.findByIdAndUpdate(id, update, {
      new: true,
      upsert: false,
      runValidators: true,
    });

    if (!doc) return res.status(404).json({ error: 'Anbieter nicht gefunden' });
    res.json(doc);
  } catch (e) {
    console.error('❌ [PUT /providers/:id] Fehler:', e);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Anbieters' });
  }
});

export default router;
