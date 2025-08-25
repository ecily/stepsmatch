// mobile/app/(onboarding)/_layout.js
import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function OnboardingLayout() {
  return (
    <>
      {/* Onboarding ist bewusst full-bleed, ohne Header */}
      <StatusBar style="light" animated />
      <Stack
        screenOptions={{
          headerShown: false,
          // sanfter, moderner Übergang fürs Onboarding
          animation: 'fade_from_bottom',
          gestureEnabled: true,
          // fühlt sich „snappier“ an bei kurzen Screens
          animationDuration: 250,
          // Android: weiche Ein-/Ausblendung
          contentStyle: { backgroundColor: 'transparent' },
        }}
      >
        {/* Expo Router registriert automatisch alle Dateien in diesem Segment.
            Diese Platzhalter sind optional – du kannst sie löschen, wenn du willst.
            Sie helfen nur beim Typing/Autocompletion. */}
        <Stack.Screen name="WelcomeScreen" />
        <Stack.Screen name="LocationScreen" />
        <Stack.Screen name="InterestsScreen" />
        <Stack.Screen name="DoneScreen" />
      </Stack>
    </>
  );
}
