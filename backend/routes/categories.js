// backend/routes/categories.js
import express from 'express';

const router = express.Router();

// 🔒 Statisch definierte Kategorienstruktur mit Subkategorien
const categories = [
  {
    category: "🏨 Beherbergung",
    subcategories: [
      "Hotel", "Boutique-Hotel", "Wellness-Hotel", "Pension", "Gästehaus",
      "Privatzimmer", "AirBnB", "Hostel", "Tiny House", "Hausboot", "Kloster"
    ]
  },
  {
    category: "🍽️ Essen & Trinken",
    subcategories: [
      "Restaurant (Vegan)", "Restaurant (Vegetarisch)", "Restaurant (Italienisch)", "Restaurant (Asiatisch)",
      "Café", "Bar", "Pub", "Imbiss", "Street Food", "Bäckerei"
    ]
  },
  {
    category: "🛍️ Shopping & Services",
    subcategories: [
      "Mode (Damen)", "Mode (Herren)", "Schuhe", "Second Hand",
      "Friseur", "Kosmetik", "Massage", "Reparatur", "Reinigung", "Copyshop", "Drogerie", "Apotheke"
    ]
  },
  {
    category: "🎭 Kultur & Freizeit",
    subcategories: [
      "Museum", "Galerie", "Sehenswürdigkeit", "Führung", "Konzert",
      "Markt", "Vortrag", "Meetup", "Park", "Spielplatz"
    ]
  },
  {
    category: "👨‍👩‍👧 Familie & Kinder",
    subcategories: [
      "Kinderlokale", "Indoor-Spielplatz", "Flohmarkt", "Second-Hand", "Familienfreundliche Orte"
    ]
  },
  {
    category: "ℹ️ Info & Hilfe",
    subcategories: [
      "Stadtinfo", "Öffentliche Toiletten", "Trinkwasserstelle", "WLAN",
      "Wärmestube", "Caritas", "Notruf", "Beratung"
    ]
  },
  {
    category: "🎯 Sonderaktionen",
    subcategories: [
      "Aktionen", "Rabatte", "Pop-Ups", "Tagesangebote", "Restposten"
    ]
  }
];

// GET /api/categories – gibt alle Kategorien + Subkategorien zurück
router.get('/', (req, res) => {
  res.json(categories);
});

export default router;
