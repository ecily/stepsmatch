// stepsmatch/mobile/components/PushInitializer.tsx
import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ensureChannels } from './push/push-notifications';
import { useLocationWatchdog, kickstartBackgroundLocation, _sendHeartbeatWithCoords } from './push/push-location';
import { refreshGeofencesAroundUser } from './push/push-geofence';
import {
  RESOLVED_PROJECT_ID,
  CHANNELS,
  BG_LOCATION_TASK,
  GEOFENCE_TASK,
} from './push/push-constants';
import {
  getPersistentDeviceId,
  resolveExpoTokenAuthoritative,
} from './push/push-state';

// ────────────────────────────────────────────────────────────
// Konstanten
// ────────────────────────────────────────────────────────────
const API_BASE = 'https://lobster-app-ie9a5.ondigitalocean.app/api';
const CANARY_KEY = 'push.canary.lastAt';
const CANARY_MIN_INTERVAL_MS = 10 * 60 * 1000; // 10 Minuten Mindestabstand
const CANARY_FORCE_KEY = 'push.canary.forceAtStartup';

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────
function isForeground() {
  try { return AppState.currentState === 'active'; } catch { return false; }
}
function ensureBadgePolyfill() {
  try {
    const anyNotif: any = Notifications as any;
    if (typeof anyNotif.setBadgeCountAsync !== 'function') {
      anyNotif.setBadgeCountAsync = async (_n: number) => {};
    }
  } catch {}
}
async function resetBadgeCountSafe(n: number = 0) {
  try {
    ensureBadgePolyfill();
    const anyNotif: any = Notifications as any;
    if (typeof anyNotif.setBadgeCountAsync === 'function') {
      await anyNotif.setBadgeCountAsync(n);
    }
  } catch {}
}
async function shouldRunCanaryNow(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(CANARY_KEY);
    const last = raw ? parseInt(raw, 10) : 0;
    const now = Date.now();
    return !last || now - last > CANARY_MIN_INTERVAL_MS;
  } catch {
    return true;
  }
}
async function markCanaryRanNow() {
  try { await AsyncStorage.setItem(CANARY_KEY, String(Date.now())); } catch {}
}

// ────────────────────────────────────────────────────────────
// Ensure TaskManager tasks are registered ONCE
// ────────────────────────────────────────────────────────────
declare global {
  var __SM_TASKS_READY__: boolean | undefined;
  var __SM_PUSH_INIT_DONE__: boolean | undefined;
}
async function ensureTasksRegisteredOnce() {
  if (global.__SM_TASKS_READY__) return;
  const bgDefined = TaskManager.isTaskDefined(BG_LOCATION_TASK);
  const gfDefined = TaskManager.isTaskDefined(GEOFENCE_TASK);
  if (!bgDefined || !gfDefined) {
    await import('./push/push-tasks');
  }
  global.__SM_TASKS_READY__ = true;
}

// ────────────────────────────────────────────────────────────
// Permissions
// ────────────────────────────────────────────────────────────
async function askNotificationPermission() {
  const pre = await Notifications.getPermissionsAsync();
  if (pre.status !== 'granted') {
    const post = await Notifications.requestPermissionsAsync();
    return post.status === 'granted';
  }
  return true;
}
let notifReceivedSub: Notifications.Subscription | null = null;
let notifResponseSub: Notifications.Subscription | null = null;

// ────────────────────────────────────────────────────────────
// Backend Calls
// ────────────────────────────────────────────────────────────
async function registerTokenWithBackend({ expoToken, deviceId, lastLocation }: any) {
  try {
    const payload: any = {
      token: expoToken,
      platform: 'android',
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
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      try {
        await kickstartBackgroundLocation();
        await refreshGeofencesAroundUser({ force: true, silent: true });
      } catch {}
    }
    if (!res.ok || (json && (json.needsRefresh || json.error === 'DeviceNotRegistered'))) {
      throw new Error(json?.error || `register failed ${res.status}`);
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e) };
  }
}

async function runCanaryPush({ expoToken, deviceId }: any) {
  const allowed = await shouldRunCanaryNow();
  if (!allowed) return { ok: true, skipped: true };
  try {
    const res = await fetch(`${API_BASE}/push/canary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: expoToken, deviceId, projectId: RESOLVED_PROJECT_ID }),
    });
    const json = await res.json().catch(() => ({}));
    await markCanaryRanNow();
    if (!res.ok || json?.ok !== true) return { ok: false, error: json?.error || `HTTP ${res.status}` };
    return { ok: true };
  } catch (e: any) {
    await markCanaryRanNow();
    return { ok: false, error: String(e) };
  }
}

async function selfHealPushToken() {
  try {
    const freshToken = await resolveExpoTokenAuthoritative();
    const deviceId = await getPersistentDeviceId();
    let lastLoc: any | null = null;
    try { lastLoc = await (await import('expo-location')).getLastKnownPositionAsync({}); } catch {}
    const reg = await registerTokenWithBackend({ expoToken: freshToken, deviceId, lastLocation: lastLoc || undefined });
    return { ok: reg.ok };
  } catch {
    return { ok: false };
  }
}

// ────────────────────────────────────────────────────────────
// Init
// ────────────────────────────────────────────────────────────
async function initPush() {
  ensureBadgePolyfill();
  await resetBadgeCountSafe(0);
  Notifications.setNotificationHandler({
    handleNotification: async () => {
      const isFg = isForeground();
      return isFg
        ? { shouldShowAlert: false, shouldPlaySound: false, shouldSetBadge: false }
        : { shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false };
    },
  });
  await ensureChannels();
  const granted = await askNotificationPermission();
  if (!granted) return;
  const deviceId = await getPersistentDeviceId();
  const token = await resolveExpoTokenAuthoritative();

  let lastLoc: any | null = null;
  try { lastLoc = await (await import('expo-location')).getLastKnownPositionAsync({}); } catch {}
  await registerTokenWithBackend({ expoToken: token, deviceId, lastLocation: lastLoc || undefined });

  // Canary at startup
  let forceFlag = false;
  try {
    const raw = await AsyncStorage.getItem(CANARY_FORCE_KEY);
    if (raw === 'true') forceFlag = true;
  } catch {}
  if (!forceFlag && process.env.EXPO_PUBLIC_PUSH_CANARY_FORCE === 'true') {
    forceFlag = true;
  }
  let canary: any = { ok: true, skipped: true };
  if (forceFlag) {
    console.log('[canary] forced at startup');
    canary = await runCanaryPush({ expoToken: token, deviceId });
  } else {
    canary = await runCanaryPush({ expoToken: token, deviceId });
  }
  if (!canary.ok && !canary.skipped) {
    await selfHealPushToken();
  }

  if (!notifReceivedSub) {
    notifReceivedSub = Notifications.addNotificationReceivedListener(async (notification) => {
      const c: any = notification?.request?.content || {};
      const data = c.data || {};
      const offerId = typeof data?.offerId === 'string' ? String(data.offerId) : null;
      if (offerId) {
        try {
          const key = `offerPushState.${offerId}`;
          const prevRaw = await AsyncStorage.getItem(key);
          const prev = prevRaw ? JSON.parse(prevRaw) : {};
          const next = { inside: !!prev.inside, lastPushedAt: prev.lastPushedAt || 0, lastPushedAtRemote: Date.now() };
          await AsyncStorage.setItem(key, JSON.stringify(next));
        } catch {}
      }
      if (data?.kind === 'offers-refresh') {
        try { await refreshGeofencesAroundUser({ force: true }); } catch {}
      }
    });
  }
  if (!notifResponseSub) {
    notifResponseSub = Notifications.addNotificationResponseReceivedListener(async (response) => {
      try {
        const action = response?.actionIdentifier;
        const data: any = response?.notification?.request?.content?.data || {};
        const offerId = typeof data?.offerId === 'string' ? String(data.offerId) : null;
        if (!offerId) return;
        if (action === 'later') {
          const { setOfferPushState } = await import('./push/push-state');
          await setOfferPushState(offerId, { inside: true, lastPushedAt: Date.now() });
        }
      } catch {}
    });
  }
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────
export default function PushInitializer() {
  const appState = useRef(AppState.currentState);
  const ranRef = useRef(false);
  const skipThisMount = useRef<boolean>(global.__SM_PUSH_INIT_DONE__ === true);

  useEffect(() => {
    if (skipThisMount.current) return;
    if (ranRef.current) return;
    ranRef.current = true;
    (async () => {
      await ensureTasksRegisteredOnce();
      await ensureChannels();
      await resetBadgeCountSafe(0);
      await initPush();
      global.__SM_PUSH_INIT_DONE__ = true;
    })();
    const sub = AppState.addEventListener('change', async (next) => {
      const prev = appState.current as string;
      if (/(inactive|background)/.test(prev) && next === 'active') {
        await ensureChannels();
        try { await Notifications.dismissAllNotificationsAsync(); } catch {}
        await resetBadgeCountSafe(0);
        try {
          await refreshGeofencesAroundUser({ force: true, silent: true });
          const loc = await (await import('expo-location')).getLastKnownPositionAsync({});
          if (loc?.coords) {
            await _sendHeartbeatWithCoords({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              accuracy: loc.coords.accuracy,
              refreshMode: 'silent',
            });
          }
          try {
            const deviceId = await getPersistentDeviceId();
            const token = await resolveExpoTokenAuthoritative();
            const canary = await runCanaryPush({ expoToken: token, deviceId });
            if (!canary.ok && !canary.skipped) await selfHealPushToken();
          } catch {}
          await new Promise((r) => setTimeout(r, 800));
          if (AppState.currentState === 'active') {
            const started = await (await import('expo-location')).hasStartedLocationUpdatesAsync(BG_LOCATION_TASK);
            if (!started) await kickstartBackgroundLocation();
          }
        } catch {}
      }
      appState.current = next;
    });
    return () => sub?.remove?.();
  }, []);

  if (skipThisMount.current) return null;
  useLocationWatchdog();
  return null;
}
