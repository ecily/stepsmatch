// stepsmatch/mobile/components/PushInitializer.js
import React, { useEffect, useRef } from 'react';
import { Platform, AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { isOfferActiveNow } from '../utils/isOfferActiveNow';

// ────────────────────────────────────────────────────────────
// Konstanten
// ────────────────────────────────────────────────────────────
const BG_LOCATION_TASK = 'stepsmatch-bg-location-task';
const GEOFENCE_TASK = 'stepsmatch-geofence-task';

const HEARTBEAT_MIN_SECONDS = 45;
const TIME_INTERVAL_MS = 60 * 1000;

const API_BASE = 'https://lobster-app-ie9a5.ondigitalocean.app/api';

// einfache ProjectId-Ermittlung für Logs/Meta
const RESOLVED_PROJECT_ID =
  (Constants?.expoConfig?.extra && Constants.expoConfig.extra.eas?.projectId) ||
  (Constants?.easConfig && Constants.easConfig.projectId) ||
  'unknown';

// Guard, damit Handler/Listener nicht doppelt initialisiert werden
if (!globalThis.__stepsmatchPushHandlerSet) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,     // ← macht Foreground-Notifs sichtbar
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  globalThis.__stepsmatchPushHandlerSet = true;
}

// ────────────────────────────────────────────────────────────
// Channel & Category
// ────────────────────────────────────────────────────────────
async function ensureChannels() {
  if (Platform.OS !== 'android') return;

  console.log('[push] channels: creating…');

  // Default
  await Notifications.setNotificationChannelAsync('stepsmatch-default-v2', {
    name: 'StepsMatch',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 150, 120, 150],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
  });

  // Offers (sichtbar / Heads-Up)
  await Notifications.setNotificationChannelAsync('offers', {
    name: 'Angebote',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 250, 200, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
  });

  // Hintergrundtask (stille Service-Notifs, falls verwendet)
  await Notifications.setNotificationChannelAsync(
    'com.ecily.mobile:stepsmatch-bg-location-task',
    {
      name: 'StepsMatch – Hintergrund',
      importance: Notifications.AndroidImportance.MIN,
      sound: null,
      vibrationPattern: [],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.SECRET,
      bypassDnd: false,
    }
  );

  console.log(
    '[push] channels ready: stepsmatch-default-v2, offers, com.ecily.mobile:stepsmatch-bg-location-task'
  );

  // Kategorie mit „GO“-Action (für Offer-Details)
  await Notifications.setNotificationCategoryAsync('offer-go', [
    {
      identifier: 'GO',
      buttonTitle: 'GO',
      options: { opensAppToForeground: true },
    },
  ]);
  console.log('[push] category ready: offer-go');
}

// ────────────────────────────────────────────────────────────
// Token & Registrierung
// ────────────────────────────────────────────────────────────
async function askNotificationPermission() {
  const pre = await Notifications.getPermissionsAsync();
  console.log('[push] notification permission (pre) =', pre?.status);
  if (pre.status !== 'granted') {
    const post = await Notifications.requestPermissionsAsync();
    console.log('[push] notification permission (post) =', post?.status);
    return post.status === 'granted';
  }
  return true;
}

async function getExpoToken() {
  // Hinweis-Log: zeigt, welche Meta wir im Build sehen
  console.log(
    '[push] meta projectId extra=',
    Constants?.expoConfig?.extra?.eas?.projectId,
    'easConfig=',
    Constants?.easConfig?.projectId,
    'releaseChannel=',
    Constants?.expoConfig?.releaseChannel
  );

  // Managed/Dev-Build: direkt abrufbar
  const token = (await Notifications.getExpoPushTokenAsync({ projectId: RESOLVED_PROJECT_ID })).data;
  console.log('[push] resolveProjectId =', RESOLVED_PROJECT_ID);
  console.log('[push] expoToken =', token);
  return token;
}

async function registerTokenWithBackend({ expoToken, deviceId }) {
  try {
    const res = await fetch(`${API_BASE}/push/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: expoToken,
        platform: Platform.OS,
        deviceId,
        projectId: RESOLVED_PROJECT_ID,
      }),
    });
    const json = await res.json();
    console.log('[push] register =>', res.status, JSON.stringify(json));
  } catch (e) {
    console.warn('[push] register error', String(e));
  }
}

// ────────────────────────────────────────────────────────────
/** DEV-Fallback: ersetzt presentNotificationAsync (entfernt in SDK 50) */
// ────────────────────────────────────────────────────────────
async function devFallbackLocalNotification({ title, body, data }) {
  try {
    if (!__DEV__) return; // nur in DEV, um Doppelungen zu vermeiden
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        channelId: 'offers',
        categoryIdentifier: 'offer-go',
      },
      trigger: null, // sofort
    });
    console.log('[push] dev-fallback scheduled (scheduleNotificationAsync)');
  } catch (e) {
    console.log('[push] dev-fallback error', String(e));
  }
}

// ────────────────────────────────────────────────────────────
// Public API: Init + Roundtrip-Test
// ────────────────────────────────────────────────────────────
export async function initPush() {
  await ensureChannels();
  const granted = await askNotificationPermission();
  if (!granted) return;

  // DeviceId für Backend (keine harte Abhängigkeit)
  let deviceId = null;
  try {
    // Lazy import, um Abhängigkeit optional zu halten
    const Application = await import('expo-application');
    deviceId = Application?.default?.androidId || Application?.androidId || null;
  } catch {
    deviceId = null;
  }

  const token = await getExpoToken();
  console.log('[Push] Expo token', token);
  await registerTokenWithBackend({ expoToken: token, deviceId });

  // Listener für „received“ (auch im FG)
  Notifications.addNotificationReceivedListener((notification) => {
    const c = notification?.request?.content || {};
    console.log(
      '[push] received',
      JSON.stringify({
        title: c.title,
        body: c.body,
        channelId: c.channelId || 'offers',
        data: c.data || {},
      })
    );
  });

  console.log('[push] listeners installed');
}

export async function sendRoundtripTest({ offerId = 'TEST', title, body } = {}) {
  // Sendet über Backend eine Remote-Push (Expo) und loggt Antwort.
  const rid = `rt_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  try {
    const res = await fetch(`${API_BASE}/push/roundtrip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        offerId,
        title: title || 'StepsMatch Test',
        body: body || 'Das ist ein Test-Push aus der App.',
        channelId: 'offers',
        projectId: RESOLVED_PROJECT_ID,
      }),
    });
    const json = await res.json();
    console.log('[push] roundtrip =>', res.status, JSON.stringify(json), 'rid=', rid);

    // DEV-Fallback (sichtbar im FG, wenn Remote noch nicht da ist)
    await devFallbackLocalNotification({
      title: 'StepsMatch (DEV Fallback)',
      body: 'Falls die Remote-Notif im FG nicht sichtbar ist.',
      data: { offerId },
    });
  } catch (e) {
    console.log('[push] roundtrip error', String(e), 'rid=', rid);
  }
}

// ────────────────────────────────────────────────────────────
// Background-Location (bestehendes Verhalten beibehalten)
// ────────────────────────────────────────────────────────────

let lastHeartbeatAt = 0;

async function sendHeartbeat({ latitude, longitude, accuracy }) {
  const now = Date.now();
  if (now - lastHeartbeatAt < HEARTBEAT_MIN_SECONDS * 1000) return;
  lastHeartbeatAt = now;

  try {
    const res = await fetch(`${API_BASE}/location/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: latitude,
        lng: longitude,
        acc: accuracy,
        platform: Platform.OS,
      }),
    });
    const json = await res.json();
    console.log('[BGLOC] Manual HTTP', res.status, JSON.stringify(json));
    console.log('[BGLOC] Manual sent lat=' + latitude, 'lng=' + longitude, 'acc=' + accuracy);
  } catch (e) {
    console.log('[BGLOC] Manual error', String(e));
  }
}

export async function kickstartBackgroundLocation() {
  try {
    // Permissions
    const fg = await Location.requestForegroundPermissionsAsync();
    const bg = await Location.requestBackgroundPermissionsAsync();
    console.log('[BGLOC] permissions', { fg: fg?.status, bg: bg?.status });

    // Start, falls nicht aktiv
    const started = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK);
    if (!started) {
      await Location.startLocationUpdatesAsync(BG_LOCATION_TASK, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: TIME_INTERVAL_MS,
        distanceInterval: 0,
        foregroundService: {
          notificationTitle: 'StepsMatch',
          notificationBody: 'Hintergrund-Ortungsdienst aktiv',
          notificationColor: '#2c6bed',
          notificationChannelId: 'com.ecily.mobile:stepsmatch-bg-location-task',
        },
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: false,
      });
    } else {
      console.log('[BGLOC] Background updates already started.');
    }

    // Initialen Kick senden (letzte Position)
    const loc = await Location.getLastKnownPositionAsync({});
    if (loc?.coords) {
      await sendHeartbeat(loc.coords);
      // optional Kickstart-Probe
      const res = await fetch(`${API_BASE}/push/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: (await Notifications.getExpoPushTokenAsync({ projectId: RESOLVED_PROJECT_ID })).data,
          platform: Platform.OS,
          lastLocation: {
            type: 'Point',
            coordinates: [loc.coords.longitude, loc.coords.latitude],
          },
          projectId: RESOLVED_PROJECT_ID,
        }),
      });
      const json = await res.json();
      console.log('[BGLOC] Kickstart HTTP', res.status, JSON.stringify(json));
      console.log('[BGLOC] Kickstart sent lat=' + loc.coords.latitude, 'lng=' + loc.coords.longitude, 'acc=' + loc.coords.accuracy);
    }
  } catch (e) {
    console.log('[BGLOC] kickstart error', String(e));
  }
}

// Task-Definitionen (keine Änderung am Namen!)
TaskManager.defineTask(BG_LOCATION_TASK, async ({ data, error }) => {
  try {
    if (error) {
      console.log('[BGLOC] Task error', String(error));
      return;
    }
    const { locations } = data || {};
    if (!locations || !locations.length) return;
    console.log('[BGLOC] locations batch size =', locations.length);
    const { latitude, longitude, accuracy } = locations[0].coords || {};
    if (latitude && longitude) {
      await sendHeartbeat({ latitude, longitude, accuracy });
    }
  } catch (e) {
    console.log('[BGLOC] task handler error', String(e));
  }
});

// GEOFENCE placeholder (falls genutzt)
TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
  if (error) {
    console.log('[GEOFENCE] error', String(error));
    return;
  }
  const { eventType, region } = data || {};
  console.log('[GEOFENCE] event', eventType, region?.identifier || '');
});

// Initialisierungshook (optional)
export default function PushInitializer() {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    console.log('[BGLOC] BackgroundLocationManager: delegating to PushInitializer (no own task/start)');
    initPush();
    kickstartBackgroundLocation();

    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        // Re-Init Channels/Permissions bei Rückkehr
        ensureChannels();
      }
      appState.current = next;
    });

    return () => {
      sub?.remove?.();
    };
  }, []);

  return null;
}
