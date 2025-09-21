import 'dotenv/config';

/**
 * WICHTIG:
 * - Für Release-Builds müssen die ENV-Variablen in EAS gesetzt sein:
 *   EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY
 *   EXPO_PUBLIC_GOOGLE_DIRECTIONS_KEY
 * - Diese Datei sorgt dafür, dass
 *   1) der Maps-SDK-Key ins AndroidManifest geschrieben wird (react-native-maps)
 *   2) der Directions-Key unter extra.directionsKey im Bundle landet (NavigationScreen liest ihn)
 */

const MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY ?? '';
const DIRECTIONS_KEY = process.env.EXPO_PUBLIC_GOOGLE_DIRECTIONS_KEY ?? '';
const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://lobster-app-ie9a5.ondigitalocean.app/api';

// Build-time Hinweis (erscheint in den EAS-Logs, hilft die Ursache schnell zu sehen)
if (!MAPS_KEY) {
  // eslint-disable-next-line no-console
  console.warn('⚠️  EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY ist leer – Google Maps wird im Release nicht funktionieren.');
}
if (!DIRECTIONS_KEY) {
  // eslint-disable-next-line no-console
  console.warn('⚠️  EXPO_PUBLIC_GOOGLE_DIRECTIONS_KEY ist leer – Google Directions (Routen) funktionieren im Release nicht.');
}

export default {
  expo: {
    name: 'Stepsmatch',
    slug: 'mobile',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    scheme: 'mobile',
    userInterfaceStyle: 'automatic',

    splash: {
      image: './assets/splash.png',
      resizeMode: 'cover',
      backgroundColor: '#0d4ea6',
    },

    ios: {
      supportsTablet: true,
    },

    android: {
      package: 'com.ecily.mobile',
      edgeToEdgeEnabled: true,

      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0B3B68',
      },

      // Für Firebase/Push
      googleServicesFile: './google-services.json',

      // >>> Hier wird der Google Maps SDK Key ins Manifest geschrieben <<<
      config: {
        googleMaps: {
          apiKey: MAPS_KEY,
        },
      },

      permissions: [
        'VIBRATE',
        'ACCESS_COARSE_LOCATION',
        'ACCESS_FINE_LOCATION',
        'ACCESS_BACKGROUND_LOCATION',
        'FOREGROUND_SERVICE',
        'FOREGROUND_SERVICE_LOCATION',
        'WAKE_LOCK',
        'POST_NOTIFICATIONS',
      ],

      // Persistente BG-Location-Notification (Android)
      foregroundService: {
        notificationTitle: 'StepsMatch läuft im Hintergrund',
        notificationBody: 'Dein Standort wird verwendet, um passende Angebote zu finden.',
        notificationChannelId: 'com.ecily.mobile:stepsmatch-bg-location-task',
      },
    },

    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
    },

    plugins: [
      ['expo-splash-screen', { image: './assets/splash.png', resizeMode: 'cover', backgroundColor: '#0d4ea6' }],
      'expo-font',
      ['expo-notifications', { sounds: ['./assets/sounds/arrival.mp3'] }],
      'expo-location',
      'expo-secure-store',
      // react-native-maps benötigt kein separates Plugin im Managed Workflow (SDK 50),
      // alles Wesentliche kommt über android.config.googleMaps.apiKey.
    ],

    experiments: { typedRoutes: true },

    // Laufzeit-Config, wird in JS via Constants.expoConfig.extra.* gelesen
    extra: {
      eas: { projectId: '08559a29-b307-47e9-a130-d3b31f73b4ed' },
      directionsKey: DIRECTIONS_KEY, // NavigationScreen.js liest diese Property
      apiBase: API_BASE,
      // Optional für Diagnostics im Client:
      mapsKeyPresent: !!MAPS_KEY,
      directionsKeyPresent: !!DIRECTIONS_KEY,
    },

    // OTA-Updates sind bewusst aus (Builds via EAS)
    updates: { enabled: false },
  },
};
