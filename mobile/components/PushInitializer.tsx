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
// ✅ NEU: Interessen-Utils zentral
import { csvToSet, matchesInterests } from '../utils/interests';

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
const TIME_INTERVAL_MS = 60 * 1000;       // fallback (wird durch aggressives Profil übersteuert)

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

// Grouping (Android Notification Group) + Anti-Spam
const GROUP_COOLDOWN_MS   = 2 * 60 * 1000;   // 2 Min pro groupId
const SUMMARY_WINDOW_MS   = 60 * 1000;       // 60s: in diesem Fenster fassen wir zusammen
const GROUP_STATE_KEY_PR  = 'offerGroupState.'; // offerGroupState.<groupId>

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

// Markenfarbe (für LED) & Vibrationsmuster
const BRAND_BLUE = '#0d4ea6';
const STRONG_PATTERN = [0, 450, 180, 900, 300, 1200]; // kräftig & markant

// Laufzeit-Cache der aktuell gesetzten Geofence-Regionen
let CURRENT_REGIONS = []; // [{ identifier, latitude, longitude, radius }, ...]

// ✅ NEU: leichter Cache für Interessen
let INTEREST_SET_CACHE = /** @type {Set<string> | null} */ (null);
let INTERESTS_LAST_LOAD_AT = 0;
const INTERESTS_TTL_MS = 60 * 1000; // 60s reicht

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

// ✅ NEU: Interessen laden (cached)
async function getInterestSet() {
  const now = nowMs();
  if (INTEREST_SET_CACHE && (now - INTERESTS_LAST_LOAD_AT) < INTERESTS_TTL_MS) {
    return INTEREST_SET_CACHE;
  }
  try {
    const raw = await AsyncStorage.getItem('userInterests');
    const arr = raw ? JSON.parse(raw) : [];
    const csv = Array.isArray(arr) && arr.length ? arr.join(',') : '';
    INTEREST_SET_CACHE = csvToSet(csv);
    INTERESTS_LAST_LOAD_AT = now;
    return INTEREST_SET_CACHE;
  } catch {
    INTEREST_SET_CACHE = new Set();
    INTERESTS_LAST_LOAD_AT = now;
    return INTEREST_SET_CACHE;
  }
}

// ✅ NEU: Offer minimal für Interessenprüfung laden
async function fetchOfferForInterests(offerId) {
  try {
    const res = await fetch(`${API_BASE}/offers/${offerId}?withProvider=1`, { method: 'GET' });
    if (!res.ok) return null;
    const offer = await res.json();
    // Erwartete Felder (robust): category, subcategory, name
    return offer || null;
  } catch {
    return null;
  }
}

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

// Group State (Pro Provider)
async function getGroupState(groupId) {
  try {
    const raw = await AsyncStorage.getItem(GROUP_STATE_KEY_PR + groupId);
    return raw ? JSON.parse(raw) : { lastPushedAt: 0, lastSummaryAt: 0, events: [] };
  } catch { return { lastPushedAt: 0, lastSummaryAt: 0, events: [] }; }
}
async function setGroupState(groupId, patch) {
  const prev = await getGroupState(groupId);
  const next = { ...prev, ...patch };
  try { await AsyncStorage.setItem(GROUP_STATE_KEY_PR + groupId, JSON.stringify(next)); } catch {}
  return next;
}
function makeGroupIdFromMeta(meta) {
  if (meta?.providerId) return `provider:${meta.providerId}`;
  return 'misc';
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

/** Reconcile inside-Flags gegen aktuelle Position: setzt inside=false,
 *  wenn wir klar außerhalb (Radius + Toleranz) sind. */
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

/** Reconcile inside-Flags anhand aktueller Position gegen gesetzte Regionen.
 *  NEU: Wenn ein Offer zum ersten Mal erkannt wird (lastPushedAt==0) und wir
 *  beim Sync bereits im Radius sind, werten wir das als "late enter" und
 *  zeigen EINEN lokalen Push (mit globalem Throttle) — aber **nur** falls es den Interessen entspricht. */
async function markAlreadyInsideQuietly() {
  try {
    if (!CURRENT_REGIONS?.length) return;
    const pos = await Location.getLastKnownPositionAsync({ maxAge: 2 * 60 * 1000, requiredAccuracy: 200 });
    if (!pos?.coords) return;

    const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    const now = nowMs();
    for (const r of CURRENT_REGIONS) {
      const offerId = parseOfferIdFromIdentifier(r.identifier);
      if (!offerId) continue;
      const d = haversineMeters(here.lat, here.lng, r.latitude, r.longitude);
      const effective = (r.radius ?? 0) + ENTER_SANITY_BUFFER_M;
      if (d <= effective) {
        const st = await getOfferPushState(offerId);
        // Erstmalig "drin" entdeckt? => optional als verspäteten ENTER werten
        if (!st.inside) {
          const g = await getGlobalState();
          const canGlobal = !g.lastAnyPushAt || (now - g.lastAnyPushAt) >= MIN_MS_BETWEEN_PUSH_GLOBAL;
          const isFirstEver = !st.lastPushedAt; // noch nie gepusht für dieses Offer

          // ✅ NEU: Interessen prüfen
          try {
            const [interestSet, offer] = await Promise.all([
              getInterestSet(),
              fetchOfferForInterests(offerId),
            ]);
            if (offer && !matchesInterests(offer, interestSet)) {
              // Kein Push, aber State korrekt setzen
              await setOfferPushState(offerId, { inside: true, lastPushedAt: st.lastPushedAt || 0 });
              console.log('[GEOFENCE] QUIET-INSIDE skipped by interests', offerId);
              continue;
            }
          } catch {}

          if (canGlobal && isFirstEver) {
            try {
              const meta = await getOfferMeta(offerId);
              await Notifications.setBadgeCountAsync?.(0).catch?.(()=>{});
              await presentLocalOfferNotification(offerId, meta);
              console.log('[LOCAL_PUSH_SHOWN:LATE_ENTER] offerId=', offerId);
              await setOfferPushState(offerId, { inside: true, lastPushedAt: now });
              await setGlobalState({ lastAnyPushAt: now });
              const acc = pos?.coords?.accuracy ?? null;
              reportEnterToBackend({ offerId, lat: here.lat, lng: here.lng, accuracy: acc }).catch(() => {});
              continue;
            } catch (e) {
              console.log('[GEOFENCE] QUIET-INSIDE late-enter push failed, fallback to quiet', String(e));
            }
          }
          // Quiet fallback (kein Push)
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
// Accuracy helpers (NEU, sanft & optional)
// ────────────────────────────────────────────────────────────
const MIN_GOOD_ACCURACY_M = 25;
const FRESH_FIX_TIMEOUT_MS = 4000;

async function getFreshBestFixOrNull(timeoutMs = FRESH_FIX_TIMEOUT_MS) {
  try {
    const fix = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.BestForNavigation,
      maximumAge: 0,
      timeout: timeoutMs,
    });
    return fix?.coords ? fix : null;
  } catch {
    return null;
  }
}

async function ensureGoodAccuracyCoords(coords) {
  try {
    if (!coords || !Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)) {
      const fresh = await getFreshBestFixOrNull();
      return fresh?.coords || null;
    }
    if (!Number.isFinite(coords.accuracy) || coords.accuracy > MIN_GOOD_ACCURACY_M) {
      const fresh = await getFreshBestFixOrNull();
      if (fresh?.coords && (fresh.coords.accuracy < (coords.accuracy ?? 1e9))) {
        return fresh.coords;
      }
    }
    return coords;
  } catch {
    return coords || null;
  }
}

// ────────────────────────────────────────────────────────────
// Notification Channels & Category
// ────────────────────────────────────────────────────────────
async function ensureChannels() {
  if (Platform.OS !== 'android') return;
  try {
    // Default-App-Kanal (für generische Hinweise)
    await Notifications.setNotificationChannelAsync('stepsmatch-default-v2', {
      name: 'StepsMatch',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 150, 120, 150],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: false,
      showBadge: true,
      description: 'Allgemeine Benachrichtigungen von StepsMatch',
    });

    // Angebote – **neuer** Kanal
    await Notifications.setNotificationChannelAsync('offers-v2', {
      name: 'Offers',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'arrival',
      vibrationPattern: STRONG_PATTERN,
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      enableLights: true,
      lightColor: BRAND_BLUE,
      bypassDnd: false,
      showBadge: true,
      description: 'Sofort-Push bei passenden Angeboten in deiner Nähe',
    });

    // Legacy
    await Notifications.setNotificationChannelAsync('offers', {
      name: 'Offers (legacy)',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 150, 120, 150],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge: true,
      description: 'Vorheriger Offer-Kanal (Kompatibilität)',
    });

    // Kategorien
    await Notifications.setNotificationCategoryAsync('offer-go-v2', [
      { identifier: 'go',     buttonTitle: 'GO',      options: { opensAppToForeground: true } },
      { identifier: 'later',  buttonTitle: 'SPÄTER',  options: { isDestructive: false } },
    ]);

    // BG-Kanal dezent
    await Notifications.setNotificationChannelAsync('com.ecily.mobile:stepsmatch-bg-location-task', {
      name: 'StepsMatch – Standort aktiv',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: null,
      vibrationPattern: [0],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      bypassDnd: false,
      showBadge: false,
      description: 'Hintergrunddienst zur Standortaktualisierung',
    });

    console.log('[push] channels ready: offers-v2, stepsmatch-default-v2, bg-channel (legacy offers kept)');
    console.log('[push] category ready: offer-go-v2');
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
        await startAggressiveBgLocation();   // ⬅️ ersetzt kickstart-Defaults
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
    const res = await fetch(`${API_BASE}/offers?withProvider=1&activeNow=1&fields=_id,name,location,provider,radius,validTimes,validDays,validDates`, { method: 'GET' });
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
        providerId: offer?.provider?._id || '',   // ⬅️ NEU: für Gruppierung
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
      console.log('[geofence] no active nearby offers -> stop if running]');
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
async function computeDistanceBadge(offerId) {
  try {
    const region = CURRENT_REGIONS.find(r => r.identifier === `offer:${offerId}`);
    const pos = await Location.getLastKnownPositionAsync({ maxAge: 2 * 60 * 1000, requiredAccuracy: 200 });
    if (!region || !pos?.coords) return null;
    const m = haversineMeters(pos.coords.latitude, pos.coords.longitude, region.latitude, region.longitude);
    if (!Number.isFinite(m)) return null;
    return m >= 1000 ? `${(m/1000).toFixed(1)} km` : `${Math.round(m)} m`;
  } catch { return null; }
}

async function fetchProviderDetails(offerId) {
  try {
    const res = await fetch(`${API_BASE}/offers/${offerId}?withProvider=1`, { method: 'GET' });
    if (!res.ok) return {};
    const offer = await res.json();
    const providerName = offer?.provider?.name || undefined;
    const address =
      offer?.provider?.address?.formatted ||
      [offer?.provider?.address?.street, offer?.provider?.address?.city].filter(Boolean).join(', ') ||
      offer?.provider?.address ||
      undefined;
    const title = offer?.title || offer?.name;
    return { providerName, address, title };
  } catch { return {}; }
}

// ── Gruppierte Summary (nur Android nutzt groupId/groupSummary)
async function maybeSendGroupSummary({ groupId, providerName, count }) {
  try {
    const title = providerName ? `${providerName}: ${count} Angebote in deiner Nähe`
                               : `${count} Angebote in deiner Nähe`;
    const body  = 'Tippe, um alle zu sehen.';
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { kind: 'group-summary', groupId, count, t: nowMs() },
        sound: true,
        android: {
          channelId: 'offers-v2',
          color: BRAND_BLUE,
          link: `mobile://offers?group=${encodeURIComponent(groupId)}`,
          groupId,
          groupSummary: true,
        },
      },
      trigger: null,
    });
  } catch {}
}

async function presentLocalOfferNotification(offerId, meta) {
  // Header
  const header = 'Schau, was wir für dich gefunden haben!';

  // Title/Provider/Adresse anreichern (optional, ohne Logik zu verändern)
  let providerName = meta?.providerName || '';
  let offerTitle   = meta?.title || 'Angebot in deiner Nähe';
  let address      = '';
  try {
    const extra = await fetchProviderDetails(offerId);
    providerName = extra.providerName || providerName || '';
    offerTitle   = extra.title || offerTitle;
    address      = extra.address || '';
  } catch {}

  // Badges
  const distanceBadge = await computeDistanceBadge(offerId);
  const validityBadge = 'noch gültig';

  const lines = [
    offerTitle,
    [
      distanceBadge ? `• Entfernung: ${distanceBadge}` : null,
      `• gültig: ${validityBadge}`,
    ].filter(Boolean).join('   '),
    [providerName, address].filter(Boolean).join(' – ')
  ].filter(Boolean);

  const body = lines.join('\n');

  // Gruppierung & Anti-Spam (Android)
  const groupId = makeGroupIdFromMeta(meta);
  const now = nowMs();
  const gs  = await getGroupState(groupId);
  const underCooldown = gs.lastPushedAt && (now - gs.lastPushedAt) < GROUP_COOLDOWN_MS;

  // Eventliste im Zeitfenster pflegen
  const pruned = (gs.events || []).filter(t => (now - t) <= SUMMARY_WINDOW_MS);
  pruned.push(now);

  // Einzel-Notification
  await Notifications.scheduleNotificationAsync({
    content: {
      title: header,
      body,
      data: { offerId, source: 'geofence-local', t: now },
      sound: true,
      categoryIdentifier: 'offer-go-v2',
      android: {
        channelId: 'offers-v2',
        color: BRAND_BLUE,
        link: `mobile://offers/${offerId}`,
        groupId,
        groupSummary: false,
      },
    },
    trigger: null,
  });

  // Summary-Logik
  const shouldSummarize =
    (pruned.length >= 2) ||
    (underCooldown && (!gs.lastSummaryAt || (now - gs.lastSummaryAt) > SUMMARY_WINDOW_MS));

  if (shouldSummarize) {
    await maybeSendGroupSummary({
      groupId,
      providerName,
      count: pruned.length,
    });
    await setGroupState(groupId, { lastPushedAt: now, lastSummaryAt: now, events: pruned });
  } else {
    await setGroupState(groupId, { lastPushedAt: now, events: pruned });
  }
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
    fetch(`${API_BASE}/location/geofence-enter`, {
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
          const fresh = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, maximumAge: 0, timeout: FRESH_FIX_TIMEOUT_MS });
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

// ⬇️ NEU: Aggressives BG-Location-Profil + lastFixAt Tracking (+ Warm-Up)
async function startAggressiveBgLocation() {
  await ensureChannels();

  const started = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK);
  if (started) {
    try { await Location.stopLocationUpdatesAsync(BG_LOCATION_TASK); } catch {}
  }

  await Location.startLocationUpdatesAsync(BG_LOCATION_TASK, {
    accuracy: Location.Accuracy.BestForNavigation, // ⬅️ vorher High
    timeInterval: 30 * 1000,             // 30s
    distanceInterval: 0,                  // bewegungsgetriggert
    deferredUpdatesInterval: 0,
    deferredUpdatesDistance: 0,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: false,
    mayShowUserSettingsDialog: true,      // erlaubt Settings-Dialog bei Bedarf
    foregroundService: {
      notificationTitle: 'StepsMatch ist aktiv',
      notificationBody: 'Standort wird im Hintergrund aktualisiert.',
      notificationChannelId: 'com.ecily.mobile:stepsmatch-bg-location-task',
      killServiceOnDestroy: false,
    },
  });

  // Warm-Up: einmalig frischen BestForNavigation-Fix anfordern
  try {
    const warm = await getFreshBestFixOrNull(5000);
    if (warm?.coords) {
      await AsyncStorage.setItem('lastFixAt', String(Date.now()));
      await _sendHeartbeatWithCoords({
        latitude: warm.coords.latitude,
        longitude: warm.coords.longitude,
        accuracy: warm.coords.accuracy,
      });
    }
  } catch {}

  await AsyncStorage.setItem('lastFixAt', String(Date.now()));
  console.log('[BGLOC] startLocationUpdatesAsync → armed (aggressive)');
}

export async function kickstartBackgroundLocation() {
  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    const bg = await Location.requestBackgroundPermissionsAsync();
    console.log('[BGLOC] permissions', { fg: fg?.status, bg: bg?.status });

    await startAggressiveBgLocation();

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
    let { latitude, longitude, accuracy } = locations[0]?.coords || {};

    // Track letzter Fix für Watchdog
    try { await AsyncStorage.setItem('lastFixAt', String(Date.now())); } catch {}

    // NEU: Schlechten Fix sanft nachbessern
    try {
      const improved = await ensureGoodAccuracyCoords({ latitude, longitude, accuracy });
      if (improved) {
        latitude = improved.latitude;
        longitude = improved.longitude;
        accuracy = improved.accuracy;
      }
    } catch {}

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
    let lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 2 * 60 * 1000, requiredAccuracy: 200 });
    let lat = lastKnown?.coords?.latitude ?? null;
    let lng = lastKnown?.coords?.longitude ?? null;
    let accuracy = lastKnown?.coords?.accuracy ?? null;

    if (eventType === Location.GeofencingEventType.Enter) {
      // Sanity-Check gegen False-Positive ENTER (NEU: ggf. Fix nachbessern)
      if (Number.isFinite(region?.latitude) && Number.isFinite(region?.longitude)) {
        try {
          const improved = await ensureGoodAccuracyCoords(lastKnown?.coords || null);
        if (improved) {
            lat = improved.latitude;
            lng = improved.longitude;
            accuracy = improved.accuracy;
          }
        } catch {}

        if (lat != null && lng != null) {
          const d = haversineMeters(lat, lng, region.latitude, region.longitude);
          const effective = (region.radius ?? 0) + ENTER_SANITY_BUFFER_M;
          if (d > effective) {
            console.log('[GEOFENCE] ENTER ignored (SANITY:OUTSIDE)', { d: Math.round(d), effective, acc: accuracy });
            return;
          }
        } else {
          console.log('[GEOFENCE] ENTER with no position (proceeding)');
        }
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

      // Offer wirklich aktiv? (+Details verfügbar)
      let active = true;
      let offerForChecks = null;
      try {
        const res = await fetch(`${API_BASE}/offers/${offerId}?withProvider=1`, { method: 'GET' });
        offerForChecks = await res.json();
        active = res.ok ? !!isOfferActiveNow(offerForChecks, EUROPE_VIENNA) : true;
      } catch (_) {}

      if (!active) {
        console.log('[LOCAL_PUSH] skipped (not active now)', offerId);
        await setOfferPushState(offerId, { inside: true, lastPushedAt: state.lastPushedAt || 0 });
        return;
      }

      // ✅ NEU: Interessen-Filter
      try {
        const interestSet = await getInterestSet();
        if (offerForChecks && !matchesInterests(offerForChecks, interestSet)) {
          console.log('[LOCAL_PUSH] skipped by interests', offerId);
          await setOfferPushState(offerId, { inside: true, lastPushedAt: state.lastPushedAt || 0 });
          return;
        }
      } catch {}

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
        android: { channelId: 'offers-v2' },
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
        android: { channelId: 'offers-v2' },
      },
      trigger: null,
    });
  }
}

// ───────────── Init & Component ─────────────

// NEU: Watchdog – prüft alle 30s, ob letzter Fix >120s alt → re-arm
function useLocationWatchdog() {
  const timerRef = useRef(null);
  useEffect(() => {
    const TICK_MS = 30 * 1000;
    const STALE_MS = 120 * 1000;
    async function tick() {
      try {
        const lastFixAt = Number(await AsyncStorage.getItem('lastFixAt') || 0);
        const age = Date.now() - lastFixAt;
        if (!lastFixAt || age > STALE_MS) {
          console.log('[BGLOC] watchdog restart (age=', age, 'ms)');
          await startAggressiveBgLocation();
        }
      } catch {}
    }
    timerRef.current = setInterval(tick, TICK_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);
}

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
      channelId: c.android?.channelId || c.channelId || 'offers-v2',
      data,
    }));
  });

  // Antwort-Listener: GO/SPAETER
  Notifications.addNotificationResponseReceivedListener(async (response) => {
    try {
      const action = response?.actionIdentifier;
      const data = response?.notification?.request?.content?.data || {};
      const offerId = data?.offerId;
      if (!offerId) return;

      if (action === 'later') {
        // "SPÄTER": als gelesen markieren → erneute Benachrichtigung erst nach EXIT & Re-ENTER (Logik bleibt)
        const prev = await getOfferPushState(offerId);
        await setOfferPushState(offerId, { inside: true, lastPushedAt: nowMs() || prev.lastPushedAt || 0 });
        console.log('[push] action: LATER -> mark read', offerId);
      }
      // "go": öffnet App (opensAppToForeground:true), weitere Navigation bleibt wie bisher app-seitig
    } catch (e) {
      console.log('[push] response listener error', String(e));
    }
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
      // Bei jedem Statewechsel sicherstellen, dass BG-Location läuft
      try {
        const started = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK);
        if (!started) {
          console.log('[BGLOC] watchdog appstate → (re)start)');
          await startAggressiveBgLocation();
        }
      } catch {}
      appState.current = next;
    });

    return () => sub?.remove?.();
  }, []);

  useLocationWatchdog();
  return null;
}
