import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/Auth/LoginScreen';
import RegisterScreen from '../screens/Auth/RegisterScreen';
import MemoryPreview from '../screens/Auth/MemoryPreview';
import MemoryEntryScreen from '../screens/Public/MemoryEntryScreen';
import { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

/**
 * AuthNavigator includes MemoryEntry so deep links work when the user
 * is not authenticated. MemoryEntryScreen resolves the destination itself:
 *   - auth resolved, no user → replace('MemoryPreview', { vaultId, memoryId })
 *   - failsafe timeout         → replace('MemoryPreview', { vaultId, memoryId })
 * The screen never navigates to MainStack routes — it only uses routes
 * that exist inside this navigator.
 */
const AuthNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#000000' },
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="MemoryPreview" component={MemoryPreview} />
      <Stack.Screen name="MemoryEntry" component={MemoryEntryScreen} />
    </Stack.Navigator>
  );
};

export default AuthNavigator;