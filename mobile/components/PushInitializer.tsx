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
// Helpers
// ────────────────────────────────────────────────────────────
function isForeground() {
  try { return AppState.currentState === 'active'; } catch { return false; }
}

/**
 * Polyfill/Absicherung: auf manchen Plattformen existiert setBadgeCountAsync nicht.
 * Wir hängen eine no-op Implementierung an, damit nachfolgende Aufrufe nicht craschen.
 */
function ensureBadgePolyfill() {
  try {
    const anyNotif: any = Notifications as any;
    if (typeof anyNotif.setBadgeCountAsync !== 'function') {
      anyNotif.setBadgeCountAsync = async (_n: number) => {};
    }
  } catch {}
}

/** Sicherer Badge-Reset, wirft nie */
async function resetBadgeCountSafe(n: number = 0) {
  try {
    ensureBadgePolyfill();
    const anyNotif: any = Notifications as any;
    if (typeof anyNotif.setBadgeCountAsync === 'function') {
      await anyNotif.setBadgeCountAsync(n);
    }
  } catch {}
}

// ────────────────────────────────────────────────────────────
// Ensure TaskManager tasks are registered ONCE (guards Hot Reload)
// ────────────────────────────────────────────────────────────
declare global {
  // eslint-disable-next-line no-var
  var __SM_TASKS_READY__: boolean | undefined;
  // 🔒 Singleton-Guard gegen mehrfaches Mounten/Initialisieren
  // eslint-disable-next-line no-var
  var __SM_PUSH_INIT_DONE__: boolean | undefined;
}

async function ensureTasksRegisteredOnce() {
  if (global.__SM_TASKS_READY__) return;

  const bgDefined = TaskManager.isTaskDefined(BG_LOCATION_TASK);
  const gfDefined = TaskManager.isTaskDefined(GEOFENCE_TASK);

  if (!bgDefined || !gfDefined) {
    await import('./push/push-tasks'); // registers tasks as side effects
  }

  global.__SM_TASKS_READY__ = true;
}

// ────────────────────────────────────────────────────────────
/** Permission helper */
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

let notifReceivedSub: Notifications.Subscription | null = null;
let notifResponseSub: Notifications.Subscription | null = null;

async function registerTokenWithBackend({
  expoToken,
  deviceId,
  lastLocation,
}: {
  expoToken: string;
  deviceId: string;
  lastLocation?: any;
}) {
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
    const res = await fetch(
      `https://lobster-app-ie9a5.ondigitalocean.app/api/push/register`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    const json = await res.json();
    console.log('[push] register =>', res.status, JSON.stringify(json));
    if (res.ok) {
      try {
        await kickstartBackgroundLocation();                             // startet NUR im FG
        await refreshGeofencesAroundUser({ force: true, silent: true }); // silent beim App-Open
      } catch (e: any) {
        console.warn('[BGLOC] auto-start or geofence-sync after register failed', String(e));
      }
    }
  } catch (e: any) {
    console.warn('[push] register error', String(e));
  }
}

async function initPush() {
  // Badge-API absichern + gleich auf 0 setzen (OEM-Badges wegräumen)
  ensureBadgePolyfill();
  await resetBadgeCountSafe(0);

  // ──────────────────────────────────────────────────────────
  // FG HARD SUPPRESS: setze den Handler *hier*, damit er der
  // zuletzt registrierte ist und ALLES im FG stumm schaltet.
  // ──────────────────────────────────────────────────────────
  Notifications.setNotificationHandler({
    handleNotification: async () => {
      const isFg = isForeground();
      if (isFg) {
        console.log('[FG-SUPPRESS] any notification suppressed (foreground@init)');
        return { shouldShowAlert: false, shouldPlaySound: false, shouldSetBadge: false };
      }
      return { shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false };
    },
  });

  await ensureChannels();
  const granted = await askNotificationPermission();
  if (!granted) return;

  const deviceId = await getPersistentDeviceId();

  try {
    const native = await Notifications.getDevicePushTokenAsync();
    console.log(
      '[push] nativePushToken',
      (native as any)?.type,
      (native as any)?.data ? String((native as any).data).slice(0, 24) + '…' : null
    );
  } catch (e: any) {
    console.log('[push] nativePushToken error', String(e));
  }

  const token = await resolveExpoTokenAuthoritative();
  // 🔧 Änderung: Token im erwarteten Muster loggen, damit ADB/grep es findet
  console.log(`[Push] Expo token ${token}`);
  console.log('[Push] deviceId', deviceId);

  let lastLoc: any | null = null;
  try { lastLoc = await (await import('expo-location')).getLastKnownPositionAsync({}); } catch {}
  await registerTokenWithBackend({ expoToken: token, deviceId, lastLocation: lastLoc || undefined });

  if (!notifReceivedSub) {
    notifReceivedSub = Notifications.addNotificationReceivedListener(async (notification) => {
      const c: any = notification?.request?.content || {};
      const data = c.data || {};
      console.log('[push] received', JSON.stringify({
        title: c.title,
        body: c.body,
        channelId: c.android?.channelId || c.channelId || CHANNELS.offers,
        data,
      }));

      // Remote-Dedupe: Zeitstempel pro Offer setzen — NUR bei valider offerId
      const offerId = typeof data?.offerId === 'string' && data.offerId ? String(data.offerId) : null;
      if (offerId) {
        try {
          const key = `offerPushState.${offerId}`;
          const prevRaw = await AsyncStorage.getItem(key);
          const prev = prevRaw ? JSON.parse(prevRaw) : {};
          const next = {
            inside: !!prev.inside,
            lastPushedAt: prev.lastPushedAt || 0,
            lastPushedAtRemote: Date.now(),
          };
          await AsyncStorage.setItem(key, JSON.stringify(next));
        } catch {}
      }

      if (data?.kind === 'offers-refresh') {
        try {
          console.log('[push] offers-refresh → force geofence refresh');
          // konsistent mit übrigen Aufrufern: Objekt-API verwenden
          await refreshGeofencesAroundUser({ force: true });
        } catch (e: any) {
          console.log('[push] offers-refresh failed', String(e?.message || e));
        }
      }
    });
  }

  if (!notifResponseSub) {
    notifResponseSub = Notifications.addNotificationResponseReceivedListener(async (response) => {
      try {
        const action = response?.actionIdentifier;
        const data: any = response?.notification?.request?.content?.data || {};
        const offerId = typeof data?.offerId === 'string' && data.offerId ? String(data.offerId) : null;
        if (!offerId) return;

        if (action === 'later') {
          const { setOfferPushState, getOfferPushState } = await import('./push/push-state');
          const prev = await getOfferPushState(offerId);
          await setOfferPushState(offerId, { inside: true, lastPushedAt: Date.now() || prev.lastPushedAt || 0 });
          console.log('[push] action: LATER -> mark read', offerId);
        }
      } catch (e: any) {
        console.log('[push] response listener error', String(e));
      }
    });
  }

  console.log('[push] listeners installed');
}

export default function PushInitializer() {
  const appState = useRef(AppState.currentState);
  const ranRef = useRef(false);

  // 🔒 Singleton-Guard: falls bereits initialisiert, diesen Mount überspringen
  const skipThisMount = useRef<boolean>(global.__SM_PUSH_INIT_DONE__ === true);

  useEffect(() => {
    if (skipThisMount.current) {
      console.log('[INIT] PushInitializer mount skipped (singleton active)');
      return;
    }

    if (ranRef.current) return;
    ranRef.current = true;

    (async () => {
      console.log('[BGLOC] BackgroundLocationManager: start in PushInitializer');

      // Register background tasks ONCE (prevents reload loop)
      await ensureTasksRegisteredOnce();

      await ensureChannels();

      // Vor Init Badges sicher auf 0 (verhindert OEM/Cache-Anzeigen)
      await resetBadgeCountSafe(0);

      await initPush();

      // Mark as globally initialized (survives Hot-Reload)
      global.__SM_PUSH_INIT_DONE__ = true;
    })();

    const sub = AppState.addEventListener('change', async (next) => {
      const prev = appState.current as string;

      // Nur beim Wechsel in den VORDERGRUND:
      if (/(inactive|background)/.test(prev) && next === 'active') {
        await ensureChannels();

        // 🔒 Zusätzlich: Sofort alle sichtbaren Notifs schließen, falls OEM sie dennoch zeigt.
        try { await Notifications.dismissAllNotificationsAsync(); } catch {}
        // Badge immer auf 0, sicher & ohne Crash
        await resetBadgeCountSafe(0);

        try {
          // Silent-Refresh beim Öffnen der App → KEIN lokaler Push
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

          // ⚠️ Kurzer Delay + FG-Recheck, um Race zu vermeiden
          await new Promise((r) => setTimeout(r, 800));
          if (AppState.currentState !== 'active') {
            console.log('[BGLOC] appstate(fg) → aborted (no longer foreground)');
          } else {
            // Jetzt (im FG) ggf. BG-Location-Service anwerfen
            const started = await (await import('expo-location')).hasStartedLocationUpdatesAsync(BG_LOCATION_TASK);
            if (!started) {
              console.log('[BGLOC] appstate(fg) → (re)start BG location');
              await kickstartBackgroundLocation(); // startet nur im FG
            }
          }
        } catch {}
      }

      // Wichtig: KEIN Restart-Versuch, wenn next !== 'active'
      appState.current = next;
    });

    return () => sub?.remove?.();
  }, []);

  // Wenn bereits initialisiert, keinerlei Hooks/Watchdogs doppelt aktivieren
  if (skipThisMount.current) return null;

  useLocationWatchdog();
  return null;
}
