import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase';
import { useAuthStore } from '../store/authStore';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import BottomTabNavigator from './BottomTabNavigator';
import AuthNavigator from './AuthNavigator';
import MemoryDetailScreen from '../screens/Memory/MemoryDetailScreen';
import MemoryEntryScreen from '../screens/Public/MemoryEntryScreen';
import { MainStackParamList } from './types';
import ThemedAlert from '../components/common/ThemedAlert';
import ThemedToast from '../components/common/ThemedToast';

const AppTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#000000', // True Black for OLED/Premium iOS feel
    card: '#1C1C1E',      // Standard Apple secondary card background
    text: '#FFFFFF',
    border: '#38383A',    // Refined native separator color
    primary: '#6C63FF',   // Branding primary (Apple-style purple tint)
  },
};

const MainStack = createNativeStackNavigator<MainStackParamList>();

const MainNavigator = () => (
  <MainStack.Navigator
    screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: '#000000' },
    }}
  >
    <MainStack.Screen name="Tabs" component={BottomTabNavigator} />
    <MainStack.Screen
      name="MemoryDetail"
      component={MemoryDetailScreen}
      options={{ animation: 'fade' }}
    />
    {/*
      MemoryEntry is included in BOTH navigators so deep links work
      regardless of auth state. When the user IS authenticated,
      AppNavigator renders MainNavigator which includes MemoryEntry.
      When the user is NOT authenticated, AppNavigator renders
      AuthNavigator which also includes MemoryEntry.
      MemoryEntryScreen reads auth state itself and routes accordingly —
      authenticated → MemoryDetail (replace), unauthenticated → MemoryPreview (replace).
    */}
    <MainStack.Screen name="MemoryEntry" component={MemoryEntryScreen} />
  </MainStack.Navigator>
);

/**
 * Deep link configuration.
 *
 * https://gmv.app/memory/:vaultId/:memoryId
 * → always lands on MemoryEntry, which resolves auth and routes
 *   to the correct destination without race conditions.
 *
 * Both navigators share the MemoryEntry route name so the linking
 * config works regardless of auth state at link-open time.
 */
const linking = {
  prefixes: ['gmv://', 'https://gmv.app'],
  config: {
    screens: {
      // Authenticated path: MainNavigator → MemoryEntry
      MemoryEntry: 'memory/:vaultId/:memoryId',
      // Auth path is handled by AuthNavigator having MemoryEntry too
    },
  },
};

const AppNavigator = () => {
  const { user, loading, setUser, setLoading } = useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName?.trim() || null,
          email: firebaseUser.email?.trim() || null,
          photoURL: firebaseUser.photoURL || null,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [setUser, setLoading]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }}>
        <NavigationContainer theme={AppTheme} linking={linking}>
          {user ? <MainNavigator /> : <AuthNavigator />}
        </NavigationContainer>

        <ThemedAlert />
        <ThemedToast />
      </View>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0B0B0B',
  },
});

export default AppNavigator;