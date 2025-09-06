// backend/server.js
import 'dotenv/config'; // ✅ ENV früh laden
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import morgan from 'morgan';

import connectDB from './config/db.js';
import offerRoutes from './routes/offers.js';
import providerRoutes from './routes/providers.js';
import categoryRoutes from './routes/categories.js';
import userAuthRoutes from './routes/userAuth.js';
import uploadRoutes from './routes/uploads.js';
import matchRoutes from './routes/match.js';
import pushRoutes from './routes/push.js';
import locationRoutes from './routes/location.js';
import testerRoutes from './routes/testers.js';
import { startOfferPoller, stopOfferPoller } from './jobs/offerPoller.js';

const app = express();
const PORT = Number(process.env.PORT) || 8080;

/* ─────────────────────────────────────────────────────────────
   Security & Performance
   ───────────────────────────────────────────────────────────── */
app.disable('x-powered-by');
app.use(
  helmet({
    contentSecurityPolicy: false,
    // crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(compression());
app.use(morgan('dev'));
app.set('trust proxy', 1);

/* ─────────────────────────────────────────────────────────────
   Body Parser
   ───────────────────────────────────────────────────────────── */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

/* ─────────────────────────────────────────────────────────────
   CORS (Whitelist + ENV-Merge)
   ───────────────────────────────────────────────────────────── */
const DEFAULT_ORIGINS = [
  // Prod Frontend (DO Static Site)
  'https://lobster-app-2-68c6f.ondigitalocean.app',
  // API-Domain (Same-Origin in DO)
  'https://lobster-app-ie9a5.ondigitalocean.app',
  // Deine Domain
  'https://www.stepsmatch.com',
  'https://stepsmatch.com',
  // Dev
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:19006', // Expo web/dev
  'http://localhost:8081',  // RN packager
  'http://10.0.0.34:5173',
  'http://10.0.0.34:19006',
  'exp://10.0.0.34:19000',
];

function parseEnvOrigins(val) {
  if (!val) return [];
  return val
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => /^https?:\/\/|^exp:\/\//i.test(s));
}

const ALLOWED_ORIGINS = Array.from(
  new Set([...DEFAULT_ORIGINS, ...parseEnvOrigins(process.env.CORS_ORIGINS)])
);

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true); // Server-zu-Server / curl / natives Gerät
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS: Origin not allowed: ${origin}`), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length'],
  optionsSuccessStatus: 204,
};

// Preflight zuerst, dann CORS
app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

/* ─────────────────────────────────────────────────────────────
   API-Routen
   ───────────────────────────────────────────────────────────── */
app.use('/api/users', userAuthRoutes);
app.use('/api/providers', providerRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/match', matchRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/testers', testerRoutes);

// Healthchecks
app.get('/api/ping', (_req, res) => res.status(200).send('pong'));
app.get('/api/_healthz', (_req, res) => res.json({ ok: true }));
app.get('/api/_readyz', (_req, res) => res.json({ ok: true }));

/* ─────────────────────────────────────────────────────────────
   404 & Error Handler (einheitliche JSON-Fehler)
   ───────────────────────────────────────────────────────────── */
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ ok: false, error: 'not_found' });
  }
  next();
});

app.use((err, _req, res, _next) => {
  const status = err.status || 400;
  const message = err.message || 'Request failed';
  if (message?.startsWith?.('CORS:')) {
    console.error('[CORS]', message);
  } else {
    console.error('[Error]', message);
  }
  res.status(status).json({ ok: false, error: message });
});

/* ─────────────────────────────────────────────────────────────
   MongoDB & Start
   ───────────────────────────────────────────────────────────── */
let serverInstance = null;

connectDB()
  .then(() => {
    const pollerDisabled = process.env.OFFER_POLLER_ENABLED === '0';
    console.log(
      `[startup] OFFER_POLLER_ENABLED=${pollerDisabled ? '0 (disabled)' : '1 (enabled)'}`
    );
    if (!pollerDisabled) {
      startOfferPoller();
    }

    serverInstance = app.listen(PORT, '0.0.0.0', () => {
      const local = `http://localhost:${PORT}`;
      const lan = `http://10.0.0.34:${PORT}`;
      console.log('🚀 Server läuft:');
      console.log(`→ lokal:       ${local}`);
      console.log(`→ im Netzwerk: ${lan}`);
      console.log(`→ Geräte im WLAN erreichen: ${lan}/api`);
      console.log(`NODE_ENV=${process.env.NODE_ENV || 'development'}`);
      console.log('CORS erlaubt für:', ALLOWED_ORIGINS.join(', '));
    });
  })
  .catch((err) => {
    console.error('❌ Fehler bei DB-Verbindung:', err);
    process.exitCode = 1;
  });

/* ─────────────────────────────────────────────────────────────
   Graceful Shutdown
   ───────────────────────────────────────────────────────────── */
async function shutdown(signal = 'SIGTERM') {
  console.log(`[shutdown] ${signal} received → shutting down…`);
  try {
    stopOfferPoller?.();
  } catch {}
  try {
    await new Promise((resolve) =>
      serverInstance ? serverInstance.close(resolve) : resolve()
    );
  } catch {}
  try {
    await (await import('mongoose')).default.connection.close();
  } catch {}
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
