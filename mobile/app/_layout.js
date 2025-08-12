import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

// Neu: PushInitializer einbinden
import PushInitializer from '../components/PushInitializer';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      {/* Startet Geofencing-Registrierung */}
      <PushInitializer />
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
