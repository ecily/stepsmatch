import axios from "axios";

/**
 * Base-URL Priorität:
 * 1) VITE_API_BASE_URL (aus .env.*)
 * 2) window.__SM_API__ (optional per <script> setzbar)
 * 3) Production-Fallback: DO-API
 */
const baseURL =
  import.meta?.env?.VITE_API_BASE_URL ||
  (typeof window !== "undefined" ? window.__SM_API__ : undefined) ||
  "https://lobster-app-ie9a5.ondigitalocean.app/api"; // <- sicherer Prod-Fallback

const axiosInstance = axios.create({
  baseURL,
  withCredentials: true, // für spätere Session-Cookies
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
});

// ────────────────────────────────────────────────────────────
// 🧪 Tester-Key: persistent & konsistent über Reloads
// - Einheitlicher Storage-Key in localStorage
// - Capture via URL-Param ?tester=... (optional Convenience)
// - Header 'X-Tester-Key' wird bei JEDER Anfrage gesetzt (Interceptor)
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
    if (value) {
      window.localStorage.setItem(TESTER_STORAGE_KEY, value);
    } else {
      window.localStorage.removeItem(TESTER_STORAGE_KEY);
    }
  } catch {
    // Ignorieren (z. B. Privacy-Mode)
  }
}

// Optional: Tester-Key aus URL übernehmen (?tester=...)
// So bleibt er über Reloads erhalten, ohne dass andere Screens ihn setzen müssen.
if (typeof window !== "undefined") {
  try {
    const params = new URLSearchParams(window.location.search);
    const testerFromUrl = params.get("tester");
    if (testerFromUrl && testerFromUrl.trim()) {
      writeTesterKey(testerFromUrl.trim());
    }
    // Optionaler globaler Fallback (falls per <script> gesetzt)
    if (!readTesterKey() && window.__SM_TESTER__) {
      writeTesterKey(String(window.__SM_TESTER__));
    }
  } catch {
    // still safe
  }
}

// Defaults einmalig setzen (für sofortige Nutzung nach Import)
const initialTesterKey = readTesterKey();
if (initialTesterKey) {
  axiosInstance.defaults.headers.common["X-Tester-Key"] = initialTesterKey;
} else {
  delete axiosInstance.defaults.headers.common["X-Tester-Key"];
}

// Request-Interceptor: immer den aktuellsten Wert aus localStorage nehmen
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
}

export default axiosInstance;
