import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import OnThisDayScreen from '../screens/Resurface/OnThisDayScreen';
import { ReliveStackParamList } from './types';

const Stack = createNativeStackNavigator<ReliveStackParamList>();

/**
 * Stack Navigator for the Relive tab (On This Day).
 * Enables native Large Title support.
 */
const ReliveStackNavigator = () => {
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
        name="OnThisDayMain"
        component={OnThisDayScreen}
        options={{ title: 'Relive' }}
      />
    </Stack.Navigator>
  );
};

export default ReliveStackNavigator;
