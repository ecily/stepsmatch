import { Stack, Redirect, usePathname } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { AppState, ActivityIndicator, View } from 'react-native';

export default function RootLayout() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const pathname = usePathname();

  // Prüft Token bei Start und bei AppState-Wechsel
  useEffect(() => {
    const fetchAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        setIsAuthenticated(!!token);
      } catch (e) {
        console.error('Fehler beim Lesen von AsyncStorage:', e);
        setIsAuthenticated(false);
      }
      setIsLoading(false);
    };

    fetchAuth();

    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') fetchAuth();
    });

    return () => subscription.remove();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#0062FF" />
      </View>
    );
  }

  // Redirect abhängig vom Auth-Status und aktuellem Pfad
  if (!isAuthenticated && !pathname.startsWith('/(auth)')) {
    return (
      <>
        <Redirect href="/(auth)/LoginScreen" />
        <Stack screenOptions={{ headerShown: false }} />
      </>
    );
  }
  if (isAuthenticated && pathname.startsWith('/(auth)')) {
    return (
      <>
        <Redirect href="/(tabs)" />
        <Stack screenOptions={{ headerShown: false }} />
      </>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
