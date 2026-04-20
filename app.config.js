import 'dotenv/config';

export default {
  expo: {
    name: "Echoes",
    slug: "echoes",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "dark",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#0B0B0B"
    },
    scheme: "gmv",
    ios: {
      supportsTablet: true,
      associatedDomains: [
        "applinks:gmv.app"
      ],
      bundleIdentifier: "com.gmv.app"
    },
    android: {
      package: "com.gmv.app",
      intentFilters: [
        {
          action: "VIEW",
          data: [
            {
              scheme: "https",
              host: "gmv.app",
              pathPrefix: "/memory"
            }
          ],
          category: [
            "BROWSABLE",
            "DEFAULT"
          ]
        }
      ],
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#0B0B0B"
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
      "expo-font"
    ],
    extra: {
      eas: {
        projectId: "7aa6565d-01ac-4fd8-a61f-6533858e5593"
      },
      firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
    },
    owner: "prakyats-organization"
  }
};
