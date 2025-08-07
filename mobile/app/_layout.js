import { Stack, Redirect, usePathname } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { AppState, ActivityIndicator, View } from 'react-native';

export default function RootLayout() {
  const [initialRoute, setInitialRoute] = useState(undefined);
  const pathname = usePathname();

  useEffect(() => {
    const fetchAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        // --- Pitch-Version: Nur Token zählt! ---
        if (!token) {
          setInitialRoute('/(auth)/LoginScreen');
        } else {
          setInitialRoute('/(tabs)');
        }
      } catch (e) {
        console.error('Fehler beim Lesen von AsyncStorage:', e);
        setInitialRoute('/(auth)/LoginScreen');
      }
    };

    fetchAuth();

    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') fetchAuth();
    });

    return () => subscription.remove();
  }, []);

  if (initialRoute === undefined) {
    // Zeige ActivityIndicator während Auth geprüft wird (bessere UX)
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#0062FF" />
      </View>
    );
  }

  // Redirect nur, wenn wir auf "/" sind und noch nicht am Ziel
  if (pathname === '/' && pathname !== initialRoute) {
    return (
      <>
        <Redirect href={initialRoute} />
        <Stack screenOptions={{ headerShown: false }} />
      </>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
