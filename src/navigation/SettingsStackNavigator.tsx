import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProfileScreen from '../screens/Settings/ProfileScreen';

const Stack = createNativeStackNavigator();

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
    </Stack.Navigator>
  );
};

export default SettingsStackNavigator;
