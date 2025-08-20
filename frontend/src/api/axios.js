import axios from "axios";

/**
 * Base-URL Priorität:
 * 1) VITE_API_BASE_URL (aus .env.*)
 * 2) window.__SM_API__ (optional per <script> setzbar)
 * 3) Production-Fallback: deine DO-API
 */
const baseURL =
  import.meta?.env?.VITE_API_BASE_URL ||
  (typeof window !== "undefined" ? window.__SM_API__ : undefined) ||
  "https://lobster-app-ie9a5.ondigitalocean.app/api"; // <- sicherer Prod-Fallback

// Debug
if (typeof window !== "undefined") {
  console.log("🔗 Axios Base URL:", baseURL);
}

const axiosInstance = axios.create({
  baseURL,
  withCredentials: true, // für spätere Session-Cookies
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
});

export default axiosInstance;
