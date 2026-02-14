import React, { useEffect, useMemo, useState } from 'react';
import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../theme/ThemeProvider';

function HeaderGreeting() {
  const t = useTheme();
  const [firstName, setFirstName] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const keys = ['userFirstName', 'userProfile', 'user', 'authUser', 'profile', 'currentUser'];
        for (const key of keys) {
          const raw = await AsyncStorage.getItem(key);
          if (!raw) continue;
          let first = '';
          try {
            const obj = JSON.parse(raw);
            const name = String(obj?.firstName || obj?.name || obj?.fullName || obj?.displayName || '').trim();
            first = name.split(' ')[0];
          } catch {
            first = String(raw).trim().split(' ')[0];
          }
          if (first) {
            if (alive) setFirstName(first);
            return;
          }
        }
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <View style={{ paddingRight: 10, alignItems: 'flex-end' }}>
      <Text style={{ color: t.colors.inkLow, fontSize: 11 }}>Willkommen</Text>
      <Text style={{ color: t.colors.inkHigh, fontSize: 14, fontWeight: '700' }}>{firstName || 'du'}</Text>
    </View>
  );
}

export default function TabLayout() {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  const tabBarStyle = useMemo(
    () => ({
      backgroundColor: t.colors.elevated,
      borderTopColor: t.colors.divider,
      borderTopWidth: 1,
      height: 58 + insets.bottom,
      paddingBottom: Math.max(8, insets.bottom),
      paddingTop: 6,
    }),
    [insets.bottom, t.colors.divider, t.colors.elevated]
  );

  return (
    <Tabs
      sceneContainerStyle={{ backgroundColor: t.colors.background }}
      screenOptions={({ route }) => ({
        headerShown: true,
        headerTitle: 'StepsMatch',
        headerTitleAlign: 'left',
        headerStyle: { backgroundColor: t.colors.background },
        headerShadowVisible: false,
        headerTitleStyle: {
          color: t.colors.inkHigh,
          fontWeight: '800',
          fontSize: 20,
          letterSpacing: 0.2,
        },
        headerRight: () => <HeaderGreeting />,
        headerTintColor: t.colors.inkHigh,
        statusBarStyle: 'dark',
        statusBarBackgroundColor: t.colors.background,
        tabBarActiveTintColor: t.colors.primary,
        tabBarInactiveTintColor: t.colors.inkLow,
        tabBarStyle,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarHideOnKeyboard: true,
        tabBarIcon: ({ focused, color, size }) => {
          let icon = 'ellipse-outline';
          if (route.name === 'index') icon = focused ? 'home' : 'home-outline';
          if (route.name === 'NavigationMap') icon = focused ? 'map' : 'map-outline';
          if (route.name === 'ProfileScreen') icon = focused ? 'person' : 'person-outline';
          if (route.name === 'diagnostics') icon = focused ? 'construct' : 'construct-outline';
          return <Ionicons name={icon} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="NavigationMap" options={{ title: 'Map' }} />
      <Tabs.Screen name="ProfileScreen" options={{ title: 'Profil' }} />
      <Tabs.Screen name="diagnostics" options={{ title: 'Diagnose' }} />

      <Tabs.Screen name="offers/[id]" options={{ href: null, headerTitle: 'Angebot' }} />
      <Tabs.Screen name="[id]" options={{ href: null }} />
      <Tabs.Screen name="OffersScreen" options={{ href: null }} />
      <Tabs.Screen name="NavigationScreen" options={{ href: null }} />
    </Tabs>
  );
}