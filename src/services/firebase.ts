import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence, getAuth } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const requiredEnv = [
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
];

if (requiredEnv.some((v) => !v)) {
  console.error("❌ Firebase ENV variables are missing");
  throw new Error("❌ Firebase ENV not loaded. Check your .env file and EAS secrets.");
}

const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Singleton guard — safe across hot reloads
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Auth with AsyncStorage persistence.
//
// IMPORT PATH: "firebase/auth" — NOT "firebase/auth/react-native".
// The subpath firebase/auth/react-native was REMOVED in Firebase 10.
// getReactNativePersistence now lives in the main "firebase/auth" package.
// metro.config.js must have unstable_enablePackageExports=true so Metro
// resolves the "react-native" condition in Firebase's exports map — otherwise
// Metro serves the browser build and persistence silently does nothing.
//
// CATCH: on hot reload, initializeAuth throws "auth/already-initialized".
// We catch that specific error and call getAuth() instead, which returns
// the EXISTING instance — the one already configured with AsyncStorage.
// Do NOT call initializeAuth() again in the catch — that just re-throws.
let authInstance;
try {
  authInstance = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (e: any) {
  if (e?.code === "auth/already-initialized") {
    authInstance = getAuth(app);
  } else {
    throw e;
  }
}

export const auth    = authInstance;
export const db      = getFirestore(app);
export const storage = getStorage(app);