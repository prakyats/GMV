const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

/**
 * Firebase JS SDK v10+ (and v12 used here) uses the package.json "exports"
 * field to ship platform-specific builds — including the React Native
 * persistence layer inside @firebase/auth.
 *
 * Metro's resolver in Expo SDK 54 does NOT enable package exports resolution
 * by default. Without this, Metro falls back to the CommonJS "main" field,
 * which points to the browser/Node build — one that has no concept of
 * AsyncStorage and silently uses in-memory persistence instead.
 *
 * enablePackageExports: true tells Metro to honour the "exports" map so
 * Firebase's "react-native" condition is picked up correctly, giving us:
 *   - getReactNativePersistence backed by AsyncStorage
 *   - correct Firestore offline persistence layer
 *   - correct Storage implementation
 *
 * This is the officially recommended fix for Firebase + Expo SDK 53/54.
 * Reference: https://docs.expo.dev/guides/using-firebase/#configure-metro
 */
config.resolver.unstable_enablePackageExports = true;

module.exports = config;