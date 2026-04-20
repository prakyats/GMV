import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '@/services/firebase';
import * as RootNavigation from '../navigation/RootNavigation';
import { useAuthStore } from '../store/authStore';

// Track the last handled notification ID to prevent double processing
let lastHandledNotificationId: string | null = null;

/**
 * Configure how foreground notifications are handled.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Register for push notifications and create the default Android channel.
 * @returns {Promise<string|null>} The Expo push token or null if unavailable.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6C63FF',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  try {
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;

    if (!projectId) {
      console.warn('Push notification projectId not found in Constants.');
    }

    const token = (await Notifications.getExpoPushTokenAsync({
      projectId,
    })).data;

    return token;
  } catch (error) {
    console.error('Failed to get push token:', error);
    return null;
  }
}

/**
 * Handle notification tap/response by navigating to the correct vault.
 * Includes auth check and deduplication guards.
 */
export function handleNotificationNavigation(response: Notifications.NotificationResponse) {
  const data = response.notification.request.content.data;
  const vaultId = data?.vaultId as string | undefined;
  const memoryId = data?.memoryId as string | undefined;

  if (!vaultId) {
    console.warn("⚠️ Notification data missing vaultId, cannot navigate");
    return;
  }

  // Deduplicate using a compound ID (vault + memory)
  const notificationId = `${vaultId}_${memoryId}`;
  if (lastHandledNotificationId === notificationId) return;
  lastHandledNotificationId = notificationId;

  console.log("🔔 Notification tapped:", JSON.stringify(data));

  const user = useAuthStore.getState().user;

  // Guard: No authenticated user
  if (!user) {
    console.log("🚫 No user logged in, skipping navigation");
    return;
  }

  console.log("🧭 Navigating to vault detail through nested helper");
  RootNavigation.navigateToVaultDetail(vaultId, memoryId);
}

/**
 * Save a push token to the user document in Firestore.
 */
export async function savePushToken(userId: string, token: string) {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) return;

    const existingTokens = userDoc.data()?.expoPushTokens || [];

    if (!existingTokens.includes(token)) {
      await updateDoc(userRef, {
        expoPushTokens: arrayUnion(token),
      });
    }
  } catch (error) {
    console.error('Failed to save push token to Firestore:', error);
  }
}
