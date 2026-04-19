import * as Haptics from 'expo-haptics';

let lastHapticTime = 0;
const HAPTIC_COOLDOWN = 300; // ms

/**
 * Trigger a haptic feedback with anti-spam cooldown logic.
 * Ensures haptics feel intentional and physical, not noisy.
 */
export const triggerHaptic = async (style: Haptics.ImpactFeedbackStyle | 'success' | 'warning' | 'error' | 'light' | 'medium' | 'heavy') => {
  const now = Date.now();
  if (now - lastHapticTime < HAPTIC_COOLDOWN) return;

  lastHapticTime = now;

  try {
    switch (style) {
      case 'success':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'warning':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'error':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
      case 'light':
      case Haptics.ImpactFeedbackStyle.Light:
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'medium':
      case Haptics.ImpactFeedbackStyle.Medium:
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'heavy':
      case Haptics.ImpactFeedbackStyle.Heavy:
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
    }
  } catch (err) {
    // Fail silently on Android if haptics are unavailable or error occurs
    console.debug('Haptics failed:', err);
  }
};
