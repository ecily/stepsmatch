// mobile/src/api/axios.js

import axios from 'axios';

// 🌐 Fester lokaler Server für Debug-Build
const baseURL = 'http://10.0.0.34:5000/api';

console.log('🔗 [DEBUG] Lokale Base URL aktiv:', baseURL);

const axiosInstance = axios.create({
  baseURL,
  timeout: 30000,
  withCredentials: false,
});

// 🛠️ Zentrale Logging-Logik für jede Anfrage
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

// 🛠️ Logging für jede Antwort oder Fehler
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
