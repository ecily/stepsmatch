import { Stack, Redirect, usePathname } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export default function RootLayout() {
  const [initialRoute, setInitialRoute] = useState(undefined);
  const pathname = usePathname();

  // Reload Auth/Interests beim App-Fokus (z.B. nach Login, Register, Onboarding)
  useEffect(() => {
    const fetchAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const interestsJson = await AsyncStorage.getItem('userInterests');
        const interests = interestsJson ? JSON.parse(interestsJson) : null;

        if (!token) {
          setInitialRoute('/(auth)/LoginScreen');
        } else if (!interests || interests.length === 0) {
          setInitialRoute('/(onboarding)/WelcomeScreen');
        } else {
          setInitialRoute('/(tabs)');
        }
      } catch (e) {
        console.error('Fehler beim Lesen von AsyncStorage:', e);
        setInitialRoute('/(auth)/LoginScreen');
      }
    };

    fetchAuth();

    // AppState Listener für Re-Focus (nach Login/Register/Interessenwahl)
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') fetchAuth();
    });

    return () => subscription.remove();
  }, []);

  if (initialRoute === undefined) {
    // Ladeanzeige für Auth-Check (kann durch <ActivityIndicator/> ersetzt werden)
    return null;
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
