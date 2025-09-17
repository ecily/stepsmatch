// stepsmatch/mobile/app/_layout.js
import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { Slot, router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
      lastPushedAt: ts,           // generisch: „zuletzt gepusht“ (egal ob remote/local)
      lastPushedAtRemote: ts,     // explizit: Remote/Server-Push Zeitstempel
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
    // Kategorien / Actions (plattformübergreifend)
    // Kategorie für Angebots-Pushes mit GO/DISMISS
    await Notifications.setNotificationCategoryAsync('offer-go', [
      {
        identifier: 'GO',
        buttonTitle: 'LOS',
        options: { opensAppToForeground: true }, // iOS relevant; auf Android ok
      },
      {
        identifier: 'DISMISS',
        buttonTitle: 'AUSBLENDEN',
        options: { isDestructive: true }, // iOS Styling; auf Android ok
      },
    ]);

    if (Platform.OS === 'android') {
      // Gemeinsames Vibrationsmuster: kräftig & markant (Branding)
      // Format: [delay, on, off, on, off, on]
      const brandVibration = [0, 350, 120, 350, 180, 500];

      // Offers-Channel: Maximale Sichtbarkeit + Sound + Vibrationsmuster
      await Notifications.setNotificationChannelAsync('offers', {
        name: 'Offers',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',               // System-Standard
        enableVibrate: true,
        vibrationPattern: brandVibration,
        enableLights: true,
        lightColor: colors?.primary || '#0d4ea6',
        bypassDnd: false,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });

      // Default-App-Channel: normal, dezenter
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

      // BG-Location-Channel: ruhig, kein Sound
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
    console.warn('[push-ui] configure failed', e?.message || e);
  }
}

export default function RootLayout() {
  const receiveSub = useRef(null);
  const tapSub = useRef(null);

  useEffect(() => {
    // Zuerst zentrale UI/Branding-Einstellungen (Channels/Kategorien)
    configureNotificationUI();

    // Nur Listener – die Mechanik (Geofences/Heartbeat/Dedupe) bleibt im PushInitializer
    receiveSub.current = Notifications.addNotificationReceivedListener((n) => {
      try {
        const c = n?.request?.content || {};
        const data = c?.data || {};
        const offerId = data?.offerId;

        // Log
        console.log(
          '[push] received',
          JSON.stringify({
            title: c.title,
            body: c.body,
            channelId: c.channelId,
            data: data,
          })
        );

        // Remote-Push für Offer merken → Dedupe ggü. lokalem Geofence-Push
        if (offerId) {
          // fire-and-forget
          markOfferRemotePushed(offerId);
        }
      } catch (e) {
        console.warn('[push] receive handler error', e?.message || e);
      }
    });

    tapSub.current = Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        const actionId = response?.actionIdentifier;
        const data = response?.notification?.request?.content?.data || {};
        const offerId = data?.offerId;
        const route = data?.route || (offerId ? `/offers/${offerId}` : null);

        // Nur Standardtap oder GO → navigieren (SNOOZE existiert nicht; DISMISS nur ausblenden)
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
