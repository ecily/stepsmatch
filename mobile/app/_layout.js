import { Stack, Redirect, usePathname } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';

export default function RootLayout() {
  const [initialRoute, setInitialRoute] = useState(undefined);
  const pathname = usePathname();

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const interestsJson = await AsyncStorage.getItem('userInterests');
        const interests = interestsJson ? JSON.parse(interestsJson) : null;

        if (!token) {
          setInitialRoute('/(auth)/LoginScreen');           // Kein Token → Login
        } else if (!interests || interests.length === 0) {
          setInitialRoute('/(onboarding)/WelcomeScreen');   // Token da, aber keine Interessen → Onboarding
        } else {
          setInitialRoute('/(tabs)');                        // Alles da → Tabs starten
        }
      } catch (e) {
        console.error('Fehler beim Lesen von AsyncStorage:', e);
        setInitialRoute('/(auth)/LoginScreen');             // Im Fehlerfall auch Login
      }
    })();
  }, []);

  if (initialRoute === undefined) {
    return null;  // Ladezustand
  }

  // Redirect nur wenn wir uns auf Root- oder Layoutpfaden befinden, nicht permanent
  if (
    pathname === '/' ||
    pathname.startsWith('/(auth)') ||
    pathname.startsWith('/(onboarding)') ||
    pathname.startsWith('/(tabs)')
  ) {
    if (pathname !== initialRoute) {
      return (
        <>
          <Redirect href={initialRoute} />
          <Stack screenOptions={{ headerShown: false }} />
        </>
      );
    }
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
