// stepsmatch/mobile/components/push/push-location.ts
// Stabilisiert Heartbeats & Geofence-Refresh (Debounce/Idempotenz) und verhindert UI-Flackern.
// Exporte:
//   - useLocationWatchdog
//   - kickstartBackgroundLocation
//   - startAggressiveBgLocation / stopAggressiveBgLocation
//   - _sendHeartbeatWithCoords / sendHeartbeat
//
// ⚠️ WICHTIG: Stelle sicher, dass ALLE Importe auf GENAU DIESEN Pfad zeigen,
// damit das Modul nicht doppelt gebundled wird (sonst greifen die Guards nicht):
//   import { useLocationWatchdog, kickstartBackgroundLocation, _sendHeartbeatWithCoords } from 'components/push/push-location';

import { AppState } from 'react-native';
import * as Location from 'expo-location';
import {
  BG_LOCATION_TASK,
  CHANNELS,
  FRESH_FIX_TIMEOUT_MS,
  HEARTBEAT_MIN_SECONDS,
  LOC_STALE_MS,
  WD_TICK_MS,
  GF_STALE_MS,
  RESOLVED_PROJECT_ID,
} from './push-constants';
import {
  getCurrentExpoToken,
  getPersistentDeviceId,
  setGlobalState,
  nowMs,
} from './push-state';
import { ensureChannels } from './push-notifications';
import {
  reconcileInsideFlagsWithPosition,
  refreshGeofencesAroundUser,
} from './push-geofence';

// ────────────────────────────────────────────────────────────
// Interne, konservative Limits & State
// ────────────────────────────────────────────────────────────

/** Mindestabstand zwischen Heartbeats – harte Untergrenze 15s, selbst wenn ENV kleiner ist. */
const HB_MIN_MS = Math.max(HEARTBEAT_MIN_SECONDS * 1000, 15_000);
/** Frühzeitiger Heartbeat, wenn sich die Position stark geändert hat (auch wenn HB_MIN_MS noch nicht um). */
const HB_MIN_MOVE_M = 20;
/** Geofence-Refresh durch Heartbeat höchstens alle 20s. */
const GF_FROM_HB_MIN_MS = 20_000;

let lastHeartbeatAt = 0;
let __hbInFlight = false;
let __lastHbLat: number | null = null;
let __lastHbLng: number | null = null;

let __lastGeofenceRefreshFromHb = 0;

/** 🔒 NEU: Idempotenz-/Debounce-Guards gegen Doppelstarts & Binder-Flut */
let __bgLocStarting = false;           // verhindert parallele Starts
let __bgLocArmed = false;              // merkt, ob wir selbst „armed“ haben
let __lastStartAt = 0;                 // letztes erfolgreiches Start-Zeitstempel
const RESTART_DEBOUNCE_MS = 60_000;    // kein Restart < 60s
const STALE_WARM_FIX_MS = 10_000;      // Warm-Fix-Frist, ohne Restart
let __fgServiceRetryDone = false;      // einmaliger Retry-Guard

export type HeartbeatRefreshMode = 'normal' | 'silent' | 'none';

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────
function isForeground(): boolean {
  try { return AppState.currentState === 'active'; } catch { return false; }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function toRad(d: number) { return (d * Math.PI) / 180; }
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
          + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ────────────────────────────────────────────────────────────
// Permission helpers (minimal-invasiv, aber robust)
// ────────────────────────────────────────────────────────────
async function haveForegroundAndBackgroundPerms(): Promise<boolean> {
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    const bg = await Location.getBackgroundPermissionsAsync();
    const ok = fg?.status === 'granted' && bg?.status === 'granted';
    if (!ok) {
      console.log('[BGLOC] permissions missing', { fg: fg?.status, bg: bg?.status });
    }
    return ok;
  } catch {
    return false;
  }
}

// ────────────────────────────────────────────────────────────
// Location helpers
// ────────────────────────────────────────────────────────────
export async function getFreshBestFixOrNull(timeoutMs = FRESH_FIX_TIMEOUT_MS) {
  try {
    const fix = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced, // genügt, verhindert Battery-Drain
      maximumAge: 0,
      timeout: timeoutMs,
    });
    return fix?.coords ? fix : null;
  } catch {
    return null;
  }
}

export async function ensureGoodAccuracyCoords(
  coords: Partial<Location.LocationObjectCoords> | null
) {
  try {
    if (
      !coords ||
      !Number.isFinite((coords as any).latitude) ||
      !Number.isFinite((coords as any).longitude)
    ) {
      const fresh = await getFreshBestFixOrNull();
      return fresh?.coords || null;
    }
    const MIN_GOOD = 25;
    if (
      !Number.isFinite((coords as any).accuracy) ||
      ((coords as any).accuracy as number) > MIN_GOOD
    ) {
      const fresh = await getFreshBestFixOrNull();
      if (fresh?.coords && (fresh.coords.accuracy ?? 9e9) < (((coords as any).accuracy) ?? 9e9)) {
        return fresh.coords;
      }
    }
    return coords as Location.LocationObjectCoords;
  } catch {
    return (coords as any) || null;
  }
}

// ────────────────────────────────────────────────────────────
/** Debounced Geofence-Refresh, zentral verwendet von Heartbeats. */
// ────────────────────────────────────────────────────────────
async function maybeRefreshGeofencesDebounced(silent: boolean) {
  const now = nowMs();
  if (now - __lastGeofenceRefreshFromHb < GF_FROM_HB_MIN_MS) return;
  try {
    await refreshGeofencesAroundUser({ force: true, silent });
  } finally {
    __lastGeofenceRefreshFromHb = now;
  }
}

// ────────────────────────────────────────────────────────────
// Heartbeat (gedrosselt & entprellt)
// ────────────────────────────────────────────────────────────
export async function _sendHeartbeatWithCoords({
  latitude,
  longitude,
  accuracy,
  refreshMode = 'normal',
}: {
  latitude: number;
  longitude: number;
  accuracy?: number;
  refreshMode?: HeartbeatRefreshMode;
}) {
  // Anti-Sturm: nur bei signifikanter Bewegung ODER nach Zeitfenster
  const now = nowMs();
  const movedEnough =
    __lastHbLat == null || __lastHbLng == null
      ? true
      : haversineMeters(__lastHbLat, __lastHbLng, latitude, longitude) >= HB_MIN_MOVE_M;

  const timeOk = now - lastHeartbeatAt >= HB_MIN_MS;

  if (__hbInFlight || (!timeOk && !movedEnough)) {
    // trotzdem (leise) Geofences frisch halten – aber debounced
    if (refreshMode === 'normal' || refreshMode === 'silent') {
      await maybeRefreshGeofencesDebounced(true);
    }
    return;
  }

  __hbInFlight = true;
  lastHeartbeatAt = now;         // früh setzen → schützt bei parallelen Aufrufen
  __lastHbLat = latitude;
  __lastHbLng = longitude;

  try {
    const token = await getCurrentExpoToken();
    const deviceId = await getPersistentDeviceId();
    if (!token || !deviceId) return;

    const res = await fetch(
      `https://lobster-app-ie9a5.ondigitalocean.app/api/location/heartbeat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          deviceId,
          lat: latitude,
          lng: longitude,
          accuracy,
          platform: 'android',
          projectId: RESOLVED_PROJECT_ID,
        }),
      }
    );
    const json = await res.json().catch(() => ({}));
    console.log('[BGLOC] Heartbeat', res.status, JSON.stringify(json));
  } catch (e: any) {
    console.log('[BGLOC] Heartbeat error', String(e));
  } finally {
    __hbInFlight = false;
  }

  // Leichtgewichtige, lokale Korrektur der Inside-Flags
  try {
    await reconcileInsideFlagsWithPosition({ latitude, longitude, accuracy });
  } catch (e: any) {
    console.log('[RECONCILE] failed after heartbeat', String(e));
  }

  // Geofences updaten – aber sauber gedrosselt
  try {
    if (refreshMode === 'normal') {
      await maybeRefreshGeofencesDebounced(false);
    } else if (refreshMode === 'silent') {
      await maybeRefreshGeofencesDebounced(true);
    } else {
      // none → explizit nichts tun
    }
  } catch (e: any) {
    console.log('[geofence] heartbeat-refresh failed', String(e));
  }

  await setGlobalState({ lastHeartbeatAt: now });
}

export async function sendHeartbeat(arg?: any) {
  try {
    if (
      arg &&
      typeof arg === 'object' &&
      Number.isFinite(arg.latitude) &&
      Number.isFinite(arg.longitude)
    ) {
      return _sendHeartbeatWithCoords({ ...arg, refreshMode: 'normal' });
    }

    // fallback: letztes Fix oder kurzer Fresh-Fix
    const pos =
      (await Location.getLastKnownPositionAsync({})) ??
      (await getFreshBestFixOrNull(5_000));

    if (pos?.coords) {
      return _sendHeartbeatWithCoords({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        refreshMode: 'silent',
      });
    }
  } catch (e: any) {
    console.log('[BGLOC] sendHeartbeat wrapper error', String(e));
  }
}

// ────────────────────────────────────────────────────────────
// Background Location start (mit Foreground Service)
// ────────────────────────────────────────────────────────────

// Safe resolver für die Background-Notification-Channel-ID
function getBgChannelId(): string {
  try {
    const id = (CHANNELS as any)?.bg;
    return typeof id === 'string' && id.length
      ? id
      : 'com.ecily.mobile:stepsmatch-bg-location-task';
  } catch {
    return 'com.ecily.mobile:stepsmatch-bg-location-task';
  }
}

export async function startAggressiveBgLocation() {
  // Ab Android 12+: FG-Service darf nicht aus BG gestartet werden.
  if (!isForeground()) {
    console.log('[BGLOC] skip startLocationUpdates (app in background)');
    return;
  }

  // 🔒 Idempotenz: parallele Starts verhindern
  if (__bgLocStarting) {
    console.log('[BGLOC] start: already starting → skip');
    return;
  }

  // Channels sicherstellen (defensiv; Fehler dürfen Flow nicht stoppen)
  try { await ensureChannels(); } catch {}

  try {
    __bgLocStarting = true;

    // Permissions prüfen, bevor wir starten (minimiert Fehlpfade)
    if (!(await haveForegroundAndBackgroundPerms())) {
      console.log('[BGLOC] start: missing permissions → skip');
      return;
    }

    const started = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK);
    const now = Date.now();

    if (started) {
      __bgLocArmed = true;
      console.log('[BGLOC] start: already running → no-op');
      return;
    }

    // Debounce gegen schnelle Restart-Loops
    if (__lastStartAt && (now - __lastStartAt) < RESTART_DEBOUNCE_MS) {
      console.log('[BGLOC] start: debounce window → skip');
      return;
    }

    const channelId = getBgChannelId();
    console.log('[BGLOC] using bg channel', channelId);

    await Location.startLocationUpdatesAsync(BG_LOCATION_TASK, {
      // Konservative, batteriefreundliche Defaults
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 10_000,   // Android: min. 10s
      distanceInterval: 15,   // mind. 15m Bewegung
      deferredUpdatesInterval: 0,
      deferredUpdatesDistance: 0,
      pausesUpdatesAutomatically: true,
      showsBackgroundLocationIndicator: false, // iOS-only (harmlos)
      mayShowUserSettingsDialog: true,
      foregroundService: {
        notificationTitle: 'StepsMatch ist aktiv',
        notificationBody: 'Standort wird im Hintergrund aktualisiert.',
        notificationChannelId: channelId,
      },
    });

    __bgLocArmed = true;
    __lastStartAt = now;

    // Optionaler „warm fix“ ohne harten Neustart – reduziert Binder-Last
    try {
      const warm = await getFreshBestFixOrNull(5_000);
      if (warm?.coords) {
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        await AsyncStorage.setItem('lastFixAt', String(Date.now()));
        await _sendHeartbeatWithCoords({
          latitude: warm.coords.latitude,
          longitude: warm.coords.longitude,
          accuracy: warm.coords.accuracy,
          refreshMode: isForeground() ? 'silent' : 'normal',
        });
      }
    } catch {}

    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.setItem('lastFixAt', String(Date.now()));
    console.log('[BGLOC] startLocationUpdatesAsync → armed (aggressive)');
  } catch (e: any) {
    const msg = String(e?.message || e);
    console.log('[BGLOC] startLocationUpdatesAsync error', msg);

    // Einmaliger Retry, wenn das FG-Service zu früh gestartet wurde
    if (!__fgServiceRetryDone && /Foreground service cannot be started/i.test(msg)) {
      __fgServiceRetryDone = true;
      console.log('[BGLOC] retry: foreground service race → wait 1s & retry');
      await sleep(1_000);
      if (isForeground()) {
        __bgLocStarting = false; // Reset, damit Retry nicht geblockt wird
        await startAggressiveBgLocation();
      } else {
        console.log('[BGLOC] retry aborted: not in foreground anymore');
      }
    }
  } finally {
    __bgLocStarting = false;
  }
}

export async function stopAggressiveBgLocation() {
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK);
    if (started) {
      await Location.stopLocationUpdatesAsync(BG_LOCATION_TASK);
      console.log('[BGLOC] stopLocationUpdatesAsync → stopped');
    }
  } catch (e: any) {
    console.log('[BGLOC] stop error', String(e?.message || e));
  } finally {
    __bgLocArmed = false;
  }
}

export async function kickstartBackgroundLocation() {
  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    const bg = await Location.requestBackgroundPermissionsAsync();
    console.log('[BGLOC] permissions', {
      fg: (fg as any)?.status,
      bg: (bg as any)?.status,
    });

    if (!isForeground()) {
      // Android 12+ Restriktion: Start erst im FG. Sende nur leichten Heartbeat.
      console.log('[BGLOC] kickstart: app in background → defer start, send heartbeat only');
      const loc = await Location.getLastKnownPositionAsync({});
      if (loc?.coords) {
        await _sendHeartbeatWithCoords({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy: loc.coords.accuracy,
          refreshMode: 'silent',
        });
      }
      return;
    }

    await startAggressiveBgLocation();

    const loc = await Location.getLastKnownPositionAsync({});
    if (loc?.coords) {
      await _sendHeartbeatWithCoords({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy,
        refreshMode: 'silent',
      });
    }
  } catch (e: any) {
    console.log('[BGLOC] kickstart error', String(e));
  }
}

// ────────────────────────────────────────────────────────────
// Watchdog
// ────────────────────────────────────────────────────────────
export function useLocationWatchdog() {
  const React = require('react');
  const { useEffect, useRef } = React as typeof import('react');
  const timerRef = useRef<any>(null);

  useEffect(() => {
    async function tick() {
      try {
        // Kein Start-Versuch, wenn die App im Hintergrund ist
        if (!isForeground()) {
          // optional: kurzen, stillen Heartbeat schicken (debounced in _sendHeartbeatWithCoords)
          const pos = await Location.getLastKnownPositionAsync({});
          if (pos?.coords) {
            await _sendHeartbeatWithCoords({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              refreshMode: 'silent',
            });
          }
          return;
        }

        const locStarted = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK);

        if (!locStarted) {
          console.log('[BGLOC] watchdog → BG task not running → start');
          await startAggressiveBgLocation();
        }

        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        const lastFixAt = Number((await AsyncStorage.getItem('lastFixAt')) || 0);
        const age = Date.now() - lastFixAt;

        // Bei stale Fix KEIN harter Neustart, zuerst warm fix + heartbeat
        if (!lastFixAt || age > LOC_STALE_MS) {
          console.log('[BGLOC] watchdog → stale fix (age=', age, 'ms) → warm-fix + heartbeat');

          try {
            const warm = await getFreshBestFixOrNull(STALE_WARM_FIX_MS);
            const pos = warm?.coords
              ? { coords: warm.coords }
              : await Location.getLastKnownPositionAsync({});
            if (pos?.coords) {
              await AsyncStorage.setItem('lastFixAt', String(Date.now()));
              await _sendHeartbeatWithCoords({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
                refreshMode: 'normal',
              });
            }
          } catch {}

          // Nur wenn Task NICHT läuft, nach Debounce starten
          const stillStarted = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK);
          if (!stillStarted) {
            await startAggressiveBgLocation();
          }
        }

        const { GEOFENCE_TASK } = await import('./push-constants');
        const gfStarted = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
        const mod = await import('./push-geofence');
        const gfAge = Date.now() - (mod as any).lastGeofenceSyncAt;
        if (!gfStarted) {
          console.log('[GEOFENCE] watchdog → geofencing not running → force refresh');
          await refreshGeofencesAroundUser({ force: true, silent: true });
        } else if (!(mod as any).lastGeofenceSyncAt || gfAge > GF_STALE_MS) {
          console.log('[GEOFENCE] watchdog → geofence stale (age=', gfAge, 'ms) → force refresh');
          await refreshGeofencesAroundUser({ force: true, silent: true });
        }
      } catch (e: any) {
        console.log('[WD] tick error', String(e?.message || e));
      }
    }

    // Sofort ein erster Tick, dann zyklisch
    tick();
    // @ts-ignore
    timerRef.current = setInterval(tick, WD_TICK_MS);

    // Re-arm beim Wechsel in den Vordergrund
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        setTimeout(() => { kickstartBackgroundLocation(); }, 800);
      }
    });

    return () => {
      try { if (timerRef.current) clearInterval(timerRef.current); } catch {}
      try { sub?.remove?.(); } catch {}
    };
  }, []);
}
