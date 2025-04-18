// backend/server.js
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';

import connectDB from './config/db.js';
import offerRoutes from './routes/offers.js';
import providerRoutes from './routes/providers.js';
import authRoutes from './routes/auth.js';
import categoryRoutes from './routes/categories.js'; // ✅ Kategorien-Routen importieren
import userAuthRoutes from './routes/userAuth.js';


dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// ✅ Middleware für große Payloads (z. B. Bilder)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ✅ CORS freischalten für Frontend (Web & Mobile)
app.use(cors({
  origin: [
    'http://localhost:5173',    // React Web Frontend (Vite)
    'http://localhost:19006',   // Expo Go (React Native)
    'http://localhost:8081'     // Alternativer Dev-Client (z. B. Emulator)
  ],
  credentials: true
}));

// ✅ API-Routen
app.use('/api/auth', authRoutes);
app.use('/api/providers', providerRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/categories', categoryRoutes); // 🆕 Kategorien-Routen verfügbar
app.use('/api/users', userAuthRoutes); // 🆕 Mobile App Auth (User)


// ✅ MongoDB-Verbindung & Serverstart
connectDB().then(() => {
  app.listen(PORT, () =>
    console.log(`🚀 Server läuft auf http://localhost:${PORT}`)
  );
});
