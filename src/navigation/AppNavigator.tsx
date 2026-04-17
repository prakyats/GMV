import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase';
import { useAuthStore } from '../store/authStore';

import BottomTabNavigator from './BottomTabNavigator';
import AuthNavigator from './AuthNavigator';

const AppTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#0B0B0B',
    card: '#1C1C1E',
    text: '#FFFFFF',
    border: '#2C2C2E',
    primary: '#6C63FF',
  },
};

const AppNavigator = () => {
  const { user, loading, setUser, setLoading } = useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
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
    <NavigationContainer theme={AppTheme}>
      {user ? <BottomTabNavigator /> : <AuthNavigator />}
    </NavigationContainer>
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

