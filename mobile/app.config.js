require('./expo-plugin-shim');

export default {
  name: "StepsMatch",
  slug: "stepsmatch",
  version: "1.0.0",
  sdkVersion: "53.0.0",
  orientation: "portrait",
  //icon: "./assets/icon.png",
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
    supportsTablet: true
  },
  android: {
    // adaptiveIcon: {
    //   foregroundImage: "./assets/adaptive-icon.png",
    //   backgroundColor: "#ffffff"
    // },
    package: "com.stepsmatch.app"
  },
  web: {
    favicon: "./assets/favicon.png"
  },
  extra: {
    eas: {
      projectId: "de0e17e7-05bf-4a73-a61b-1edd912bd925"
    }
  }
};
