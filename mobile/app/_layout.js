// stepsmatch/mobile/app/_layout.js
import React, { useEffect } from 'react';
import { Slot } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

// Ein globaler Handler ist bereits in PushInitializer gesetzt.
// Falls _layout vor PushInitializer geladen wird, doppeln wir nicht:
if (!globalThis.__stepsmatchPushHandlerSet) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  globalThis.__stepsmatchPushHandlerSet = true;
}

export default function RootLayout() {
  useEffect(() => {
    // Tap-Listener für Standard-Tap und "GO"
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const actionId = response?.actionIdentifier;
      const data = response?.notification?.request?.content?.data || {};
      const offerId = data?.offerId;

      // Nur bei Default oder GO navigieren
      if (actionId !== Notifications.DEFAULT_ACTION_IDENTIFIER && actionId !== 'GO') {
        console.log('[push-tap] ignore action for navigation:', actionId, JSON.stringify(data || {}));
        return;
      }

      if (offerId) {
        const path = `/offers/${offerId}`;
        console.log('[nav-offer] fromPush=true route=', path);
        try {
          router.push(path);
        } catch (e) {
          console.log('[nav-offer] router error', String(e));
        }
      } else {
        console.log('[push-tap] no offerId in data', JSON.stringify(data));
      }
    });

    return () => {
      sub?.remove?.();
    };
  }, []);

  return <Slot />;
}
