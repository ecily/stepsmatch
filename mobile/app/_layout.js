import { Stack, Redirect, usePathname } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';

export default function RootLayout() {
  const [initialRoute, setInitialRoute] = useState(undefined);
  const pathname = usePathname();

  useEffect(() => {
    (async () => {
      const interests = await AsyncStorage.getItem('userInterests');
      setInitialRoute(interests ? '/(tabs)' : '/(onboarding)/WelcomeScreen');
    })();
  }, []);

  if (initialRoute === undefined) {
    return null; // Ladezustand
  }

  // Redirect NUR beim echten Start oder falscher Route (nie wenn User schon am Ziel ist)
  if (
    pathname === '/' ||
    pathname === '/(tabs)/HomeScreen' ||
    pathname === '/(tabs)' ||
    pathname === '/(onboarding)' ||
    pathname === '/(onboarding)/WelcomeScreen'
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

  // Stack für alles andere (Tabs und Onboarding laufen dann normal)
  return <Stack screenOptions={{ headerShown: false }} />;
}
