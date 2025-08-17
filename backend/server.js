// backend/server.js
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

// Performance / Security (gzip + Headers) – inline
import compression from 'compression';
import helmet from 'helmet';

import connectDB from './config/db.js';
import offerRoutes from './routes/offers.js';
import providerRoutes from './routes/providers.js';
// ❌ entfernt: import authRoutes from './routes/auth.js';
import categoryRoutes from './routes/categories.js';
import userAuthRoutes from './routes/userAuth.js';
import uploadRoutes from './routes/uploads.js';
import matchRoutes from './routes/match.js';

// ⬇️ Push- und Location-Routen
import pushRoutes from './routes/push.js';
import locationRoutes from './routes/location.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ─────────────────────────────────────────────────────────────
// Performance & Security (gzip/Brotli + Security Headers)
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.set('trust proxy', 1);

// Body-Parser (große Payloads erlauben)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// CORS für Web und Mobile Devices
app.use(
  cors({
    origin: function (origin, callback) {
      const allowedOrigins = [
        'http://localhost:5173',
        'http://localhost:19006',
        'http://localhost:8081',
        'http://10.0.0.34:5173',
        'http://10.0.0.34:19006',
        'exp://10.0.0.34:19000',
        'https://lobster-app-ie9a5.ondigitalocean.app',
      ];

      if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
        callback(null, true);
      } else {
        callback(new Error('Nicht erlaubter Ursprung'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  })
);

// Upload-Route separat behandeln (wenn du das trennen willst)
app.use(
  '/api/uploads',
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
  }),
  uploadRoutes
);

// API-Routen
app.use('/api/users', userAuthRoutes); // enthält /register, /login, /push-token, /preferences
app.use('/api/providers', providerRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/match', matchRoutes); // statt /match-check

// Token-Registrierung & Geofencing-Enter
app.use('/api/push', pushRoutes);          // z. B. POST /api/push/register
app.use('/api/location', locationRoutes);  // z. B. POST /api/location/geofence-enter

// Healthcheck
app.get('/api/ping', (req, res) => {
  res.status(200).send('pong');
});

// MongoDB-Verbindung & Serverstart
connectDB()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      const hostLocal = `http://localhost:${PORT}`;
      const hostLan = `http://10.0.0.34:${PORT}`;
      console.log('🚀 Server läuft:');
      console.log(`→ lokal:      ${hostLocal}`);
      console.log(`→ im Netzwerk: ${hostLan}`);
      console.log(`→ Geräte im WLAN erreichen: ${hostLan}/api`);
      console.log(`NODE_ENV=${process.env.NODE_ENV || 'development'}`);
    });
  })
  .catch((err) => {
    console.error('❌ Fehler bei DB-Verbindung:', err);
  });
