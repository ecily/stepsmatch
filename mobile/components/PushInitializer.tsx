// stepsmatch/mobile/components/PushInitializer.js
import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const BG_LOCATION_TASK = 'stepsmatch-bg-location-task';
const GEOFENCE_TASK    = 'stepsmatch-geofence-task';

// Produktionswerte
const HEARTBEAT_MIN_SECONDS = 45;         // Debounce zwischen Heartbeats in der BG-Task
const TIME_INTERVAL_MS = 60 * 1000;       // Ziel: ~60s Updates durch Foreground Service
const API_BASE = 'https://lobster-app-ie9a5.ondigitalocean.app/api';

let lastHeartbeatAt = 0;

// 🔒 Push-Token: Modulweiter Cache + Storage-Key
let PUSH_TOKEN = null;
const PUSH_TOKEN_KEY = 'expoPushToken';

// Geofencing-Config
const GEOFENCE_RADIUS_DEFAULT = 150; // Meter
const GEOFENCE_MAX = 15;             // max. registrierte Regionen
const OFFERS_ENDPOINT = `${API_BASE}/offers?withProvider=1`; // liefert provider.location

// 🆕 Geofence-Notif-Config (lokaler Fallback + Metadaten)
const GEOFENCE_META_KEY = 'geofenceMeta_v1';         // id -> {title, body}
const NOTIFIED_RECENT_KEY = 'geofenceNotified_v1';   // id -> timestamp
const NOTIFY_DEDUP_WINDOW_MS = 5 * 60 * 1000;        // 5 Minuten

// 🆕 Anti-Flood (Schritt 3)
const ENTER_LOCK_KEY = 'geofenceEnterLock_v1';       // id -> timestamp (ms)
const ENTER_LOCK_MS  = 90 * 1000;                    // 90s

/* ---------- Helpers ---------- */

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  try {
    // Default/App-Channel
    await Notifications.setNotificationChannelAsync('stepsmatch-default-v2', {
      name: 'StepsMatch',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: 'default',
    });

    // Push-Channel für Offers
    await Notifications.setNotificationChannelAsync('offers', {
      name: 'Offers',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [200, 120, 200],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: 'default',
    });

    // Dedizierter Foreground-Service-Channel für BG-Location (höhere Priorität)
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

function resolveProjectId() {
  const viaExtra = Constants?.expoConfig?.extra?.eas?.projectId || null;
  const viaEas   = Constants?.easConfig?.projectId || null;
  return viaExtra || viaEas || null;
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

  let t = Constants.expoConfig?.extra?.expoPushToken || Constants.manifest2?.extra?.expoPushToken || null;

  if (!t) {
    try {
      const projectId = resolveProjectId();
      const resp = projectId
        ? await Notifications.getExpoPushTokenAsync({ projectId })
        : await Notifications.getExpoPushTokenAsync();
      t = resp?.data || null;
    } catch (e) {
      console.log('[push] token fetch error', e?.message || e);
    }
  }

  if (t) {
    PUSH_TOKEN = String(t).trim();
    try { await AsyncStorage.setItem(PUSH_TOKEN_KEY, PUSH_TOKEN); } catch {}
    if (!Constants.expoConfig) Constants.expoConfig = { extra: {} };
    if (!Constants.expoConfig.extra) Constants.expoConfig.extra = {};
    Constants.expoConfig.extra.expoPushToken = PUSH_TOKEN;

    console.log('[push] expoToken ready =', PUSH_TOKEN);
    return PUSH_TOKEN;
  }
  return null;
}

/** Low-level Poster: Token + Koordinaten -> POST /location/heartbeat */
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

/**
 * 👉 Zentraler, wiederverwendbarer Heartbeat
 */
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

          // === Anti-Flood: Hard-Lock 90s VOR allen Aktionen ===
          let locks = {};
          try { locks = JSON.parse(await AsyncStorage.getItem(ENTER_LOCK_KEY)) || {}; } catch {}
          const now = Date.now();
          const last = Number(locks[id] || 0);
          if (last && now - last < ENTER_LOCK_MS) {
            console.log('[GEOFENCE] enter skipped (lock active)', id, `${Math.round((ENTER_LOCK_MS - (now - last))/1000)}s left`);
            return; // keinerlei Aktionen
          }
          // Lock setzen (sofort, damit parallele Enter nicht durchrutschen)
          locks[id] = now;

          // Optional: alte Locks ausmisten (>6h)
          for (const k of Object.keys(locks)) {
            if (now - Number(locks[k]) > 6 * 60 * 60 * 1000) delete locks[k];
          }
          try { await AsyncStorage.setItem(ENTER_LOCK_KEY, JSON.stringify(locks)); } catch {}

          // 1) Lokaler Fallback (Heads-Up), dedupliziert – SOFORT sichtbar
          try {
            // Dedupe-Tabelle laden
            let notified = {};
            try { notified = JSON.parse(await AsyncStorage.getItem(NOTIFIED_RECENT_KEY)) || {}; } catch {}
            if (notified[id] && now - Number(notified[id]) < NOTIFY_DEDUP_WINDOW_MS) {
              console.log('[GEOFENCE] local notif skipped (dedupe) for', id);
            } else {
              // Metadaten laden
              let metaMap = {};
              try { metaMap = JSON.parse(await AsyncStorage.getItem(GEOFENCE_META_KEY)) || {}; } catch {}
              const meta = metaMap[id] || {};
              const title = meta.title || 'Angebot in deiner Nähe';
              const body  = meta.body  || 'Tippe, um Details zu sehen';

              // Nur eine Kategorie mit EINER Aktion "GO"
              try {
                await Notifications.setNotificationCategoryAsync('offer-go', [
                  { identifier: 'GO', buttonTitle: 'Öffnen', options: { isDestructive: false, isAuthenticationRequired: false } },
                ]);
              } catch {}

              // Sofort anzeigen (lokal)
              await Notifications.scheduleNotificationAsync({
                content: {
                  title,
                  body,
                  sound: 'default',
                  categoryIdentifier: 'offer-go', // ← nur GO
                  data: { offerId: id, localFallback: true },
                  channelId: 'offers',
                },
                trigger: null,
              });
              console.log('[GEOFENCE] local fallback notification shown for', id);

              // Dedupe aktualisieren
              notified[id] = now;
              for (const k of Object.keys(notified)) {
                if (now - Number(notified[k]) > 6 * 60 * 60 * 1000) delete notified[k];
              }
              await AsyncStorage.setItem(NOTIFIED_RECENT_KEY, JSON.stringify(notified));
            }
          } catch (e) {
            console.log('[GEOFENCE] local fallback error', e?.message || e);
          }

          // 2) Backend informieren – FIRE-AND-FORGET (kein await)
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

          // 3) Heartbeat (nice-to-have)
          try {
            if (token && pos?.coords) await postHeartbeat(token, pos.coords, 'Geofence-Enter');
          } catch {}
        } catch (e) {
          console.log('[GEOFENCE] enter-getCurrentPosition error', e?.message || e);
        }
      } else if (eventType === Location.GeofencingEventType.Exit) {
        // Beim Verlassen des Radius: Dedupe + Lock für diese offerId löschen,
        // damit ein späterer Re-Enter wieder eine Notification auslösen kann.
        try {
          const id = String(region?.identifier || '');
          if (id) {
            // Dedupe
            let notified = {};
            try { notified = JSON.parse(await AsyncStorage.getItem(NOTIFIED_RECENT_KEY)) || {}; } catch {}
            if (notified[id]) {
              delete notified[id];
              await AsyncStorage.setItem(NOTIFIED_RECENT_KEY, JSON.stringify(notified));
              console.log('[GEOFENCE] exit -> dedupe cleared for', id);
            } else {
              console.log('[GEOFENCE] exit -> no dedupe entry for', id);
            }

            // Lock
            let locks = {};
            try { locks = JSON.parse(await AsyncStorage.getItem(ENTER_LOCK_KEY)) || {}; } catch {}
            if (locks[id]) {
              delete locks[id];
              await AsyncStorage.setItem(ENTER_LOCK_KEY, JSON.stringify(locks));
              console.log('[GEOFENCE] exit -> lock cleared for', id);
            } else {
              console.log('[GEOFENCE] exit -> no lock entry for', id);
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
    // 1) Aktuelle Position
    let me = await Location.getLastKnownPositionAsync();
    if (!me) {
      me = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, mayShowUserSettingsDialog: false });
    }

    // 2) Offers mit Provider laden
    const res = await fetch(OFFERS_ENDPOINT, { method: 'GET' });
    const list = await res.json().catch(() => []);
    if (!Array.isArray(list) || list.length === 0) {
      console.log('[GEOFENCE] no offers received');
      return;
    }

    // 3) Regionen + Metadaten bauen
    const regions = [];
    const metas = {}; // id -> {title, body}

    for (const o of list) {
      const p = o?.provider;
      const coords = p?.location?.coordinates;
      if (!coords || coords.length !== 2) continue;
      const [lng, lat] = coords;
      const radius = Number(p?.radiusMeters || GEOFENCE_RADIUS_DEFAULT);
      const id = String(o._id || `${lat},${lng},${radius}`);

      regions.push({
        identifier: id,
        latitude: lat,
        longitude: lng,
        radius: Math.min(Math.max(radius, 50), 1000), // clamp 50..1000m
        notifyOnEnter: true,
        notifyOnExit: false,
      });

      const title = o?.name || p?.name || 'Angebot in deiner Nähe';
      const cat = o?.subcategory ? `${o.category} · ${o.subcategory}` : (o?.category || '');
      const body = cat || (p?.name ? `Bei ${p.name}` : 'Jetzt ansehen');
      metas[id] = { title, body };
    }

    // 4) Sortieren nach Distanz & begrenzen
    if (me?.coords) {
      const { latitude: myLat, longitude: myLng } = me.coords;
      const dist = (lat1, lng1, lat2, lng2) => {
        const R = 6371000, toR = (d)=> d*Math.PI/180;
        const dLat = toR(lat2 - lat1), dLng = toR(lng2 - lng1);
        const A = Math.sin(dLat/2)**2 + Math.cos(toR(lat1))*Math.cos(toR(lat2))*Math.sin(dLng/2)**2;
        return 2*R*Math.asin(Math.sqrt(A));
      };
      regions.sort((a, b) => dist(myLat, myLng, a.latitude, a.longitude) - dist(myLat, myLng, b.latitude, b.longitude));
    }
    const top = regions.slice(0, GEOFENCE_MAX);

    // 4b) Metadaten auf „top“ zuschneiden & speichern
    const metasTop = {};
    for (const r of top) metasTop[r.identifier] = metas[r.identifier];
    try { await AsyncStorage.setItem(GEOFENCE_META_KEY, JSON.stringify(metasTop)); } catch {}

    // 5) Starten/neu setzen
    const isRunning = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
    if (isRunning) {
      await Location.stopGeofencingAsync(GEOFENCE_TASK).catch(() => {});
    }
    await Location.startGeofencingAsync(GEOFENCE_TASK, top);
    console.log('[GEOFENCE] registered regions =', top.length);
  } catch (e) {
    console.log('[GEOFENCE] refresh error', e?.message || e);
  }
}

/* ---------- Component Bootstrapping ---------- */
export default function PushInitializer() {
  const initDone = useRef(false);

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

        // Nur eine Kategorie mit EINER Aktion "GO" (idempotent)
        try {
          await Notifications.setNotificationCategoryAsync('offer-go', [
            { identifier: 'GO', buttonTitle: 'Öffnen', options: { isDestructive: false, isAuthenticationRequired: false } },
          ]);
        } catch {}

        // Token VOR allem anderen sicherstellen
        const token = await getStoredOrFetchExpoToken();

        // Standort-Berechtigungen
        const fg = await Location.requestForegroundPermissionsAsync();
        const bg = await Location.requestBackgroundPermissionsAsync();
        console.log('[BGLOC] permissions', { fg: fg.status, bg: bg.status });
        if (fg.status !== 'granted' || bg.status !== 'granted') {
          console.log('[BGLOC] Missing location permissions -> abort start');
          return;
        }

        // Kickstart (letzte/aktuelle Position)
        try {
          let pos = await Location.getLastKnownPositionAsync();
          if (!pos) {
            pos = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
              mayShowUserSettingsDialog: false,
            });
          }
          if (pos?.coords && token) {
            await postHeartbeat(token, pos.coords, 'Kickstart');
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

        // Geofences
        await refreshGeofences();
      } catch (e) {
        console.log('[BGLOC] init error', e?.message || e);
      }
    })();
  }, []);

  return null;
}
