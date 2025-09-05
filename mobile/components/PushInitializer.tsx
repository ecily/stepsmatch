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
import { isOfferActiveNow } from '../utils/isOfferActiveNow'; // ✅ ValidTimes (Europe/Vienna)

// ────────────────────────────────────────────────────────────
// NEW: Notification handler (Foreground sichtbar)
// ────────────────────────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────
const BG_LOCATION_TASK = 'stepsmatch-bg-location-task';
const GEOFENCE_TASK    = 'stepsmatch-geofence-task';

const HEARTBEAT_MIN_SECONDS = 45;         // Debounce für Heartbeats
const TIME_INTERVAL_MS = 60 * 1000;       // ~60s Fallback, Geofence liefert Sofort-Push

const API_BASE = 'https://lobster-app-ie9a5.ondigitalocean.app/api';
const EUROPE_VIENNA = 'Europe/Vienna';

// Geofencing
const MAX_GEOFENCES = 20;                 // Sicherheitslimit
const GEOFENCE_SYNC_INTERVAL_MS = 60 * 1000; // 60s
const DEFAULT_RADIUS_M = 120;             // falls Offer keinen Radius hat
const OUTSIDE_TOLERANCE_M = 15;           // Toleranz für Reconciliation

// Sanity + Throttle
const ENTER_SANITY_BUFFER_M = 12;                              // kleiner Sicherheits-Puffer gegen False-Positives
const MIN_MS_BETWEEN_PUSH_SAME_OFFER = 2 * 60 * 1000;          // 2 min per Offer
const MIN_MS_BETWEEN_PUSH_GLOBAL     = 20 * 1000;              // 20 s global

// Storage Keys
const TOKEN_KEY = 'expoPushToken.v2';
const DEVICE_ID_SECURE_KEY = 'deviceId.v1';
const DEVICE_ID_ASYNC_KEY  = 'deviceId.v1.mirror';

// Global-State-Storage (für Throttle & Heartbeat)
const GLOBAL_STATE_KEY = 'offerPushState.__global';            // { lastAnyPushAt, lastHeartbeatAt }

const RESOLVED_PROJECT_ID =
  (Constants?.expoConfig?.extra && Constants.expoConfig.extra.eas?.projectId) ||
  (Constants?.easConfig && Constants.easConfig.projectId) ||
  '08559a29-b307-47e9-a130-d3b31f73b4ed';

// Laufzeit-Cache der aktuell gesetzten Geofence-Regionen
let CURRENT_REGIONS = []; // [{ identifier, latitude, longitude, radius }, ...]

// ────────────────────────────────────────────────────────────
// Utilities
// ────────────────────────────────────────────────────────────
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
function toRad(d) { return (d * Math.PI) / 180; }
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
function nowMs() { return Date.now(); }

// Offer Push State (inside/lastPushedAt)
async function getOfferPushState(offerId) {
  try {
    const raw = await AsyncStorage.getItem(`offerPushState.${offerId}`);
    return raw ? JSON.parse(raw) : { inside: false, lastPushedAt: 0 };
  } catch { return { inside: false, lastPushedAt: 0 }; }
}
async function setOfferPushState(offerId, state) {
  try { await AsyncStorage.setItem(`offerPushState.${offerId}`, JSON.stringify(state)); } catch {}
}

// Global-State Helpers
async function getGlobalState() {
  try {
    const raw = await AsyncStorage.getItem(GLOBAL_STATE_KEY);
    return raw ? JSON.parse(raw) : { lastAnyPushAt: 0, lastHeartbeatAt: 0 };
  } catch {
    return { lastAnyPushAt: 0, lastHeartbeatAt: 0 };
  }
}
async function setGlobalState(patch) {
  const prev = await getGlobalState();
  const next = { ...prev, ...patch };
  try { await AsyncStorage.setItem(GLOBAL_STATE_KEY, JSON.stringify(next)); } catch {}
  return next;
}

// Meta Cache für schnelle Notification-Texte
async function setOfferMeta(offerId, meta) {
  try { await AsyncStorage.setItem(`offerMeta.${offerId}`, JSON.stringify(meta)); } catch {}
}
async function getOfferMeta(offerId) {
  try {
    const raw = await AsyncStorage.getItem(`offerMeta.${offerId}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// Hilfsfunktionen für inside-Reconciliation & Pruning
function parseOfferIdFromIdentifier(identifier = '') {
  const m = String(identifier).match(/^offer:([a-f0-9]{24})$/i);
  return m ? m[1] : null;
}

async function pruneObsoleteOfferStates(validIdentifiers) {
  try {
    const validIds = new Set(
      (validIdentifiers || [])
        .map(parseOfferIdFromIdentifier)
        .filter(Boolean)
    );
    const keys = await AsyncStorage.getAllKeys();
    const offerStateKeys = (keys || []).filter(k => k.startsWith('offerPushState.'));
    const ops = [];
    for (const key of offerStateKeys) {
      const offerId = key.slice('offerPushState.'.length);
      if (!validIds.has(offerId)) {
        ops.push(AsyncStorage.setItem(key, JSON.stringify({ inside: false, lastPushedAt: 0 })));
      }
    }
    if (ops.length) await Promise.allSettled(ops);
  } catch (_) {}
}

/** Reconcile inside-Flags anhand aktueller Position gegen gesetzte Regionen. */
async function reconcileInsideFlagsWithPosition({ latitude, longitude }) {
  try {
    if (!CURRENT_REGIONS?.length || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    const updates = [];
    for (const r of CURRENT_REGIONS) {
      const offerId = parseOfferIdFromIdentifier(r.identifier);
      if (!offerId) continue;

      const d = haversineMeters(latitude, longitude, r.latitude, r.longitude);
      const outside = d > (Number(r.radius) + OUTSIDE_TOLERANCE_M);

      if (outside) {
        const state = await getOfferPushState(offerId);
        if (state.inside) {
          updates.push(setOfferPushState(offerId, { inside: false, lastPushedAt: state.lastPushedAt || 0 }));
          console.log('[RECONCILE] set outside for', offerId, `(d=${Math.round(d)}m > r=${r.radius}m+tol)`);
        }
      }
    }
    if (updates.length) await Promise.allSettled(updates);
  } catch (e) {
    console.log('[RECONCILE] error', String(e));
  }
}

// Quiet-Inside markieren (App-Neustart/Refresh), ohne Push
async function markAlreadyInsideQuietly() {
  try {
    if (!CURRENT_REGIONS?.length) return;
    const pos = await Location.getLastKnownPositionAsync({ maxAge: 2 * 60 * 1000, requiredAccuracy: 200 });
    if (!pos?.coords) return;

    const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    for (const r of CURRENT_REGIONS) {
      const offerId = parseOfferIdFromIdentifier(r.identifier);
      if (!offerId) continue;
      const d = haversineMeters(here.lat, here.lng, r.latitude, r.longitude);
      const effective = (r.radius ?? 0) + ENTER_SANITY_BUFFER_M;
      if (d <= effective) {
        const st = await getOfferPushState(offerId);
        if (!st.inside) {
          await setOfferPushState(offerId, { inside: true, lastPushedAt: st.lastPushedAt || 0 });
          console.log('[GEOFENCE] QUIET-INSIDE (no push)', r.identifier, { d: Math.round(d), effective });
        }
      }
    }
  } catch (e) {
    console.log('[GEOFENCE] QUIET-INSIDE error', String(e));
  }
}

// ────────────────────────────────────────────────────────────
// Notification Channels & Category
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

    const STRONG_PATTERN = [0, 400, 200, 800, 300, 1000];
    await Notifications.setNotificationChannelAsync('offers', {
      name: 'Offers',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: STRONG_PATTERN,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
      showBadge: true,
    });

    await Notifications.setNotificationCategoryAsync('offer-go', [
      { identifier: 'go', buttonTitle: 'GO', options: { opensAppToForeground: true } },
      { identifier: 'dismiss', buttonTitle: 'DISMISS', options: { isDestructive: true } },
    ]);

    await Notifications.setNotificationChannelAsync('com.ecily.mobile:stepsmatch-bg-location-task', {
      name: 'StepsMatch – Hintergrund',
      importance: Notifications.AndroidImportance.MIN,
      sound: null,
      vibrationPattern: [],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.SECRET,
      bypassDnd: false,
    });

    console.log('[push] channels ready: offers, stepsmatch-default-v2, com.ecily.mobile:stepsmatch-bg-location-task');
    console.log('[push] category ready: offer-go');
  } catch (e) {
    console.warn('[notif] ensureChannels failed:', e?.message || e);
  }
}

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

let CURRENT_EXPO_TOKEN = null;
let REGISTERED_READY = false;
let lastGeofenceSyncAt = 0;

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
    if (res.ok) {
      REGISTERED_READY = true;
      try {
        await kickstartBackgroundLocation();
        await refreshGeofencesAroundUser(true);
      } catch (e) {
        console.warn('[BGLOC] auto-start or geofence-sync after register failed', String(e));
      }
    }
  } catch (e) {
    console.warn('[push] register error', String(e));
  }
}

// ────────────────────────────────────────────────────────────
// Local-first Geofencing
// ────────────────────────────────────────────────────────────
async function fetchCandidateOffers() {
  try {
    const res = await fetch(`${API_BASE}/offers?withProvider=1`, { method: 'GET' });
    const json = await res.json();
    if (!res.ok) {
      console.log('[geofence] fetch offers error', res.status, JSON.stringify(json));
      return [];
    }
    const list = Array.isArray(json) ? json : (json?.data || []);
    return list || [];
  } catch (e) {
    console.log('[geofence] fetch offers exception', String(e));
    return [];
  }
}

function pickOfferPoint(offer) {
  const coords =
    (offer?.provider?.location?.coordinates) ||
    (offer?.location?.coordinates) ||
    null;
  if (!coords || coords.length < 2) return null;
  const [lng, lat] = coords;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  return { lat, lng };
}

function offerRadius(offer) {
  return (
    offer?.radiusM ??
    offer?.radius ??
    offer?.radiusMeters ??
    DEFAULT_RADIUS_M
  );
}

async function refreshGeofencesAroundUser(force = false) {
  try {
    const now = nowMs();
    if (!force && now - lastGeofenceSyncAt < GEOFENCE_SYNC_INTERVAL_MS) {
      return;
    }

    const loc = await Location.getLastKnownPositionAsync({});
    if (!loc?.coords) {
      console.log('[geofence] skip sync (no lastKnownPosition)');
      return;
    }
    const { latitude, longitude } = loc.coords;

    const offers = await fetchCandidateOffers();
    const activeNearby = [];
    for (const offer of offers) {
      try {
        if (!isOfferActiveNow(offer, EUROPE_VIENNA)) continue;
        const p = pickOfferPoint(offer);
        if (!p) continue;
        const dist = haversineMeters(latitude, longitude, p.lat, p.lng);
        if (dist <= 2000) {
          activeNearby.push({ offer, p, dist });
        }
      } catch (_) {}
    }
    activeNearby.sort((a, b) => a.dist - b.dist);
    const top = activeNearby.slice(0, MAX_GEOFENCES);

    const regions = top.map(({ offer, p }) => {
      const r = offerRadius(offer);
      const identifier = `offer:${offer._id}`;
      setOfferMeta(offer._id, {
        title: offer?.title || offer?.name || 'Angebot in deiner Nähe',
        providerName: offer?.provider?.name || '',
        radius: r,
      }).catch(() => {});
      return {
        identifier,
        latitude: p.lat,
        longitude: p.lng,
        radius: Math.max(20, Math.min(500, Number(r) || DEFAULT_RADIUS_M)), // 20..500m
        notifyOnEnter: true,
        notifyOnExit: true,
      };
    });

    if (!regions.length) {
      console.log('[geofence] no active nearby offers -> stop if running');
      const started = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
      if (started) {
        try {
          await Location.stopGeofencingAsync(GEOFENCE_TASK);
        } catch (e) {
          // 🔇 TaskNotFound/AlreadyStopped ignorieren
          console.log('[geofence] stop (ignored)', String(e?.message || e));
        }
        console.log('[geofence] geofencing stopped (no regions)');
      }
      CURRENT_REGIONS = [];
      lastGeofenceSyncAt = now;
      return;
    }

    const started = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
    if (started) {
      try {
        await Location.stopGeofencingAsync(GEOFENCE_TASK);
      } catch (e) {
        console.log('[geofence] stop before (ignored)', String(e?.message || e));
      }
    }
    try {
      await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
    } catch (e) {
      // Manche ROMs brauchen einen kurzen Retry, wenn stop/start raced
      console.log('[geofence] start failed once, retrying...', String(e?.message || e));
      await new Promise(r => setTimeout(r, 250));
      await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
    }
    CURRENT_REGIONS = regions.slice(); // für Heartbeat-Reconciliation
    lastGeofenceSyncAt = now;
    console.log('[geofence] started with', regions.length, 'regions');

    try {
      await pruneObsoleteOfferStates(regions.map(r => r.identifier));
    } catch (_) {}

    await markAlreadyInsideQuietly();
  } catch (e) {
    console.log('[geofence] refresh error', String(e));
  }
}

// ────────────────────────────────────────────────────────────
// Local Notification helper (SDK ≥ 51 kompatibel)
// ────────────────────────────────────────────────────────────
async function presentLocalOfferNotification(offerId, meta) {
  const title =
    meta?.title && meta?.providerName
      ? `${meta.title} – ${meta.providerName}`
      : (meta?.title || 'Angebot in deiner Nähe');

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body: 'Du bist jetzt im Radius. Tippe „GO“ für Details & Route.',
      data: { offerId, source: 'geofence-local', t: nowMs() },
      sound: true,
      categoryIdentifier: 'offer-go',
      android: { channelId: 'offers' },
    },
    trigger: null, // → sofort
  });
}

// Backend-Report (fire-and-forget)
async function reportEnterToBackend({ offerId, lat, lng, accuracy }) {
  try {
    const token = await getCurrentExpoToken();
    const deviceId = await getPersistentDeviceId();
    const payload = {
      offerId,
      token,
      deviceId,
      platform: Platform.OS,
      projectId: RESOLVED_PROJECT_ID,
      source: 'local-geofence',
      t: nowMs(),
      lat,
      lng,
      accuracy,
    };
    fetch(`${API_BASE}/push/enter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {}
}

// ───────────── BG-Location & Heartbeat (Fallback) ─────────────
let lastHeartbeatAt = 0;

async function _sendHeartbeatWithCoords({ latitude, longitude, accuracy }) {
  if (!REGISTERED_READY) {
    console.log('[HB] skipped (not registered yet)');
    return;
  }
  const now = nowMs();
  if (now - lastHeartbeatAt < HEARTBEAT_MIN_SECONDS * 1000) return;
  lastHeartbeatAt = now;

  try {
    const token = await getCurrentExpoToken();
    const deviceId = await getPersistentDeviceId();
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

  try {
    await reconcileInsideFlagsWithPosition({ latitude, longitude });
  } catch (e) {
    console.log('[RECONCILE] failed after heartbeat', String(e));
  }

  try {
    console.log('[geofence] heartbeat-triggered refresh (force=true)');
    await refreshGeofencesAroundUser(true);
  } catch (e) {
    console.log('[geofence] heartbeat-triggered refresh failed', String(e));
  }

  await setGlobalState({ lastHeartbeatAt: now });
}

/** Exportierte Heartbeat-Funktion */
export async function sendHeartbeat(arg) {
  try {
    if (typeof arg === 'string') {
      const pos = await Location.getLastKnownPositionAsync({});
      if (!pos?.coords) {
        try {
          const fresh = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (fresh?.coords) {
            return _sendHeartbeatWithCoords({
              latitude: fresh.coords.latitude,
              longitude: fresh.coords.longitude,
              accuracy: fresh.coords.accuracy,
            });
          }
        } catch {}
        console.log('[BGLOC] sendHeartbeat(token) no position available');
        return;
      }
      return _sendHeartbeatWithCoords({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      });
    }

    if (arg && typeof arg === 'object' && Number.isFinite(arg.latitude) && Number.isFinite(arg.longitude)) {
      return _sendHeartbeatWithCoords(arg);
    }

    const pos = await Location.getLastKnownPositionAsync({});
    if (pos?.coords) {
      return _sendHeartbeatWithCoords({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      });
    }
  } catch (e) {
    console.log('[BGLOC] sendHeartbeat wrapper error', String(e));
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
        accuracy: Location.Accuracy.High,
        timeInterval: TIME_INTERVAL_MS,
        distanceInterval: 10,
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
      await _sendHeartbeatWithCoords({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy,
      });
    }
  } catch (e) {
    console.log('[BGLOC] kickstart error', String(e));
  }
}

// ───────────── Task Definitions ─────────────
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
      await _sendHeartbeatWithCoords({ latitude, longitude, accuracy });

      try {
        console.log('[geofence] bg-task-triggered refresh (force=true)');
        await refreshGeofencesAroundUser(true);
      } catch (e) {
        console.log('[geofence] bg-task-triggered refresh failed', String(e));
      }
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
  const ident = String(region?.identifier || '');
  console.log('[GEOFENCE] event', eventType, ident);

  const m = ident.match(/^offer:([a-f0-9]{24})$/i);
  if (!m) return;
  const offerId = m[1];

  try {
    const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 2 * 60 * 1000, requiredAccuracy: 200 });
    const lat = lastKnown?.coords?.latitude ?? null;
    const lng = lastKnown?.coords?.longitude ?? null;
    const accuracy = lastKnown?.coords?.accuracy ?? null;

    if (eventType === Location.GeofencingEventType.Enter) {
      // Sanity-Check gegen False-Positive ENTER
      if (lat != null && lng != null && Number.isFinite(region?.latitude) && Number.isFinite(region?.longitude)) {
        const d = haversineMeters(lat, lng, region.latitude, region.longitude);
        const effective = (region.radius ?? 0) + ENTER_SANITY_BUFFER_M;
        if (d > effective) {
          console.log('[GEOFENCE] ENTER ignored (SANITY:OUTSIDE)', { d: Math.round(d), effective });
          return;
        }
      } else {
        console.log('[GEOFENCE] ENTER with no lastKnownPosition (proceeding)');
      }

      const state = await getOfferPushState(offerId);
      if (state.inside) {
        console.log('[GEOFENCE] ENTER dedup -> already inside, skip', offerId);
        return;
      }

      // sanfter Throttle per Offer & global
      const now = nowMs();
      if (state.lastPushedAt && now - state.lastPushedAt < MIN_MS_BETWEEN_PUSH_SAME_OFFER) {
        console.log('[GEOFENCE] THROTTLE per-offer hit', offerId);
        await setOfferPushState(offerId, { inside: true, lastPushedAt: state.lastPushedAt });
        return;
      }
      const g = await getGlobalState();
      if (g.lastAnyPushAt && now - g.lastAnyPushAt < MIN_MS_BETWEEN_PUSH_GLOBAL) {
        console.log('[GEOFENCE] THROTTLE global hit', offerId);
        await setOfferPushState(offerId, { inside: true, lastPushedAt: state.lastPushedAt || 0 });
        return;
      }

      // Offer wirklich aktiv?
      let active = true;
      try {
        const res = await fetch(`${API_BASE}/offers/${offerId}?withProvider=1`, { method: 'GET' });
        const offer = await res.json();
        active = res.ok ? !!isOfferActiveNow(offer, EUROPE_VIENNA) : true;
      } catch (_) {}

      if (!active) {
        console.log('[LOCAL_PUSH] skipped (not active now)', offerId);
        await setOfferPushState(offerId, { inside: true, lastPushedAt: state.lastPushedAt || 0 });
        return;
      }

      // ✅ Sofort-Push lokal (SDK-konform)
      const meta = await getOfferMeta(offerId);
      await Notifications.setBadgeCountAsync?.(0).catch?.(()=>{});
      await presentLocalOfferNotification(offerId, meta);
      console.log('[LOCAL_PUSH_SHOWN] offerId=', offerId);

      await setOfferPushState(offerId, { inside: true, lastPushedAt: now });
      await setGlobalState({ lastAnyPushAt: now });

      reportEnterToBackend({ offerId, lat, lng, accuracy }).catch(() => {});
    }

    if (eventType === Location.GeofencingEventType.Exit) {
      // Re-Enter erlaubt → lastPushedAt NICHT hochsetzen
      const prev = await getOfferPushState(offerId);
      await setOfferPushState(offerId, { inside: false, lastPushedAt: prev.lastPushedAt || 0 });
      console.log('[GEOFENCE] EXIT -> re-enter will notify again', offerId);
    }
  } catch (e) {
    console.log('[GEOFENCE] handler exception', String(e));
  }
});

// ───────────── Diagnostics: Roundtrip an Backend ─────────────
export async function sendRoundtripTest({ offerId = 'ROUNDTRIP_TEST' } = {}) {
  try {
    const token = await getCurrentExpoToken();
    const deviceId = await getPersistentDeviceId();
    const payload = {
      token,
      deviceId,
      platform: Platform.OS,
      projectId: RESOLVED_PROJECT_ID,
      offerId,
      t: nowMs(),
    };

    // bevorzugt /push/roundtrip; Fallbacks: /push/test, /push/ping
    const endpoints = ['roundtrip', 'test', 'ping'];
    let ok = false, lastStatus = 0;
    for (const ep of endpoints) {
      try {
        const res = await fetch(`${API_BASE}/push/${ep}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        lastStatus = res.status;
        if (res.ok) { ok = true; break; }
      } catch {}
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'StepsMatch – Roundtrip',
        body: ok ? 'Backend-Push ausgelöst.' : `Backend nicht erreichbar (status=${lastStatus}).`,
        data: { kind: 'roundtrip', ok },
        android: { channelId: 'offers' },
      },
      trigger: null,
    });
    console.log('[diag] roundtrip', ok ? 'ok' : `failed status=${lastStatus}`);
  } catch (e) {
    console.log('[diag] roundtrip error', String(e));
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'StepsMatch – Roundtrip',
        body: 'Fehler beim Auslösen. Lokale Bestätigung angezeigt.',
        data: { kind: 'roundtrip', ok: false, error: String(e) },
        android: { channelId: 'offers' },
      },
      trigger: null,
    });
  }
}

// ───────────── Init & Component ─────────────
async function initPush() {
  await ensureChannels();
  const granted = await askNotificationPermission();
  if (!granted) return;

  const deviceId = await getPersistentDeviceId();

  // Native FCM (Diagnose)
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
      channelId: c.android?.channelId || c.channelId || 'offers',
      data,
    }));
  });

  console.log('[push] listeners installed');
}

export default function PushInitializer() {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    (async () => {
      console.log('[BGLOC] BackgroundLocationManager: start in PushInitializer');
      await ensureChannels();
      await initPush(); // Register -> BG-Location & Geofences starten
    })();

    const sub = AppState.addEventListener('change', async (next) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        await ensureChannels();
        try {
          await refreshGeofencesAroundUser(true); // beim Zurückkehren hart refreshen
          const loc = await Location.getLastKnownPositionAsync({});
          if (loc?.coords) {
            await _sendHeartbeatWithCoords({
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
