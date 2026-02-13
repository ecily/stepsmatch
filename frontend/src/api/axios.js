// C:\coding\stepsmatch\frontend\src\api\axios.js
import axios from "axios";

/**
 * Base-URL Priorität:
 * 1) VITE_API_BASE_URL (aus .env.*)
 * 2) window.__SM_API__ (optional per <script> setzbar)
 * 3) Fallback: http://localhost:8080/api
 *
 * Policy:
 * - Nur in "production" wird hart gefailt, wenn VITE_API_BASE_URL fehlt.
 * - In allen anderen Modes (development/live/etc.) fällt es auf localhost zurück,
 *   um Setup-/Mode-Probleme beim lokalen Arbeiten zu vermeiden.
 */
const envBase = import.meta?.env?.VITE_API_BASE_URL;
const winBase = typeof window !== "undefined" ? window.__SM_API__ : undefined;

// IMPORTANT: default to development (not production)
const mode = import.meta?.env?.MODE || "development";

const resolved =
  (envBase && String(envBase).trim()) ||
  (winBase && String(winBase).trim()) ||
  "";

let baseURL = resolved;

if (!baseURL) {
  if (mode === "production") {
    throw new Error(
      "[StepsMatch] Missing VITE_API_BASE_URL (required in production builds)."
    );
  }
  baseURL = "http://localhost:8080/api";
}

const axiosInstance = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
});

// ────────────────────────────────────────────────────────────
// 🧪 Tester-Key: persistent & konsistent über Reloads
// ────────────────────────────────────────────────────────────
const TESTER_STORAGE_KEY = "stepsmatch_tester_key";

function readTesterKey() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TESTER_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeTesterKey(value) {
  if (typeof window === "undefined") return;
  try {
    if (value) window.localStorage.setItem(TESTER_STORAGE_KEY, value);
    else window.localStorage.removeItem(TESTER_STORAGE_KEY);
  } catch {
    // ignore
  }
}

if (typeof window !== "undefined") {
  try {
    const params = new URLSearchParams(window.location.search);
    const testerFromUrl = params.get("tester");
    if (testerFromUrl && testerFromUrl.trim()) writeTesterKey(testerFromUrl.trim());
    if (!readTesterKey() && window.__SM_TESTER__) writeTesterKey(String(window.__SM_TESTER__));
  } catch {
    // no-op
  }
}

const initialTesterKey = readTesterKey();
if (initialTesterKey) {
  axiosInstance.defaults.headers.common["X-Tester-Key"] = initialTesterKey;
} else {
  delete axiosInstance.defaults.headers.common["X-Tester-Key"];
}

axiosInstance.interceptors.request.use((config) => {
  const tk = readTesterKey();
  if (tk && tk.trim()) {
    config.headers = config.headers ?? {};
    config.headers["X-Tester-Key"] = tk.trim();
  } else if (config.headers && "X-Tester-Key" in config.headers) {
    delete config.headers["X-Tester-Key"];
  }
  return config;
});

// Debug
if (typeof window !== "undefined") {
  console.log("🔗 Axios Base URL:", baseURL);
  console.log("🌍 VITE_API_BASE_URL:", envBase);
  console.log("🧭 MODE:", mode);
}

export default axiosInstance;
