// stepsmatch/mobile/components/PushInitializer.js
import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import Constants from 'expo-constants';

const BG_LOCATION_TASK = 'stepsmatch-bg-location-task';

// Produktionswerte
const HEARTBEAT_MIN_SECONDS = 45;          // Anti-Spam-Puffer
const TIME_INTERVAL_MS = 60 * 1000;        // ~1x/Minute im Stillstand
const API_BASE = 'https://lobster-app-ie9a5.ondigitalocean.app/api';

let lastHeartbeatAt = 0;

/* ---------- Helpers ---------- */

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('stepsmatch-default-v2', {
    name: 'StepsMatch',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: 'default',
  });
}

async function getStoredOrFetchExpoToken() {
  let t =
    Constants.expoConfig?.extra?.expoPushToken ||
    Constants.manifest2?.extra?.expoPushToken ||
    null;
  if (!t) {
    try {
      const { data } = await Notifications.getExpoPushTokenAsync();
      t = data;
      if (!Constants.expoConfig) Constants.expoConfig = { extra: {} };
      if (!Constants.expoConfig.extra) Constants.expoConfig.extra = {};
      Constants.expoConfig.extra.expoPushToken = t;
      console.log('[push] fetched expoToken (fallback) =', t);
    } catch (e) {
      console.log('[push] fallback token error', e?.message || e);
    }
  }
  return t || null;
}

/** Baut Payload & sendet Heartbeat nur wenn token/coords valide sind */
async function sendHeartbeat(coords, label = 'Heartbeat') {
  try {
    if (!coords || typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number') {
      console.log('[BGLOC] skip send (no coords)');
      return false;
    }

    const expoToken = await getStoredOrFetchExpoToken();
    if (!expoToken) {
      console.log('[BGLOC] skip send (no expoToken)');
      return false;
    }

    const payload = {
      token: expoToken,
      platform: Platform.OS,
      lat: coords.latitude,
      lng: coords.longitude, // wichtig: 'lng' (nicht 'lon')
      acc: coords.accuracy ?? null,
      speed: coords.speed ?? null,
      heading: coords.heading ?? null,
    };

    const res = await fetch(`${API_BASE}/location/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const txt = await res.text();
    console.log(`[BGLOC] ${label} HTTP`, res.status, txt);

    if (res.ok) {
      console.log(
        `[BGLOC] ${label} sent lat=${coords.latitude?.toFixed?.(5)} lng=${coords.longitude?.toFixed?.(5)} acc=${coords.accuracy}`
      );
      return true;
    } else {
      console.log('[BGLOC] server rejected; payload was', JSON.stringify(payload));
      return false;
    }
  } catch (e) {
    console.log('[BGLOC] Exception in sendHeartbeat:', e?.message || e);
    return false;
  }
}

/* ---------- Background Task ---------- */

// Task nur einmal definieren (wichtig bei Hot-Reload)
if (!TaskManager.isTaskDefined?.(BG_LOCATION_TASK)) {
  TaskManager.defineTask(BG_LOCATION_TASK, async ({ data, error }) => {
    try {
      if (error) {
        console.log('[BGLOC] Task error:', error);
        return;
      }

      const locs = data?.locations || [];
      if (!locs.length) {
        console.log('[BGLOC] locations: 0');
        return;
      }
      console.log('[BGLOC] locations batch size =', locs.length);

      const now = Math.floor(Date.now() / 1000);
      if (now - lastHeartbeatAt < HEARTBEAT_MIN_SECONDS) {
        console.log('[BGLOC] skip (debounce)', now - lastHeartbeatAt, 's since last');
        return;
      }

      const latest = locs[locs.length - 1];
      const { coords } = latest || {};
      const ok = await sendHeartbeat(coords, 'Heartbeat');
      if (ok) lastHeartbeatAt = now;
    } catch (e) {
      console.log('[BGLOC] Exception in task:', e?.message || e);
    }
  });
}

/* ---------- Component Bootstrapping ---------- */

export default function PushInitializer() {
  const initDone = useRef(false);

  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;

    (async () => {
      try {
        // Notifications-Permission (Android 13+)
        const notiPerm0 = await Notifications.getPermissionsAsync();
        let notiStatus = notiPerm0.status;
        if (notiStatus !== 'granted') {
          const asked = await Notifications.requestPermissionsAsync();
          notiStatus = asked.status;
        }
        console.log('[push] notification permission =', notiStatus);

        await ensureAndroidChannel();

        // Expo Push Token beim Start ziehen & merken
        try {
          const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync();
          if (!Constants.expoConfig) Constants.expoConfig = { extra: {} };
          if (!Constants.expoConfig.extra) Constants.expoConfig.extra = {};
          Constants.expoConfig.extra.expoPushToken = expoPushToken;
          console.log('[push] expoToken (init) =', expoPushToken);
        } catch (e) {
          console.log('[push] token error (init)', e?.message || e);
        }

        // Standort-Berechtigungen
        const fg = await Location.requestForegroundPermissionsAsync();
        const bg = await Location.requestBackgroundPermissionsAsync();
        console.log('[BGLOC] permissions', { fg: fg.status, bg: bg.status });
        if (fg.status !== 'granted' || bg.status !== 'granted') {
          console.log('[BGLOC] Missing location permissions -> abort start');
          return;
        }

        // Provider-Status (Debug)
        try {
          const prov = await Location.getProviderStatusAsync();
          console.log('[BGLOC] providerStatus', prov);
        } catch (e) {
          console.log('[BGLOC] providerStatus error', e?.message || e);
        }

        // **Kickstart**: einmalig aktuelle Position holen und sofort senden
        try {
          // lastKnown spart Akku; bei null fallback auf currentPosition
          let pos = await Location.getLastKnownPositionAsync();
          if (!pos) {
            pos = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
              mayShowUserSettingsDialog: false,
            });
          }
          if (pos?.coords) {
            await sendHeartbeat(pos.coords, 'Kickstart');
          } else {
            console.log('[BGLOC] Kickstart: no position available');
          }
        } catch (e) {
          console.log('[BGLOC] Kickstart error', e?.message || e);
        }

        // Hintergrund-Updates (Produktionswerte)
        const started = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK);
        if (!started) {
          console.log('[BGLOC] Starting background updates…');
          await Location.startLocationUpdatesAsync(BG_LOCATION_TASK, {
            // Events auch ohne Bewegung, alle ~60s
            distanceInterval: 0,
            timeInterval: TIME_INTERVAL_MS,

            // Balanced spart Akku und bleibt im Hintergrund aktiv
            accuracy: Location.Accuracy.Balanced,

            // Foreground Service (Android)
            foregroundService: {
              notificationTitle: 'StepsMatch aktiv',
              notificationBody: 'Standortabgleich läuft im Hintergrund.',
            },

            // iOS-Felder (unschädlich auf Android)
            showsBackgroundLocationIndicator: false,
            pausesUpdatesAutomatically: false,
            activityType: Location.ActivityType.Other,

            // sofort liefern
            deferredUpdatesInterval: 0,
            deferredUpdatesDistance: 0,
          });
        } else {
          console.log('[BGLOC] Background updates already started.');
        }
      } catch (e) {
        console.log('[BGLOC] init error', e?.message || e);
      }
    })();
  }, []);

  return null;
}
