import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: 'http://10.0.0.34:5000/api', // Lokales Backend
  timeout: 10000,
});

export default axiosInstance;

