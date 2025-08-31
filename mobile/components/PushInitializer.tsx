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
const GEOFENCE_TASK    = 'stepsmatch-geofence-task';

const HEARTBEAT_MIN_SECONDS = 45;
const TIME_INTERVAL_MS = 60 * 1000;
const API_BASE = 'https://lobster-app-ie9a5.ondigitalocean.app/api';

const GEOFENCE_RADIUS_DEFAULT = 150;
const GEOFENCE_MAX = 15;
const OFFERS_ENDPOINT = `${API_BASE}/offers?withProvider=1&page=1&limit=200`;

const GEOFENCE_META_KEY = 'geofenceMeta_v1';
const NOTIFIED_RECENT_KEY = 'geofenceNotified_v1';
const NOTIFY_DEDUP_WINDOW_MS = 5 * 60 * 1000;

const ENTER_LOCK_KEY = 'geofenceEnterLock_v1';
const ENTER_LOCK_MS  = 90 * 1000;

let lastHeartbeatAt = 0;

let PUSH_TOKEN = null;
const PUSH_TOKEN_KEY = 'expoPushToken';

/* ---------- Notifications: Handler + Channels + Categories ---------- */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    // Android: Heads-Up begünstigen
    priority: Notifications.AndroidNotificationPriority?.MAX ?? undefined,
  }),
});

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('stepsmatch-default-v2', {
      name: 'StepsMatch',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: 'default',
    });

    // Alias-Channel (Server kann 'offers' schicken)
    await Notifications.setNotificationChannelAsync('offers', {
      name: 'Offers',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: 'default',
    });

    // Foreground-Service Channel
    await Notifications.setNotificationChannelAsync('com.ecily.mobile:stepsmatch-bg-location-task', {
      name: 'StepsMatch – Standortdienst',
      description: 'Background location notification channel',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });

    console.log('[push] channels ready: stepsmatch-default-v2, offers, com.ecily.mobile:stepsmatch-bg-location-task');
  } catch (e) {
    console.log('[push] channel error', e?.message || e);
  }
}

async function ensureCategories() {
  try {
    await Notifications.setNotificationCategoryAsync('offer-go', [
      { identifier: 'GO', buttonTitle: 'Öffnen', options: { isDestructive: false, isAuthenticationRequired: false } },
      { identifier: 'DISMISS', buttonTitle: 'Schließen', options: { isDestructive: true } },
    ]);
    await Notifications.setNotificationCategoryAsync('offers-actions', [
      { identifier: 'GO', buttonTitle: 'GO' },
      { identifier: 'DISMISS', buttonTitle: 'Schließen', options: { isDestructive: true } },
    ]);

    console.log('[push] categories ready: offer-go, offers-actions');
  } catch (e) {
    console.log('[push] categories error', e?.message || e);
  }
}

/* ---------- Push Token ---------- */

function resolveProjectId() {
  const viaExtra = Constants?.expoConfig?.extra?.eas?.projectId || null;
  const viaEas   = Constants?.easConfig?.projectId || null;
  return viaExtra || viaEas || null;
}

async function registerTokenOnBackend(token) {
  try {
    const res = await fetch(`${API_BASE}/push/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        platform: Platform.OS,
        deviceId: Constants?.deviceName || null,
      }),
    });
    const json = await res.json().catch(() => ({}));
    console.log('[push] register =>', res.status, JSON.stringify(json || {}));
  } catch (e) {
    console.warn('[push] register failed', String(e));
  }
}

/** 🔁 Server-Roundtrip mit Fallback: wenn echte Push nicht ankommt → lokale Notif nach 5s */
const roundtripProbe = {
  pending: new Set(),
};

async function serverPushRoundtrip(token) {
  try {
    if (!token) return;
    const rid = `rt_${Date.now()}_${Math.floor(Math.random() * 1e5)}`;
    roundtripProbe.pending.add(rid);

    const res = await fetch(`${API_BASE}/push/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        title: 'StepsMatch • Roundtrip',
        body: 'Push-Pipeline aktiv ✅',
        data: { kind: 'roundtrip', rid, ts: Date.now() },
        channelId: 'offers',
        categoryId: 'offer-go',
      }),
    });
    const json = await res.json().catch(() => ({}));
    console.log('[push] roundtrip =>', res.status, JSON.stringify(json || {}));

    // ⏳ Falls binnen 5s kein [push] received mit exakt diesem rid kommt → lokaler Fallback
    setTimeout(async () => {
      if (roundtripProbe.pending.has(rid)) {
        try {
          await Notifications.presentNotificationAsync({
            title: 'StepsMatch • Push aktiv (Fallback)',
            body: 'Remote-Benachrichtigung nicht zugestellt – zeige lokale Fallback-Notif.',
            data: { kind: 'roundtrip-fallback', rid },
            categoryIdentifier: 'offer-go',
            android: { channelId: 'offers', priority: Notifications.AndroidNotificationPriority.MAX },
            sound: 'default',
          });
          roundtripProbe.pending.delete(rid);
          console.log('[push] roundtrip fallback presented for', rid);
        } catch (e) {
          console.log('[push] roundtrip fallback error', e?.message || e);
        }
      }
    }, 5000);
  } catch (e) {
    console.log('[push] roundtrip error', e?.message || e);
  }
}

async function fetchFreshExpoToken() {
  try {
    const projectId = resolveProjectId();
    if (!projectId) {
      console.warn('[push] WARN: projectId fehlt (expo.extra.eas.projectId). Token könnte ungültig sein.');
    }
    const { data: expoToken } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const t = expoToken ? String(expoToken).trim() : null;
    if (t) {
      PUSH_TOKEN = t;
      try { await AsyncStorage.setItem(PUSH_TOKEN_KEY, PUSH_TOKEN); } catch {}
      console.log('[push] expoToken =', PUSH_TOKEN);
      return PUSH_TOKEN;
    }
    console.warn('[push] kein Expo-Token erhalten');
    return null;
  } catch (e) {
    console.warn('[push] getExpoPushTokenAsync failed', String(e));
    return null;
  }
}

async function getStoredOrFetchExpoToken() {
  if (PUSH_TOKEN && String(PUSH_TOKEN).trim()) return PUSH_TOKEN;
  try {
    const fromStore =
      (await AsyncStorage.getItem(PUSH_TOKEN_KEY)) ||
      (await AsyncStorage.getItem('pushToken')) || null;
    if (fromStore && String(fromStore).trim()) {
      PUSH_TOKEN = String(fromStore).trim();
      return PUSH_TOKEN;
    }
  } catch {}
  return await fetchFreshExpoToken();
}

/* ---------- Heartbeat ---------- */

async function postHeartbeat(token, coords, label = 'Heartbeat') {
  try {
    if (!token) { console.log('[BGLOC] skip send (no token)'); return false; }
    if (!coords || typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number') {
      console.log('[BGLOC] skip send (no coords)'); return false;
    }
    const payload = {
      token,
      platform: Platform.OS,
      lat: coords.latitude,
      lng: coords.longitude,
      accuracy: typeof coords.accuracy === 'number' ? coords.accuracy : undefined,
      at: new Date().toISOString(),
    };
    const res = await fetch(`${API_BASE}/location/heartbeat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const txt = await res.text();
    console.log(`[BGLOC] ${label} HTTP`, res.status, txt);

    if (res.ok) {
      try { await AsyncStorage.setItem('lastHeartbeatAt', payload.at); } catch {}
      console.log(`[BGLOC] ${label} sent lat=${coords.latitude?.toFixed?.(5)} lng=${coords.longitude?.toFixed?.(5)} acc=${coords.accuracy}`);
      return true;
    } else {
      console.log('[BGLOC] server rejected; payload was', JSON.stringify(payload));
      return false;
    }
  } catch (e) {
    console.log('[BGLOC] Exception in postHeartbeat:', e?.message || e);
    return false;
  }
}

export async function sendHeartbeat(token, label = 'Manual') {
  try {
    const ensuredToken = token || (await getStoredOrFetchExpoToken());
    if (!ensuredToken) { console.log('[BGLOC] sendHeartbeat: no token'); return false; }

    let pos = await Location.getLastKnownPositionAsync();
    if (!pos) {
      try {
        pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          mayShowUserSettingsDialog: false,
        });
      } catch (e) { console.log('[BGLOC] getCurrentPosition error', e?.message || e); }
    }
    const ok = await postHeartbeat(ensuredToken, pos?.coords || null, label);
    return ok;
  } catch (e) {
    console.log('[BGLOC] sendHeartbeat exception', e?.message || e);
    return false;
  }
}

/** 🔔 Lokaler Soforttest */
export async function debugLocalPush() {
  console.log('[push] debugLocalPush()');
  try {
    await Notifications.presentNotificationAsync({
      title: 'StepsMatch • Test',
      body: 'Lokale Notification (Handler+Channel ok?)',
      data: { kind: 'debug-local' },
      categoryIdentifier: 'offer-go',
      android: { channelId: 'offers', priority: Notifications.AndroidNotificationPriority.MAX },
      sound: 'default',
    });
    console.log('[push] presentNotificationAsync -> OK');
  } catch (e) {
    console.log('[push] presentNotificationAsync -> ERROR', e);
  }
}

/* ---------- Foreground-Handling & Logging ---------- */

let notifReceivedSub = null;
let notifResponseSub = null;

function installNotificationListeners() {
  try {
    if (notifReceivedSub) return;

    notifReceivedSub = Notifications.addNotificationReceivedListener(async (notification) => {
      const c = notification?.request?.content || {};
      console.log('[push] received', JSON.stringify({
        title: c.title, body: c.body, data: c.data,
        channelId: c.android?.channelId || c.channelId,
      }));

      // Roundtrip: Erfolg markieren → Roundtrip-Fallback wird nicht abgefeuert
      const rid = c?.data?.rid;
      if (rid && roundtripProbe.pending.has(rid)) {
        roundtripProbe.pending.delete(rid);
      }

      // ❌ Entfernt: KEIN zusätzliches presentNotificationAsync im Vordergrund.
      // Der globale setNotificationHandler zeigt die Notif bereits sichtbar an.
      // Ein erneutes present* führte zu Doppel-Notifs / "verschluckt" Remote-Notif.
    });

    notifResponseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const c = response?.notification?.request?.content || {};
      console.log('[push] response', JSON.stringify({
        actionId: response?.actionIdentifier,
        data: c.data,
        channelId: c.android?.channelId || c.channelId,
      }));
      // TODO: Deep-Link/Navigation falls gewünscht
    });

    console.log('[push] listeners installed');
  } catch (e) {
    console.log('[push] listener install error', e?.message || e);
  }
}

function uninstallNotificationListeners() {
  try {
    notifReceivedSub?.remove?.();
    notifResponseSub?.remove?.();
  } catch {}
  notifReceivedSub = null;
  notifResponseSub = null;
}

/* ---------- Geofence-Tools ---------- */

export async function forceRefreshGeofencesNow() {
  try {
    console.log('[GEOFENCE] force refresh…');
    await refreshGeofences();
  } catch (e) {
    console.log('[GEOFENCE] force refresh error', e?.message || e);
  }
}

if (!TaskManager.isTaskDefined?.(BG_LOCATION_TASK)) {
  TaskManager.defineTask(BG_LOCATION_TASK, async ({ data, error }) => {
    try {
      if (error) { console.log('[BGLOC] Task error:', error); return; }
      const locs = data?.locations || [];
      if (!locs.length) { console.log('[BGLOC] locations: 0'); return; }
      console.log('[BGLOC] locations batch size =', locs.length);

      const now = Math.floor(Date.now() / 1000);
      if (now - lastHeartbeatAt < HEARTBEAT_MIN_SECONDS) {
        console.log('[BGLOC] skip (debounce)', now - lastHeartbeatAt, 's since last');
        return;
      }

      const token = await getStoredOrFetchExpoToken();
      if (!token) { console.log('[BGLOC] skip (no token even after fetch)'); return; }

      const latest = locs[locs.length - 1];
      const { coords } = latest || {};
      const ok = await postHeartbeat(token, coords, 'Heartbeat');
      if (ok) lastHeartbeatAt = now;
    } catch (e) { console.log('[BGLOC] Exception in task:', e?.message || e); }
  });
}

if (!TaskManager.isTaskDefined?.(GEOFENCE_TASK)) {
  TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
    try {
      if (error) { console.log('[GEOFENCE] Task error:', error); return; }
      const eventType = data?.eventType;
      const region = data?.region;
      console.log('[GEOFENCE] event', eventType, region?.identifier);

      if (eventType === Location.GeofencingEventType.Enter) {
        try {
          const token = await getStoredOrFetchExpoToken();
          const id = String(region?.identifier || '');
          if (!token || !id) return;

          let pos = null;
          try {
            pos = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
              mayShowUserSettingsDialog: false
            });
          } catch {}

          let locks = {};
          try { locks = JSON.parse(await AsyncStorage.getItem(ENTER_LOCK_KEY)) || {}; } catch {}
          const nowMs = Date.now();
          const last = Number(locks[id] || 0);
          if (last && nowMs - last < ENTER_LOCK_MS) {
            console.log('[GEOFENCE] enter skipped (lock active)', id, `${Math.round((ENTER_LOCK_MS - (nowMs - last))/1000)}s left`);
            return;
          }
          locks[id] = nowMs;
          for (const k of Object.keys(locks)) {
            if (nowMs - Number(locks[k]) > 6 * 60 * 60 * 1000) delete locks[k];
          }
          try { await AsyncStorage.setItem(ENTER_LOCK_KEY, JSON.stringify(locks)); } catch {}

          // Lokaler Fallback
          try {
            let notified = {};
            try { notified = JSON.parse(await AsyncStorage.getItem(NOTIFIED_RECENT_KEY)) || {}; } catch {}
            if (!(notified[id] && nowMs - Number(notified[id]) < NOTIFY_DEDUP_WINDOW_MS)) {
              let metaMap = {};
              try { metaMap = JSON.parse(await AsyncStorage.getItem(GEOFENCE_META_KEY)) || {}; } catch {}
              const meta = metaMap[id] || {};
              const title = meta.title || 'Angebot in deiner Nähe';
              const body  = meta.body  || 'Tippe, um Details zu sehen';

              await Notifications.presentNotificationAsync({
                title, body, sound: 'default',
                categoryIdentifier: 'offer-go',
                data: { offerId: id, localFallback: true },
                android: { channelId: 'offers', priority: Notifications.AndroidNotificationPriority.MAX },
              });
              console.log('[GEOFENCE] local fallback notification shown for', id);

              notified[id] = nowMs;
              for (const k of Object.keys(notified)) {
                if (nowMs - Number(notified[k]) > 6 * 60 * 60 * 1000) delete notified[k];
              }
              await AsyncStorage.setItem(NOTIFIED_RECENT_KEY, JSON.stringify(notified));
            } else {
              console.log('[GEOFENCE] local notif skipped (dedupe) for', id);
            }
          } catch (e) { console.log('[GEOFENCE] local fallback error', e?.message || e); }

          // Backend informieren
          try {
            fetch(`${API_BASE}/location/geofence-enter`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                offerId: id,
                token,
                platform: Platform.OS === 'ios' ? 'ios' : 'android',
                lat: pos?.coords?.latitude,
                lng: pos?.coords?.longitude,
                eventType: 'enter',
                channelId: 'offers',
              }),
            })
              .then(() => console.log('[GEOFENCE] notified backend geofence-enter for offerId=', id))
              .catch((e) => console.log('[GEOFENCE] geofence-enter notify error', e?.message || e));
          } catch (e) { console.log('[GEOFENCE] geofence-enter notify setup error', e?.message || e); }

          // Heartbeat
          try { if (token && pos?.coords) await postHeartbeat(token, pos.coords, 'Geofence-Enter'); } catch {}
        } catch (e) { console.log('[GEOFENCE] enter-getCurrentPosition error', e?.message || e); }
      } else if (eventType === Location.GeofencingEventType.Exit) {
        try {
          const id = String(region?.identifier || '');
          if (id) {
            let notified = {};
            try { notified = JSON.parse(await AsyncStorage.getItem(NOTIFIED_RECENT_KEY)) || {}; } catch {}
            if (notified[id]) { delete notified[id]; await AsyncStorage.setItem(NOTIFIED_RECENT_KEY, JSON.stringify(notified)); console.log('[GEOFENCE] exit -> dedupe cleared for', id); }

            let locks = {};
            try { locks = JSON.parse(await AsyncStorage.getItem(ENTER_LOCK_KEY)) || {}; } catch {}
            if (locks[id]) { delete locks[id]; await AsyncStorage.setItem(ENTER_LOCK_KEY, JSON.stringify(locks)); console.log('[GEOFENCE] exit -> lock cleared for', id); }
          }
        } catch (e) { console.log('[GEOFENCE] exit clear error', e?.message || e); }
      }
    } catch (e) { console.log('[GEOFENCE] Exception in task:', e?.message || e); }
  });
}

/* ---------- Geofences registrieren ---------- */
async function refreshGeofences() {
  try {
    let me = await Location.getLastKnownPositionAsync();
    if (!me) {
      me = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, mayShowUserSettingsDialog: false });
    }

    const res = await fetch(OFFERS_ENDPOINT, { method: 'GET' });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch {}
    const offers =
      (json?.offers && Array.isArray(json.offers) && json.offers) ||
      (json?.data?.offers && Array.isArray(json.data.offers) && json.data.offers) ||
      (Array.isArray(json?.data) && json.data) ||
      (Array.isArray(json?.rows) && json.rows) ||
      (Array.isArray(json) && json) ||
      [];

    if (!Array.isArray(offers) || offers.length === 0) {
      console.log('[GEOFENCE] no offers received');
      return;
    }

    const pickLoc = (o) => {
      const c = o?.location?.coordinates || o?.provider?.location?.coordinates || null;
      if (Array.isArray(c) && c.length >= 2) {
        const [lng, lat] = c; const latN = Number(lat), lngN = Number(lng);
        if (Number.isFinite(latN) && Number.isFinite(lngN)) return { latitude: latN, longitude: lngN };
      }
      return null;
    };
    const pickRadius = (o) => {
      const r1 = Number(o?.radius); if (Number.isFinite(r1) && r1 >= 0) return r1;
      const r2 = Number(o?.provider?.radius); if (Number.isFinite(r2) && r2 >= 0) return r2;
      const r3 = Number(o?.provider?.radiusMeters); if (Number.isFinite(r3) && r3 >= 0) return r3;
      return GEOFENCE_RADIUS_DEFAULT;
    };

    const rows = offers
      .map((o) => {
        const loc = pickLoc(o);
        const radius = pickRadius(o);
        const active = isOfferActiveNow(o, 'Europe/Vienna');
        return { o, loc, radius, active };
      })
      .filter((r) => r.active && r.loc);

    if (!rows.length) { console.log('[GEOFENCE] no active offers with location'); return; }

    let ranked = rows;
    if (me?.coords) {
      const my = { lat: me.coords.latitude, lng: me.coords.longitude };
      const dist = (a, b) => {
        const toR = (d)=> d*Math.PI/180, R=6371000;
        const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
        const A = Math.sin(dLat/2)**2 + Math.cos(toR(a.lat))*Math.cos(toR(b.lat))*Math.sin(dLng/2)**2;
        return 2*R*Math.asin(Math.sqrt(A));
      };
      ranked = rows
        .map((r) => ({ ...r, d: dist(my, { lat: r.loc.latitude, lng: r.loc.longitude }) }))
        .filter((r) => r.d <= 25_000)
        .sort((a, b) => a.d - b.d);
    }

    const regions = [];
    const metasTop = {};

    for (const r of ranked.slice(0, GEOFENCE_MAX)) {
      const id = String(r.o._id || `${r.loc.latitude},${r.loc.longitude},${r.radius}`);
      regions.push({
        identifier: id,
        latitude: r.loc.latitude,
        longitude: r.loc.longitude,
        radius: Math.min(Math.max(r.radius, 50), 1000),
        notifyOnEnter: true,
        notifyOnExit: false,
      });

      const title = r.o?.name || r.o?.provider?.name || 'Angebot in deiner Nähe';
      const cat = r.o?.subcategory ? `${r.o.category} · ${r.o.subcategory}` : (r.o?.category || '');
      const body = cat || (r.o?.provider?.name ? `Bei ${r.o.provider.name}` : 'Jetzt ansehen');
      metasTop[id] = { title, body };
    }

    try { await AsyncStorage.setItem(GEOFENCE_META_KEY, JSON.stringify(metasTop)); } catch {}

    const isRunning = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
    if (isRunning) { await Location.stopGeofencingAsync(GEOFENCE_TASK).catch(() => {}); }
    await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
    console.log('[GEOFENCE] registered regions =', regions.length);
  } catch (e) {
    console.log('[GEOFENCE] refresh error', e?.message || e);
  }
}

/* ---------- Component Bootstrapping ---------- */
export default function PushInitializer() {
  const initDone = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const intervalRef = useRef(null);
  const appStateSubRef = useRef(null);

  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;

    (async () => {
      try {
        // Noti-Permission (Android 13+)
        const notiPerm0 = await Notifications.getPermissionsAsync();
        let notiStatus = notiPerm0.status;
        if (notiStatus !== 'granted') {
          const asked = await Notifications.requestPermissionsAsync();
          notiStatus = asked.status;
        }
        console.log('[push] notification permission =', notiStatus);

        await ensureAndroidChannel();
        await ensureCategories();
        installNotificationListeners();

        const freshToken = await fetchFreshExpoToken();
        if (freshToken) {
          await registerTokenOnBackend(freshToken);
          // 🔁 Direkt nach Registrierung: End-to-End-Serverpush anstoßen
          setTimeout(() => { serverPushRoundtrip(freshToken); }, 1200);
        } else {
          console.warn('[push] no expo token -> push disabled for this session');
        }

        // Standort-Berechtigungen
        const fg = await Location.requestForegroundPermissionsAsync();
        const bg = await Location.requestBackgroundPermissionsAsync();
        console.log('[BGLOC] permissions', { fg: fg.status, bg: bg.status });
        if (fg.status !== 'granted' || bg.status !== 'granted') {
          console.log('[BGLOC] Missing location permissions -> abort start');
          return;
        }

        // Kickstart
        try {
          let pos = await Location.getLastKnownPositionAsync();
          if (!pos) {
            pos = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
              mayShowUserSettingsDialog: false,
            });
          }
          if (pos?.coords && freshToken) {
            await postHeartbeat(freshToken, pos.coords, 'Kickstart');
          } else {
            console.log('[BGLOC] Kickstart: no position/token available');
          }
        } catch (e) { console.log('[BGLOC] Kickstart error', e?.message || e); }

        // Foreground-Service Location Updates
        const started = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK);
        if (!started) {
          console.log('[BGLOC] Starting background updates…');
          await Location.startLocationUpdatesAsync(BG_LOCATION_TASK, {
            distanceInterval: 0,
            timeInterval: TIME_INTERVAL_MS,
            accuracy: Location.Accuracy.Balanced,
            foregroundService: {
              notificationTitle: 'StepsMatch aktiv',
              notificationBody: 'Standortabgleich läuft im Hintergrund.',
              notificationChannelId: 'com.ecily.mobile:stepsmatch-bg-location-task',
            },
            showsBackgroundLocationIndicator: false,
            pausesUpdatesAutomatically: false,
            activityType: Location.ActivityType.Other,
            deferredUpdatesInterval: 0,
            deferredUpdatesDistance: 0,
          });
        } else { console.log('[BGLOC] Background updates already started.'); }

        await refreshGeofences();

        // a) App kommt in den Vordergrund → Geofences refreshen
        const onStateChange = (next) => {
          const prev = appStateRef.current;
          appStateRef.current = next;
          if ((prev === 'background' || prev === 'inactive') && next === 'active') {
            setTimeout(() => { refreshGeofences(); }, 1500);
          }
        };
        const sub = AppState.addEventListener('change', onStateChange);
        appStateSubRef.current = sub;

        // b) Alle 30 Min. refresher
        intervalRef.current = setInterval(() => { refreshGeofences(); }, 30 * 60 * 1000);

      } catch (e) {
        console.log('[BGLOC] init error', e?.message || e);
      }
    })();

    return () => {
      try { appStateSubRef.current?.remove?.(); } catch {}
      if (intervalRef.current) clearInterval(intervalRef.current);
      uninstallNotificationListeners();
    };
  }, []);

  return null;
}
