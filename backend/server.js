// backend/server.js
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';

import connectDB from './config/db.js';
import offerRoutes from './routes/offers.js';
import providerRoutes from './routes/providers.js';
import authRoutes from './routes/auth.js';
import categoryRoutes from './routes/categories.js';
import userAuthRoutes from './routes/userAuth.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// ✅ Middleware für große Payloads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ✅ CORS freischalten für Web & Mobile
app.use(cors({
  origin: [
    'http://localhost:5173',    // React Web
    'http://localhost:19006',   // Expo Go
    'http://localhost:8081'     // Android Emulator
  ],
  credentials: true
}));

// ✅ API-Routen
app.use('/api/auth', authRoutes);
app.use('/api/providers', providerRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/users', userAuthRoutes);

// ✅ MongoDB-Verbindung & Serverstart
connectDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server läuft auf:`);
    console.log(`→ lokal: http://localhost:${PORT}`);
    console.log(`→ im Netzwerk: http://10.0.0.34:${PORT}`);
  });
});
