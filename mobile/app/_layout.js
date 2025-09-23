// stepsmatch/mobile/app/_layout.js
import React, { useEffect, useRef } from 'react';
import { Platform, AppState } from 'react-native';
import { Slot, router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

import PushInitializer from '../components/PushInitializer';
import ThemeProvider from '../theme/ThemeProvider';
import LocationAlwaysGate from '../components/permissions/LocationAlwaysGate';
import colors from '../theme/colors';
import { refreshExpoPushTokenNow } from '../components/push/push-token-refresh';

/* ────────────────────────────────────────────────────────────
   Globaler Notification-Handler (UI/UX-Verhalten)
   ──────────────────────────────────────────────────────────── */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/* ────────────────────────────────────────────────────────────
   Remote-Push als „gesehen“ markieren (für Dedupe)
   ──────────────────────────────────────────────────────────── */
async function markOfferRemotePushed(offerId) {
  if (!offerId) return;
  const key = `offerPushState.${offerId}`;
  const ts = Date.now();
  try {
    const prevRaw = await AsyncStorage.getItem(key);
    const prev = prevRaw ? JSON.parse(prevRaw) : {};
    const next = {
      ...prev,
      lastPushedAt: ts,
      lastPushedAtRemote: ts,
      lastSource: 'remote',
    };
    await AsyncStorage.setItem(key, JSON.stringify(next));
  } catch (e) {
    console.warn('[push] persist remote ts failed', e && e.message ? e.message : e);
  }
}

/* ────────────────────────────────────────────────────────────
   Notification-Kanäle & Kategorien (idempotent)
   ──────────────────────────────────────────────────────────── */
async function configureNotificationUI() {
  try {
    // Kategorien / Actions
    await Notifications.setNotificationCategoryAsync('offer-go', [
      { identifier: 'GO',      buttonTitle: 'LOS',        options: { opensAppToForeground: true } },
      { identifier: 'DISMISS', buttonTitle: 'AUSBLENDEN', options: { isDestructive: true } },
    ]);

    if (Platform.OS === 'android') {
      const brandVibration = [0, 350, 120, 350, 180, 500];

      // Wichtig: Kanal-ID muss zum Backend passen → 'offers-v2'
      await Notifications.setNotificationChannelAsync('offers-v2', {
        name: 'Offers',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        enableVibrate: true,
        vibrationPattern: brandVibration,
        enableLights: true,
        lightColor: (colors && colors.primary) || '#0d4ea6',
        bypassDnd: false,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });

      await Notifications.setNotificationChannelAsync('stepsmatch-default-v2', {
        name: 'StepsMatch',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
        enableVibrate: true,
        vibrationPattern: [0, 220],
        enableLights: true,
        lightColor: (colors && colors.primary) || '#0d4ea6',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      });

      await Notifications.setNotificationChannelAsync('com.ecily.mobile:stepsmatch-bg-location-task', {
        name: 'StepsMatch Hintergrund',
        importance: Notifications.AndroidImportance.LOW,
        sound: null,
        enableVibrate: false,
        enableLights: false,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.SECRET,
      });
    }
  } catch (e) {
    console.warn('[push-ui] configure failed', e && e.message ? e.message : e);
  }
}

export default function RootLayout() {
  const receiveSub = useRef(null);
  const tapSub = useRef(null);
  const appStateSub = useRef(null);

  useEffect(() => {
    // 1) UI/Channels/Kategorien setzen
    configureNotificationUI();

    // 2) Token sofort aktualisieren (App-Start)
    refreshExpoPushTokenNow('app-start').catch(() => {});

    // 3) Bei Rückkehr in den Vordergrund nochmal refreshen
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        refreshExpoPushTokenNow('app-foreground').catch(() => {});
      }
    });
    appStateSub.current = sub;

    // 4) Listener für Empfang
    receiveSub.current = Notifications.addNotificationReceivedListener((n) => {
      try {
        const c = (n && n.request && n.request.content) || {};
        const data = c.data || {};
        const offerId = data.offerId;

        console.log(
          '[push] received',
          JSON.stringify({ title: c.title, body: c.body, channelId: c.channelId, data })
        );

        if (offerId) {
          // fire-and-forget
          markOfferRemotePushed(offerId);
        }
      } catch (e) {
        console.warn('[push] receive handler error', e && e.message ? e.message : e);
      }
    });

    // 5) Listener für Tap/Actions
    tapSub.current = Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        const actionId = response && response.actionIdentifier;
        const data =
          (response &&
            response.notification &&
            response.notification.request &&
            response.notification.request.content &&
            response.notification.request.content.data) ||
          {};
        const offerId = data.offerId;
        const route = data.route || (offerId ? `/offers/${offerId}` : null);

        const isDefaultTap =
          actionId === Notifications.DEFAULT_ACTION_IDENTIFIER ||
          (actionId && actionId.toUpperCase && actionId.toUpperCase() === 'GO');

        if (!isDefaultTap) {
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
        console.warn('[push] nav error', e && e.message ? e.message : e);
      }
    });

    return () => {
      if (receiveSub.current && receiveSub.current.remove) receiveSub.current.remove();
      if (tapSub.current && tapSub.current.remove) tapSub.current.remove();
      if (appStateSub.current && appStateSub.current.remove) appStateSub.current.remove();
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
