import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import VaultListScreen from '../screens/Vault/VaultListScreen';
import VaultDetailScreen from '../screens/Vault/VaultDetailScreen';
import MemoryDetailScreen from '../screens/Vault/MemoryDetailScreen';
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
        headerShown: false,
        contentStyle: { backgroundColor: '#0B0B0B' },
      }}
    >
      <Stack.Screen 
        name="VaultList" 
        component={VaultListScreen} 
      />
      <Stack.Screen 
        name="VaultDetail" 
        component={VaultDetailScreen} 
      />
      <Stack.Screen 
        name="MemoryDetail" 
        component={MemoryDetailScreen} 
      />
    </Stack.Navigator>
  );
};

export default VaultStackNavigator;
