// mobile/src/api/axios.js
import axios from 'axios';

const baseURL = __DEV__
  ? 'http://localhost:5000/api' // local dev
  : 'https://dein-live-backend/api'; // später live backend

const axiosInstance = axios.create({
  baseURL,
  timeout: 10000,
});

export default axiosInstance;
