import axios from 'axios';
import { Platform } from 'react-native';

const isAndroid = Platform.OS === 'android';
const isDevelopment = __DEV__;

let baseURL = 'https://lobster-app-ie9a5.ondigitalocean.app/api'; // Standard: Live-Backend

// ⚙️ Lokales Backend nur verwenden, wenn:
// - wir im Development Mode sind
// - und nicht auf einem echten Android-Gerät (z. B. im Emulator oder Web)
if (isDevelopment && !isAndroid) {
  baseURL = 'http://10.0.0.34:5000/api'; // Lokales Backend für Web/Emulator
}

const axiosInstance = axios.create({
  baseURL,
  timeout: 10000,
});

export default axiosInstance;
