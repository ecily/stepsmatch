// stepsmatch/mobile/app/(tabs)/index.js
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { sendHeartbeat } from '../../components/PushInitializer'; // ✅ zentraler Heartbeat
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  ScrollView,
  RefreshControl,
  AppState,
  Animated,
  Easing,
  Platform,
  InteractionManager,
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import colors from '../../theme/colors';
import { isOfferActiveNow } from '../../utils/isOfferActiveNow'; // ✅ zentraler Helper (Europe/Vienna)

const API_URL = 'https://lobster-app-ie9a5.ondigitalocean.app/api';
const CATEGORY_ID = 'offers-actions'; // 🔔 Actions: ➡️ / ❌ / 💤

/* ─────────── PUSH: Handler (zeigt Banner auch im Vordergrund) ─────────── */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/* ─────────── PUSH: Setup (Channels + Permission + Token + Kategorie) ─────────── */
async function ensurePushReady() {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
        showBadge: true,
      });
      await Notifications.setNotificationChannelAsync('offers', {
        name: 'Offers',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
        showBadge: true,
      });
    }

    await Notifications.setNotificationCategoryAsync(CATEGORY_ID, [
      { identifier: 'go', buttonTitle: '➡️', options: { isDestructive: false, isAuthenticationRequired: false } },
      { identifier: 'dismiss', buttonTitle: '❌', options: { isDestructive: true, isAuthenticationRequired: false } },
      { identifier: 'snooze', buttonTitle: '💤', options: { isDestructive: false, isAuthenticationRequired: false } },
    ]);

    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) {
      const req = await Notifications.requestPermissionsAsync();
      if (!req.granted) {
        console.log('[Push] permission not granted');
        return null;
      }
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId ??
      null;

    const tokenResp = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const token = tokenResp?.data || null;

    if (token) {
      const old = await AsyncStorage.getItem('expoPushToken');
      if (old !== token) await AsyncStorage.setItem('expoPushToken', token);
      console.log('[Push] Expo token', token);
    } else {
      console.log('[Push] no token received');
    }

    return token;
  } catch (e) {
    console.log('[Push] setup error', e?.message || e);
    return null;
  }
}

/* ───────────── Helpers ───────────── */

function withTimeout(promise, ms, label = 'operation') {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => (timer = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms))),
  ]).finally(() => clearTimeout(timer));
}

const api = axios.create({ baseURL: API_URL, timeout: 12000 });

function groupByCategory(list) {
  const m = {};
  for (const o of list) {
    const cat = o.category || 'Andere';
    if (!m[cat]) m[cat] = [];
    m[cat].push(o);
  }
  return m;
}

function toNumber(val) {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
  }
  return null;
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function formatDistance(metersLike) {
  const meters = toNumber(metersLike);
  if (meters == null) return null;
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

function isNear(metersLike) {
  const m = toNumber(metersLike);
  return m != null && m <= 500;
}

/* ───────────── Filter-Helfer ───────────── */

const normalizeToken = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\s+/g, ' ')
    .trim();

function csvToSet(csv) {
  if (!csv) return new Set();
  return new Set(csv.split(',').map(normalizeToken).filter(Boolean));
}

function matchesInterests(offer, interestSet) {
  if (!interestSet || interestSet.size === 0) return true;
  const cat = normalizeToken(offer?.category);
  const sub = normalizeToken(offer?.subcategory);
  const name = normalizeToken(offer?.name);
  for (const t of interestSet) {
    if (!t) continue;
    if (
      (cat && (cat === t || cat.includes(t))) ||
      (sub && (sub === t || sub.includes(t))) ||
      (name && name.includes(t))
    ) {
      return true;
    }
  }
  return false;
}

function pickOfferLatLng(item) {
  const coords =
    item?.location?.coordinates ||
    item?.provider?.location?.coordinates ||
    null;
  if (Array.isArray(coords) && coords.length >= 2) {
    const [lng, lat] = coords;
    const latN = Number(lat), lngN = Number(lng);
    if (Number.isFinite(latN) && Number.isFinite(lngN)) return { lat: latN, lng: lngN };
  }
  return null;
}

function pickRadiusMeters(item) {
  const r1 = toNumber(item?.radius);
  if (r1 != null && isFinite(r1) && r1 >= 0) return r1;
  const r2 = toNumber(item?.provider?.radius);
  if (r2 != null && isFinite(r2) && r2 >= 0) return r2;
  return null;
}

/* ─────────── Datums-/Zeit-Parsing ─────────── */
function startOfDayLocal(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0); }
function endOfDayLocal(d)   { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999); }

function parseDateLike(x, role /* 'from' | 'to' */) {
  if (!x) return null;
  if (x instanceof Date) return isNaN(x) ? null : x;
  if (typeof x === 'number') { const d = new Date(x); return isNaN(d) ? null : d; }
  const s = String(x).trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (dateOnly) {
    const y = Number(dateOnly[1]), m = Number(dateOnly[2]) - 1, d = Number(dateOnly[3]);
    const base = new Date(y, m, d);
    return role === 'to' ? endOfDayLocal(base) : startOfDayLocal(base);
  }
  const d = new Date(s);
  if (isNaN(d)) return null;

  // Falls Server "Z-Mitternacht" liefert → als lokaler Tag interpretieren
  const isZMidnight = /T00:00:00(\.000)?Z$/.test(s);
  if (isZMidnight) {
    const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
    const local = new Date(y, m, day);
    return role === 'to' ? endOfDayLocal(local) : startOfDayLocal(local);
  }
  return d;
}

// HH:mm[:ss] → Sekunden seit Mitternacht
function parseHM(x) {
  if (!x) return null;
  const m = String(x).trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]), s = Number(m[3] || 0);
  if (h < 0 || h > 23 || min < 0 || min > 59 || s < 0 || s > 59) return null;
  return h * 3600 + min * 60 + s;
}

/* ─────────── Endzeit/Restlaufzeit (nutzt zentralen Aktiv-Check) ─────────── */
function pickOfferEndDate(item) {
  if (!item || typeof item !== 'object') return null;
  const directKeys = [
    'activeUntil','activeEnd','validUntil','endAt',
    'validTo','dateTo','activeWindowEnd','endTime',
    'expiresAt','expiry','until'
  ];
  for (const k of directKeys) {
    const v = item?.[k];
    const d = parseDateLike(v, 'to');
    if (d) return d;
  }
  const vd = item?.validDates || item?.dates || null;
  if (vd && typeof vd === 'object') {
    const toRaw = vd.to ?? vd.end ?? vd.toDate ?? vd.endDate;
    const d = parseDateLike(toRaw, 'to');
    if (d) return d;
  }
  return null;
}

function getRemainingMs(item, now = new Date()) {
  const hardEnd = pickOfferEndDate(item);
  if (hardEnd) {
    const diff = hardEnd.getTime() - now.getTime();
    if (diff > 0) return diff;
    return null;
  }
  const vt = item?.validTimes || item?.times || null;
  if (vt && typeof vt === 'object') {
    const fromS = parseHM(vt.from ?? vt.start ?? vt.fromTime);
    const toS   = parseHM(vt.to   ?? vt.end   ?? vt.toTime);
    if (toS != null) {
      const nowS = now.getHours()*3600 + now.getMinutes()*60 + now.getSeconds();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      if (fromS != null && fromS > toS) {
        const endBase = (nowS >= fromS)
          ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0)
          : todayStart;
        const end = new Date(endBase.getTime() + toS * 1000);
        const diff = end.getTime() - now.getTime();
        return diff > 0 ? diff : null;
      } else {
        const end = new Date(todayStart.getTime() + toS * 1000);
        const diff = end.getTime() - now.getTime();
        return diff > 0 ? diff : null;
      }
    }
  }
  // Fallback: solange aktiv → bis Tagesende anzeigen
  if (isOfferActiveNow(item, 'Europe/Vienna', now)) {
    const end = endOfDayLocal(now);
    const diff = end.getTime() - now.getTime();
    return diff > 0 ? diff : null;
  }
  return null;
}

function formatRemaining(diffMs) {
  if (diffMs == null) return 'Rest: —';
  const totalMin = Math.ceil(diffMs / 60000);
  if (totalMin <= 0) return 'Rest: —';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `Rest: ${m}\u00A0min`;
  if (m === 0) return `Rest: ${h}\u00A0h`;
  return `Rest: ${h}\u00A0h ${m}\u00A0min`;
}

/* ───────────── Screen ───────────── */

export default function HomeTab() {
  const router = useRouter();

  // Data
  const [offers, setOffers] = useState([]);
  const [grouped, setGrouped] = useState({});
  // Paging
  const [page, setPage] = useState(1);
  const [limit] = useState(200);
  const [hasMore, setHasMore] = useState(false);
  // Loading
  const [initialLoading, setInitialLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // Error/Info
  const [err, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  // Location
  const [userLoc, setUserLoc] = useState(null);

  // Dev-Banner
  const [devMsg, setDevMsg] = useState(null);
  const showDev = useCallback((msg) => {
    setDevMsg(String(msg || ''));
    setTimeout(() => setDevMsg(null), 3500);
  }, []);

  // Refs
  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);
  const abortRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const heartbeatTimerRef = useRef(null);
  const lastFocusAtRef = useRef(0);
  const appState = useRef(AppState.currentState);
  const lastTokenRef = useRef(null);

  const fetchFnRef = useRef(null);

  // Dedupe & Helper für Notif-Navigation
  const lastHandledNotifIdRef = useRef(null);

  const navigateFromNotifData = useCallback((originLabel, data) => {
    try {
      const d = data || {};
      const offerId = d.offerId || d?.offer?.id || d?.id;
      const link = d.link || d.url;

      if (offerId) {
        console.log('[NotifNav]', originLabel, '→ /offers/', offerId);
        InteractionManager.runAfterInteractions(() => {
          router.push({ pathname: '/offers/[id]', params: { id: String(offerId) } });
        });
        return true;
      }
      if (typeof link === 'string' && link.length > 0) {
        console.log('[NotifNav]', originLabel, '→', link);
        InteractionManager.runAfterInteractions(() => router.push(link));
        return true;
      }

      console.log('[NotifNav] Kein offerId/link im Payload:', d);
      return false;
    } catch (e) {
      console.warn('[NotifNav] Fehler beim Navigieren:', e);
      return false;
    }
  }, [router]);

  // ⬇️ lokaler Heartbeat-Helper entfernt – zentraler `sendHeartbeat` wird importiert

  /* PUSH: Setup */
  useEffect(() => {
    (async () => {
      const token = await ensurePushReady();
      if (!token) {
        if (__DEV__) showDev('Push nicht bereit (Permissions/Token/Channel prüfen).');
        return;
      }
      lastTokenRef.current = token;
      await sendHeartbeat(token);
    })();
  }, [showDev]);

  /* Notif-Response Listener */
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(async (response) => {
      try {
        const notifId = response?.notification?.request?.identifier;
        if (notifId && lastHandledNotifIdRef.current === notifId) return;
        lastHandledNotifIdRef.current = notifId ?? lastHandledNotifIdRef.current;

        const actionId = response?.actionIdentifier;
        const data = response?.notification?.request?.content?.data || {};
        const offerId = String(data?.offerId || '');

        if (!actionId || actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) {
          navigateFromNotifData('tap-live', data);
          return;
        }

        let action = null;
        if (actionId === 'go') action = 'go';
        else if (actionId === 'dismiss') action = 'dismiss';
        else if (actionId === 'snooze') action = 'snooze';

        if (action && offerId) {
          const token = await AsyncStorage.getItem('expoPushToken');
          if (token) {
            try { await api.post('/location/notify-action', { offerId, action, token }); }
            catch (e) { console.log('[notify-action] error', e?.message || e); }
          }
          if (action === 'go') navigateFromNotifData('tap-action-go', data);
        }
      } catch (e) {
        console.log('[Push] response listener error', e?.message || e);
      }
    });

    return () => { try { sub?.remove?.(); } catch {} };
  }, [navigateFromNotifData]);

  /* Cold-Start Navigation */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resp = await Notifications.getLastNotificationResponseAsync();
        if (!mounted || !resp) return;

        const notifId = resp?.notification?.request?.identifier;
        if (notifId && lastHandledNotifIdRef.current === notifId) return;
        lastHandledNotifIdRef.current = notifId ?? lastHandledNotifIdRef.current;

        const actionId = resp?.actionIdentifier;
        const data = resp?.notification?.request?.content?.data || {};

        if (!actionId || actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) {
          navigateFromNotifData('tap-cold-start', data);
          return;
        }
        if (actionId === 'go') navigateFromNotifData('tap-cold-start-action-go', data);
      } catch (e) {
        console.warn('[NotifNav] getLastNotificationResponseAsync Fehler:', e);
      }
    })();
    return () => { mounted = false; };
  }, [navigateFromNotifData]);

  /* Gesehen-IDs */
  const SEEN_IDS_KEY = 'seenOfferIds_v1';
  const BASELINE_ON_FIRST_LOAD = false;
  const MAX_POSTS_PER_RELOAD = 1;

  const seenIdsRef = useRef(new Set());
  const baselineAppliedRef = useRef(BASELINE_ON_FIRST_LOAD);

  const loadSeenIds = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(SEEN_IDS_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        seenIdsRef.current = new Set(arr.filter((x) => typeof x === 'string'));
      }
    } catch {}
  }, []);

  const saveSeenIds = useCallback(async () => {
    try {
      await AsyncStorage.setItem(SEEN_IDS_KEY, JSON.stringify(Array.from(seenIdsRef.current)));
    } catch {}
  }, []);

  const interestsCSVFromStorage = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('userInterests');
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr) && arr.length) return arr.join(',');
    } catch {}
    return '';
  }, []);

  const getLocation = useCallback(async () => {
    const { status } = await withTimeout(Location.requestForegroundPermissionsAsync(), 5000, 'location permission');
    if (status !== 'granted') throw new Error('Location permission denied');

    let pos = await Location.getLastKnownPositionAsync();
    if (!pos) {
      pos = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        7000,
        'getCurrentPosition'
      );
    }
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  }, []);

  // Fetch
  const fetchPage = useCallback(
    async ({ pageToLoad = 1, mode = 'initial' } = {}) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      if (abortRef.current) { try { abortRef.current.abort(); } catch {} }
      const controller = new AbortController();
      abortRef.current = controller;

      if (mode === 'initial' && !hasLoadedOnce) { setInitialLoading(true); setError(null); }
      if (mode === 'pull') { setRefreshing(true); setError(null); }
      if (mode === 'more') { setLoadingMore(true); }

      let postsThisReload = 0;

      try {
        if (!baselineAppliedRef.current) { await loadSeenIds(); }

        const [interestsCSV, loc] = await Promise.all([interestsCSVFromStorage(), getLocation()]);
        setUserLoc(loc);
        const interestSet = csvToSet(interestsCSV);

        let expoToken = null;
        try { expoToken = await AsyncStorage.getItem('expoPushToken'); } catch {}

        const params = { withProvider: 1, page: pageToLoad, limit };
        const t0 = performance.now();
        const res = await api.get('/offers', { params, signal: controller.signal });
        const t1 = performance.now();

        const payload = res?.data ?? {};
        let rows = [];
        if (Array.isArray(payload)) rows = payload;
        else if (Array.isArray(payload.data)) rows = payload.data;
        else if (Array.isArray(payload.offers)) rows = payload.offers;
        else if (Array.isArray(payload.items)) rows = payload.items;
        else if (Array.isArray(payload.results)) rows = payload.results;
        else if (payload?.data && Array.isArray(payload.data.data)) rows = payload.data.data;

        const serverHasMore =
          !!(payload?.hasMore ??
             payload?.data?.hasMore ??
             payload?.pagination?.hasMore ??
             (payload?.nextPage != null) ??
             (rows.length === limit));

        const now = new Date();
        const filtered = [];
        const newlySeenThisRun = [];

        for (const o of rows) {
          if (!matchesInterests(o, interestSet)) continue;
          // ✅ zentraler Aktivitäts-Check mit fixer TZ
          if (!isOfferActiveNow(o, 'Europe/Vienna', now)) continue;

          const geo = pickOfferLatLng(o);
          const radiusM = pickRadiusMeters(o);
          if (!geo || !Number.isFinite(radiusM)) continue;

          const distanceM =
            toNumber(o.distance) ?? haversineMeters(loc.lat, loc.lng, geo.lat, geo.lng);
          const inside = distanceM <= radiusM;

          if (inside) {
            filtered.push(o);

            // Push-Trigger: „neu gesehen“ in diesem Client → Backend informiert (das pusht weiter)
            if (expoToken && postsThisReload < MAX_POSTS_PER_RELOAD) {
              const id = String(o._id || '');
              const seenSet = seenIdsRef.current;
              const isNew = id && !seenSet.has(id);

              if (isNew) {
                seenSet.add(id);
                newlySeenThisRun.push(id);

                api.post('/location/geofence-enter', {
                  offerId: o._id,
                  lat: loc.lat,
                  lng: loc.lng,
                  token: expoToken,
                  platform: Platform.OS === 'ios' ? 'ios' : 'android',
                  eventType: 'enter',
                  channelId: 'offers',
                }).catch(() => {});

                postsThisReload += 1;
              }
            }
          }
        }

        filtered.sort((a, b) => {
          const pa = pickOfferLatLng(a);
          const pb = pickOfferLatLng(b);
          const da = toNumber(a.distance) ?? (pa ? haversineMeters(loc.lat, loc.lng, pa.lat, pa.lng) : Infinity);
          const db = toNumber(b.distance) ?? (pb ? haversineMeters(loc.lat, loc.lng, pb.lat, pb.lng) : Infinity);
          return da - db;
        });

        if (!mountedRef.current) return;
        setLastUpdated(new Date());
        setHasMore(serverHasMore);
        setPage(pageToLoad);

        if (pageToLoad === 1) {
          setOffers(() => {
            setGrouped(groupByCategory(filtered));
            return filtered;
          });
        } else {
          setOffers(prev => {
            const merged = [...prev, ...filtered];
            setGrouped(groupByCategory(merged));
            return merged;
          });
        }

        if (!hasLoadedOnce) setHasLoadedOnce(true);

        console.log(`[HomeTab] GET /offers p=${pageToLoad} n=${rows.length} kept=${filtered.length} hasMore=${serverHasMore} net=${(t1 - t0).toFixed(0)}ms`);
        if (newlySeenThisRun.length > 0) { await saveSeenIds(); }
      } catch (e) {
        if (mountedRef.current) {
          const msg = e?.message?.includes('timeout')
            ? 'Zeitüberschreitung – bitte erneut versuchen.'
            : 'Fehler beim Laden der Angebote.';
          setError(msg);
          console.warn('[HomeTab] fetch error:', e?.message || e);
        }
      } finally {
        inFlightRef.current = false;
        if (!mountedRef.current) return;
        if (mode === 'initial' && !hasLoadedOnce) setInitialLoading(false);
        if (mode === 'pull') setRefreshing(false);
        if (mode === 'more') setLoadingMore(false);
      }
    },
    [limit, interestsCSVFromStorage, getLocation, hasLoadedOnce, loadSeenIds, saveSeenIds]
  );

  useEffect(() => { fetchFnRef.current = fetchPage; }, [fetchPage]);

  // Initial load
  useEffect(() => {
    mountedRef.current = true;
    fetchFnRef.current?.({ pageToLoad: 1, mode: 'initial' });
    return () => {
      mountedRef.current = false;
      if (abortRef.current) try { abortRef.current.abort(); } catch {}
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    };
  }, []);

  const onRefresh = useCallback(() => {
    fetchFnRef.current?.({ pageToLoad: 1, mode: 'pull' });
  }, []);

  useEffect(() => {
    const handleAppState = async (next) => {
      const prev = appState.current;
      appState.current = next;
      if (prev?.match(/inactive|background/) && next === 'active') {
        const now = Date.now();
        if (now - lastFocusAtRef.current > 5000) {
          lastFocusAtRef.current = now;
          if (lastTokenRef.current) await sendHeartbeat(lastTokenRef.current);
          fetchFnRef.current?.({ pageToLoad: 1, mode: 'auto' });
        }
      }
    };
    const sub = AppState.addEventListener('change', handleAppState);

    // Auto-Refresh
    refreshTimerRef.current = setInterval(() => {
      fetchFnRef.current?.({ pageToLoad: 1, mode: 'auto' });
    }, 180000);

    // Heartbeat alle 10 Min
    //heartbeatTimerRef.current = setInterval(() => {
    //  if (lastTokenRef.current) sendHeartbeat(lastTokenRef.current);
    //}, 600000);

    return () => {
      sub.remove();
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    };
  }, []);

  /* UI */

  const groupedEntries = useMemo(() => Object.entries(grouped), [grouped]);

  if (!hasLoadedOnce && initialLoading) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.categoryContainer}>
          <SkeletonSection titleWidth={140} />
          <SkeletonSection titleWidth={120} />
          <SkeletonSection titleWidth={160} />
        </ScrollView>
        {__DEV__ && devMsg ? <DevBanner msg={devMsg} onClose={() => setDevMsg(null)} /> : null}
      </View>
    );
  }

  if (err && !hasLoadedOnce) {
    return (
      <View style={styles.containerCenter}>
        <Text style={styles.error}>{err}</Text>
        <TouchableOpacity
          onPress={() => fetchFnRef.current?.({ pageToLoad: 1, mode: 'pull' })}
          style={[styles.card, { marginTop: 16, paddingVertical: 12, width: 220, alignItems: 'center' }]}
          activeOpacity={0.9}
        >
          <Text style={{ color: colors.primary, fontWeight: '700' }}>Erneut versuchen</Text>
        </TouchableOpacity>
        {__DEV__ && devMsg ? <DevBanner msg={devMsg} onClose={() => setDevMsg(null)} /> : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.categoryContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {lastUpdated && <Text style={styles.updatedHint}>Aktualisiert: {lastUpdated.toLocaleTimeString()}</Text>}

        {groupedEntries.length === 0 ? (
          <Text style={styles.empty}>Zurzeit leider keine passenden Angebote in deiner Nähe!</Text>
        ) : (
          groupedEntries.map(([category, catOffers]) => (
            <View key={category} style={styles.categoryBlock}>
              <Text style={styles.categoryTitle}>{category}</Text>
              <FlatList
                data={catOffers}
                keyExtractor={(it) => it._id}
                renderItem={({ item, index }) => (
                  <AnimatedOfferCard
                    item={item}
                    index={index}
                    userLoc={userLoc}
                    onPress={() => {
                      try {
                        const geo = pickOfferLatLng(item);
                        const distanceMeters =
                          toNumber(item.distance) ??
                          (userLoc && geo ? haversineMeters(userLoc.lat, userLoc.lng, geo.lat, geo.lng) : null);
                        const heroImage = (Array.isArray(item.images) && item.images.length > 0) ? item.images[0] : '';
                        router.push({
                          pathname: `/offers/${item._id}`,
                          params: {
                            id: item._id,
                            name: item.name || '',
                            image: heroImage || '',
                            distance: distanceMeters != null ? String(Math.round(distanceMeters)) : '',
                          },
                        });
                      } catch {
                        router.push(`/offers/${item._id}`);
                      }
                    }}
                  />
                )}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalList}
                style={{ marginBottom: 26 }}
              />
            </View>
          ))
        )}

        {hasMore && (
          <View style={{ alignItems: 'center', marginTop: 4 }}>
            {loadingMore ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <TouchableOpacity
                style={styles.loadMoreBtn}
                onPress={() => fetchFnRef.current?.({ pageToLoad: page + 1, mode: 'more' })}
                activeOpacity={0.9}
              >
                <Text style={styles.loadMoreText}>Mehr laden</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {__DEV__ && devMsg ? <DevBanner msg={devMsg} onClose={() => setDevMsg(null)} /> : null}
    </View>
  );
}

/* ───────────── Card ───────────── */

function AnimatedOfferCard({ item, index, onPress, userLoc }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(6)).current;

  useEffect(() => {
    const delay = Math.min(index * 50, 250);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 200, delay, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 200, delay, useNativeDriver: true }),
    ]).start();
  }, [index, opacity, translateY]);

  let distanceMeters = toNumber(item.distance);
  if (distanceMeters == null && userLoc && item?.location?.coordinates?.length === 2) {
    const [lng, lat] = item.location.coordinates;
    distanceMeters = haversineMeters(userLoc.lat, userLoc.lng, lat, lng);
  }
  const distanceText = formatDistance(distanceMeters);
  const near = isNear(distanceMeters);

  // ✅ echtes Aktiv-Flag (Europe/Vienna)
  const isActiveNowFlag = isOfferActiveNow(item, 'Europe/Vienna', new Date());

  const remainingMs = getRemainingMs(item);
  const remainingLabel = formatRemaining(remainingMs);
  const hurry = remainingMs != null && remainingMs <= 60 * 60 * 1000;

  const imgs = (item.images || []).slice(0, 3);
  while (imgs.length < 3) imgs.push(null);

  return (
    <Animated.View style={[styles.card, { opacity, transform: [{ translateY }], overflow: 'hidden' }]}>
      <TouchableOpacity style={{ flex: 1 }} onPress={onPress} activeOpacity={0.9}>
        <View style={styles.badgeRow}>
          {isActiveNowFlag && (
            <View style={[styles.badge, styles.badgeNow]}>
              <Text style={styles.badgeText}>Jetzt gültig</Text>
            </View>
          )}
          <View style={[styles.badge, styles.badgeRest]}>
            <Text style={[styles.badgeText, { color: '#7c2d12' }]}>{remainingLabel}</Text>
          </View>
          <View style={[styles.badge, styles.badgeDistance]}>
            <Text style={[styles.badgeText, { color: '#0f172a' }]}>{distanceText ?? '—'}</Text>
          </View>
          {near && (
            <View style={[styles.badge, styles.badgeNear]}>
              <Text style={styles.badgeText}>In der Nähe</Text>
            </View>
          )}
          {!!item.category && (
            <View style={[styles.badge, styles.badgeCategory]}>
              <Text style={[styles.badgeText, { color: '#374151' }]} numberOfLines={1}>
                {item.subcategory ? `${item.category} · ${item.subcategory}` : item.category}
              </Text>
            </View>
          )}
        </View>

        {hurry && <Text style={styles.hurryText}>Beeilung! Läuft bald aus!</Text>}

        <Text style={styles.title} numberOfLines={2}>{item.name}</Text>

        {!!item.description && (
          <Text style={styles.desc} numberOfLines={3}>{item.description}</Text>
        )}

        <View style={styles.imagesRow}>
          {imgs.map((src, i) =>
            src ? (
              <Image key={i} source={{ uri: src }} style={styles.offerImage} />
            ) : (
              <View key={i} style={styles.offerImageTransparent} />
            )
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

/* ───────────── Dev-Banner & Skeletons & Styles ───────────── */

function DevBanner({ msg, onClose }) {
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onClose} style={styles.devBannerWrap}>
      <Text style={styles.devBannerText} numberOfLines={3}>{msg}</Text>
    </TouchableOpacity>
  );
}

function SkeletonCard() {
  return (
    <View style={[styles.card, { overflow: 'hidden' }]}>
      <View style={[styles.skel, { width: 80, height: 12, marginBottom: 10 }]} />
      <View style={[styles.skel, { width: 160, height: 16, marginBottom: 8 }]} />
      <View style={[styles.skel, { width: 200, height: 12, marginBottom: 12 }]} />
      <View style={{ flexDirection: 'row', marginTop: 8 }}>
        <View style={styles.skelImg} />
        <View style={styles.skelImg} />
        <View style={styles.skelImg} />
      </View>
    </View>
  );
}

function SkeletonSection({ titleWidth = 140 }) {
  return (
    <View style={styles.categoryBlock}>
      <View style={[styles.skel, { width: titleWidth, height: 20, marginBottom: 12 }]} />
      <FlatList
        data={[1, 2, 3, 4]}
        keyExtractor={(i) => `skel-${i}`}
        renderItem={() => <SkeletonCard />}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalList}
        style={{ marginBottom: 26 }}
      />
    </View>
  );
}

const CARD_WIDTH = 260;
const CARD_MIN_HEIGHT = 216;
const IMAGE_MARGIN = 8;
const IMAGE_WIDTH = 70;
const IMAGE_HEIGHT = 54;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  categoryContainer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 },
  containerCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  categoryBlock: { marginBottom: 8 },
  categoryTitle: { fontSize: 20, fontWeight: '700', color: '#1f2937', marginBottom: 10 },

  horizontalList: { paddingLeft: 2, paddingRight: 2 },

  updatedHint: { color: '#6b7280', fontSize: 12, marginBottom: 8 },

  card: {
    backgroundColor: '#f7f8fb',
    borderRadius: 16,
    padding: 16,
    marginRight: 14,
    width: CARD_WIDTH,
    minHeight: CARD_MIN_HEIGHT,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },

  badgeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' },

  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1, marginRight: 6, marginBottom: 6 },
  badgeNear: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
  badgeNow: { backgroundColor: '#eef2ff', borderColor: '#c7d2fe' },
  badgeCategory: { backgroundColor: '#f3f4f6', borderColor: '#e5e7eb' },
  badgeDistance: { backgroundColor: '#e5f0ff', borderColor: '#bfdbfe' },
  badgeRest: { backgroundColor: '#fff7ed', borderColor: '#fed7aa' },

  badgeText: { fontSize: 12, fontWeight: '700', color: '#0f172a' },

  hurryText: { fontSize: 12, color: '#b45309', marginBottom: 4, fontWeight: '600' },

  title: { fontSize: 18, fontWeight: '800', color: colors.primary, marginBottom: 6, lineHeight: 22 },
  desc: { fontSize: 14, color: '#4b5563', marginBottom: 10, lineHeight: 19 },

  imagesRow: {
    flexDirection: 'row',
    marginTop: 6,
    justifyContent: 'flex-start',
    alignItems: 'center',
    minHeight: IMAGE_HEIGHT,
  },
  offerImage: {
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    borderRadius: 10,
    backgroundColor: '#eee',
    marginRight: IMAGE_MARGIN,
  },
  offerImageTransparent: {
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    borderRadius: 10,
    marginRight: IMAGE_MARGIN,
    opacity: 0,
  },

  skel: { backgroundColor: '#e9eef5', borderRadius: 8 },
  skelImg: {
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    borderRadius: 10,
    backgroundColor: '#e9eef5',
    marginRight: IMAGE_MARGIN,
  },

  loadMoreBtn: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#eef2ff',
  },
  loadMoreText: { color: colors.primary, fontWeight: '700' },

  error: { color: 'red', marginTop: 30, textAlign: 'center' },
  empty: { color: '#999', marginTop: 20, textAlign: 'center', fontSize: 16 },

  devBannerWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 16,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#64748b',
    elevation: 6,
  },
  devBannerText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '700',
  },
});
