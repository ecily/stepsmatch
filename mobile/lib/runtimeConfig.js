import Constants from 'expo-constants';

export const APP_BRAND = 'StepsMatch';

const rawApiBase =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  Constants?.expoConfig?.extra?.apiBase ||
  Constants?.manifest?.extra?.apiBase ||
  // Internal live-test fallback; builds should prefer Env/Expo config.
  'https://lobster-app-ie9a5.ondigitalocean.app/api';

export const API_BASE_URL = String(rawApiBase || '').replace(/\/$/, '');

export const FGS_NOTIFICATION_TITLE = 'StepsMatch ist aktiv';
export const FGS_NOTIFICATION_BODY = 'Standortaktualisierung läuft';

