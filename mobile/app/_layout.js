import React, { useEffect } from 'react';
import { Stack, useRouter, useRootNavigationState } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';

import PushInitializer from '../components/PushInitializer';

// ---- Helpers ---------------------------------------------------------------

function getQueryParam(url, key) {
  if (typeof url !== 'string') return null;
  const m = url.match(new RegExp(`[?&]${key}=([^&]+)`, 'i'));
  return m ? decodeURIComponent(m[1]) : null;
}

function normalizePath(p) {
  if (typeof p !== 'string') return null;
  let path = p.trim();

  // evtl. "mobile://OfferScreen?id=..." → auf Pfad reduzieren
  try {
    if (path.includes('://')) {
      const parsed = Linking.parse(path);
      if (parsed?.path) path = `/${parsed.path}`;
      if (parsed?.queryParams?.id && !path.includes('?')) path += `?id=${parsed.queryParams.id}`;
    }
  } catch {}

  if (!path.startsWith('/')) path = `/${path}`;
  path = path.replace(/\/{2,}/g, '/');
  return path;
}

function extractOfferId(data, url) {
  // priorisierte Quellen für die ID
  const candidates = [
    data?.offerId,
    data?._id,
    data?.id,
    getQueryParam(url || '', 'id')
  ];
  const id = candidates.find((v) => v != null && String(v).trim().length > 0);
  return id ? String(id).trim() : null;
}

function navigateFromData(router, raw) {
  const data = raw ?? {};
  const rawUrl = typeof data.url === 'string' ? data.url : null;
  const path = normalizePath(rawUrl || '');

  // ---- Spezieller Fix: inkompatibler Pfad "/OfferScreen" ------------------
  // Wir erlauben mehrere Schreibweisen: /OfferScreen, OfferScreen, /offerscreen …
  const lower = (path || '').toLowerCase();
  if (lower === '/offerscreen' || lower === 'offerscreen' || lower === '/offerscreen/') {
    const id = extractOfferId(data, rawUrl);
    if (id) {
      // → Detailseite öffnen
      router.push(`/offers/${id}`);
      return true;
    } else {
      // → Tabs-Übersicht als Fallback
      router.push('/(tabs)/OffersScreen');
      return true;
    }
  }

  // ---- Reguläre, bereits korrekte Varianten -------------------------------
  // 1) Fertiger interner Pfad, z. B. "/offers/123" oder "/(tabs)/OffersScreen"
  if (path && path !== '/') {
    router.push(path);
    return true;
  }

  // 2) Kein nutzbarer Pfad, aber Offer-ID vorhanden → baue Detailroute
  const id = extractOfferId(data, rawUrl);
  if (id) {
    router.push(`/offers/${id}`);
    return true;
  }

  // 3) Explizit NavigationScreen
  if (data.navigateTo === 'navigation' && id) {
    router.push({ pathname: '/(tabs)/NavigationScreen', params: { id } });
    return true;
  }

  // nichts zu navigieren
  return false;
}

// ---- RootLayout -----------------------------------------------------------

export default function RootLayout() {
  const router = useRouter();
  const navState = useRootNavigationState(); // stellt sicher, dass Router bereit ist

  const whenReady = (fn) => {
    if (navState?.key) return fn();
    const t = setInterval(() => {
      if (navState?.key) {
        clearInterval(t);
        fn();
      }
    }, 50);
    setTimeout(() => clearInterval(t), 3000);
  };

  // A) Deeplink (falls genutzt)
  useEffect(() => {
    whenReady(async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          const parsed = Linking.parse(initialUrl);
          if (parsed?.path) {
            router.push(`/${parsed.path}`);
            return;
          }
        }
      } catch {}
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navState?.key]);

  // B) Cold Start über letzte Notification (typisch für Expo Push)
  useEffect(() => {
    whenReady(async () => {
      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        const data = last?.notification?.request?.content?.data ?? null;
        if (data) navigateFromData(router, data);
      } catch {}
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navState?.key]);

  // C) App läuft → Notification-Taps live abfangen
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response?.notification?.request?.content?.data ?? {};
      whenReady(() => navigateFromData(router, data));
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navState?.key]);

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <PushInitializer />
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
