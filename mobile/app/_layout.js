import React, { useEffect, useRef, useState } from 'react';
import { Stack, useRouter, useRootNavigationState } from 'expo-router';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';

import PushInitializer from '../components/PushInitializer';
import BackgroundLocationManager from '../components/BackgroundLocationManager';

/**
 * Wichtig:
 * - Notification-Handler + Channels werden EINHEITLICH in PushInitializer gesetzt.
 * - _layout registriert NUR den Tap-Listener für die Navigation.
 */

/* ---------------- helpers (strict) ---------------- */
const extractOfferIdStrict = (data) => {
  const id =
    data?.offerId ||
    data?._id ||
    data?.id ||
    null;
  return id ? String(id).trim() : null;
};

/**
 * Striktes, deterministisches Routing:
 * - Wenn offerId vorhanden → exakt /offers/<id>
 * - Sonst: nichts tun (nur loggen)
 */
const routeFromPushDataStrict = (router, data) => {
  const offerId = extractOfferIdStrict(data || {});
  if (!offerId) {
    console.log('[push-tap] no-offerId data=', JSON.stringify(data || {}));
    return false;
  }
  const path = `/offers/${offerId}`;
  console.log('[nav-offer] fromPush=true route=', path);
  router.replace(path);
  return true;
};

/* ---------------- Root ---------------- */
export default function RootLayout() {
  const router = useRouter();
  const navState = useRootNavigationState();

  const navReadyRef = useRef(false);
  const lockRef = useRef(false); // verhindert Doppel-Navigationen
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [mustOnboard, setMustOnboard] = useState(false);

  // System-Splash sofort freigeben (Expo Splash)
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const whenReady = (fn) => {
    if (navReadyRef.current) return fn();
    const t = setInterval(() => {
      if (navState?.key) {
        navReadyRef.current = true;
        clearInterval(t);
        fn();
      }
    }, 40);
    setTimeout(() => clearInterval(t), 3000);
  };

  // 0) Erststart-Check
  useEffect(() => {
    (async () => {
      try {
        const flag = await AsyncStorage.getItem('hasOnboarded');
        const needs = !flag || flag !== '1';
        setMustOnboard(needs);
      } finally {
        setOnboardingChecked(true);
      }
    })();
  }, []);

  // A) Sobald Router ready & Check fertig → Onboarding oder Deeplink/Push
  useEffect(() => {
    if (!onboardingChecked) return;
    whenReady(async () => {
      if (mustOnboard) {
        if (!lockRef.current) {
          lockRef.current = true;
          console.log('[nav] onboarding replace');
          router.replace('/(onboarding)/WelcomeScreen');
        }
        return;
      }

      // 1) Deeplink prüfen – nur explizit /offers/<id>
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl && !lockRef.current) {
          const parsed = Linking.parse(initialUrl);
          const path = parsed?.path ? `/${parsed.path}` : null;
          const qpId = parsed?.queryParams?.id ? String(parsed.queryParams.id) : null;
          const offerMatch = /^\/offers\/([a-f0-9]{24})$/i.exec(path || '');
          const id = offerMatch?.[1] || qpId || null;

          if (id) {
            lockRef.current = true;
            console.log('[deeplink] route=', `/offers/${id}`);
            router.replace(`/offers/${id}`);
            return;
          }
        }
      } catch {}

      // 2) Letzte Notification als Fallback – strikt auf offerId
      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        const data = last?.notification?.request?.content?.data ?? null;
        if (data && !lockRef.current) {
          lockRef.current = true;
          console.log('[push-recv] lastNotification data=', JSON.stringify(data));
          const ok = routeFromPushDataStrict(router, data);
          if (ok) return;
          lockRef.current = false; // nichts passiert → Lock wieder freigeben
        }
      } catch {}

      // 3) Sonst Tabs als Start – kein extra Routing
      console.log('[nav] default tabs');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboardingChecked, mustOnboard, navState?.key]);

  // B) Laufende App → Notification-Taps (zentral, 1 Listener mit Navigation)
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      // Nur Standard-Tap oder "GO" navigiert (Actions wie DISMISS ignorieren)
      const actionId = response?.actionIdentifier;
      if (
        actionId &&
        actionId !== Notifications.DEFAULT_ACTION_IDENTIFIER &&
        actionId !== 'GO'
      ) {
        console.log('[push-tap] ignore action:', actionId);
        return;
      }

      const data = response?.notification?.request?.content?.data ?? {};
      console.log('[push-tap] data=', JSON.stringify(data));
      whenReady(() => {
        if (lockRef.current) return;
        lockRef.current = true;
        const ok = routeFromPushDataStrict(router, data);
        setTimeout(() => {
          lockRef.current = false;
        }, 350); // kurzes Entprellen
      });
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navState?.key]);

  // PushInitializer nur einmal rendern (richtet Handler+Channels etc. zentral ein)
  const InitializerOnce = React.useMemo(() => () => {
    const once = React.useRef(false);
    if (once.current) return null;
    once.current = true;
    return <PushInitializer />;
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <InitializerOnce />
      <BackgroundLocationManager />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
