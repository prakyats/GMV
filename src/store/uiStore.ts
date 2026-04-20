import { create } from 'zustand';
import * as Haptics from 'expo-haptics';

export type AlertType = 'info' | 'error' | 'confirm';

export interface AlertState {
  title: string;
  message: string;
  type: AlertType;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface UIState {
  alert: AlertState | null;
  toast: string | null;

  showAlert: (alert: AlertState) => void;
  hideAlert: () => void;

  showToast: (message: string) => void;
  hideToast: () => void;
}

let toastTimer: NodeJS.Timeout | null = null;

/**
 * UI Store: Centralized logic for global alerts and toasts.
 * Enforces a single source of truth for all interaction feedback.
 */
export const useUIStore = create<UIState>((set) => ({
  alert: null,
  toast: null,

  showAlert: (alert) => {
    // 🚨 HAPTIC FEEDBACK
    if (alert.type === 'error') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    set(() => ({
      alert, // replaces existing alert (no stacking)
    }));
  },

  hideAlert: () => set({ alert: null }),

  showToast: (message) => {
    // 🚨 HAPTIC FEEDBACK
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (toastTimer) clearTimeout(toastTimer);

    set({ toast: message });

    // Auto-dismiss after 2.5s
    toastTimer = setTimeout(() => {
      set({ toast: null });
    }, 2500);
  },

  hideToast: () => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: null });
  },
}));
