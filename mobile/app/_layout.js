import { Stack, Redirect, usePathname } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';

export default function RootLayout() {
  const [initialRoute, setInitialRoute] = useState(undefined);
  const pathname = usePathname();

  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem('token');
      const interests = await AsyncStorage.getItem('userInterests');

      if (!token) {
        setInitialRoute('/(auth)/LoginScreen');
      } else if (!interests) {
        setInitialRoute('/(onboarding)/WelcomeScreen');
      } else {
        setInitialRoute('/(tabs)/index'); // <<--- IMMER EXPLIZIT AUF INDEX
      }
    })();
  }, []);

  if (initialRoute === undefined) {
    return null;
  }

  if (
    pathname === '/' ||
    pathname === '/(tabs)' ||
    pathname === '/(tabs)/index' ||
    pathname === '/(onboarding)' ||
    pathname === '/(auth)' ||
    pathname === '/(onboarding)/WelcomeScreen' ||
    pathname === '/(auth)/LoginScreen'
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
