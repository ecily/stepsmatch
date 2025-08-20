// backend/server.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";

// Performance / Security
import compression from "compression";
import helmet from "helmet";

import connectDB from "./config/db.js";
import offerRoutes from "./routes/offers.js";
import providerRoutes from "./routes/providers.js";
import categoryRoutes from "./routes/categories.js";
import userAuthRoutes from "./routes/userAuth.js";
import uploadRoutes from "./routes/uploads.js";
import matchRoutes from "./routes/match.js";
import pushRoutes from "./routes/push.js";
import locationRoutes from "./routes/location.js";

// ✅ NEU: Tester-Gate (Validate + Accept)
import testerRoutes from "./routes/testers.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

/* ─────────────────────────────────────────────────────────────
   Performance & Security
   ───────────────────────────────────────────────────────────── */
app.use(
  helmet({
    contentSecurityPolicy: false,
    // Falls du Bilder/Assets cross-origin laden willst und Probleme siehst:
    // crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(compression());
app.set("trust proxy", 1);

/* ─────────────────────────────────────────────────────────────
   Body-Parser
   ───────────────────────────────────────────────────────────── */
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

/* ─────────────────────────────────────────────────────────────
   CORS (Web & Mobile) — EINHEITLICH und VOR ALLEN ROUTERN
   ───────────────────────────────────────────────────────────── */
const ALLOWED_ORIGINS = [
  // Prod Frontend (DO Static Site)
  "https://lobster-app-2-68c6f.ondigitalocean.app",
  // API-Domain selbst (für Same-Origin-Fälle in DO)
  "https://lobster-app-ie9a5.ondigitalocean.app",
  // ✅ Deine Domain (beide Varianten!)
  "https://www.stepsmatch.com",
  "https://stepsmatch.com",
  // Dev
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:19006", // Expo web/dev
  "http://localhost:8081",  // React Native packager
  "http://10.0.0.34:5173",
  "http://10.0.0.34:19006",
  "exp://10.0.0.34:19000",
];


// Optional weitere Origins über ENV erlauben (kommagetrennt)
if (process.env.CORS_ORIGINS) {
  for (const o of process.env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)) {
    if (!ALLOWED_ORIGINS.includes(o)) ALLOWED_ORIGINS.push(o);
  }
}

const corsOptions = {
  origin(origin, callback) {
    // Bei Server-zu-Server oder Curl ohne Origin: erlauben
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error("CORS: Origin not allowed: " + origin), false);
  },
  credentials: true, // wichtig, falls axios/fetch mit Cookies arbeitet
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  exposedHeaders: ["Content-Length"],
};

// Preflight global & mit gleichen Optionen beantworten
app.options("*", cors(corsOptions));
app.use(cors(corsOptions));

/* ─────────────────────────────────────────────────────────────
   API-Routen
   ───────────────────────────────────────────────────────────── */
// WICHTIG: Keine separaten, konkurrierenden CORS-Middlewares mehr
// für /api/uploads — globale CORS-Regeln greifen bereits.
app.use("/api/users", userAuthRoutes);       // /register, /login, /push-token, /preferences
app.use("/api/providers", providerRoutes);
app.use("/api/offers", offerRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/match", matchRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/location", locationRoutes);
app.use("/api/uploads", uploadRoutes);

// ✅ NEU: Tester-Gate Endpunkte
//  • POST /api/testers/validate
//  • POST /api/testers/accept
app.use("/api/testers", testerRoutes);

// Healthcheck
app.get("/api/ping", (req, res) => {
  res.status(200).send("pong");
});

/* ─────────────────────────────────────────────────────────────
   MongoDB-Verbindung & Serverstart
   ───────────────────────────────────────────────────────────── */
connectDB()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      const hostLocal = `http://localhost:${PORT}`;
      const hostLan = `http://10.0.0.34:${PORT}`;
      console.log("🚀 Server läuft:");
      console.log(`→ lokal:       ${hostLocal}`);
      console.log(`→ im Netzwerk: ${hostLan}`);
      console.log(`→ Geräte im WLAN erreichen: ${hostLan}/api`);
      console.log(`NODE_ENV=${process.env.NODE_ENV || "development"}`);
      console.log("CORS erlaubt für:", ALLOWED_ORIGINS.join(", "));
    });
  })
  .catch((err) => {
    console.error("❌ Fehler bei DB-Verbindung:", err);
  });
