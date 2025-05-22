// backend/routes/categories.js
import express from 'express';
import Category from '../models/Category.js';

const router = express.Router();

// 📥 GET /api/categories – alle Kategorien
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find();
    res.json(categories);
  } catch (err) {
    console.error('Fehler beim Laden der Kategorien:', err);
    res.status(500).json({ error: 'Serverfehler beim Laden der Kategorien' });
  }
});

// ➕ POST /api/categories – neue Kategorie anlegen
router.post('/', async (req, res) => {
  try {
    const { name, subcategories } = req.body;

    const existing = await Category.findOne({ name });
    if (existing) {
      return res.status(400).json({ error: 'Kategorie existiert bereits' });
    }

    const newCategory = new Category({
      name,
      subcategories: subcategories || [],
    });

    await newCategory.save();
    res.status(201).json(newCategory);
  } catch (err) {
    console.error('Fehler beim Erstellen der Kategorie:', err);
    res.status(500).json({ error: 'Serverfehler beim Erstellen' });
  }
});

// ✏️ PUT /api/categories/:id – Kategorie aktualisieren
router.put('/:id', async (req, res) => {
  try {
    const { name, subcategories } = req.body;

    const updated = await Category.findByIdAndUpdate(
      req.params.id,
      { name, subcategories },
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: 'Kategorie nicht gefunden' });

    res.json(updated);
  } catch (err) {
    console.error('Fehler beim Aktualisieren der Kategorie:', err);
    res.status(500).json({ error: 'Serverfehler beim Aktualisieren' });
  }
});

// ❌ DELETE /api/categories/:id – Kategorie löschen
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Category.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Kategorie nicht gefunden' });

    res.json({ success: true, message: 'Kategorie gelöscht' });
  } catch (err) {
    console.error('Fehler beim Löschen der Kategorie:', err);
    res.status(500).json({ error: 'Serverfehler beim Löschen' });
  }
});

export default router;
