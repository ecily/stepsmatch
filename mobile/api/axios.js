import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: 'https://lobster-app-ie9a5.ondigitalocean.app/api',
  timeout: 10000,
});

export default axiosInstance;
