import React, { useEffect, useRef, useState } from 'react';
import { Stack, useRouter, useRootNavigationState } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';

import PushInitializer from '../components/PushInitializer';

// ------- utils -------
const getQueryParam = (url, key) => {
  if (typeof url !== 'string') return null;
  const m = url.match(new RegExp(`[?&]${key}=([^&]+)`, 'i'));
  return m ? decodeURIComponent(m[1]) : null;
};
const normalizePath = (p) => {
  if (typeof p !== 'string') return null;
  let path = p.trim();
  try {
    if (path.includes('://')) {
      const parsed = Linking.parse(path);
      if (parsed?.path) path = `/${parsed.path}`;
      if (parsed?.queryParams?.id && !path.includes('?')) path += `?id=${parsed.queryParams.id}`;
    }
  } catch {}
  if (!path.startsWith('/')) path = `/${path}`;
  return path.replace(/\/{2,}/g, '/');
};
const extractOfferId = (data, url) => {
  const candidates = [data?.offerId, data?._id, data?.id, getQueryParam(url || '', 'id')];
  const id = candidates.find((v) => v != null && String(v).trim().length > 0);
  return id ? String(id).trim() : null;
};
const navigateFromData = (router, raw) => {
  const data = raw ?? {};
  const rawUrl = typeof data.url === 'string' ? data.url : null;
  const path = normalizePath(rawUrl || '');
  const lower = (path || '').toLowerCase();

  if (lower === '/offerscreen' || lower === 'offerscreen' || lower === '/offerscreen/') {
    const idExplicit = extractOfferId(data, rawUrl);
    router.push(idExplicit ? `/offers/${idExplicit}` : '/(tabs)/OffersScreen');
    return true;
  }
  if (path && path !== '/') {
    router.push(path);
    return true;
  }
  const id = extractOfferId(data, rawUrl);
  if (id) {
    router.push(`/offers/${id}`);
    return true;
  }
  if (data.navigateTo === 'navigation' && id) {
    router.push({ pathname: '/(tabs)/NavigationScreen', params: { id } });
    return true;
  }
  return false;
};

// ------- Root -------
export default function RootLayout() {
  const router = useRouter();
  const navState = useRootNavigationState();

  const navReadyRef = useRef(false);
  const lockRef = useRef(false); // verhindert Doppel-Navigationen
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [mustOnboard, setMustOnboard] = useState(false);

  // System-Splash sofort freigeben (Expo-Native Splash); unser eigenes Overlay gibt es nicht mehr
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
        // kein harter Lock mehr – nur direkte Navigation gleich unten
      } finally {
        setOnboardingChecked(true);
      }
    })();
  }, []);

  // A) Sobald Router ready & Check fertig → entweder Onboarding oder Deeplink/Push
  useEffect(() => {
    if (!onboardingChecked) return;
    whenReady(async () => {
      if (mustOnboard) {
        if (!lockRef.current) {
          lockRef.current = true;
          router.replace('/(onboarding)/WelcomeScreen');
        }
        return;
      }
      // kein Onboarding nötig → Deeplink bevorzugen
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl && !lockRef.current) {
          lockRef.current = true;
          const parsed = Linking.parse(initialUrl);
          if (parsed?.path) router.push(`/${parsed.path}`);
          return;
        }
      } catch {}
      // Last notification fallback
      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        const data = last?.notification?.request?.content?.data ?? null;
        if (data && !lockRef.current) {
          lockRef.current = true;
          navigateFromData(router, data);
        }
      } catch {}
      // sonst nix tun → Tabs bleiben initialer Screen
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboardingChecked, mustOnboard, navState?.key]);

  // B) Laufende App → Notification-Taps
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response?.notification?.request?.content?.data ?? {};
      whenReady(() => {
        lockRef.current = true;
        navigateFromData(router, data);
        setTimeout(() => { lockRef.current = false; }, 300); // kurz entprellen
      });
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navState?.key]);

  // PushInitializer nur einmal rendern
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
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
