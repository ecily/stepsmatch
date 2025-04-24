import axios from 'axios';

const baseURL = __DEV__
  ? 'http://10.0.0.34:5000/api' // Lokales Backend für Expo Go
  : 'https://lobster-app-ie9a5.ondigitalocean.app/api'; // ✅ Dein aktuelles Live-Backend

const axiosInstance = axios.create({
  baseURL,
  timeout: 10000,
});

export default axiosInstance;
