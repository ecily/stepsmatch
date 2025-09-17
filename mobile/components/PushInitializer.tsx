// stepsmatch/mobile/components/PushInitializer.tsx
import React, { useEffect, useRef } from 'react';
import { Platform, AppState, DeviceEventEmitter } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Random from 'expo-random';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { isOfferActiveNow } from '../utils/isOfferActiveNow';
import { csvToSet, matchesInterests } from '../utils/interests';

// ⬇️ Reine UI-Builder & Konstanten (keine Logik)
import {
  BRAND_BLUE,
  CHANNELS,
  CATEGORIES,
  buildOfferBody,
  buildOfferNotificationContent,
  buildGroupSummaryContent,
} from './push/notifyUI';

// ────────────────────────────────────────────────────────────
// Notification handler (kontextsensitiv)
// ────────────────────────────────────────────────────────────
function isForeground() {
  try { return AppState.currentState === 'active'; } catch { return false; }
}
function isOfferNotification(c:any) {
  const ch = c?.android?.channelId || c?.channelId;
  const kind = c?.data?.kind;
  return ch === CHANNELS.offers || ch === CHANNELS.offersLegacy || (typeof kind === 'string' && kind.startsWith('offer'));
}

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const c:any = notification?.request?.content || {};
    if (isForeground() && isOfferNotification(c)) {
      // App ist offen → kein OS-Banner; stattdessen In-App-Signal + Haptik
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      const offerId = typeof c?.data?.offerId === 'string' ? c.data.offerId : null;
      DeviceEventEmitter.emit('offer:foreground-enter', {
        offerId,
        meta: null,
        source: 'remote',
      });
      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      };
    }
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────
const BG_LOCATION_TASK = 'stepsmatch-bg-location-task';
const GEOFENCE_TASK    = 'stepsmatch-geofence-task';

const HEARTBEAT_MIN_SECONDS = 45;
const REMOTE_DEDUPE_WINDOW_MS = 45 * 1000;

const API_BASE = 'https://lobster-app-ie9a5.ondigitalocean.app/api';
const EUROPE_VIENNA = 'Europe/Vienna';

// Geofencing
const MAX_GEOFENCES = 20;
const GEOFENCE_SYNC_INTERVAL_MS = 60 * 1000;
const DEFAULT_RADIUS_M = 120;

// Reconcile/Accuracy
const OUTSIDE_TOLERANCE_M = 5;
const ACCURACY_TOKEN_CAP_M = 60;
const ENTER_SANITY_BUFFER_M = 5;

// Throttle
const MIN_MS_BETWEEN_PUSH_SAME_OFFER = 2 * 60 * 1000;
const MIN_MS_BETWEEN_PUSH_GLOBAL     = 20 * 1000;

// Grouping / Anti-Spam
const GROUP_COOLDOWN_MS = 2 * 60 * 1000;
const SUMMARY_WINDOW_MS = 60 * 1000;
const GROUP_STATE_KEY_PR = 'offerGroupState.';

// Storage Keys
const TOKEN_KEY = 'expoPushToken.v2';
const DEVICE_ID_SECURE_KEY = 'deviceId.v1';
const DEVICE_ID_ASYNC_KEY  = 'deviceId.v1.mirror';

// Global-State
const GLOBAL_STATE_KEY = 'offerPushState.__global';

const RESOLVED_PROJECT_ID =
  (Constants?.expoConfig?.extra && (Constants as any).expoConfig.extra.eas?.projectId) ||
  ((Constants as any)?.easConfig && (Constants as any).easConfig.projectId) ||
  '08559a29-b307-47e9-a130-d3b31f73b4ed';

// UI / Channels
const STRONG_PATTERN = [0, 450, 180, 900, 300, 1200];

// Laufzeit-Cache der gesetzten Geofences
let CURRENT_REGIONS: Array<{identifier:string, latitude:number, longitude:number, radius:number}> = [];

// Interessen-Cache
let INTEREST_SET_CACHE: Set<string> | null = null;
let INTERESTS_LAST_LOAD_AT = 0;
const INTERESTS_TTL_MS = 60 * 1000;

// ────────────────────────────────────────────────────────────
/* Guards & State */
// ────────────────────────────────────────────────────────────
let CHANNELS_READY_ONCE = false;
let INIT_PUSH_ONCE = false;
let notifReceivedSub: Notifications.Subscription | null = null;
let notifResponseSub: Notifications.Subscription | null = null;

// Refresh-Mutex + Gap
let GEOFENCE_REFRESH_IN_FLIGHT = false;
let LAST_REFRESH_TS = 0;
const REFRESH_MIN_GAP_MS = 3000;

// Event-Dedupe
const LAST_EVENT_SEEN: Record<string, number> = {};
const EVENT_DEDUP_WINDOW_MS = 5000;

// Per-Offer ENTER lock
const PUSH_LOCKS: Record<string, number> = {};
const PUSH_LOCK_TTL_MS = 10000;

// Watchdog
const WD_TICK_MS = 20 * 1000;
const LOC_STALE_MS = 120 * 1000;
const GF_STALE_MS  = 3 * 60 * 1000;

// Track zuletzt bekannte Sync-Zeit exportweit (für WD)
let lastGeofenceSyncAt = 0;

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────
function acquirePushLock(offerId: string) {
  const now = Date.now();
  const prev = PUSH_LOCKS[offerId] || 0;
  if (prev && (now - prev) < PUSH_LOCK_TTL_MS) return false;
  PUSH_LOCKS[offerId] = now;
  setTimeout(() => { if (PUSH_LOCKS[offerId] === now) delete PUSH_LOCKS[offerId]; }, PUSH_LOCK_TTL_MS);
  return true;
}

function regionsEqual(a: typeof CURRENT_REGIONS, b: typeof CURRENT_REGIONS) {
  if ((a?.length || 0) !== (b?.length || 0)) return false;
  const sig = (r: any) => `${r.identifier}:${r.latitude.toFixed(6)}:${r.longitude.toFixed(6)}:${Math.round(Number(r.radius||0))}`;
  const sa = [...a].map(sig).sort();
  const sb = [...b].map(sig).sort();
  for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return false;
  return true;
}
function toRad(d:number) { return (d * Math.PI) / 180; }
function haversineMeters(lat1:number, lng1:number, lat2:number, lng2:number) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
function nowMs() { return Date.now(); }

function bytesToUuidV4(bytes: Uint8Array) {
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(20,32)}`;
}
async function generateUuidV4() {
  const bytes = await Random.getRandomBytesAsync(16);
  return bytesToUuidV4(bytes);
}
async function getPersistentDeviceId() {
  try {
    const existing = await SecureStore.getItemAsync(DEVICE_ID_SECURE_KEY);
    if (existing) return existing;
  } catch {}
  try {
    const mirror = await AsyncStorage.getItem(DEVICE_ID_ASYNC_KEY);
    if (mirror) {
      try { await SecureStore.setItemAsync(DEVICE_ID_SECURE_KEY, mirror); } catch {}
      return mirror;
    }
  } catch {}
  const fresh = await generateUuidV4();
  try { await SecureStore.setItemAsync(DEVICE_ID_SECURE_KEY, fresh); } catch {}
  try { await AsyncStorage.setItem(DEVICE_ID_ASYNC_KEY, fresh); } catch {}
  return fresh;
}

// Interessen
async function getInterestSet() {
  const now = nowMs();
  if (INTEREST_SET_CACHE && (now - INTERESTS_LAST_LOAD_AT) < INTERESTS_TTL_MS) return INTEREST_SET_CACHE;
  try {
    const raw = await AsyncStorage.getItem('userInterests');
    const arr = raw ? JSON.parse(raw) : [];
    const csv = Array.isArray(arr) && arr.length ? arr.join(',') : '';
    INTEREST_SET_CACHE = csvToSet(csv);
    INTERESTS_LAST_LOAD_AT = now;
  } catch {
    INTEREST_SET_CACHE = new Set();
    INTERESTS_LAST_LOAD_AT = now;
  }
  return INTEREST_SET_CACHE;
}
async function fetchOfferForInterests(offerId:string) {
  try {
    const res = await fetch(`${API_BASE}/offers/${offerId}?withProvider=1`, { method: 'GET' });
    if (!res.ok) return null;
    return (await res.json()) || null;
  } catch { return null; }
}

// Offer Push State
async function getOfferPushState(offerId:string) {
  try {
    const raw = await AsyncStorage.getItem(`offerPushState.${offerId}`);
    return raw ? JSON.parse(raw) : { inside: false, lastPushedAt: 0 };
  } catch { return { inside: false, lastPushedAt: 0 }; }
}
async function setOfferPushState(offerId:string, state:any) {
  try { await AsyncStorage.setItem(`offerPushState.${offerId}`, JSON.stringify(state)); } catch {}
}

// Global-State
async function getGlobalState() {
  try {
    const raw = await AsyncStorage.getItem(GLOBAL_STATE_KEY);
    return raw ? JSON.parse(raw) : { lastAnyPushAt: 0, lastHeartbeatAt: 0 };
  } catch { return { lastAnyPushAt: 0, lastHeartbeatAt: 0 }; }
}
async function setGlobalState(patch:any) {
  const prev = await getGlobalState();
  const next = { ...prev, ...patch };
  try { await AsyncStorage.setItem(GLOBAL_STATE_KEY, JSON.stringify(next)); } catch {}
  return next;
}

// Group State
async function getGroupState(groupId:string) {
  try {
    const raw = await AsyncStorage.getItem(GROUP_STATE_KEY_PR + groupId);
    return raw ? JSON.parse(raw) : { lastPushedAt: 0, lastSummaryAt: 0, events: [] };
  } catch { return { lastPushedAt: 0, lastSummaryAt: 0, events: [] }; }
}
async function setGroupState(groupId:string, patch:any) {
  const prev = await getGroupState(groupId);
  const next = { ...prev, ...patch };
  try { await AsyncStorage.setItem(GROUP_STATE_KEY_PR + groupId, JSON.stringify(next)); } catch {}
  return next;
}
function makeGroupIdFromMeta(meta:any) {
  if (meta?.providerId) return `provider:${meta.providerId}`;
  return 'misc';
}

// Meta Cache
async function setOfferMeta(offerId:string, meta:any) {
  try { await AsyncStorage.setItem(`offerMeta.${offerId}`, JSON.stringify(meta)); } catch {}
}
async function getOfferMeta(offerId:string) {
  try {
    const raw = await AsyncStorage.getItem(`offerMeta.${offerId}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// IDs & Regions
function parseOfferIdFromIdentifier(identifier = '') {
  const m = String(identifier).match(/^offer:([a-f0-9]{24})$/i);
  return m ? m[1] : null;
}
async function pruneObsoleteOfferStates(validIdentifiers: string[]) {
  try {
    const validIds = new Set((validIdentifiers || []).map(parseOfferIdFromIdentifier).filter(Boolean));
    const keys = await AsyncStorage.getAllKeys();
    const offerStateKeys = (keys || []).filter(k => k.startsWith('offerPushState.'));
    const ops: Promise<any>[] = [];
    for (const key of offerStateKeys) {
      const offerId = key.slice('offerPushState.'.length);
      if (!validIds.has(offerId)) {
        ops.push(AsyncStorage.setItem(key, JSON.stringify({ inside: false, lastPushedAt: 0 })));
      }
    }
    if (ops.length) await Promise.allSettled(ops as any);
  } catch {}
}

// ────────────────────────────────────────────────────────────
// Accuracy helpers
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
  } catch { return null; }
}
async function ensureGoodAccuracyCoords(coords: Partial<Location.LocationObjectCoords> | null) {
  try {
    if (!coords || !Number.isFinite((coords as any).latitude) || !Number.isFinite((coords as any).longitude)) {
      const fresh = await getFreshBestFixOrNull();
      return fresh?.coords || null;
    }
    if (!Number.isFinite((coords as any).accuracy) || ((coords as any).accuracy as number) > MIN_GOOD_ACCURACY_M) {
      const fresh = await getFreshBestFixOrNull();
      if (fresh?.coords && (fresh.coords.accuracy < (((coords as any).accuracy) ?? 1e9))) {
        return fresh.coords;
      }
    }
    return coords as Location.LocationObjectCoords;
  } catch { return (coords as any) || null; }
}

// ────────────────────────────────────────────────────────────
// Channels & Category (konsolidiert)
// ────────────────────────────────────────────────────────────
async function ensureChannels() {
  if (Platform.OS !== 'android') return;
  if (CHANNELS_READY_ONCE) return;
  CHANNELS_READY_ONCE = true;

  try {
    await Notifications.setNotificationChannelAsync(CHANNELS.default, {
      name: 'StepsMatch',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 150, 120, 150],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: false,
      showBadge: true,
      description: 'Allgemeine Benachrichtigungen von StepsMatch',
    });

    await Notifications.setNotificationChannelAsync(CHANNELS.offers, {
      name: 'Offers',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'arrival',
      vibrationPattern: STRONG_PATTERN,
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      enableLights: true,
      lightColor: BRAND_BLUE as any,
      bypassDnd: false,
      showBadge: true,
      description: 'Sofort-Push bei passenden Angeboten in deiner Nähe',
    });

    await Notifications.setNotificationChannelAsync(CHANNELS.offersLegacy, {
      name: 'Offers (legacy)',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 150, 120, 150],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge: true,
      description: 'Vorheriger Offer-Kanal (Kompatibilität)',
    });

    await Notifications.setNotificationCategoryAsync(CATEGORIES.offerGo, [
      { identifier: 'go',     buttonTitle: 'Route',  options: { opensAppToForeground: true } },
      { identifier: 'later',  buttonTitle: 'Später', options: { isDestructive: false } },
    ]);

    await Notifications.setNotificationChannelAsync(CHANNELS.bg, {
      name: 'StepsMatch – Standort aktiv',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: null,
      vibrationPattern: [0],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      bypassDnd: false,
      showBadge: false,
      description: 'Hintergrunddienst zur Standortaktualisierung',
    });

    console.log('[push] channels ready:', CHANNELS);
    console.log('[push] category ready:', CATEGORIES);
  } catch (e:any) {
    console.warn('[notif] ensureChannels failed:', e?.message || e);
  }
}

// ────────────────────────────────────────────────────────────
// Permissions & Token
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

let CURRENT_EXPO_TOKEN: string | null = null;
let REGISTERED_READY = false;

async function resolveExpoTokenAuthoritative() {
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

async function registerTokenWithBackend({ expoToken, deviceId, lastLocation }:{
  expoToken:string, deviceId:string, lastLocation?:Location.LocationObject
}) {
  try {
    const payload:any = {
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
        await startAggressiveBgLocation();
        // ⚠️ wichtig: kein Push beim App-Öffnen → silent refresh
        await refreshGeofencesAroundUser({ force: true, silent: true });
      } catch (e:any) {
        console.warn('[BGLOC] auto-start or geofence-sync after register failed', String(e));
      }
    }
  } catch (e:any) {
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
  } catch (e:any) {
    console.log('[geofence] fetch offers exception', String(e));
    return [];
  }
}
function pickOfferPoint(offer:any) {
  const coords = (offer?.provider?.location?.coordinates) || (offer?.location?.coordinates) || null;
  if (!coords || coords.length < 2) return null;
  const [lng, lat] = coords;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  return { lat, lng };
}
function offerRadius(offer:any) {
  return offer?.radiusM ?? offer?.radius ?? offer?.radiusMeters ?? DEFAULT_RADIUS_M;
}

function effectiveInside({
  hereLat, hereLng, regionLat, regionLng, radius, acc
}: { hereLat:number, hereLng:number, regionLat:number, regionLng:number, radius:number, acc?:number|null }) {
  const accCap = Math.min(Number.isFinite(acc as any) ? Number(acc) : ACCURACY_TOKEN_CAP_M, ACCURACY_TOKEN_CAP_M);
  const d = haversineMeters(hereLat, hereLng, regionLat, regionLng);
  return { inside: d <= ((radius ?? 0) + accCap + ENTER_SANITY_BUFFER_M), d, accCap };
}

type RefreshOptions = boolean | { force?: boolean; silent?: boolean };

async function refreshGeofencesAroundUser(forceOrOptions: RefreshOptions = false) {
  const opts = typeof forceOrOptions === 'boolean' ? { force: forceOrOptions, silent: false } : (forceOrOptions || { force: false, silent: false });
  const { force, silent } = { force: !!opts.force, silent: !!opts.silent };

  const nowStart = nowMs();
  if (GEOFENCE_REFRESH_IN_FLIGHT) return;
  if (!force && nowStart - LAST_REFRESH_TS < REFRESH_MIN_GAP_MS) return;

  GEOFENCE_REFRESH_IN_FLIGHT = true;
  try {
    const now = nowMs();
    if (!force && now - lastGeofenceSyncAt < GEOFENCE_SYNC_INTERVAL_MS) return;

    const loc = await Location.getLastKnownPositionAsync({});
    if (!loc?.coords) {
      console.log('[geofence] skip sync (no lastKnownPosition)');
      return;
    }
    const { latitude, longitude, accuracy: hereAcc } = loc.coords;

    const offers = await fetchCandidateOffers();
    const activeNearby: Array<{offer:any, p:{lat:number,lng:number}, dist:number}> = [];
    for (const offer of offers) {
      try {
        if (!isOfferActiveNow(offer, EUROPE_VIENNA)) continue;
        const p = pickOfferPoint(offer);
        if (!p) continue;
        const dist = haversineMeters(latitude, longitude, p.lat, p.lng);
        if (dist <= 2000) activeNearby.push({ offer, p, dist });
      } catch {}
    }
    activeNearby.sort((a, b) => a.dist - b.dist);
    const top = activeNearby.slice(0, MAX_GEOFENCES);

    const regions = top.map(({ offer, p }) => {
      const r = offerRadius(offer);
      const identifier = `offer:${offer._id}`;
      setOfferMeta(offer._id, {
        title: offer?.title || offer?.name || 'Angebot',
        providerName: offer?.provider?.name || '',
        providerId: offer?.provider?._id || '',
        radius: r,
      }).catch(() => {});
      return {
        identifier,
        latitude: p.lat,
        longitude: p.lng,
        radius: Math.max(20, Math.min(500, Number(r) || DEFAULT_RADIUS_M)),
        notifyOnEnter: true,
        notifyOnExit: true,
      };
    });

    // INSTANT-INSIDE nur wenn NICHT silent
    try {
      if (!silent && regions.length && loc?.coords) {
        for (const r of regions) {
          const offerId = parseOfferIdFromIdentifier(r.identifier);
          if (!offerId) continue;
          const { inside, d } = effectiveInside({
            hereLat: latitude, hereLng: longitude,
            regionLat: r.latitude, regionLng: r.longitude,
            radius: Number(r.radius) || DEFAULT_RADIUS_M, acc: hereAcc
          });
          if (!inside) continue;

          const st = await getOfferPushState(offerId);
          if (st?.inside) continue;

          // Aktivität
          let active = true;
          try {
            const res = await fetch(`${API_BASE}/offers/${offerId}?withProvider=1`, { method: 'GET' });
            const offerForChecks = await res.json();
            active = res.ok ? !!isOfferActiveNow(offerForChecks, EUROPE_VIENNA) : true;
          } catch {}

          if (!active) {
            await setOfferPushState(offerId, { inside: true, lastPushedAt: st?.lastPushedAt || 0 });
            continue;
          }

          if (acquirePushLock(offerId)) {
            const meta = await getOfferMeta(offerId);
            await Notifications.setBadgeCountAsync?.(0).catch?.(()=>{});
            await presentLocalOfferNotification(offerId, meta, 'synthetic-enter');
            console.log('[LOCAL_PUSH_SHOWN:INSTANT_NEW_OFFER]', JSON.stringify({
              offerId, d: Math.round(d) + 'm', source: 'INSTANT_AFTER_SYNC'
            }));
            const ts = nowMs();
            await setOfferPushState(offerId, { inside: true, lastPushedAt: ts });
            await setGlobalState({ lastAnyPushAt: ts });
            reportEnterToBackend({ offerId, lat: latitude, lng: longitude, accuracy: hereAcc ?? null }).catch(()=>{});
          }
        }
      }
    } catch (e:any) {
      console.log('[geofence] instant-inside check failed', String(e?.message || e));
    }

    if (!regions.length) {
      const started = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
      if (started) {
        try { await Location.stopGeofencingAsync(GEOFENCE_TASK); } catch {}
        console.log('[geofence] geofencing stopped (no regions)');
      }
      CURRENT_REGIONS = [];
      lastGeofenceSyncAt = now;
      LAST_REFRESH_TS = nowMs();
      return;
    }

    // Gleich? Kein Restart
    if (regionsEqual(CURRENT_REGIONS, regions)) {
      CURRENT_REGIONS = regions.slice();
      lastGeofenceSyncAt = now;
      LAST_REFRESH_TS = nowMs();
      await markAlreadyInsideQuietly({ allowFirstEverPush: !silent });
      console.log('[geofence] regions unchanged -> no restart');
      return;
    }

    const started = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
    if (started) {
      try { await Location.stopGeofencingAsync(GEOFENCE_TASK); } catch {}
    }
    try {
      await Location.startGeofencingAsync(GEOFENCE_TASK, regions as any);
    } catch (e:any) {
      console.log('[geofence] start failed once, retrying...', String(e?.message || e));
      await new Promise(r => setTimeout(r, 250));
      await Location.startGeofencingAsync(GEOFENCE_TASK, regions as any);
    }
    CURRENT_REGIONS = regions.slice();
    lastGeofenceSyncAt = now;
    LAST_REFRESH_TS = nowMs();
    console.log('[geofence] started with', regions.length, 'regions');

    try { await pruneObsoleteOfferStates(regions.map(r => r.identifier)); } catch {}

    await markAlreadyInsideQuietly({ allowFirstEverPush: !silent });
  } catch (e:any) {
    console.log('[geofence] refresh error', String(e));
  } finally {
    GEOFENCE_REFRESH_IN_FLIGHT = false;
  }
}

// ────────────────────────────────────────────────────────────
// Local Notification helper (+ Distanz-Tools für Logs)
// ────────────────────────────────────────────────────────────
async function computeDistanceBadge(offerId:string) {
  try {
    const region = CURRENT_REGIONS.find(r => r.identifier === `offer:${offerId}`);
    const pos = await Location.getLastKnownPositionAsync({ maxAge: 2 * 60 * 1000, requiredAccuracy: 200 });
    if (!region || !pos?.coords) return null;
    const m = haversineMeters(pos.coords.latitude, pos.coords.longitude, region.latitude, region.longitude);
    if (!Number.isFinite(m)) return null;
    return m >= 1000 ? `${(m/1000).toFixed(1)} km` : `${Math.round(m)} m`;
  } catch { return null; }
}
async function computeDistanceMeters(offerId:string, lat?:number|null, lng?:number|null) {
  try {
    const region = CURRENT_REGIONS.find(r => r.identifier === `offer:${offerId}`);
    if (!region) return null;
    let ref = { latitude: lat ?? null, longitude: lng ?? null };
    if (ref.latitude == null || ref.longitude == null) {
      const pos = await Location.getLastKnownPositionAsync({ maxAge: 2 * 60 * 1000, requiredAccuracy: 200 });
      if (!pos?.coords) return null;
      ref = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    }
    const m = haversineMeters(ref.latitude!, ref.longitude!, region.latitude, region.longitude);
    return Number.isFinite(m) ? Math.round(m) : null;
  } catch { return null; }
}

async function fetchProviderDetails(offerId:string) {
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

async function maybeSendGroupSummary({ groupId, providerName, count }:{
  groupId:string, providerName?:string, count:number
}) {
  try {
    const { content, trigger } = buildGroupSummaryContent({ groupId, providerName, count });
    await Notifications.scheduleNotificationAsync({ content, trigger });
  } catch {}
}

// ➕ Source-Param: 'geofence-local' | 'synthetic-enter' | 'heartbeat'
async function presentLocalOfferNotification(
  offerId:string,
  meta:any,
  source: 'geofence-local' | 'synthetic-enter' | 'heartbeat' = 'geofence-local'
) {
  // App im Vordergrund → keine System-Notification. In-App-Event + Haptik und nur State pflegen.
  if (isForeground()) {
    try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    DeviceEventEmitter.emit('offer:foreground-enter', { offerId, meta, source });
    console.log('[FOREGROUND] in-app signal emitted for offer', offerId);
    const groupId = makeGroupIdFromMeta(meta);
    const now = nowMs();
    const gs  = await getGroupState(groupId);
    const pruned = (gs.events || []).filter((t:number) => (now - t) <= SUMMARY_WINDOW_MS);
    pruned.push(now);
    await setGroupState(groupId, { lastPushedAt: now, events: pruned });
    return;
  }

  let providerName = meta?.providerName || '';
  let offerTitle   = meta?.title || 'Angebot';
  let address      = '';
  try {
    const extra = await fetchProviderDetails(offerId);
    providerName = extra.providerName || providerName || '';
    offerTitle   = extra.title || offerTitle;
    address      = extra.address || '';
  } catch {}

  const distanceBadge = await computeDistanceBadge(offerId);
  const body = buildOfferBody({
    offerTitle,
    distanceBadge,
    validityBadge: 'noch gültig',
    providerName,
    address,
  });

  const groupId = makeGroupIdFromMeta(meta);
  const now = nowMs();
  const gs  = await getGroupState(groupId);
  const underCooldown = gs.lastPushedAt && (now - gs.lastPushedAt) < GROUP_COOLDOWN_MS;

  const pruned = (gs.events || []).filter((t:number) => (now - t) <= SUMMARY_WINDOW_MS);
  pruned.push(now);

  const { content, trigger } = buildOfferNotificationContent({
    offerId,
    source,
    body,
    groupId,
  });

  await Notifications.scheduleNotificationAsync({ content, trigger });

  const shouldSummarize =
    (pruned.length >= 2) ||
    (underCooldown && (!gs.lastSummaryAt || (now - gs.lastSummaryAt) > SUMMARY_WINDOW_MS));

  if (shouldSummarize) {
    await maybeSendGroupSummary({ groupId, providerName, count: pruned.length });
    await setGroupState(groupId, { lastPushedAt: now, lastSummaryAt: now, events: pruned });
  } else {
    await setGroupState(groupId, { lastPushedAt: now, events: pruned });
  }
}

// Backend-Report
async function reportEnterToBackend({ offerId, lat, lng, accuracy }:{
  offerId:string, lat:number, lng:number, accuracy?:number|null
}) {
  try {
    const token = await getCurrentExpoToken();
    const deviceId = await getPersistentDeviceId();
    const payload = {
      offerId, token, deviceId,
      platform: Platform.OS,
      projectId: RESOLVED_PROJECT_ID,
      source: 'local-geofence',
      t: nowMs(),
      lat, lng, accuracy,
    };
    fetch(`${API_BASE}/location/geofence-enter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {}
}

// ───────────── BG-Location & Heartbeat ─────────────
let lastHeartbeatAt = 0;

type HeartbeatRefreshMode = 'normal' | 'silent' | 'none';

async function _sendHeartbeatWithCoords({
  latitude, longitude, accuracy, refreshMode = 'normal',
}:{
  latitude:number, longitude:number, accuracy?:number, refreshMode?: HeartbeatRefreshMode
}) {
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
        token, deviceId,
        lat: latitude, lng: longitude, accuracy,
        platform: Platform.OS, projectId: RESOLVED_PROJECT_ID,
      }),
    });
    const json = await res.json();
    console.log('[BGLOC] Heartbeat', res.status, JSON.stringify(json));
  } catch (e:any) {
    console.log('[BGLOC] Heartbeat error', String(e));
  }

  try {
    await reconcileInsideFlagsWithPosition({ latitude, longitude, accuracy });
  } catch (e:any) {
    console.log('[RECONCILE] failed after heartbeat', String(e));
  }

  try {
    if (refreshMode === 'normal') {
      console.log('[geofence] heartbeat-triggered refresh (force=true)');
      await refreshGeofencesAroundUser(true);
    } else if (refreshMode === 'silent') {
      console.log('[geofence] heartbeat-triggered refresh (force=true, silent=true)');
      await refreshGeofencesAroundUser({ force: true, silent: true });
    } else {
      console.log('[geofence] heartbeat-triggered refresh skipped (mode=none)');
    }
  } catch (e:any) {
    console.log('[geofence] heartbeat-triggered refresh failed', String(e));
  }

  await setGlobalState({ lastHeartbeatAt: now });
}

export async function sendHeartbeat(arg?: any) {
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
              refreshMode: 'silent',
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
        refreshMode: 'silent',
      });
    }

    if (arg && typeof arg === 'object' && Number.isFinite(arg.latitude) && Number.isFinite(arg.longitude)) {
      return _sendHeartbeatWithCoords({ ...arg, refreshMode: 'normal' });
    }

    const pos = await Location.getLastKnownPositionAsync({});
    if (pos?.coords) {
      return _sendHeartbeatWithCoords({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        refreshMode: 'normal',
      });
    }
  } catch (e:any) {
    console.log('[BGLOC] sendHeartbeat wrapper error', String(e));
  }
}

// ───────────── Reconcile & Already-inside ─────────────
async function reconcileInsideFlagsWithPosition({
  latitude, longitude, accuracy,
}: { latitude:number, longitude:number, accuracy?:number }) {
  try {
    if (!CURRENT_REGIONS?.length || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    const accCap = Math.min(Number.isFinite(accuracy!) ? Number(accuracy) : ACCURACY_TOKEN_CAP_M, ACCURACY_TOKEN_CAP_M);

    const updates = [];
    for (const r of CURRENT_REGIONS) {
      const offerId = parseOfferIdFromIdentifier(r.identifier);
      if (!offerId) continue;

      const d = haversineMeters(latitude, longitude, r.latitude, r.longitude);
      const outside = d > (Number(r.radius) + accCap + OUTSIDE_TOLERANCE_M);

      if (outside) {
        const state = await getOfferPushState(offerId);
        if (state.inside) {
          updates.push(setOfferPushState(offerId, { inside: false, lastPushedAt: state.lastPushedAt || 0 }));
          console.log('[RECONCILE] set outside for', offerId, `(d=${Math.round(d)}m > r=${r.radius}m + accCap=${accCap}m + tol=${OUTSIDE_TOLERANCE_M}m)`);
        }
      }
    }
    if (updates.length) await Promise.allSettled(updates as any);
  } catch (e:any) {
    console.log('[RECONCILE] error', String(e));
  }
}

async function markAlreadyInsideQuietly({ allowFirstEverPush = true }: { allowFirstEverPush?: boolean } = {}) {
  try {
    if (!CURRENT_REGIONS?.length) return;
    const pos = await Location.getLastKnownPositionAsync({ maxAge: 2 * 60 * 1000, requiredAccuracy: 200 });
    if (!pos?.coords) return;

    const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    const accCap = Math.min(Number.isFinite(pos.coords.accuracy) ? Number(pos.coords.accuracy) : ACCURACY_TOKEN_CAP_M, ACCURACY_TOKEN_CAP_M);

    const now = nowMs();
    for (const r of CURRENT_REGIONS) {
      const offerId = parseOfferIdFromIdentifier(r.identifier);
      if (!offerId) continue;

      const d = haversineMeters(here.lat, here.lng, r.latitude, r.longitude);
      const effective = (r.radius ?? 0) + accCap + ENTER_SANITY_BUFFER_M;

      if (d <= effective) {
        const st = await getOfferPushState(offerId);
        if (!st.inside) {
          // Interessen/aktiv nur für diesen ruhigen Pfad prüfen:
          let offerForChecks:any = null;
          try {
            const [interestSet, fetchedOffer] = await Promise.all([getInterestSet(), fetchOfferForInterests(offerId)]);
            offerForChecks = fetchedOffer;
            if (offerForChecks && !matchesInterests(offerForChecks, interestSet)) {
              await setOfferPushState(offerId, { inside: true, lastPushedAt: st.lastPushedAt || 0 });
              console.log('[GEOFENCE] QUIET-INSIDE skipped by interests', offerId);
              continue;
            }
            if (offerForChecks && !isOfferActiveNow(offerForChecks, EUROPE_VIENNA)) {
              await setOfferPushState(offerId, { inside: true, lastPushedAt: st.lastPushedAt || 0 });
              console.log('[GEOFENCE] QUIET-INSIDE skipped (not active now)', offerId);
              continue;
            }
          } catch {}

          const isFirstEver = !st.lastPushedAt;
          if (isFirstEver && allowFirstEverPush && acquirePushLock(offerId)) {
            try {
              const meta = await getOfferMeta(offerId);
              await Notifications.setBadgeCountAsync?.(0).catch?.(()=>{});
              await presentLocalOfferNotification(offerId, meta, 'synthetic-enter');

              const enteredDistanceM = await computeDistanceMeters(offerId, here.lat, here.lng);
              console.log('[LOCAL_PUSH_SHOWN:SYNT_ENTER]', JSON.stringify({
                offerId,
                d: typeof enteredDistanceM === 'number' ? `${enteredDistanceM}m` : null,
                acc: pos?.coords?.accuracy != null ? Math.round(pos.coords.accuracy as number) : null,
                source: 'SYNTH_ENTER',
              }));

              await setOfferPushState(offerId, { inside: true, lastPushedAt: now });
              await setGlobalState({ lastAnyPushAt: now });

              const acc = pos?.coords?.accuracy ?? null;
              reportEnterToBackend({ offerId, lat: here.lat, lng: here.lng, accuracy: acc }).catch(() => {});
              continue;
            } catch (e:any) {
              console.log('[GEOFENCE] QUIET-INSIDE synthetic-enter push failed, fallback to quiet', String(e));
            }
          }

          await setOfferPushState(offerId, { inside: true, lastPushedAt: st.lastPushedAt || 0 });
          console.log('[GEOFENCE] QUIET-INSIDE (no push)', r.identifier, { d: Math.round(d), effective: Math.round(effective), accCap });
        }
      }
    }
  } catch (e:any) {
    console.log('[GEOFENCE] QUIET-INSIDE error', String(e));
  }
}

// ───────────── BG Location start (mit Foreground Service) ─────────────
async function startAggressiveBgLocation() {
  await ensureChannels();

  const started = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK);
  if (started) {
    try { await Location.stopLocationUpdatesAsync(BG_LOCATION_TASK); } catch {}
  }

  await Location.startLocationUpdatesAsync(BG_LOCATION_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 30 * 1000,
    distanceInterval: 0,
    deferredUpdatesInterval: 0,
    deferredUpdatesDistance: 0,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: false,
    mayShowUserSettingsDialog: true,
    foregroundService: {
      notificationTitle: 'StepsMatch ist aktiv',
      notificationBody: 'Standort wird im Hintergrund aktualisiert.',
      notificationChannelId: CHANNELS.bg,
      killServiceOnDestroy: false,
    },
  });

  try {
    const warm = await getFreshBestFixOrNull(5000);
    if (warm?.coords) {
      await AsyncStorage.setItem('lastFixAt', String(Date.now()));
      // Warmstart während App-Start → im Vordergrund silent
      await _sendHeartbeatWithCoords({
        latitude: warm.coords.latitude,
        longitude: warm.coords.longitude,
        accuracy: warm.coords.accuracy,
        refreshMode: isForeground() ? 'silent' : 'normal',
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
    console.log('[BGLOC] permissions', { fg: (fg as any)?.status, bg: (bg as any)?.status });

    await startAggressiveBgLocation();

    const loc = await Location.getLastKnownPositionAsync({});
    if (loc?.coords) {
      // Nach manueller Kickstart-Sequenz → im Vordergrund silent
      await _sendHeartbeatWithCoords({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy,
        refreshMode: isForeground() ? 'silent' : 'normal',
      });
    }
  } catch (e:any) {
    console.log('[BGLOC] kickstart error', String(e));
  }
}

// ───────────── Task Definitions ─────────────

// Helper: letzte Remote-Push-Zeit für Offer laden (aus _layout Listener geschrieben)
async function getOfferRemoteLastPush(offerId: string): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(`offerPushState.${offerId}`);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return parsed?.lastPushedAtRemote || 0;
  } catch {
    return 0;
  }
}

TaskManager.defineTask(BG_LOCATION_TASK, async ({ data, error }) => {
  try {
    if (error) {
      console.log('[BGLOC] Task error', String(error));
      return;
    }
    const { locations } = (data || {}) as any;
    if (!locations?.length) return;
    console.log('[BGLOC] locations batch size =', locations.length);
    let { latitude, longitude, accuracy } = locations[0]?.coords || {};

    try { await AsyncStorage.setItem('lastFixAt', String(Date.now())); } catch {}

    try {
      const improved = await ensureGoodAccuracyCoords({ latitude, longitude, accuracy } as any);
      if (improved) {
        latitude  = improved.latitude;
        longitude = improved.longitude;
        accuracy  = improved.accuracy;
      }
    } catch {}

    if (latitude && longitude) {
      await _sendHeartbeatWithCoords({ latitude, longitude, accuracy, refreshMode: 'normal' });

      try {
        console.log('[geofence] bg-task-triggered refresh (force=true)');
        await refreshGeofencesAroundUser(true);
      } catch (e:any) {
        console.log('[geofence] bg-task-triggered refresh failed', String(e));
      }
    }
  } catch (e:any) {
    console.log('[BGLOC] task handler error', String(e));
  }
});

TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
  if (error) {
    console.log('[GEOFENCE] error', String(error));
    return;
  }
  const { eventType, region } = (data || {}) as any;
  const ident = String(region?.identifier || '');
  console.log('[GEOFENCE] event', eventType, ident);

  const m = ident.match(/^offer:([a-f0-9]{24})$/i);
  if (!m) return;
  const offerId = m[1];

  // Event-Burst-Dedupe
  const key = `${eventType}:${offerId}`;
  const nowEvt = nowMs();
  if (LAST_EVENT_SEEN[key] && (nowEvt - LAST_EVENT_SEEN[key]) < EVENT_DEDUP_WINDOW_MS) {
    console.log('[GEOFENCE] event dedup window hit', key);
    return;
  }
  LAST_EVENT_SEEN[key] = nowEvt;

  try {
    let lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 2 * 60 * 1000, requiredAccuracy: 200 });
    let lat = lastKnown?.coords?.latitude ?? null;
    let lng = lastKnown?.coords?.longitude ?? null;
    let accuracy = lastKnown?.coords?.accuracy ?? null;
    let enteredDistanceM: number | null = null;

    if (eventType === Location.GeofencingEventType.Enter) {
      // Accuracy-Sanity
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
          enteredDistanceM = Math.round(d);
          const accCap = Math.min(Number.isFinite(accuracy as any) ? Number(accuracy) : ACCURACY_TOKEN_CAP_M, ACCURACY_TOKEN_CAP_M);
          const effective = (region.radius ?? 0) + accCap + ENTER_SANITY_BUFFER_M;
          if (d > effective) {
            console.log('[GEOFENCE] ENTER ignored (SANITY:OUTSIDE)', {
              d: Math.round(d),
              effective: Math.round(effective),
              radius: region.radius,
              acc: accuracy,
              accCap,
            });
            return;
          }
        } else {
          console.log('[GEOFENCE] ENTER with no position (proceeding)');
        }
      }

      // Zustand laden (für sauberes Setzen bei Dedupe)
      const state = await getOfferPushState(offerId);

      // Remote-Dedupe
      const lastRemote = await getOfferRemoteLastPush(offerId);
      if (lastRemote && (nowEvt - lastRemote) < REMOTE_DEDUPE_WINDOW_MS) {
        console.log('[GEOFENCE] ENTER skipped by remote dedupe', offerId, (nowEvt - lastRemote) + 'ms');
        await setOfferPushState(offerId, { inside: true, lastPushedAt: Math.max(state?.lastPushedAt || 0, lastRemote) });
        return;
      }

      if (!acquirePushLock(offerId)) {
        console.log('[GEOFENCE] ENTER in-flight lock hit', offerId);
        return;
      }

      if (state.inside) {
        console.log('[GEOFENCE] ENTER dedup -> already inside, skip', offerId);
        return;
      }

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

      // Aktiv + Interessen
      let active = true;
      let offerForChecks:any = null;
      try {
        const res = await fetch(`${API_BASE}/offers/${offerId}?withProvider=1`, { method: 'GET' });
        offerForChecks = await res.json();
        active = res.ok ? !!isOfferActiveNow(offerForChecks, EUROPE_VIENNA) : true;
      } catch {}

      try {
        const interestSet = await getInterestSet();
        if (offerForChecks && !matchesInterests(offerForChecks, interestSet)) {
          console.log('[LOCAL_PUSH] skipped by interests', offerId);
          await setOfferPushState(offerId, { inside: true, lastPushedAt: state.lastPushedAt || 0 });
          return;
        }
      } catch {}

      if (!active) {
        console.log('[LOCAL_PUSH] skipped (not active now)', offerId);
        await setOfferPushState(offerId, { inside: true, lastPushedAt: state.lastPushedAt || 0 });
        return;
      }

      // Lokaler Sofort-Push ODER In-App-Signal (wenn foreground)
      const meta = await getOfferMeta(offerId);
      await Notifications.setBadgeCountAsync?.(0).catch?.(()=>{});
      await presentLocalOfferNotification(offerId, meta);

      if (enteredDistanceM == null) {
        enteredDistanceM = await computeDistanceMeters(offerId, lat, lng);
      }
      console.log('[LOCAL_PUSH_SHOWN]', JSON.stringify({
        offerId,
        d: typeof enteredDistanceM === 'number' ? `${enteredDistanceM}m` : null,
        acc: accuracy != null ? Math.round(accuracy as number) : null,
        source: 'ENTER',
      }));

      await setOfferPushState(offerId, { inside: true, lastPushedAt: now });
      await setGlobalState({ lastAnyPushAt: now });

      reportEnterToBackend({ offerId, lat: lat!, lng: lng!, accuracy }).catch(() => {});
    }

    if (eventType === Location.GeofencingEventType.Exit) {
      const prev = await getOfferPushState(offerId);
      await setOfferPushState(offerId, { inside: false, lastPushedAt: prev.lastPushedAt || 0 });
      console.log('[GEOFENCE] EXIT -> re-enter will notify again', offerId);
    }
  } catch (e:any) {
    console.log('[GEOFENCE] handler exception', String(e));
  }
});

// ───────────── Diagnostics helper ─────────────
export async function sendRoundtripTest({ offerId = 'ROUNDTRIP_TEST' } = {}) {
  try {
    const token = await getCurrentExpoToken();
    const deviceId = await getPersistentDeviceId();
    const payload = {
      token, deviceId, platform: Platform.OS, projectId: RESOLVED_PROJECT_ID, offerId, t: nowMs(),
    };

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
        android: { channelId: CHANNELS.offers },
      },
      trigger: null,
    });
    console.log('[diag] roundtrip', ok ? 'ok' : `failed status=${lastStatus}`);
  } catch (e:any) {
    console.log('[diag] roundtrip error', String(e));
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'StepsMatch – Roundtrip',
        body: 'Fehler beim Auslösen. Lokale Bestätigung angezeigt.',
        data: { kind: 'roundtrip', ok: false, error: String(e) },
        android: { channelId: CHANNELS.offers },
      },
      trigger: null,
    });
  }
}

// ───────────── Watchdog ─────────────
function useLocationWatchdog() {
  const timerRef = useRef<any>(null);
  useEffect(() => {
    async function tick() {
      try {
        const locStarted = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK);
        if (!locStarted) {
          console.log('[BGLOC] watchdog → BG task not running → restart');
          await startAggressiveBgLocation();
        }

        const lastFixAt = Number(await AsyncStorage.getItem('lastFixAt') || 0);
        const age = Date.now() - lastFixAt;
        if (!lastFixAt || age > LOC_STALE_MS) {
          console.log('[BGLOC] watchdog → stale fix (age=', age, 'ms) → re-arm + heartbeat');
          await startAggressiveBgLocation();
          const pos = await Location.getLastKnownPositionAsync({});
          if (pos?.coords) {
            await _sendHeartbeatWithCoords({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              refreshMode: 'normal',
            });
          }
        }

        const gfStarted = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
        const gfAge = Date.now() - (lastGeofenceSyncAt || 0);
        if (!gfStarted) {
          console.log('[GEOFENCE] watchdog → geofencing not running → force start/refresh');
          await refreshGeofencesAroundUser(true);
        } else if (!lastGeofenceSyncAt || gfAge > GF_STALE_MS) {
          console.log('[GEOFENCE] watchdog → geofence stale (age=', gfAge, 'ms) → force refresh');
          await refreshGeofencesAroundUser(true);
        }
      } catch (e) {
        console.log('[WD] tick error', String((e as any)?.message || e));
      }
    }
    timerRef.current = setInterval(tick, WD_TICK_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);
}

// ───────────── Init & Component ─────────────
async function initPush() {
  if (INIT_PUSH_ONCE) {
    return;
  }
  INIT_PUSH_ONCE = true;

  await ensureChannels();
  const granted = await askNotificationPermission();
  if (!granted) return;

  const deviceId = await getPersistentDeviceId();

  try {
    const native = await Notifications.getDevicePushTokenAsync();
    console.log('[push] nativePushToken', (native as any)?.type, (native as any)?.data ? String((native as any).data).slice(0,24) + '…' : null);
  } catch (e:any) {
    console.log('[push] nativePushToken error', String(e));
  }

  const token = await resolveExpoTokenAuthoritative();
  console.log('[Push] Expo token', token);
  console.log('[Push] deviceId', deviceId);

  let lastLoc: Location.LocationObject | null = null;
  try { lastLoc = await Location.getLastKnownPositionAsync({}); } catch {}
  await registerTokenWithBackend({ expoToken: token, deviceId, lastLocation: lastLoc || undefined });

  // Listener nur EINMAL registrieren
  if (!notifReceivedSub) {
    notifReceivedSub = Notifications.addNotificationReceivedListener(async (notification) => {
      const c:any = notification?.request?.content || {};
      const data = c.data || {};
      console.log('[push] received', JSON.stringify({
        title: c.title,
        body: c.body,
        channelId: c.android?.channelId || c.channelId || CHANNELS.offers,
        data,
      }));

      // Remote-Dedupe: Zeitstempel pro Offer setzen
      if (data?.offerId) {
        try {
          const key = `offerPushState.${data.offerId}`;
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
          await refreshGeofencesAroundUser(true);
        } catch (e) {
          console.log('[push] offers-refresh failed', String((e as any)?.message || e));
        }
      }
    });
  }

  if (!notifResponseSub) {
    notifResponseSub = Notifications.addNotificationResponseReceivedListener(async (response) => {
      try {
        const action = response?.actionIdentifier;
        const data:any = response?.notification?.request?.content?.data || {};
        const offerId = data?.offerId;
        if (!offerId) return;

        if (action === 'later') {
          const prev = await getOfferPushState(offerId);
          await setOfferPushState(offerId, { inside: true, lastPushedAt: nowMs() || prev.lastPushedAt || 0 });
          console.log('[push] action: LATER -> mark read', offerId);
        }
      } catch (e:any) {
        console.log('[push] response listener error', String(e));
      }
    });
  }

  console.log('[push] listeners installed');
}

export default function PushInitializer() {
  const appState = useRef(AppState.currentState);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    (async () => {
      console.log('[BGLOC] BackgroundLocationManager: start in PushInitializer');
      await ensureChannels();
      await initPush();
    })();

    const sub = AppState.addEventListener('change', async (next) => {
      if ((appState.current as string).match(/inactive|background/) && next === 'active') {
        await ensureChannels();
        try {
          // Silent-Refresh beim Öffnen der App → KEIN lokaler Push
          await refreshGeofencesAroundUser({ force: true, silent: true });

          const loc = await Location.getLastKnownPositionAsync({});
          if (loc?.coords) {
            await _sendHeartbeatWithCoords({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              accuracy: loc.coords.accuracy,
              refreshMode: 'silent',
            });
          }
        } catch {}
      }
      try {
        const started = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK);
        if (!started) {
          console.log('[BGLOC] watchdog appstate → (re)start');
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
