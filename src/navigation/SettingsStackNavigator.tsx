import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SettingsStackParamList } from './types';
import ProfileScreen from '../screens/Settings/ProfileScreen';
import EditProfileScreen from '../screens/Settings/EditProfileScreen';

const Stack = createNativeStackNavigator<SettingsStackParamList>();

/**
 * Stack Navigator for the Settings tab.
 * Handles potential drill-down settings screens.
 */
const SettingsStackNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerLargeTitle: true,
        headerTransparent: true,
        headerBlurEffect: 'dark',
        headerTintColor: '#6C63FF',
        contentStyle: { backgroundColor: '#000000' },
      }}
    >
      <Stack.Screen
        name="ProfileMain"
        component={ProfileScreen}
        options={{ title: 'Settings' }}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ 
          title: 'Edit Profile',
          headerLargeTitle: false,
          headerTransparent: true,
          headerBlurEffect: 'dark'
        }}
      />
    </Stack.Navigator>
  );
};

export default SettingsStackNavigator;
