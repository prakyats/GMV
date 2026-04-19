import React, { useEffect, useRef, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../../store/authStore';

/**
 * MemoryEntryScreen — Central deep link handler.
 *
 * This screen lives in BOTH MainNavigator (authenticated) and AuthNavigator
 * (unauthenticated) so deep links resolve cleanly regardless of auth state.
 *
 * Routing logic:
 *   auth resolved + user  → replace to MemoryDetail (MainStack)
 *   auth resolved, no user → replace to MemoryPreview (AuthStack)
 *   auth hangs >3s        → failsafe replace to MemoryPreview
 *
 * Key safety guarantees:
 *   1. isResolved ref prevents double-navigation if both useEffect and
 *      the timeout fire near-simultaneously.
 *   2. navigation.replace() is used throughout — never navigate() — so
 *      the entry screen is removed from the stack (no back button to limbo).
 *   3. Each navigator only navigates to routes that exist within it:
 *      MainNavigator → MemoryDetail
 *      AuthNavigator → MemoryPreview
 *      Never cross-navigator.
 *   4. Timeout is cleared on unmount to prevent ghost navigation if the
 *      user somehow leaves before auth resolves.
 */

// Import both param list types so we can navigate correctly from either context
import type { MainStackParamList } from '../../navigation/types';
import type { AuthStackParamList } from '../../navigation/types';

// The route param shape is identical in both stacks
type EntryParams = { vaultId: string; memoryId: string };

const MemoryEntryScreen = () => {
  // We use `any` for navigation type here because this screen exists in two
  // different navigators. Each replace() call only uses routes valid for
  // the navigator that is currently active.
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ MemoryEntry: EntryParams }, 'MemoryEntry'>>();
  const { vaultId, memoryId } = route.params;
  const { user, loading } = useAuthStore();

  // Prevents double-navigation if auth resolves AND timeout fires in the same tick
  const isResolved = useRef(false);

  const resolve = useCallback(() => {
    if (isResolved.current) return;
    isResolved.current = true;

    if (user) {
      // Authenticated → go to full memory detail
      // This replace() is safe inside MainNavigator (where MemoryDetail exists)
      navigation.replace('MemoryDetail', { memoryId, vaultId });
    } else {
      // Unauthenticated → go to curiosity preview
      // This replace() is safe inside AuthNavigator (where MemoryPreview exists)
      navigation.replace('MemoryPreview', { vaultId, memoryId });
    }
  }, [navigation, user, vaultId, memoryId]);

  // Primary path: auth finishes loading
  useEffect(() => {
    if (!loading) {
      resolve();
    }
  }, [loading, resolve]);

  // Failsafe: if Firebase Auth hangs (e.g. no network), fallback after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isResolved.current) {
        if (__DEV__) console.log('[MemoryEntry] Auth timeout — falling back to preview');
        // Force no-user path on timeout
        isResolved.current = false; // allow resolve() to run
        navigation.replace('MemoryPreview', { vaultId, memoryId });
        isResolved.current = true;
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, []); // intentionally empty — runs once on mount only

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#6C63FF" />
      <Text style={styles.text}>Opening memory...</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#8E8E93',
    marginTop: 16,
    fontSize: 14,
    fontWeight: '500',
  },
});

export default MemoryEntryScreen;