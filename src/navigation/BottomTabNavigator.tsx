import React from 'react';
import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import VaultStackNavigator from './VaultStackNavigator';
import ReliveStackNavigator from './ReliveStackNavigator';
import SettingsStackNavigator from './SettingsStackNavigator';

import { BottomTabParamList } from './types';

const Tab = createBottomTabNavigator<BottomTabParamList>();

const BottomTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#6C63FF',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: {
          backgroundColor: 'rgba(0, 0, 0, 0.85)', // Denser background
          borderTopColor: 'rgba(255, 255, 255, 0.1)',
          position: 'absolute',
          elevation: 0,
        },
        tabBarBackground: () => (
          <BlurView 
            tint="dark" 
            intensity={90} 
            style={StyleSheet.absoluteFill} 
          />
        ),
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
          marginBottom: 4,
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'Vaults') {
            iconName = focused ? 'file-tray-full' : 'file-tray-full-outline';
          } else if (route.name === 'OnThisDay') {
            iconName = focused ? 'sparkles' : 'sparkles-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'person-circle' : 'person-circle-outline';
          } else {
            iconName = 'help-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen 
        name="Vaults" 
        component={VaultStackNavigator}
        options={{
          tabBarLabel: 'Vaults',
        }}
      />
      <Tab.Screen 
        name="OnThisDay" 
        component={ReliveStackNavigator}
        options={{
          tabBarLabel: 'Relive',
        }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsStackNavigator}
        options={{
          tabBarLabel: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
};

export default BottomTabNavigator;
