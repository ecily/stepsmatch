require('./expo-plugin-shim');

export default () => ({
  name: "StepsMatch",
  slug: "stepsmatch",
  version: "1.0.0",
  sdkVersion: "53.0.0",
  orientation: "portrait",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff"
  },
  updates: {
    fallbackToCacheTimeout: 0
  },
  assetBundlePatterns: ["**/*"],
  ios: {
    bundleIdentifier: "com.stepsmatch.app"
  },
  android: {
    package: "com.stepsmatch.app",
    googleServicesFile: "./android/app/google-services.json" // ✅ wichtig für Push
  },
  web: {
    favicon: "./assets/favicon.png"
  },
  plugins: ["expo-notifications"], // ✅ zwingend notwendig für FCM
  extra: {
    eas: {
      projectId: "de0e17e7-05bf-4a73-a61b-1edd912bd925"
    }
  }
});
