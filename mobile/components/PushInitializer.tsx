// stepsmatch/mobile/components/PushInitializer.js
import React, { useEffect, useRef } from 'react';
import { Platform, AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const BG_LOCATION_TASK = 'stepsmatch-bg-location-task';
const GEOFENCE_TASK = 'stepsmatch-geofence-task';

const HEARTBEAT_MIN_SECONDS = 45;      // Throttle für Heartbeats
const TIME_INTERVAL_MS = 60 * 1000;    // BG-Location Intervall
const API_BASE = 'https://lobster-app-ie9a5.ondigitalocean.app/api';

const RESOLVED_PROJECT_ID =
  (Constants?.expoConfig?.extra && Constants.expoConfig.extra.eas?.projectId) ||
  (Constants?.easConfig && Constants.easConfig.projectId) ||
  '08559a29-b307-47e9-a130-d3b31f73b4ed'; // Fallback auf dein echtes Projekt

// ────────────────────────────────────────────────────────────
// KEIN globaler Notification-Handler hier – der ist in app/_layout.js gesetzt.
// (Vermeidet Doppel-Handler und deprecated shouldShowAlert.)
// ────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────
// DEV-Roundtrip-Fallback (nur DEV)
// ────────────────────────────────────────────────────────────
let pendingFallbackRid = null;
let remoteArrivedForRid = new Set();

function scheduleRoundtripFallback(rid, { title, body, offerId }) {
  if (!__DEV__) return;
  pendingFallbackRid = rid;
  setTimeout(async () => {
    if (remoteArrivedForRid.has(rid)) return;
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
async function ensureChannels() {
  if (Platform.OS !== 'android') return;
  try {
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
    await Notifications.setNotificationChannelAsync('com.ecily.mobile:stepsmatch-bg-location-task', {
      name: 'StepsMatch – Hintergrund',
      importance: Notifications.AndroidImportance.MIN,
      sound: null,
      vibrationPattern: [],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.SECRET,
      bypassDnd: false,
    });
    await Notifications.setNotificationCategoryAsync('offer-go', [
      { identifier: 'GO', buttonTitle: 'GO', options: { opensAppToForeground: true } },
    ]);
    console.log('[push] channels ready: stepsmatch-default-v2, offers, com.ecily.mobile:stepsmatch-bg-location-task');
    console.log('[push] category ready: offer-go');
  } catch (e) {
    console.warn('[notif] ensureChannels failed:', e?.message || e);
  }
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

const TOKEN_KEY = 'expoPushToken.v1';
let _expoTokenCache = null;

async function getExpoToken() {
  if (_expoTokenCache) return _expoTokenCache;
  const cached = await AsyncStorage.getItem(TOKEN_KEY);
  if (cached) {
    _expoTokenCache = cached;
    return cached;
  }

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

  _expoTokenCache = token;
  await AsyncStorage.setItem(TOKEN_KEY, token);
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

  // Empfangs-Listener (FG/BG Log)
  Notifications.addNotificationReceivedListener((notification) => {
    const c = notification?.request?.content || {};
    const data = c.data || {};
    console.log('[push] received', JSON.stringify({
      title: c.title,
      body: c.body,
      channelId: c.channelId || 'offers',
      data,
    }));

    // Roundtrip-Remote erkannt → DEV-Fallback für denselben rid abbrechen
    const src = data?.source;
    const t = data?.t;
    if (src === 'roundtrip' && typeof t === 'number') {
      remoteArrivedForRid.add(String(t));
    }
  });

  console.log('[push] listeners installed');
}

export async function sendRoundtripTest({ offerId = 'TEST', title, body } = {}) {
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

    scheduleRoundtripFallback(rid, {
      title: 'StepsMatch (DEV Fallback)',
      body: 'Falls Remote im FG nicht sichtbar ist.',
      offerId,
    });
  } catch (e) {
    console.log('[push] roundtrip error', String(e), 'rid=', rid);
  }
}

// ───────────── BG-Location & Heartbeat ─────────────
let lastHeartbeatAt = 0;

async function sendHeartbeat({ latitude, longitude, accuracy }) {
  const now = Date.now();
  if (now - lastHeartbeatAt < HEARTBEAT_MIN_SECONDS * 1000) return;
  lastHeartbeatAt = now;

  try {
    const token = await getExpoToken(); // 🔑 Token IMMER mitsenden!
    const res = await fetch(`${API_BASE}/location/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,                             // <— WICHTIG
        lat: latitude,
        lng: longitude,
        accuracy,                          // <— korrektes Feld (nicht "acc")
        platform: Platform.OS,
        projectId: RESOLVED_PROJECT_ID,
      }),
    });
    const json = await res.json();
    console.log('[BGLOC] Heartbeat', res.status, JSON.stringify(json));
  } catch (e) {
    console.log('[BGLOC] Heartbeat error', String(e));
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
      console.log('[BGLOC] Background updates started.');
    } else {
      console.log('[BGLOC] Background updates already started.');
    }

    const loc = await Location.getLastKnownPositionAsync({});
    if (loc?.coords) {
      await sendHeartbeat({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy,
      });

      // Sicherstellen, dass Register + Location initial auch gesetzt sind
      const token = await getExpoToken();
      const res = await fetch(`${API_BASE}/push/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          platform: Platform.OS,
          lastLocation: { type: 'Point', coordinates: [loc.coords.longitude, loc.coords.latitude] },
          projectId: RESOLVED_PROJECT_ID,
        }),
      });
      const json = await res.json();
      console.log('[BGLOC] Kickstart register', res.status, JSON.stringify(json));
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
    if (latitude && longitude) {
      await sendHeartbeat({ latitude, longitude, accuracy });
    }
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
    console.log('[BGLOC] BackgroundLocationManager: start in PushInitializer');
    initPush();
    kickstartBackgroundLocation();

    const sub = AppState.addEventListener('change', async (next) => {
      // Beim Resume → Channel sicherstellen & einen Heartbeat triggern
      if (appState.current.match(/inactive|background/) && next === 'active') {
        await ensureChannels();
        try {
          const loc = await Location.getLastKnownPositionAsync({});
          if (loc?.coords) {
            await sendHeartbeat({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              accuracy: loc.coords.accuracy,
            });
          }
        } catch {}
      }
      appState.current = next;
    });

    return () => sub?.remove?.();
  }, []);

  return null;
}
