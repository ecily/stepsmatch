// stepsmatch/mobile/components/PushInitializer.js
import React, { useEffect, useRef } from 'react';
import { Platform, AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Random from 'expo-random';
import Constants from 'expo-constants';

const BG_LOCATION_TASK = 'stepsmatch-bg-location-task';
const GEOFENCE_TASK = 'stepsmatch-geofence-task';

const HEARTBEAT_MIN_SECONDS = 45;
const TIME_INTERVAL_MS = 60 * 1000;
const API_BASE = 'https://lobster-app-ie9a5.ondigitalocean.app/api';

const RESOLVED_PROJECT_ID =
  (Constants?.expoConfig?.extra && Constants.expoConfig.extra.eas?.projectId) ||
  (Constants?.easConfig && Constants.easConfig.projectId) ||
  '08559a29-b307-47e9-a130-d3b31f73b4ed';

// ────────────────────────────────────────────────────────────
// DEV fallback
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
// Persistent Device ID
// ────────────────────────────────────────────────────────────
const DEVICE_ID_SECURE_KEY = 'deviceId.v1';
const DEVICE_ID_ASYNC_KEY  = 'deviceId.v1.mirror';

function bytesToUuidV4(bytes) {
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
}
async function generateUuidV4() {
  const bytes = await Random.getRandomBytesAsync(16);
  return bytesToUuidV4(bytes);
}
async function getPersistentDeviceId() {
  try {
    const existing = await SecureStore.getItemAsync(DEVICE_ID_SECURE_KEY);
    if (existing) return existing;
  } catch (_) {}
  try {
    const mirror = await AsyncStorage.getItem(DEVICE_ID_ASYNC_KEY);
    if (mirror) {
      try { await SecureStore.setItemAsync(DEVICE_ID_SECURE_KEY, mirror); } catch (_) {}
      return mirror;
    }
  } catch (_) {}
  const fresh = await generateUuidV4();
  try { await SecureStore.setItemAsync(DEVICE_ID_SECURE_KEY, fresh); } catch (_) {}
  try { await AsyncStorage.setItem(DEVICE_ID_ASYNC_KEY, fresh); } catch (_) {}
  return fresh;
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

const TOKEN_KEY = 'expoPushToken.v2';
let CURRENT_EXPO_TOKEN = null;
let REGISTERED_READY = false; // 🔒 Heartbeat feuert erst danach

async function resolveExpoTokenAuthoritative() {
  console.log(
    '[push] meta projectId extra=',
    Constants?.expoConfig?.extra?.eas?.projectId,
    'easConfig=',
    Constants?.easConfig?.projectId,
    'releaseChannel=',
    Constants?.expoConfig?.releaseChannel
  );
  const { data: freshToken } = await Notifications.getExpoPushTokenAsync({ projectId: RESOLVED_PROJECT_ID });
  const cached = await AsyncStorage.getItem(TOKEN_KEY);
  if (cached !== freshToken) {
    await AsyncStorage.setItem(TOKEN_KEY, freshToken);
    console.log('[push] token changed -> cache updated');
  }
  CURRENT_EXPO_TOKEN = freshToken;
  console.log('[push] resolveProjectId =', RESOLVED_PROJECT_ID);
  console.log('[push] expoToken =', freshToken);
  return freshToken;
}
async function getCurrentExpoToken() {
  if (CURRENT_EXPO_TOKEN) return CURRENT_EXPO_TOKEN;
  const cached = await AsyncStorage.getItem(TOKEN_KEY);
  if (cached) {
    CURRENT_EXPO_TOKEN = cached;
    resolveExpoTokenAuthoritative().catch(() => {});
    return cached;
  }
  return resolveExpoTokenAuthoritative();
}

async function registerTokenWithBackend({ expoToken, deviceId, lastLocation }) {
  try {
    const payload = {
      token: expoToken,
      platform: Platform.OS,
      deviceId,
      projectId: RESOLVED_PROJECT_ID,
    };
    if (lastLocation?.coords) {
      payload.lastLocation = {
        type: 'Point',
        coordinates: [lastLocation.coords.longitude, lastLocation.coords.latitude],
      };
    }
    const res = await fetch(`${API_BASE}/push/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    console.log('[push] register =>', res.status, JSON.stringify(json));
    if (res.ok) REGISTERED_READY = true; // 🔓 erst jetzt dürfen Heartbeats raus
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

  const deviceId = await getPersistentDeviceId();

  // 🔎 Native FCM-Token (für Diagnose sichtbar machen)
  try {
    const native = await Notifications.getDevicePushTokenAsync();
    console.log('[push] nativePushToken', native?.type, native?.data ? String(native.data).slice(0,24) + '…' : null);
  } catch (e) {
    console.log('[push] nativePushToken error', String(e));
  }

  const token = await resolveExpoTokenAuthoritative();
  console.log('[Push] Expo token', token);
  console.log('[Push] deviceId', deviceId);

  let lastLoc = null;
  try { lastLoc = await Location.getLastKnownPositionAsync({}); } catch (_) {}
  await registerTokenWithBackend({ expoToken: token, deviceId, lastLocation: lastLoc || undefined });

  Notifications.addNotificationReceivedListener((notification) => {
    const c = notification?.request?.content || {};
    const data = c.data || {};
    console.log('[push] received', JSON.stringify({
      title: c.title,
      body: c.body,
      channelId: c.channelId || 'offers',
      data,
    }));
    const src = data?.source;
    const t = data?.t;
    if (src === 'roundtrip' && typeof t === 'number') {
      remoteArrivedForRid.add(String(t));
    }
  });

  console.log('[push] listeners installed');
}

// ───────────── BG-Location & Heartbeat ─────────────
let lastHeartbeatAt = 0;

async function sendHeartbeat({ latitude, longitude, accuracy }) {
  if (!REGISTERED_READY) {
    console.log('[HB] skipped (not registered yet)');
    return;
  }
  const now = Date.now();
  if (now - lastHeartbeatAt < HEARTBEAT_MIN_SECONDS * 1000) return;
  lastHeartbeatAt = now;

  try {
    const token = await getCurrentExpoToken();
    const deviceId = await getPersistentDeviceId();
    console.log('[HB] using token =', token);
    const res = await fetch(`${API_BASE}/location/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        deviceId,
        lat: latitude,
        lng: longitude,
        accuracy,
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
    (async () => {
      console.log('[BGLOC] BackgroundLocationManager: start in PushInitializer');
      // ⛓️ Sequenz: Erst push init & register, DANN BG-Location/Heartbeat
      await initPush();
      await kickstartBackgroundLocation();
    })();

    const sub = AppState.addEventListener('change', async (next) => {
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
