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
    async function ensureAndroidChannelsAndCategories() {
      if (Platform.OS !== 'android') return;

      try {
        // ✅ Starke Vibration & maximale Wichtigkeit
        const STRONG_PATTERN = [0, 400, 200, 800, 300, 1000];

        // Neuer High-Priority Channel für lokale Sofort-Pushes
        await Notifications.setNotificationChannelAsync('offers-high-v2', {
          name: 'Offers (High)',
          importance: Notifications.AndroidImportance.MAX,
          sound: 'default',
          vibrationPattern: STRONG_PATTERN,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          bypassDnd: true,
        });

        // Rückfallebene: Falls Server/Alt-Code noch "offers" sendet, ist der auch laut/stark
        await Notifications.setNotificationChannelAsync('offers', {
          name: 'Offers',
          importance: Notifications.AndroidImportance.MAX,
          sound: 'default',
          vibrationPattern: STRONG_PATTERN,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          bypassDnd: true,
        });

        // Kategorie mit Actions (GO, DISMISS) – passend zu deinem Produktentscheid
        await Notifications.setNotificationCategoryAsync('offer-go', [
          {
            identifier: 'GO',
            buttonTitle: 'GO',
            options: { opensAppToForeground: true },
          },
          {
            identifier: 'DISMISS',
            buttonTitle: 'DISMISS',
            options: { isDestructive: true },
          },
        ]);

        console.log('[notif] channels ready: offers-high-v2 & offers; category: offer-go');
      } catch (e) {
        console.warn('[notif] ensure channels/categories failed:', e?.message || e);
      }
    }

    ensureAndroidChannelsAndCategories();

    // Received-Listener: zeigt ankommende Pushes (FG/BG) inkl. Payload
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

    // Tap-Listener: Standard-Tap oder "GO" → /offers/[id] oder data.route
    tapSub.current = Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        const actionId = response?.actionIdentifier;
        const data = response?.notification?.request?.content?.data || {};
        const offerId = data?.offerId;
        const route = data?.route || (offerId ? `/offers/${offerId}` : null);

        if (
          actionId !== Notifications.DEFAULT_ACTION_IDENTIFIER &&
          actionId !== 'GO'
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
    <>
      <PushInitializer />
      <Slot />
    </>
  );
}
