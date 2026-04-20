import { initializeApp, getApps, getApp } from "firebase/app";
// @ts-ignore
import { initializeAuth, getReactNativePersistence } from 'firebase/auth/react-native';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const requiredEnv = [
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
];

console.log("🔥 Firebase API KEY present:", !!process.env.EXPO_PUBLIC_FIREBASE_API_KEY);

if (requiredEnv.some((v) => !v)) {
  console.error("❌ Firebase ENV variables are missing");
  throw new Error("❌ Firebase ENV not loaded. Check your .env file and EAS secrets.");
}

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase Singleton
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Initialize Auth with AsyncStorage for React Native persistence
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

export const db = getFirestore(app);
export const storage = getStorage(app);