// stepsmatch/mobile/app/(tabs)/_layout.js
import React, { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { Text, View, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import colors from '../../theme/colors';

const API_URL = 'https://lobster-app-ie9a5.ondigitalocean.app/api';

/* Kleines Header-Widget: "Hallo, Vorname" */
function HeaderGreeting() {
  const [firstName, setFirstName] = useState(null);

  useEffect(() => {
    (async () => {
      const tryKeys = ['userFirstName','userProfile','user','authUser','profile','currentUser'];
      const extractFirst = (val) => {
        if (!val) return null;
        if (typeof val === 'string') {
          try {
            const obj = JSON.parse(val);
            const raw = obj?.firstName || obj?.vorname || obj?.name || obj?.fullName || obj?.displayName || null;
            if (raw && typeof raw === 'string') return raw.split(' ')[0].trim();
            return val.split(' ')[0].trim();
          } catch {
            return val.split(' ')[0].trim();
          }
        }
        if (typeof val === 'object') {
          const raw = val?.firstName || val?.vorname || val?.name || val?.fullName || val?.displayName || null;
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

      let token = null;
      for (const tk of ['authToken','token','jwt','accessToken']) {
        const t = await AsyncStorage.getItem(tk);
        if (t && String(t).trim()) { token = t.trim(); break; }
      }
      if (token) {
        for (const ep of ['/users/me','/me','/auth/me']) {
          try {
            const res = await fetch(`${API_URL}${ep}`, { headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) continue;
            const data = await res.json();
            const rawName = data?.name || data?.user?.name || data?.data?.name || null;
            if (rawName && typeof rawName === 'string') {
              const first = rawName.split(' ')[0].trim();
              setFirstName(first);
              try { await AsyncStorage.setItem('userFirstName', first); } catch {}
              return;
            }
          } catch {}
        }
      }
      setFirstName(null);
    })();
  }, []);

  return (
    <View style={{ paddingRight: 12, alignItems: 'flex-end' }}>
      <Text style={{ color: '#94a3b8', fontSize: 11, marginBottom: 2 }}>Version 3,</Text>
      <Text style={{ color: '#e2e8f0', fontSize: 14, fontWeight: '700' }}>
        {firstName || 'Pilger'}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  // Intro-Modal: direkt beim Einstieg sichtbar, Tap irgendwo -> schließen
  const [showIntro, setShowIntro] = useState(true);

  return (
    <>
      <Tabs
        sceneContainerStyle={{ backgroundColor: colors.background }}
        screenOptions={({ route }) => ({
          headerShown: true,
          //headerStatusBarHeight: 0,
          headerTitle: 'StepsMatch',
          headerTitleAlign: 'left',
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: '800', fontSize: 18, color: colors.primary, letterSpacing: 0.2 },
          headerTitleAllowFontScaling: true,
          headerTintColor: colors.primary,
          headerRight: () => <HeaderGreeting />,

          statusBarStyle: 'dark',
          statusBarBackgroundColor: colors.background,

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
          tabBarItemStyle: { minWidth: 80 },
          tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
          tabBarHideOnKeyboard: true,

          tabBarIcon: ({ focused, color, size }) => {
            let icon = 'ellipse-outline';
            if (route.name === 'index') icon = focused ? 'home' : 'home-outline';
            if (route.name === 'ProfileScreen') icon = focused ? 'person' : 'person-outline';
            if (route.name === 'diagnostics') icon = focused ? 'bug' : 'bug-outline';
            if (route.name === 'NavigationMap') icon = focused ? 'navigate' : 'navigate-outline';
            return <Ionicons name={icon} size={size} color={color} />;
          },
        })}
      >
        {/* Sichtbare Tabs */}
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="NavigationMap" options={{ title: 'Navigation' }} />
        <Tabs.Screen name="ProfileScreen" options={{ title: 'Profil' }} />
        <Tabs.Screen name="diagnostics" options={{ title: 'Diagnostics' }} />

        {/* Detailseite: NICHT in der Tabbar, aber mit Header "Details" */}
        <Tabs.Screen
          name="offers/[id]"
          options={{
            href: null,                // <- Tabbar ausblenden
            headerTitle: 'Details',    // <- wenn aktiv, Header-Titel setzen
            // tabBarStyle: { display: 'none' }, // optional: Tabbar auf der Detailseite komplett verbergen
          }}
        />

        {/* Versteckte/ausgeblendete Screens */}
        <Tabs.Screen name="[id]" options={{ href: null }} />          {/* dynamischer Rest — ausblenden */}
        <Tabs.Screen name="OffersScreen" options={{ href: null }} />
        {/* NavigationScreen bleibt versteckt (falls vorhanden) */}
        <Tabs.Screen name="NavigationScreen" options={{ href: null }} />
        {/* Wichtig: KEIN "navigation" Alias definieren */}
      </Tabs>

      {/* Intro-Modal Overlay */}
      <Modal
        visible={showIntro}
        transparent
        animationType="fade"
        onRequestClose={() => setShowIntro(false)} // Android Back
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.6)',
            paddingHorizontal: 24,
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={() => setShowIntro(false)}
          accessibilityRole="button"
          accessibilityLabel="Intro schließen"
        >
          <View
            style={{
              width: '100%',
              borderRadius: 16,
              paddingVertical: 20,
              paddingHorizontal: 18,
              backgroundColor: 'rgba(16,18,22,0.96)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.10)',
            }}
          >
            <Text style={{ color: '#E9F1FF', fontSize: 18, fontWeight: '800', textAlign: 'center' }}>
              StepsMatch - find. not seek.
            </Text>
            <Text style={{ color: '#cbd5e1', fontSize: 14, marginTop: 8, textAlign: 'center' }}>
              Alpha - Testversion.
            </Text>
            <Text style={{ color: '#cbd5e1', fontSize: 14, marginTop: 14, textAlign: 'center' }}>
              Danke, probiere, teste und gib mir Feeback.
            </Text>
            <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 12, textAlign: 'center' }}>
              (Zum Schließen irgendwo tippen)
            </Text>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
