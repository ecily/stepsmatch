// stepsmatch/mobile/app/_layout.js
import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { Slot, router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import PushInitializer from '../components/PushInitializer';
import ThemeProvider from '../theme/ThemeProvider';
import LocationAlwaysGate from '../components/permissions/LocationAlwaysGate';

export default function RootLayout() {
  const receiveSub = useRef(null);
  const tapSub = useRef(null);

  useEffect(() => {
    // Nur Listener – Kanäle/Kategorien werden NUR im PushInitializer gesetzt
    receiveSub.current = Notifications.addNotificationReceivedListener((n) => {
      try {
        const c = n?.request?.content || {};
        console.log(
          '[push] received',
          JSON.stringify({
            title: c.title,
            body: c.body,
            channelId: c.channelId,
            data: c.data,
          })
        );
      } catch {}
    });

    tapSub.current = Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        const actionId = response?.actionIdentifier;
        const data = response?.notification?.request?.content?.data || {};
        const offerId = data?.offerId;
        const route = data?.route || (offerId ? `/offers/${offerId}` : null);

        // Standard-Tap oder GO → navigieren
        if (
          actionId !== Notifications.DEFAULT_ACTION_IDENTIFIER &&
          actionId?.toUpperCase?.() !== 'GO'
        ) {
          console.log('[push-tap] ignore action:', actionId, JSON.stringify(data || {}));
          return;
        }

        if (route) {
          console.log('[nav-offer] fromPush=true route=', route);
          router.push(route);
        } else {
          console.log('[push-tap] no route/offerId in data', JSON.stringify(data || {}));
        }
      } catch (e) {
        console.warn('[push] nav error', e?.message || e);
      }
    });

    return () => {
      receiveSub.current?.remove?.();
      tapSub.current?.remove?.();
    };
  }, []);

  return (
    <ThemeProvider>
      <PushInitializer />
      <LocationAlwaysGate />
      <Slot />
    </ThemeProvider>
  );
}
