// stepsmatch/mobile/app/_layout.js
import React, { useEffect, useRef } from 'react';
import { Platform, AppState } from 'react-native';
import { Slot, router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ✅ Schritt 2/3 Bootstrap: zentral hier importieren
import { ensureChannels } from '../components/push/push-notifications';
import {
  kickstartBackgroundLocation,
  useLocationWatchdog,
} from '../components/push/push-location';

import PushInitializer from '../components/PushInitializer';
import ThemeProvider from '../theme/ThemeProvider';
import LocationAlwaysGate from '../components/permissions/LocationAlwaysGate';
import colors from '../theme/colors';

/* ────────────────────────────────────────────────────────────
   Globaler Notification-Handler (reines UI/UX-Verhalten)
   – Alert sichtbar, Sound an, kein Badge.
   – Mechanik (Geofence/Heartbeat) bleibt unberührt.
   ──────────────────────────────────────────────────────────── */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Kleiner Helper fürs Mergen von Offer-Push-States
async function markOfferRemotePushed(offerId) {
  if (!offerId) return;
  const key = `offerPushState.${offerId}`;
  const ts = Date.now();
  try {
    const prevRaw = await AsyncStorage.getItem(key);
    const prev = prevRaw ? JSON.parse(prevRaw) : {};
    const next = {
      ...prev,
      lastPushedAt: ts,          // generisch: „zuletzt gepusht“
      lastPushedAtRemote: ts,    // explizit: Remote/Server-Push
      lastSource: 'remote',
    };
    await AsyncStorage.setItem(key, JSON.stringify(next));
  } catch (e) {
    console.warn('[push] persist remote ts failed', e?.message || e);
  }
}

/* ────────────────────────────────────────────────────────────
   Zentrale UI/Branding-Konfiguration der Notifications
   - Android Channels (Farben, Importance, Sound, Vibration)
   - Kategorien/Aktionen (GO, DISMISS) – ohne SNOOZE
   Hinweis:
   - Aufruf ist idempotent; erneutes Setzen aktualisiert nur.
   - PushInitializer behält weiterhin die Mechanik (Tasks, Dedupe etc.).
   ──────────────────────────────────────────────────────────── */
async function configureNotificationUI() {
  try {
    // Kategorie / Actions
    await Notifications.setNotificationCategoryAsync('offer-go', [
      {
        identifier: 'GO',
        buttonTitle: 'LOS',
        options: { opensAppToForeground: true },
      },
      {
        identifier: 'DISMISS',
        buttonTitle: 'AUSBLENDEN',
        options: { isDestructive: true },
      },
    ]);

    if (Platform.OS === 'android') {
      const brandVibration = [0, 350, 120, 350, 180, 500];

      await Notifications.setNotificationChannelAsync('offers', {
        name: 'Offers',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        enableVibrate: true,
        vibrationPattern: brandVibration,
        enableLights: true,
        lightColor: colors?.primary || '#0d4ea6',
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
        lightColor: colors?.primary || '#0d4ea6',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      });

      await Notifications.setNotificationChannelAsync(
        'com.ecily.mobile:stepsmatch-bg-location-task',
        {
          name: 'StepsMatch Hintergrund',
          importance: Notifications.AndroidImportance.LOW,
          sound: null,
          enableVibrate: false,
          enableLights: false,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.SECRET,
        }
      );
    }
  } catch (e) {
    console.warn('[push-ui] configure failed', e?.message || e);
  }
}

export default function RootLayout() {
  const receiveSub = useRef(null);
  const tapSub = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  // ✅ Watchdog Hook mounten (läuft dauerhaft im Root)
  useLocationWatchdog();

  useEffect(() => {
    // Kaltstart-Bootstrap: UI/Channels + BG-Location
    configureNotificationUI();
    ensureChannels();
    kickstartBackgroundLocation();

    // AppState-Resume-Guard: bei Rückkehr in den Vordergrund neu „anstupsen“
    const sub = AppState.addEventListener('change', (state) => {
      const wasBg = /inactive|background/.test(appStateRef.current || '');
      if (wasBg && state === 'active') {
        // Idempotent; sorgt dafür, dass nach Doze/Standby sofort wieder Puls anliegt
        ensureChannels();
        kickstartBackgroundLocation();
      }
      appStateRef.current = state;
    });

    // Notification-Empfang → Remote-Dedupe markieren
    receiveSub.current = Notifications.addNotificationReceivedListener((n) => {
      try {
        const c = n?.request?.content || {};
        const data = c?.data || {};
        const offerId = data?.offerId;

        console.log(
          '[push] received',
          JSON.stringify({
            title: c.title,
            body: c.body,
            channelId: c.channelId,
            data: data,
          })
        );

        if (offerId) {
          // fire-and-forget
          markOfferRemotePushed(offerId);
        }
      } catch (e) {
        console.warn('[push] receive handler error', e?.message || e);
      }
    });

    // Notification-Tap / GO → in Offer-Detail navigieren
    tapSub.current = Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        const actionId = response?.actionIdentifier;
        const data = response?.notification?.request?.content?.data || {};
        const offerId = data?.offerId;
        const route = data?.route || (offerId ? `/offers/${offerId}` : null);

        // Nur Standardtap oder GO → navigieren
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
      sub?.remove?.();
    };
  }, []);

  return (
    <ThemeProvider>
      {/* Mechanik (Tasks/Geofence/Heartbeat/Dedupe) bleibt zentral hier gemountet */}
      <PushInitializer />
      {/* Permission-Gate für „Immer erlauben“ */}
      <LocationAlwaysGate />
      <Slot />
    </ThemeProvider>
  );
}
