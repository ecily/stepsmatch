// stepsmatch/mobile/components/PushInitializer.js
import React, { useEffect, useRef } from 'react';
import { Platform, AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { isOfferActiveNow } from '../utils/isOfferActiveNow'; // robustes Aktiv-Filtering wie im UI

const BG_LOCATION_TASK = 'stepsmatch-bg-location-task';
const GEOFENCE_TASK    = 'stepsmatch-geofence-task';

// Produktionswerte
const HEARTBEAT_MIN_SECONDS = 45;         // Debounce zwischen Heartbeats in der BG-Task
const TIME_INTERVAL_MS = 60 * 1000;       // Ziel: ~60s Updates durch Foreground Service
const API_BASE = 'https://lobster-app-ie9a5.ondigitalocean.app/api';

// Geofencing-Config
const GEOFENCE_RADIUS_DEFAULT = 150; // Meter
const GEOFENCE_MAX = 15;             // max. registrierte Regionen
const OFFERS_ENDPOINT = `${API_BASE}/offers?withProvider=1&page=1&limit=200`; // liefert provider.location ggf. in data/rows

// Geofence-Notif-Config (lokaler Fallback + Metadaten)
const GEOFENCE_META_KEY = 'geofenceMeta_v1';         // id -> {title, body}
const NOTIFIED_RECENT_KEY = 'geofenceNotified_v1';   // id -> timestamp
const NOTIFY_DEDUP_WINDOW_MS = 5 * 60 * 1000;        // 5 Minuten

// Anti-Flood
const ENTER_LOCK_KEY = 'geofenceEnterLock_v1';       // id -> timestamp (ms)
const ENTER_LOCK_MS  = 90 * 1000;                    // 90s

let lastHeartbeatAt = 0;

// Push-Token Cache + Storage-Key
let PUSH_TOKEN = null;
const PUSH_TOKEN_KEY = 'expoPushToken';

/* ---------- Notifications: Handler + Channels + Categories ---------- */

// Ohne Handler zeigt Android im Vordergrund oft NICHTS an.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
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

    await Notifications.setNotificationChannelAsync('offers', {
      name: 'Offers',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: 'default',
    });

    // Muss mit foregroundService.notificationChannelId übereinstimmen
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

    // kompatibel falls an anderer Stelle referenziert
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
  // bevorzugte Reihenfolge: app.json -> eas zur Laufzeit
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

/**
 * Holt IMMER einen frischen Expo-Token mit korrektem projectId.
 * Speichert ihn lokal (AsyncStorage) und cached ihn für Heartbeats/Geofences.
 */
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

/**
 * Liefert Token aus Cache/Speicher; wenn fehlend → frisch holen.
 * (Für BG-Tasks, wo wir synchron schnell einen Token brauchen.)
 */
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
    if (!token) {
      console.log('[BGLOC] skip send (no token)');
      return false;
    }
    if (!coords || typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number') {
      console.log('[BGLOC] skip send (no coords)');
      return false;
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
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const txt = await res.text();
    console.log(`[BGLOC] ${label} HTTP`, res.status, txt);

    if (res.ok) {
      try { await AsyncStorage.setItem('lastHeartbeatAt', payload.at); } catch {}
      console.log(
        `[BGLOC] ${label} sent lat=${coords.latitude?.toFixed?.(5)} lng=${coords.longitude?.toFixed?.(5)} acc=${coords.accuracy}`
      );
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

/** 👉 Zentraler, wiederverwendbarer Heartbeat */
export async function sendHeartbeat(token, label = 'Manual') {
  try {
    const ensuredToken = token || (await getStoredOrFetchExpoToken());
    if (!ensuredToken) {
      console.log('[BGLOC] sendHeartbeat: no token');
      return false;
    }

    let pos = await Location.getLastKnownPositionAsync();
    if (!pos) {
      try {
        pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          mayShowUserSettingsDialog: false,
        });
      } catch (e) {
        console.log('[BGLOC] getCurrentPosition error', e?.message || e);
      }
    }
    const ok = await postHeartbeat(ensuredToken, pos?.coords || null, label);
    return ok;
  } catch (e) {
    console.log('[BGLOC] sendHeartbeat exception', e?.message || e);
    return false;
  }
}

/** 🔔 Soforttest ohne Backend: sollte IMMER eine Notification zeigen */
export async function debugLocalPush() {
  console.log('[push] debugLocalPush()');
  try {
    await Notifications.presentNotificationAsync({
      title: 'StepsMatch • Test',
      body: 'Lokale Notification (Handler+Channel ok?)',
      data: { kind: 'debug-local' },
      categoryIdentifier: 'offer-go',
      android: { channelId: 'offers' },
      sound: 'default',
    });
    console.log('[push] presentNotificationAsync -> OK');
  } catch (e) {
    console.log('[push] presentNotificationAsync -> ERROR', e);
  }
}

/** optionaler Geofence-Refresh-Export (z.B. nach Offer-Erstellung) */
export async function forceRefreshGeofencesNow() {
  try {
    console.log('[GEOFENCE] force refresh…');
    await refreshGeofences();
  } catch (e) {
    console.log('[GEOFENCE] force refresh error', e?.message || e);
  }
}

/* ---------- Background Location Task ---------- */
if (!TaskManager.isTaskDefined?.(BG_LOCATION_TASK)) {
  TaskManager.defineTask(BG_LOCATION_TASK, async ({ data, error }) => {
    try {
      if (error) {
        console.log('[BGLOC] Task error:', error);
        return;
      }
      const locs = data?.locations || [];
      if (!locs.length) {
        console.log('[BGLOC] locations: 0');
        return;
      }
      console.log('[BGLOC] locations batch size =', locs.length);

      const now = Math.floor(Date.now() / 1000);
      if (now - lastHeartbeatAt < HEARTBEAT_MIN_SECONDS) {
        console.log('[BGLOC] skip (debounce)', now - lastHeartbeatAt, 's since last');
        return;
      }

      const token = await getStoredOrFetchExpoToken();
      if (!token) {
        console.log('[BGLOC] skip (no token even after fetch)');
        return;
      }

      const latest = locs[locs.length - 1];
      const { coords } = latest || {};
      const ok = await postHeartbeat(token, coords, 'Heartbeat');
      if (ok) lastHeartbeatAt = now;
    } catch (e) {
      console.log('[BGLOC] Exception in task:', e?.message || e);
    }
  });
}

/* ---------- Geofencing Task ---------- */
if (!TaskManager.isTaskDefined?.(GEOFENCE_TASK)) {
  TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
    try {
      if (error) {
        console.log('[GEOFENCE] Task error:', error);
        return;
      }
      const eventType = data?.eventType;
      const region = data?.region;
      console.log('[GEOFENCE] event', eventType, region?.identifier);

      if (eventType === Location.GeofencingEventType.Enter) {
        try {
          const token = await getStoredOrFetchExpoToken();
          const id = String(region?.identifier || '');
          if (!token || !id) return;

          // Aktuelle Position (Best-Effort)
          let pos = null;
          try {
            pos = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
              mayShowUserSettingsDialog: false
            });
          } catch {}

          // Anti-Flood: Hard-Lock 90s vor allen Aktionen
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

          // 1) Lokale Notification (dedupe) — presentNotificationAsync
          try {
            let notified = {};
            try { notified = JSON.parse(await AsyncStorage.getItem(NOTIFIED_RECENT_KEY)) || {}; } catch {}
            if (notified[id] && nowMs - Number(notified[id]) < NOTIFY_DEDUP_WINDOW_MS) {
              console.log('[GEOFENCE] local notif skipped (dedupe) for', id);
            } else {
              let metaMap = {};
              try { metaMap = JSON.parse(await AsyncStorage.getItem(GEOFENCE_META_KEY)) || {}; } catch {}
              const meta = metaMap[id] || {};
              const title = meta.title || 'Angebot in deiner Nähe';
              const body  = meta.body  || 'Tippe, um Details zu sehen';

              await Notifications.presentNotificationAsync({
                title,
                body,
                sound: 'default',
                categoryIdentifier: 'offer-go',
                data: { offerId: id, localFallback: true },
                android: { channelId: 'offers' },
              });
              console.log('[GEOFENCE] local fallback notification shown for', id);

              notified[id] = nowMs;
              for (const k of Object.keys(notified)) {
                if (nowMs - Number(notified[k]) > 6 * 60 * 60 * 1000) delete notified[k];
              }
              await AsyncStorage.setItem(NOTIFIED_RECENT_KEY, JSON.stringify(notified));
            }
          } catch (e) {
            console.log('[GEOFENCE] local fallback error', e?.message || e);
          }

          // 2) Backend informieren – fire-and-forget
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
          } catch (e) {
            console.log('[GEOFENCE] geofence-enter notify setup error', e?.message || e);
          }

          // 3) Heartbeat (optional)
          try {
            if (token && pos?.coords) await postHeartbeat(token, pos.coords, 'Geofence-Enter');
          } catch {}
        } catch (e) {
          console.log('[GEOFENCE] enter-getCurrentPosition error', e?.message || e);
        }
      } else if (eventType === Location.GeofencingEventType.Exit) {
        try {
          const id = String(region?.identifier || '');
          if (id) {
            let notified = {};
            try { notified = JSON.parse(await AsyncStorage.getItem(NOTIFIED_RECENT_KEY)) || {}; } catch {}
            if (notified[id]) {
              delete notified[id];
              await AsyncStorage.setItem(NOTIFIED_RECENT_KEY, JSON.stringify(notified));
              console.log('[GEOFENCE] exit -> dedupe cleared for', id);
            }

            let locks = {};
            try { locks = JSON.parse(await AsyncStorage.getItem(ENTER_LOCK_KEY)) || {}; } catch {}
            if (locks[id]) {
              delete locks[id];
              await AsyncStorage.setItem(ENTER_LOCK_KEY, JSON.stringify(locks));
              console.log('[GEOFENCE] exit -> lock cleared for', id);
            }
          }
        } catch (e) {
          console.log('[GEOFENCE] exit clear error', e?.message || e);
        }
      }
    } catch (e) {
      console.log('[GEOFENCE] Exception in task:', e?.message || e);
    }
  });
}

/* ---------- Geofences registrieren ---------- */
async function refreshGeofences() {
  try {
    // 1) Aktuelle Position (für Ranking & Filter)
    let me = await Location.getLastKnownPositionAsync();
    if (!me) {
      me = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, mayShowUserSettingsDialog: false });
    }

    // 2) Offers laden (robustes Parsing)
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

    // 3) Position + Radius robust bestimmen (Offer -> Provider Fallback)
    const pickLoc = (o) => {
      const c = o?.location?.coordinates || o?.provider?.location?.coordinates || null;
      if (Array.isArray(c) && c.length >= 2) {
        const [lng, lat] = c;
        const latN = Number(lat), lngN = Number(lng);
        if (Number.isFinite(latN) && Number.isFinite(lngN)) return { latitude: latN, longitude: lngN };
      }
      return null;
    };
    const pickRadius = (o) => {
      const r1 = Number(o?.radius);
      if (Number.isFinite(r1) && r1 >= 0) return r1;
      const r2 = Number(o?.provider?.radius);
      if (Number.isFinite(r2) && r2 >= 0) return r2;
      const r3 = Number(o?.provider?.radiusMeters);
      if (Number.isFinite(r3) && r3 >= 0) return r3;
      return GEOFENCE_RADIUS_DEFAULT;
    };

    // 4) Auf aktive Offers beschränken (wie UI)
    const rows = offers
      .map((o) => {
        const loc = pickLoc(o);
        const radius = pickRadius(o);
        const active = isOfferActiveNow(o, 'Europe/Vienna');
        return { o, loc, radius, active };
      })
      .filter((r) => r.active && r.loc);

    if (!rows.length) {
      console.log('[GEOFENCE] no active offers with location');
      return;
    }

    // 5) Ranking nach Distanz (wenn eigene Position bekannt)
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

    // 6) Regionen bauen & begrenzen
    const regions = [];
    const metasTop = {};

    for (const r of ranked.slice(0, GEOFENCE_MAX)) {
      const id = String(r.o._id || `${r.loc.latitude},${r.loc.longitude},${r.radius}`);
      regions.push({
        identifier: id,
        latitude: r.loc.latitude,
        longitude: r.loc.longitude,
        radius: Math.min(Math.max(r.radius, 50), 1000), // clamp 50..1000m
        notifyOnEnter: true,
        notifyOnExit: false,
      });

      const title = r.o?.name || r.o?.provider?.name || 'Angebot in deiner Nähe';
      const cat = r.o?.subcategory ? `${r.o.category} · ${r.o.subcategory}` : (r.o?.category || '');
      const body = cat || (r.o?.provider?.name ? `Bei ${r.o.provider.name}` : 'Jetzt ansehen');
      metasTop[id] = { title, body };
    }

    // 7) Metadaten speichern
    try { await AsyncStorage.setItem(GEOFENCE_META_KEY, JSON.stringify(metasTop)); } catch {}

    // 8) Starten/neu setzen
    const isRunning = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
    if (isRunning) {
      await Location.stopGeofencingAsync(GEOFENCE_TASK).catch(() => {});
    }
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

  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;

    (async () => {
      try {
        // Notifications-Permission (Android 13+)
        const notiPerm0 = await Notifications.getPermissionsAsync();
        let notiStatus = notiPerm0.status;
        if (notiStatus !== 'granted') {
          const asked = await Notifications.requestPermissionsAsync();
          notiStatus = asked.status;
        }
        console.log('[push] notification permission =', notiStatus);

        await ensureAndroidChannel();
        await ensureCategories();

        // >>> Token VOR allem anderen sicherstellen (FRISCH + projectId)
        const freshToken = await fetchFreshExpoToken();
        if (freshToken) {
          await registerTokenOnBackend(freshToken);
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
        } catch (e) {
          console.log('[BGLOC] Kickstart error', e?.message || e);
        }

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
        } else {
          console.log('[BGLOC] Background updates already started.');
        }

        // Geofences initial setzen
        await refreshGeofences();

        // 🔁 Zusätzliche Robustheit:
        // a) Bei App-Rückkehr in den Vordergrund neu registrieren
        const onStateChange = (next) => {
          const prev = appStateRef.current;
          appStateRef.current = next;
          if ((prev === 'background' || prev === 'inactive') && next === 'active') {
            setTimeout(() => { refreshGeofences(); }, 1500);
          }
        };
        AppState.addEventListener('change', onStateChange);

        // b) Alle 30 Minuten während App läuft refreshen
        intervalRef.current = setInterval(() => {
          refreshGeofences();
        }, 30 * 60 * 1000);

        // Cleanup registrieren
        return () => {
          try { AppState.removeEventListener?.('change', onStateChange); } catch {}
          if (intervalRef.current) clearInterval(intervalRef.current);
        };
      } catch (e) {
        console.log('[BGLOC] init error', e?.message || e);
      }
    })();

    // Cleanup, falls Komponente ent-mountet
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return null;
}
