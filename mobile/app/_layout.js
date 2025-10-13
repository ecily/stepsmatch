// stepsmatch/mobile/app/_layout.js
import React, { useCallback, useEffect, useState, useRef } from 'react';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Globales Theme
import ThemeProvider from '../theme/ThemeProvider';

// Startet Foreground-Location-Service, Geofencing, Channels (ohne Popups)
import PushInitializer, {
  ensureBgAfterOnboarding,
  getBgStatus,
} from '../components/PushInitializer';

// Neues Onboarding-Gate (Notifs → FG+BG-Location → Akku-Optimierung)
import PermissionGate from '../components/PermissionGate';

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);
  const gateCompletedRef = useRef(false);

  // Falls die App mit bereits erteilten Rechten startet, Gate überspringen
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const s = await getBgStatus();
        if (!mounted) return;
        if (s?.locPerms && s?.notifPerms) {
          setAppReady(true);
        }
      } catch {
        // still — Gate übernimmt dann
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleGateDone = useCallback(async () => {
    if (gateCompletedRef.current) return; // Doppelklick-Schutz
    gateCompletedRef.current = true;

    try {
      // Startet BG-Location + Geofences + Token-Register OHNE Dialoge
      await ensureBgAfterOnboarding();
    } catch {
      // Logs werden im PushInitializer geführt
    } finally {
      setAppReady(true);
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          {appReady ? (
            <>
              {/* Initialisierung erst NACH erfüllten Voraussetzungen */}
              <PushInitializer />
              <Slot />
              <StatusBar style="auto" />
            </>
          ) : (
            // Geführter Onboarding-Flow (2-stufig: Notifs → FG/BG-Location)
            <PermissionGate onDone={handleGateDone} />
          )}
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
