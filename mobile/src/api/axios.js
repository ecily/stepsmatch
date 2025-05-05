// /mobile/src/api/axios.js

import axios from 'axios';

// 🌐 Feste Base URL für Live-Backend (für Expo Go, APK & Web)
const baseURL = 'https://lobster-app-ie9a5.ondigitalocean.app/api';

console.log('🌍 [AXIOS] Live Base URL verwendet:', baseURL);

// ⚙️ Erstelle Axios-Instanz
const axiosInstance = axios.create({
  baseURL,
  timeout: 30000,
  withCredentials: false,
});

// 📤 Logging für ausgehende Anfragen
axiosInstance.interceptors.request.use(
  (config) => {
    console.log('📤 [AXIOS] Anfrage an:', config.baseURL + config.url);
    if (config.data) {
      console.log('🧾 [AXIOS] Payload:', JSON.stringify(config.data, null, 2));
    }
    return config;
  },
  (error) => {
    console.error('❌ [AXIOS] Fehler bei Anfrage:', error);
    return Promise.reject(error);
  }
);

// ✅ Logging für eingehende Antworten oder Fehler
axiosInstance.interceptors.response.use(
  (response) => {
    console.log('✅ [AXIOS] Antwort:', response.status, response.data);
    return response;
  },
  (error) => {
    console.error('❌ [AXIOS] Fehlerhafte Antwort:', error.message);
    if (error.response) {
      console.error('📥 [AXIOS] Fehlerantwort:', error.response.status, error.response.data);
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
