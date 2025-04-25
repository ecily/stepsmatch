// src/api/axios.js
import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

console.log('🔗 Axios Base URL:', baseURL);

const axiosInstance = axios.create({
  baseURL,
  withCredentials: true, // wichtig für Cookies / Sessions
  timeout: 15000,         // optional: Timeout auf 15s
});

export default axiosInstance;
