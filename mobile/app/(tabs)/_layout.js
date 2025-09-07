// stepsmatch/mobile/app/(tabs)/_layout.js
import React, { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import colors from '../../theme/colors';

// ggf. an zentraler Stelle bündeln – hier lokal für den Header
const API_URL = 'https://lobster-app-ie9a5.ondigitalocean.app/api';

/* Kleines Header-Widget: "Hallo, Vorname" */
function HeaderGreeting() {
  const [firstName, setFirstName] = useState(null);

  useEffect(() => {
    (async () => {
      // 1) aus AsyncStorage versuchen
      const tryKeys = [
        'userFirstName',          // direkter Vorname
        'userProfile',            // JSON: { firstName?, name? }
        'user', 'authUser',
        'profile', 'currentUser', // verschiedene mögliche Keys
      ];

      const extractFirst = (val) => {
        if (!val) return null;
        if (typeof val === 'string') {
          try {
            const obj = JSON.parse(val);
            const raw =
              obj?.firstName || obj?.vorname || obj?.name || obj?.fullName || obj?.displayName || null;
            if (raw && typeof raw === 'string') return raw.split(' ')[0].trim();
            // falls es tatsächlich ein String war (kein JSON), nimm den Teil vor dem ersten Leerzeichen
            if (!raw) return val.split(' ')[0].trim();
          } catch {
            return val.split(' ')[0].trim();
          }
        }
        if (typeof val === 'object') {
          const raw =
            val?.firstName || val?.vorname || val?.name || val?.fullName || val?.displayName || null;
          if (raw && typeof raw === 'string') return raw.split(' ')[0].trim();
        }
        return null;
      };

      let nameFromStorage = null;
      for (const k of tryKeys) {
        try {
          const v = await AsyncStorage.getItem(k);
          const first = extractFirst(v);
          if (first) { nameFromStorage = first; break; }
        } catch {}
      }
      if (nameFromStorage) { setFirstName(nameFromStorage); return; }

      // 2) Fallback: API anfragen, falls Token vorhanden
      const tokenKeys = ['authToken', 'token', 'jwt', 'accessToken'];
      let token = null;
      for (const tk of tokenKeys) {
        const t = await AsyncStorage.getItem(tk);
        if (t && String(t).trim()) { token = t.trim(); break; }
      }

      if (token) {
        const endpoints = ['/users/me', '/me', '/auth/me'];
        for (const ep of endpoints) {
          try {
            const res = await fetch(`${API_URL}${ep}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) continue;
            const data = await res.json();

            // mögliche Formen: { name }, { user: { name } }, { data: { name } }
            const rawName =
              data?.name ||
              data?.user?.name ||
              data?.data?.name ||
              null;
            if (rawName && typeof rawName === 'string') {
              const first = rawName.split(' ')[0].trim();
              setFirstName(first);
              // für’s nächste Mal cachen
              try { await AsyncStorage.setItem('userFirstName', first); } catch {}
              return;
            }
          } catch {}
        }
      }

      // 3) Fallback
      setFirstName(null);
    })();
  }, []);

  return (
    <View style={{ paddingRight: 12, alignItems: 'flex-end' }}>
      <Text style={{ color: '#94a3b8', fontSize: 11, marginBottom: 2 }}>Hallo,</Text>
      <Text style={{ color: '#e2e8f0', fontSize: 14, fontWeight: '700' }}>
        {firstName || 'Pilger'}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        // 🔹 kompakter Header (kein extra StatusBar-Offset)
        headerShown: true,
        headerStatusBarHeight: 0,
        headerTitle: 'Stepsmatch',
        headerTitleAlign: 'left',
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '800', fontSize: 18, color: colors.primary },
        headerRight: () => <HeaderGreeting />,

        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopWidth: 0,
          elevation: 8,
          height: 56 + insets.bottom,
          paddingBottom: Math.max(8, insets.bottom),
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarHideOnKeyboard: true,
        tabBarIcon: ({ focused, color, size }) => {
          let icon = 'ellipse-outline';
          if (route.name === 'index') icon = focused ? 'home' : 'home-outline';
          if (route.name === 'NavigationMap') icon = focused ? 'map' : 'map-outline';
          if (route.name === 'ProfileScreen') icon = focused ? 'person' : 'person-outline';
          if (route.name === 'diagnostics') icon = focused ? 'bug' : 'bug-outline';
          return <Ionicons name={icon} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      {/* OffersScreen bleibt versteckt */}
      <Tabs.Screen name="OffersScreen" options={{ href: null }} />
      {/* ⬇️ WICHTIG: alten Navigation-Route explizit ausblenden, falls Datei existiert */}
      <Tabs.Screen name="Navigation" options={{ href: null }} />
      {/* aktive Navigation */}
      <Tabs.Screen name="NavigationMap" options={{ title: 'Navigation' }} />
      <Tabs.Screen name="ProfileScreen" options={{ title: 'Profil' }} />
      {/* ⬇️ Temporärer Tab für Live-Tests */}
      <Tabs.Screen name="diagnostics" options={{ title: 'Diagnostics' }} />
    </Tabs>
  );
}
