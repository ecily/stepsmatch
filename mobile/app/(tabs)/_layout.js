import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#9ca3af', // neutral grau
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopWidth: 0,
          elevation: 8,
          height: 64,
          paddingBottom: 6,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        // kleine Animation beim Wechsel
        tabBarHideOnKeyboard: true,
        tabBarIcon: ({ focused, color, size }) => {
          let icon = 'ellipse-outline';
          if (route.name === 'index') icon = focused ? 'home' : 'home-outline';
          if (route.name === 'OffersScreen') icon = focused ? 'pricetags' : 'pricetags-outline';
          if (route.name === 'NavigationScreen') icon = focused ? 'map' : 'map-outline';
          if (route.name === 'ProfileScreen') icon = focused ? 'person' : 'person-outline';
          return <Ionicons name={icon} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="OffersScreen" options={{ title: 'Angebote' }} />
      <Tabs.Screen name="NavigationScreen" options={{ title: 'Navigation' }} />
      <Tabs.Screen name="ProfileScreen" options={{ title: 'Profil' }} />
    </Tabs>
  );
}
