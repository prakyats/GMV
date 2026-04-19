import React from 'react';
import { Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import VaultListScreen from '../screens/Vault/VaultListScreen';
import VaultDetailScreen from '../screens/Vault/VaultDetailScreen';
import VaultMembersListScreen from '../screens/Vault/VaultMembersListScreen';
import { VaultStackParamList } from './types';

const Stack = createNativeStackNavigator<VaultStackParamList>();

/**
 * Stack Navigator for the Vaults tab.
 * Handles drill-down navigation from the list to vault details.
 */
const VaultStackNavigator = () => {
  return (
    <Stack.Navigator 
      initialRouteName="VaultList"
      screenOptions={{
        headerShown: true,
        headerLargeTitle: Platform.OS === 'ios',
        headerTransparent: Platform.OS === 'ios',
        headerBlurEffect: 'dark',
        headerTintColor: '#6C63FF',
        headerStyle: Platform.OS === 'android' ? { backgroundColor: '#000000' } : undefined,
        contentStyle: { backgroundColor: '#000000' },
      }}
    >
      <Stack.Screen 
        name="VaultList" 
        component={VaultListScreen} 
        options={{ title: 'Vaults' }}
      />
      <Stack.Screen 
        name="VaultDetail" 
        component={VaultDetailScreen} 
        options={{ 
          headerLargeTitle: false,
          title: '',
        }}
      />
      <Stack.Screen
        name="VaultMembers"
        component={VaultMembersListScreen}
        options={{
          headerLargeTitle: false,
          title: 'Members',
        }}
      />
    </Stack.Navigator>
  );
};

export default VaultStackNavigator;
