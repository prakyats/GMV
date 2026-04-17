import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import VaultListScreen from '../screens/Vault/VaultListScreen';
import OnThisDayScreen from '../screens/Resurface/OnThisDayScreen';
import ProfileScreen from '../screens/Settings/ProfileScreen';

import { BottomTabParamList } from './types';


const Tab = createBottomTabNavigator<BottomTabParamList>();

const BottomTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#6C63FF',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: {
          backgroundColor: '#0B0B0B',
          borderTopColor: '#2C2C2E',
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}
    >
      <Tab.Screen 
        name="Vaults" 
        component={VaultListScreen}
        options={{
          tabBarLabel: 'Vaults',
        }}
      />
      <Tab.Screen 
        name="OnThisDay" 
        component={OnThisDayScreen}
        options={{
          tabBarLabel: 'On This Day',
        }}
      />
      <Tab.Screen 
        name="Settings" 
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Settings',
        }}
      />
    </Tab.Navigator>
  );
};

export default BottomTabNavigator;
