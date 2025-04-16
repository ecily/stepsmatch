// backend/routes/categories.js
import express from 'express';
import Category from '../models/Category.js';  // Importiere das Category Model

const router = express.Router();

// Route, um Kategorien aus der MongoDB abzurufen
router.get('/', async (req, res) => {
  try {
    // Abrufen der Kategorien aus MongoDB
    const categories = await Category.find();  
    res.json(categories);  // Gibt die Kategorien als JSON zurück
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Fehler beim Abrufen der Kategorien' });
  }
});

export default router;
