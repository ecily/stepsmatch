import 'dotenv/config';

export default {
  expo: {
    name: "Stepsmatch",
    slug: "mobile",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    scheme: "mobile",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "cover",
      backgroundColor: "#0d4ea6"
    },
    ios: { supportsTablet: true },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#0B3B68"
      },
      edgeToEdgeEnabled: true,
      package: "com.ecily.mobile",
      googleServicesFile: "./google-services.json",
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY || ""
        }
      },
      permissions: [
        "VIBRATE",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "FOREGROUND_SERVICE",
        "FOREGROUND_SERVICE_LOCATION",
        "WAKE_LOCK",
        "POST_NOTIFICATIONS"
      ],
      foregroundService: {
        notificationTitle: "StepsMatch läuft im Hintergrund",
        notificationBody: "Dein Standort wird verwendet, um passende Angebote zu finden.",
        notificationChannelId: "com.ecily.mobile:stepsmatch-bg-location-task"
      }
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      ["expo-splash-screen", { image: "./assets/splash.png", resizeMode: "cover", backgroundColor: "#0d4ea6" }],
      "expo-font",
      ["expo-notifications", { sounds: ["./assets/sounds/arrival.mp3"] }],
      "expo-location",
      "expo-secure-store"
    ],
    experiments: { typedRoutes: true },
    extra: {
      eas: { projectId: "08559a29-b307-47e9-a130-d3b31f73b4ed" },
      directionsKey: process.env.EXPO_PUBLIC_GOOGLE_DIRECTIONS_KEY || "",
      apiBase: process.env.EXPO_PUBLIC_API_BASE_URL || "https://lobster-app-ie9a5.ondigitalocean.app/api"
    },
    updates: {
      enabled: false
    }
  }
};
