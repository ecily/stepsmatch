// backend/server.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import morgan from "morgan";

import connectDB from "./config/db.js";
import offerRoutes from "./routes/offers.js";
import providerRoutes from "./routes/providers.js";
import categoryRoutes from "./routes/categories.js";
import userAuthRoutes from "./routes/userAuth.js";
import uploadRoutes from "./routes/uploads.js";
import matchRoutes from "./routes/match.js";
import pushRoutes from "./routes/push.js";
import locationRoutes from "./routes/location.js";
import testerRoutes from "./routes/testers.js";
import { startOfferPoller } from "./jobs/offerPoller.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

/* ─────────────────────────────────────────────────────────────
   Security & Performance
   ───────────────────────────────────────────────────────────── */
app.use(
  helmet({
    contentSecurityPolicy: false,
    // Wenn du Assets/Bilder cross-origin laden musst:
    // crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(compression());
app.use(morgan("dev"));
app.set("trust proxy", 1);

/* ─────────────────────────────────────────────────────────────
   Body Parser
   ───────────────────────────────────────────────────────────── */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

/* ─────────────────────────────────────────────────────────────
   CORS (saubere Whitelist + ENV-Merge + Validierung)
   ───────────────────────────────────────────────────────────── */
const DEFAULT_ORIGINS = [
  // Prod Frontend (DO Static Site)
  "https://lobster-app-2-68c6f.ondigitalocean.app",
  // API-Domain (Same-Origin in DO)
  "https://lobster-app-ie9a5.ondigitalocean.app",
  // Deine Domain
  "https://www.stepsmatch.com",
  "https://stepsmatch.com",
  // Dev
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:19006", // Expo web/dev
  "http://localhost:8081",  // RN packager
  "http://10.0.0.34:5173",
  "http://10.0.0.34:19006",
  "exp://10.0.0.34:19000",
];

// Hilfsfunktion: ENV-Liste stabil parsen (Kommas/Spaces/Zeilenumbrüche)
function parseEnvOrigins(val) {
  if (!val) return [];
  return val
    .split(/[,\s]+/)               // trennt an Komma, Leerzeichen, Zeilenumbruch
    .map((s) => s.trim())
    .filter(Boolean)
    // nur valide Prefixe erlauben
    .filter((s) => /^https?:\/\/|^exp:\/\//i.test(s));
}

const ALLOWED_ORIGINS = Array.from(
  new Set([...DEFAULT_ORIGINS, ...parseEnvOrigins(process.env.CORS_ORIGINS)])
);

const corsOptions = {
  origin(origin, callback) {
    // Server-zu-Server / curl ohne Origin → erlauben
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS: Origin not allowed: ${origin}`), false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  exposedHeaders: ["Content-Length"],
};

// Preflight zuerst, dann CORS
app.options("*", cors(corsOptions));
app.use(cors(corsOptions));

/* ─────────────────────────────────────────────────────────────
   API-Routen (WICHTIG: vor jedem NDA-/Frontend-Gate!)
   ───────────────────────────────────────────────────────────── */
app.use("/api/users", userAuthRoutes);
app.use("/api/providers", providerRoutes);
app.use("/api/offers", offerRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/match", matchRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/location", locationRoutes);
app.use("/api/uploads", uploadRoutes);

// Tester-Gate Endpunkte (rein API, kein Blocker für /api/**)
app.use("/api/testers", testerRoutes);

// Healthcheck
app.get("/api/ping", (_req, res) => {
  res.status(200).send("pong");
});

/* ─────────────────────────────────────────────────────────────
   Error Handler (einheitliche JSON-Fehler)
   ───────────────────────────────────────────────────────────── */
app.use((err, _req, res, _next) => {
  const status = err.status || 400;
  const message = err.message || "Request failed";
  // CORS-Fehler sauber im Log sichtbar machen
  if (message?.startsWith?.("CORS:")) {
    console.error("[CORS]", message);
  } else {
    console.error("[Error]", message);
  }
  res.status(status).json({ ok: false, error: message });
});

/* ─────────────────────────────────────────────────────────────
   MongoDB & Start
   ───────────────────────────────────────────────────────────── */
connectDB()
  .then(() => {
    // Offer-Poller (serverseitiger 1‑Minuten‑Check für neue/aktualisierte Offers)
    if (process.env.OFFER_POLLER_ENABLED !== "0") {
      startOfferPoller();
    }

    app.listen(PORT, "0.0.0.0", () => {
      const local = `http://localhost:${PORT}`;
      const lan = `http://10.0.0.34:${PORT}`;
      console.log("🚀 Server läuft:");
      console.log(`→ lokal:       ${local}`);
      console.log(`→ im Netzwerk: ${lan}`);
      console.log(`→ Geräte im WLAN erreichen: ${lan}/api`);
      console.log(`NODE_ENV=${process.env.NODE_ENV || "development"}`);
      console.log("CORS erlaubt für:", ALLOWED_ORIGINS.join(", "));
    });
  })
  .catch((err) => {
    console.error("❌ Fehler bei DB-Verbindung:", err);
  });
