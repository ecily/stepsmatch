// backend/server.js
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';

import connectDB from './config/db.js';
import offerRoutes from './routes/offers.js';
import providerRoutes from './routes/providers.js';
import authRoutes from './routes/auth.js';
import categoryRoutes from './routes/categories.js';  // Importiere die Kategorie-Routen

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// ✅ Middleware für größere Payloads (z. B. bei Bild-Uploads)
app.use(express.json({ limit: '50mb' }));  // Erhöht das Payload-Limit auf 50MB
app.use(express.urlencoded({ limit: '50mb', extended: true }));  // Auch für URL-kodierte Daten

// Middleware für CORS und Parsing
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

// ✅ Routen
app.use('/api/auth', authRoutes);
app.use('/api/providers', providerRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/categories', categoryRoutes);  // Stelle sicher, dass die Kategorie-Routen eingebunden sind

// Verbindungsaufbau zur DB und Server starten
connectDB().then(() => {
  app.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT}`));
});
