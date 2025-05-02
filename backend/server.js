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
import uploadRoutes from './routes/uploads.js';
import pushTokenRoutes from './routes/pushTokens.js'; // ✅ NEU

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// ✅ Middleware für große Payloads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ✅ CORS für Web und Mobile Devices
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:5173',    // Web-Frontend lokal
      'http://localhost:19006',   // Expo Go
      'http://localhost:8081',    // Android Emulator
      'http://10.0.0.34:5173',   // Web-Frontend im Netzwerk
      'http://10.0.0.34:19006',  // Expo Go im Netzwerk
      'exp://10.0.0.34:19000',   // Expo Dev Client
      'https://lobster-app-ie9a5.ondigitalocean.app', // Deine aktuelle Live-URL
    ];

    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Nicht erlaubter Ursprung'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// Cloudinary Uploads
app.use('/api/uploads', cors({
  origin: 'http://localhost:5173',
  credentials: true,
}), uploadRoutes);

// ✅ API-Routen
app.use('/api/auth', authRoutes);
app.use('/api/providers', providerRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/users', userAuthRoutes);
app.use('/api/push-token', pushTokenRoutes); // ✅ NEU

// ✅ Neu: Ping-Route für Serverstatus
app.get('/api/ping', (req, res) => {
  res.status(200).send('pong');
});

// ✅ MongoDB-Verbindung & Serverstart
connectDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 Server läuft auf:');
    console.log(`→ lokal:     http://localhost:${PORT}`);
    console.log(`→ im Netzwerk: http://10.0.0.34:${PORT}`);
    console.log(`→ alle Geräte im WLAN sollten http://10.0.0.34:${PORT}/api erreichen können`);
  });
});
