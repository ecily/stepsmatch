import { Stack, Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';

export default function RootLayout() {
  const [initialRoute, setInitialRoute] = useState(undefined);

  useEffect(() => {
    (async () => {
      const interests = await AsyncStorage.getItem('userInterests');
      if (interests) {
        setInitialRoute('/(tabs)/HomeScreen');
      } else {
        setInitialRoute('/(onboarding)/WelcomeScreen');
      }
    })();
  }, []);

  // Während des Ladens: Splash, Ladeanimation, oder null
  if (initialRoute === undefined) {
    return null;
  }

  return (
    <>
      {initialRoute && <Redirect href={initialRoute} />}
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
