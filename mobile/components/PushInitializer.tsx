// stepsmatch/mobile/components/PushInitializer.js
import React, { useEffect, useRef } from 'react';
import { Platform, AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { isOfferActiveNow } from '../utils/isOfferActiveNow';

const BG_LOCATION_TASK = 'stepsmatch-bg-location-task';
const GEOFENCE_TASK = 'stepsmatch-geofence-task';

const HEARTBEAT_MIN_SECONDS = 45;
const TIME_INTERVAL_MS = 60 * 1000;
const API_BASE = 'https://lobster-app-ie9a5.ondigitalocean.app/api';

const RESOLVED_PROJECT_ID =
  (Constants?.expoConfig?.extra && Constants.expoConfig.extra.eas?.projectId) ||
  (Constants?.easConfig && Constants.easConfig.projectId) ||
  'unknown';

// ────────────────────────────────────────────────────────────
// Globaler Foreground-Handler (Fallback, falls _layout früher lädt)
// iOS 16+: shouldShowBanner/shouldShowList; Android ignoriert das einfach
// ────────────────────────────────────────────────────────────
if (!globalThis.__stepsmatchPushHandlerSet) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,        // Android
      shouldPlaySound: true,
      shouldSetBadge: false,
      // iOS neuere Felder (unterstützt von expo-notifications ohne Crash)
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  globalThis.__stepsmatchPushHandlerSet = true;
}

// ────────────────────────────────────────────────────────────
// Roundtrip-Fallback-Steuerung: verzögere Local-Fallback um 4s
// nur wenn KEINE Remote-Notif mit source:"roundtrip" einging
// ────────────────────────────────────────────────────────────
let pendingFallbackRid = null;
let remoteArrivedForRid = new Set();

function scheduleRoundtripFallback(rid, { title, body, offerId }) {
  // Nur in DEV, um „Doppel“ in Release sicher zu vermeiden
  if (!__DEV__) return;
  pendingFallbackRid = rid;
  setTimeout(async () => {
    if (remoteArrivedForRid.has(rid)) return; // Remote ist angekommen → kein Fallback
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: title || 'StepsMatch (DEV Fallback)',
          body: (body || 'Falls Remote im FG nicht sichtbar ist.') + (offerId ? ` [offerId:${offerId}]` : ''),
          data: offerId ? { offerId } : {},
          channelId: 'offers',
          categoryIdentifier: 'offer-go',
        },
        trigger: null,
      });
      console.log('[push] dev fallback fired (scheduleNotificationAsync) rid=', rid);
    } catch (e) {
      console.log('[push] dev fallback error', String(e), 'rid=', rid);
    }
  }, 4000);
}

// ────────────────────────────────────────────────────────────
// Channels & Category
// ────────────────────────────────────────────────────────────
async function ensureChannels() {
  if (Platform.OS !== 'android') return;

  console.log('[push] channels: creating…');

  await Notifications.setNotificationChannelAsync('stepsmatch-default-v2', {
    name: 'StepsMatch',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 150, 120, 150],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
  });

  await Notifications.setNotificationChannelAsync('offers', {
    name: 'Angebote',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 250, 200, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
  });

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

  await Notifications.setNotificationCategoryAsync('offer-go', [
    { identifier: 'GO', buttonTitle: 'GO', options: { opensAppToForeground: true } },
  ]);

  console.log('[push] channels ready: stepsmatch-default-v2, offers, com.ecily.mobile:stepsmatch-bg-location-task');
  console.log('[push] category ready: offer-go');
}

// ────────────────────────────────────────────────────────────
// Permissions, Token, Registrierung
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
  console.log(
    '[push] meta projectId extra=',
    Constants?.expoConfig?.extra?.eas?.projectId,
    'easConfig=',
    Constants?.easConfig?.projectId,
    'releaseChannel=',
    Constants?.expoConfig?.releaseChannel
  );
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
// Public API
// ────────────────────────────────────────────────────────────
export async function initPush() {
  await ensureChannels();
  const granted = await askNotificationPermission();
  if (!granted) return;

  let deviceId = null;
  try {
    const Application = await import('expo-application');
    deviceId = Application?.default?.androidId || Application?.androidId || null;
  } catch {}

  const token = await getExpoToken();
  console.log('[Push] Expo token', token);
  await registerTokenWithBackend({ expoToken: token, deviceId });

  // Empfangs-Listener (FG)
  Notifications.addNotificationReceivedListener((notification) => {
    const c = notification?.request?.content || {};
    const data = c.data || {};
    console.log(
      '[push] received',
      JSON.stringify({
        title: c.title,
        body: c.body,
        channelId: c.channelId || 'offers',
        data,
      })
    );

    // Wenn Remote-Roundtrip kam, Fallback für denselben rid abbrechen
    const src = data?.source;
    const t = data?.t;
    if (src === 'roundtrip' && typeof t === 'number') {
      // rid rekonstruieren wie im Backend: wir nutzen hier t als Marker
      remoteArrivedForRid.add(String(t));
    }
  });

  console.log('[push] listeners installed');
}

export async function sendRoundtripTest({ offerId = 'TEST', title, body } = {}) {
  // rid leiten wir aus t ab (server-seitig im Payload)
  const rid = String(Date.now());
  try {
    const res = await fetch(`${API_BASE}/push/roundtrip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        offerId,
        title: title || 'StepsMatch',
        body: body || 'Das ist ein Test-Push aus der App.',
        channelId: 'offers',
        projectId: RESOLVED_PROJECT_ID,
      }),
    });
    const json = await res.json();
    console.log('[push] roundtrip =>', res.status, JSON.stringify(json), 'rid=', rid);

    // Fallback erst NACH kurzer Wartezeit, wird storniert wenn Remote zuvor eintrifft
    scheduleRoundtripFallback(rid, {
      title: 'StepsMatch (DEV Fallback)',
      body: 'Falls Remote im FG nicht sichtbar ist.',
      offerId,
    });
  } catch (e) {
    console.log('[push] roundtrip error', String(e), 'rid=', rid);
  }
}

// ───────────── BG-Location (wie gehabt) ─────────────
let lastHeartbeatAt = 0;

async function sendHeartbeat({ latitude, longitude, accuracy }) {
  const now = Date.now();
  if (now - lastHeartbeatAt < HEARTBEAT_MIN_SECONDS * 1000) return;
  lastHeartbeatAt = now;

  try {
    const res = await fetch(`${API_BASE}/location/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: latitude, lng: longitude, acc: accuracy, platform: Platform.OS }),
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
    const fg = await Location.requestForegroundPermissionsAsync();
    const bg = await Location.requestBackgroundPermissionsAsync();
    console.log('[BGLOC] permissions', { fg: fg?.status, bg: bg?.status });

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

    const loc = await Location.getLastKnownPositionAsync({});
    if (loc?.coords) {
      await sendHeartbeat(loc.coords);
      const res = await fetch(`${API_BASE}/push/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: (await Notifications.getExpoPushTokenAsync({ projectId: RESOLVED_PROJECT_ID })).data,
          platform: Platform.OS,
          lastLocation: { type: 'Point', coordinates: [loc.coords.longitude, loc.coords.latitude] },
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

TaskManager.defineTask(BG_LOCATION_TASK, async ({ data, error }) => {
  try {
    if (error) {
      console.log('[BGLOC] Task error', String(error));
      return;
    }
    const { locations } = data || {};
    if (!locations?.length) return;
    console.log('[BGLOC] locations batch size =', locations.length);
    const { latitude, longitude, accuracy } = locations[0]?.coords || {};
    if (latitude && longitude) await sendHeartbeat({ latitude, longitude, accuracy });
  } catch (e) {
    console.log('[BGLOC] task handler error', String(e));
  }
});

TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
  if (error) {
    console.log('[GEOFENCE] error', String(error));
    return;
  }
  const { eventType, region } = data || {};
  console.log('[GEOFENCE] event', eventType, region?.identifier || '');
});

export default function PushInitializer() {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    console.log('[BGLOC] BackgroundLocationManager: delegating to PushInitializer (no own task/start)');
    initPush();
    kickstartBackgroundLocation();

    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        ensureChannels();
      }
      appState.current = next;
    });

    return () => sub?.remove?.();
  }, []);

  return null;
}
