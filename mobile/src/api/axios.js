// mobile/src/api/axios.js

import axios from 'axios';
import { Platform } from 'react-native';

const isAndroid = Platform.OS === 'android';
const isDevelopment = __DEV__;

// 🚀 Automatische Umschaltung:
// - Android im Development → Live-Backend (wegen Expo Go Einschränkung)
// - Sonst Development → Lokales Backend
// - Production (APK) → Live-Backend

const baseURL =
  isAndroid && isDevelopment
    ? 'https://lobster-app-ie9a5.ondigitalocean.app/api' // Expo Go auf echtem Gerät
    : isDevelopment
    ? 'http://10.0.0.34:5000/api'                        // Lokales Backend bei Web/Emulator
    : 'https://lobster-app-ie9a5.ondigitalocean.app/api'; // Live Backend für APKs

console.log('🔗 Aktive Base URL:', baseURL);

const axiosInstance = axios.create({
  baseURL,
  timeout: 30000,         // ⏱️ 30 Sekunden Timeout
  withCredentials: false, // ✅ Wichtig für Expo & Mobile – keine Cookies!
});

export default axiosInstance;
