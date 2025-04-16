// backend/routes/categories.js
import express from 'express';
import Offer from '../models/Offer.js';  // Stelle sicher, dass das Offer-Modell importiert wird

const router = express.Router();

// Route, um alle Kategorien aus der Datenbank zu holen
router.get('/', async (req, res) => {
  try {
    // Verwenden von MongoDB Aggregate, um alle Kategorien zu extrahieren und Duplikate zu eliminieren
    const categories = await Offer.aggregate([
      {
        $group: {
          _id: null,
          categories: { $addToSet: "$category" }  // Fügt alle einzigartigen Kategorien in einem Array hinzu
        }
      },
      {
        $project: { _id: 0, categories: 1 }  // Entfernt die _id aus der Antwort
      }
    ]);

    if (!categories || categories.length === 0) {
      return res.status(404).json({ message: "Keine Kategorien gefunden" });
    }

    // Gibt die konsolidierte Liste der Kategorien zurück
    res.json(categories[0].categories);
  } catch (error) {
    console.error("Fehler beim Abrufen der Kategorien:", error);
    res.status(500).json({ message: "Fehler beim Abrufen der Kategorien" });
  }
});

export default router;
