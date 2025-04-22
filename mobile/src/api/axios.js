// mobile/src/api/axios.js
import axios from 'axios';

const baseURL = __DEV__
  ? 'http://10.0.0.34:5000/api' // Lokale IP deines PCs im WLAN
  : 'https://dein-live-backend/api'; // später Live-Backend

const axiosInstance = axios.create({
  baseURL,
  timeout: 10000,
});

export default axiosInstance;
