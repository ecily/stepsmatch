// stepsmatch/mobile/app/(onboarding)/LocationScreen.js
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

// Wir nutzen ausschließlich das neue Gate + Initializer
import { ensureBgAfterOnboarding } from '../../components/PushInitializer';

/**
 * LEGACY SCREEN DEAKTIVIERT
 * -------------------------
 * Dieser Screen wurde früher für Standort-Permissions verwendet.
 * Ab jetzt übernimmt das zentrale PermissionGate den kompletten Flow.
 * Diese Route leitet nur noch leise weiter, damit keine doppelten Bildschirme erscheinen.
 */
export default function LocationScreen() {
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Sicherstellen, dass BG-Services laufen (ohne zusätzliche Popups)
        await ensureBgAfterOnboarding();
      } catch {}
      if (!alive) return;

      // Direkt zum nächsten Onboarding-Schritt
      router.replace('/(onboarding)/InterestsScreen');
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  // Minimaler Fallback während der Weiterleitung
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0b0f17' }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    </SafeAreaView>
  );
}
