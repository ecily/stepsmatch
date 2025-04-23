import axios from 'axios';

const baseURL = __DEV__
  ? 'http://10.0.0.34:5000/api' // ✅ Lokales Backend
  : 'https://shark-app-f9zq9.ondigitalocean.app/api'; // ✅ Live-Backend für APK

const axiosInstance = axios.create({
  baseURL,
  timeout: 10000,
});

export default axiosInstance;
