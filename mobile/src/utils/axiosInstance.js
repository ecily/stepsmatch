import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: 'https://dein-backend-url.com/api',
  timeout: 10000,
});

export default axiosInstance;
