import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import VaultListScreen from '../screens/Vault/VaultListScreen';
import VaultDetailScreen from '../screens/Vault/VaultDetailScreen';
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
    </Stack.Navigator>
  );
};

export default VaultStackNavigator;
