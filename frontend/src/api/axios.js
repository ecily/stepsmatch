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
const mode = import.meta?.env?.MODE || "development";

const PROD_API_FALLBACK = "https://lobster-app-ie9a5.ondigitalocean.app/api";

const host = typeof window !== "undefined" ? window.location.hostname : "";
const isLocalHost =
  host === "localhost" ||
  host === "127.0.0.1" ||
  host === "::1" ||
  host.endsWith(".local");

const resolved =
  (envBase && String(envBase).trim()) ||
  (winBase && String(winBase).trim()) ||
  "";

let baseURL = resolved;

if (!baseURL && isLocalHost) {
  baseURL = "http://localhost:8080/api";
}

if (!isLocalHost) {
  if (!baseURL) {
    baseURL = PROD_API_FALLBACK;
    console.warn("[StepsMatch] Missing VITE_API_BASE_URL on hosted frontend. Using PROD_API_FALLBACK.");
  }
  if (/^https?:\/\/(localhost|127\.0\.0\.1|::1)(:\\d+)?/i.test(baseURL)) {
    baseURL = PROD_API_FALLBACK;
    console.warn("[StepsMatch] Hosted frontend resolved localhost API. Overriding to PROD_API_FALLBACK.");
  }
}

if (!baseURL) {
  throw new Error("[StepsMatch] Could not resolve API base URL.");
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
