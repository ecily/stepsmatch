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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ─────────────────────────────────────────────────────────────
// Performance & Security (gzip/Brotli + Security Headers)
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.set("trust proxy", 1);

// Body-Parser
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// ─────────────────────────────────────────────────────────────
// CORS (Web & Mobile)
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:19006",
  "http://localhost:8081",
  "http://10.0.0.34:5173",
  "http://10.0.0.34:19006",
  "exp://10.0.0.34:19000",
  // ⬇️ Deine DO-Static-Site (Frontend)
  "https://lobster-app-2-68c6f.ondigitalocean.app",
  // Später eigene Domain hier ergänzen, z. B.:
  // "https://www.stepsmatch.com",
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Nicht erlaubter Ursprung: " + origin));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true, // nur nötig, wenn Cookies/Auth-Credentials verwendet werden
  })
);

// Preflight explizit erlauben (hilft bei manchen Clients)
app.options("*", cors());

// ─────────────────────────────────────────────────────────────
// Upload-Route mit separater CORS-Whitelist (Web-Uploads)
app.use(
  "/api/uploads",
  cors({
    origin(origin, callback) {
      const uploadAllowed = [
        "http://localhost:5173",
        "https://lobster-app-2-68c6f.ondigitalocean.app",
      ];
      if (!origin || uploadAllowed.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Nicht erlaubter Upload-Ursprung: " + origin));
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
  uploadRoutes
);

// ─────────────────────────────────────────────────────────────
// API-Routen
app.use("/api/users", userAuthRoutes); // /register, /login, /push-token, /preferences
app.use("/api/providers", providerRoutes);
app.use("/api/offers", offerRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/match", matchRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/location", locationRoutes);

// Healthcheck
app.get("/api/ping", (req, res) => {
  res.status(200).send("pong");
});

// ─────────────────────────────────────────────────────────────
// MongoDB-Verbindung & Serverstart
connectDB()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      const hostLocal = `http://localhost:${PORT}`;
      const hostLan = `http://10.0.0.34:${PORT}`;
      console.log("🚀 Server läuft:");
      console.log(`→ lokal:      ${hostLocal}`);
      console.log(`→ im Netzwerk: ${hostLan}`);
      console.log(`→ Geräte im WLAN erreichen: ${hostLan}/api`);
      console.log(`NODE_ENV=${process.env.NODE_ENV || "development"}`);
    });
  })
  .catch((err) => {
    console.error("❌ Fehler bei DB-Verbindung:", err);
  });
