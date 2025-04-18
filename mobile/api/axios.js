import axios from 'axios';

const LOCAL_API = 'http://10.0.0.34:5000/api'; // Deine lokale IP
const LIVE_API = 'https://stepsmatch.onrender.com/api'; // Oder dein späteres Live-Backend

const baseURL = process.env.EXPO_PUBLIC_API_BASE_URL || LOCAL_API;

const axiosInstance = axios.create({
  baseURL,
  timeout: 10000,
});

export default axiosInstance;
