import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { sendHeartbeat } from '../../components/PushInitializer';
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
  SafeAreaView,
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { isOfferActiveNow } from '../../utils/isOfferActiveNow';

import { useTheme } from '../../theme/ThemeProvider';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { EmptyState } from '../../components/EmptyState';
import { DistanceBadge } from '../../components/DistanceBadge';

import { csvToSet, matchesInterests } from '../../utils/interests';

const API_URL = 'https://lobster-app-ie9a5.ondigitalocean.app/api';

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

/* ─────────── Geo-Helpers (robust) ─────────── */
function pickOfferLatLng(o) {
  try {
    if (o?.location?.coordinates && Array.isArray(o.location.coordinates) && o.location.coordinates.length === 2) {
      const [lng, lat] = o.location.coordinates;
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat: Number(lat), lng: Number(lng) };
    }
    if (o?.provider?.location?.coordinates && Array.isArray(o.provider.location.coordinates) && o.provider.location.coordinates.length === 2) {
      const [lng, lat] = o.provider.location.coordinates;
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat: Number(lat), lng: Number(lng) };
    }
    const lat = toNumber(o?.lat ?? o?.latitude ?? o?.provider?.lat ?? o?.provider?.latitude);
    const lng = toNumber(o?.lng ?? o?.lon ?? o?.longitude ?? o?.provider?.lng ?? o?.provider?.lon ?? o?.provider?.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    return null;
  } catch {
    return null;
  }
}

function pickRadiusMeters(o) {
  const candidates = [
    o?.radiusMeters,
    o?.radius_m,
    o?.radiusM,
    o?.radius,
    o?.range,
    o?.distanceRadius,
    o?.geoRadiusM,
    o?.provider?.radiusMeters,
    o?.provider?.radius_m,
    o?.provider?.radiusM,
    o?.provider?.radius,
  ].map(toNumber);
  for (const v of candidates) {
    if (Number.isFinite(v) && v > 0) return v;
  }
  return 150;
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

  const isZMidnight = /T00:00:00(\.000)?Z$/.test(s);
  if (isZMidnight) {
    const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
    const local = new Date(y, m, day);
    return role === 'to' ? endOfDayLocal(local) : startOfDayLocal(local);
  }
  return d;
}

function parseHM(x) {
  if (!x) return null;
  const m = String(x).trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]), s = Number(m[3] || 0);
  if (h < 0 || h > 23 || min < 0 || min > 59 || s < 0 || s > 59) return null;
  return h * 3600 + min * 60 + s;
}

/* ─────────── Endzeit/Restlaufzeit ─────────── */
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
  const t = useTheme();

  // Data
  const [offers, setOffers] = useState([]);
  const [grouped, setGrouped] = useState({});
  // Paging  (FIX: entfernte, versehentliche Zeile `the`)
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

  const fetchFnRef = useRef(null);

  const navigateFromNotifData = useCallback((originLabel, data) => {
    try {
      const d = data || {};
      const offerId = d.offerId || d?.offer?.id || d?.id;
      const link = d.link || d.url;

      if (offerId) {
        console.log('[NotifNav]', originLabel, '→ /offers/', offerId);
        InteractionManager.runAfterInteractions(() => {
          router.push({ pathname: '/(tabs)/offers/[id]', params: { id: String(offerId) } });
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

  /* Initial HB */
  useEffect(() => {
    (async () => {
      try {
        await sendHeartbeat();
      } catch (e) {
        if (__DEV__) showDev('Heartbeat nicht gesendet.');
      }
    })();
  }, [showDev]);

  /* Push-FG-Refresh */
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((n) => {
      try {
        const data = n?.request?.content?.data || {};
        if (data?.type === 'offer') {
          if (__DEV__) showDev('Neues Angebot – Liste aktualisieren …');
          fetchFnRef.current?.({ pageToLoad: 1, mode: 'push' });
        }
      } catch {}
    });
    return () => { try { sub?.remove?.(); } catch {} };
  }, [showDev]);

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
        try {
          expoToken = (await AsyncStorage.getItem('expoPushToken.v2')) ||
                      (await AsyncStorage.getItem('expoPushToken')) ||
                      null;
        } catch {}

        const params = { withProvider: 1, page: pageToLoad, limit };
        const t0 = (global?.performance && performance.now) ? performance.now() : Date.now();
        const res = await api.get('/offers', { params, signal: controller.signal });
        const t1 = (global?.performance && performance.now) ? performance.now() : Date.now();

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
          if (!isOfferActiveNow(o, 'Europe/Vienna', now)) continue;

          const geo = pickOfferLatLng(o);
          const radiusM = pickRadiusMeters(o);
          if (!geo || !Number.isFinite(radiusM)) continue;

          const distanceM =
            toNumber(o.distance) ?? haversineMeters(loc.lat, loc.lng, geo.lat, geo.lng);
          const inside = distanceM <= radiusM;

          if (inside) {
            filtered.push(o);

            if (expoToken && postsThisReload < 1) {
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
        if (now - (lastFocusAtRef.current || 0) > 5000) {
          lastFocusAtRef.current = now;
          await sendHeartbeat();
          fetchFnRef.current?.({ pageToLoad: 1, mode: 'auto' });
        }
      }
    };
    const sub = AppState.addEventListener('change', handleAppState);

    // Auto-Refresh
    refreshTimerRef.current = setInterval(() => {
      fetchFnRef.current?.({ pageToLoad: 1, mode: 'auto' });
    }, 180000);

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
      <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }}>
        <View style={[styles.container, { backgroundColor: t.colors.background }]}>
          <ScrollView contentContainerStyle={styles.categoryContainer}>
            <SkeletonSection titleWidth={140} />
            <SkeletonSection titleWidth={120} />
            <SkeletonSection titleWidth={160} />
          </ScrollView>
          {__DEV__ && devMsg ? <DevBanner msg={devMsg} onClose={() => setDevMsg(null)} theme={t} /> : null}
        </View>
      </SafeAreaView>
    );
  }

  if (err && !hasLoadedOnce) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }}>
        <View style={[styles.containerCenter, { backgroundColor: t.colors.background }]}>
          <Text style={[styles.error, { color: t.colors.danger }]}>{err}</Text>
          <View style={{ marginTop: 16, width: 220, alignItems: 'center' }}>
            <Button
              title="Erneut versuchen"
              variant="primary"
              size="md"
              onPress={() => fetchFnRef.current?.({ pageToLoad: 1, mode: 'pull' })}
            />
          </View>
          {__DEV__ && devMsg ? <DevBanner msg={devMsg} onClose={() => setDevMsg(null)} theme={t} /> : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }}>
      <View style={[styles.container, { backgroundColor: t.colors.background }]}>
        <ScrollView
          contentContainerStyle={styles.categoryContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {lastUpdated && (
            <Text style={[styles.updatedHint, { color: t.colors.inkLow }]}>
              Aktualisiert: {lastUpdated.toLocaleTimeString()}
            </Text>
          )}

          {groupedEntries.length === 0 ? (
            <EmptyState
              title="Keine Angebote in deiner Nähe"
              subtitle="Passe deine Interessen an oder versuche es später erneut."
              icon="📍"
            />
          ) : (
            groupedEntries.map(([category, catOffers]) => (
              <View key={category} style={styles.categoryBlock}>
                <Text style={[styles.categoryTitle, { color: t.colors.inkHigh }]}>{category}</Text>
                <FlatList
                  data={catOffers}
                  keyExtractor={(it) => it._id}
                  renderItem={({ item, index }) => (
                    <AnimatedOfferCard
                      item={item}
                      index={index}
                      userLoc={userLoc}
                      theme={t}
                      onPress={() => {
                        try {
                          const geo = pickOfferLatLng(item);
                          const distanceMeters =
                            toNumber(item.distance) ??
                            (userLoc && geo ? haversineMeters(userLoc.lat, userLoc.lng, geo.lat, geo.lng) : null);
                          const heroImage = (Array.isArray(item.images) && item.images.length > 0) ? item.images[0] : '';
                          router.push({
                            pathname: '/(tabs)/offers/[id]',
                            params: {
                              id: item._id,
                              name: item.name || '',
                              image: heroImage || '',
                              distance: distanceMeters != null ? String(Math.round(distanceMeters)) : '',
                            },
                          });
                        } catch {
                          router.push({ pathname: '/(tabs)/offers/[id]', params: { id: item._id } });
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
                <ActivityIndicator size="small" color={t.colors.primary} />
              ) : (
                <View style={{ width: 180 }}>
                  <Button
                    title="Mehr laden"
                    variant="secondary"
                    size="md"
                    onPress={() => fetchFnRef.current?.({ pageToLoad: page + 1, mode: 'more' })}
                  />
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {__DEV__ && devMsg ? <DevBanner msg={devMsg} onClose={() => setDevMsg(null)} theme={t} /> : null}
      </View>
    </SafeAreaView>
  );
}

/* ───────────── Card ───────────── */

function AnimatedOfferCard({ item, index, onPress, userLoc, theme }) {
  const t = theme || useTheme();
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

  const isActiveNowFlag = isOfferActiveNow(item, 'Europe/Vienna', new Date());

  const remainingMs = getRemainingMs(item);
  const remainingLabel = formatRemaining(remainingMs);
  const hurry = remainingMs != null && remainingMs <= 60 * 60 * 1000;

  const imgs = (item.images || []).slice(0, 3);
  while (imgs.length < 3) imgs.push(null);

  return (
    <Animated.View
      style={[
        styles.card,
        {
          opacity,
          transform: [{ translateY }],
          overflow: 'hidden',
          backgroundColor: t.colors.card,
          shadowOpacity: t.mode === 'dark' ? 0.25 : 0.08,
        },
      ]}
    >
      <TouchableOpacity style={{ flex: 1 }} onPress={onPress} activeOpacity={0.9}>
        <View style={styles.badgeRow}>
          {isActiveNowFlag && <Badge label="Jetzt gültig" tone="info" style={{ marginRight: 6, marginBottom: 6 }} />}
          <Badge label={remainingLabel} tone="warning" style={{ marginRight: 6, marginBottom: 6 }} />

          <DistanceBadge meters={distanceMeters} style={{ marginRight: 6, marginBottom: 6 }} />

          {near && <Badge label="In der Nähe" tone="success" style={{ marginRight: 6, marginBottom: 6 }} />}
          {!!item.category && (
            <Badge
              label={item.subcategory ? `${item.category} · ${item.subcategory}` : item.category}
              tone="neutral"
              style={{ marginRight: 6, marginBottom: 6 }}
            />
          )}
        </View>

        {hurry && (
          <Text style={[styles.hurryText, { color: t.colors.warning }]}>
            Beeilung! Läuft bald aus!
          </Text>
        )}

        <Text style={[styles.title, { color: t.colors.primary }]} numberOfLines={2}>
          {item.name}
        </Text>

        {!!item.description && (
          <Text style={[styles.desc, { color: t.colors.ink }]} numberOfLines={3}>
            {item.description}
          </Text>
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

function DevBanner({ msg, onClose, theme }) {
  const t = theme || useTheme();
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onClose}
      style={[
        styles.devBannerWrap,
        {
          backgroundColor: t.colors.elevated,
          borderColor: t.colors.divider,
        },
      ]}
    >
      <Text style={[styles.devBannerText, { color: t.colors.inkHigh }]} numberOfLines={3}>
        {msg}
      </Text>
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
  categoryTitle: { fontSize: 20, fontWeight: '700', marginBottom: 10 },

  horizontalList: { paddingLeft: 2, paddingRight: 2 },

  updatedHint: { fontSize: 12, marginBottom: 8 },

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

  hurryText: { fontSize: 12, marginBottom: 4, fontWeight: '600' },

  title: { fontSize: 18, fontWeight: '800', marginBottom: 6, lineHeight: 22 },
  desc: { fontSize: 14, marginBottom: 10, lineHeight: 19 },

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

  error: { marginTop: 30, textAlign: 'center' },
  empty: { marginTop: 20, textAlign: 'center', fontSize: 16 },

  devBannerWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 16,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    elevation: 6,
  },
  devBannerText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
