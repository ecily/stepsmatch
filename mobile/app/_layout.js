// stepsmatch/mobile/app/_layout.js
import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { Slot, router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import PushInitializer from '../components/PushInitializer';

// Globaler Handler (nur 1x)
if (!globalThis.__stepsmatchPushHandlerSet) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      // SDK 50: shouldShowAlert ist deprecated
      shouldShowBanner: true, // Banner im FG
      shouldShowList: true,   // in Notification Shade sichtbar
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  globalThis.__stepsmatchPushHandlerSet = true;
}

export default function RootLayout() {
  const receiveSub = useRef(null);
  const tapSub = useRef(null);

  useEffect(() => {
    // Android-Channel sicherstellen (muss mit serverseitigem channelId "offers" matchen)
    async function ensureChannel() {
      if (Platform.OS === 'android') {
        try {
          await Notifications.setNotificationChannelAsync('offers', {
            name: 'Offers',
            importance: Notifications.AndroidImportance.MAX,
            sound: 'default',
            vibrationPattern: [250, 250, 500, 250],
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
            bypassDnd: true,
            // showBadge: false, // optional
          });
        } catch (e) {
          console.warn('[notif] setNotificationChannelAsync failed:', e?.message || e);
        }
      }
    }
    ensureChannel();

    // Received-Listener: zeigt ankommende Pushes (FG/BG) inkl. Payload
    receiveSub.current = Notifications.addNotificationReceivedListener((n) => {
      try {
        const c = n?.request?.content || {};
        console.log('[push] received', JSON.stringify({
          title: c.title,
          body: c.body,
          channelId: c.channelId,
          data: c.data,
        }));
      } catch {}
    });

    // Tap-Listener: Standard-Tap oder "GO" → /offers/[id] oder data.route
    tapSub.current = Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        const actionId = response?.actionIdentifier;
        const data = response?.notification?.request?.content?.data || {};
        const offerId = data?.offerId;
        const route = data?.route || (offerId ? `/offers/${offerId}` : null);

        if (actionId !== Notifications.DEFAULT_ACTION_IDENTIFIER && actionId !== 'GO') {
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
    <>
      <PushInitializer />
      <Slot />
    </>
  );
}
