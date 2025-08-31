// stepsmatch/mobile/app/_layout.js
import React, { useEffect } from 'react';
import { Slot } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import PushInitializer from '../components/PushInitializer';

// Globaler Foreground-Handler (nur 1x)
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
    // Tap-Listener: Standard-Tap oder "GO" → /offers/[id]
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const actionId = response?.actionIdentifier;
      const data = response?.notification?.request?.content?.data || {};
      const offerId = data?.offerId;

      if (actionId !== Notifications.DEFAULT_ACTION_IDENTIFIER && actionId !== 'GO') {
        console.log('[push-tap] ignore action:', actionId, JSON.stringify(data || {}));
        return;
      }

      if (offerId) {
        const path = `/offers/${offerId}`;
        console.log('[nav-offer] fromPush=true route=', path);
        try { router.push(path); } catch (e) { console.log('[nav-offer] router error', String(e)); }
      } else {
        console.log('[push-tap] no offerId in data', JSON.stringify(data || {}));
        console.log('[NotifNav] Kein offerId/link im Payload:', data || {});
      }
    });

    return () => sub?.remove?.();
  }, []);

  // ← Mounten garantiert, egal welche Tabs/Stacks aktiv sind
  return (
    <>
      <PushInitializer />
      <Slot />
    </>
  );
}
