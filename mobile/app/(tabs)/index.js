import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
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
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import colors from '../../theme/colors';

const API_URL = 'https://lobster-app-ie9a5.ondigitalocean.app/api';

/* ───────────────────────── Helpers ───────────────────────── */

function withTimeout(promise, ms, label = 'operation') {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      (timer = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms))
    ),
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

/* ───────────────────────── Skeletons ─────────────────────── */

function SkeletonCard() {
  return (
    <View style={[styles.card, { overflow: 'hidden' }]}>
      <View style={[styles.skel, { width: 80, height: 12, marginBottom: 8 }]} />
      <View style={[styles.skel, { width: 160, height: 16, marginBottom: 8 }]} />
      <View style={[styles.skel, { width: 200, height: 12, marginBottom: 10 }]} />
      <View style={{ flexDirection: 'row', marginTop: 6 }}>
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
      <View style={[styles.skel, { width: titleWidth, height: 20, marginBottom: 10 }]} />
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

/* ───────────────────────── Screen ───────────────────────── */

export default function HomeTab() {
  const router = useRouter(); // <-- EINMAL hier

  // Data
  const [offers, setOffers] = useState([]);
  const [grouped, setGrouped] = useState({});
  // Paging
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [hasMore, setHasMore] = useState(false);
  // Loading
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // Error/Info
  const [err, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Refs
  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);
  const abortRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const lastFocusAtRef = useRef(0);
  const appState = useRef(AppState.currentState);
  const lastQueryRef = useRef({ lat: null, lng: null, interestsCSV: '' });

  const interestsCSVFromStorage = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('userInterests');
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr) && arr.length) {
        return arr.join(',');
      }
    } catch {}
    return '';
  }, []);

  const getLocation = useCallback(async () => {
    const { status } = await withTimeout(
      Location.requestForegroundPermissionsAsync(),
      5000,
      'location permission'
    );
    if (status !== 'granted') throw new Error('Location permission denied');

    let pos = await Location.getLastKnownPositionAsync();
    if (!pos) {
      pos = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        7000,
        'getCurrentPosition'
      );
    }
    return {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
    };
  }, []);

  const fetchPage = useCallback(
    async ({ pageToLoad = 1, mode = 'initial' } = {}) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      // Abort vorheriger Request
      if (abortRef.current) {
        try {
          abortRef.current.abort();
        } catch {}
      }
      const controller = new AbortController();
      abortRef.current = controller;

      if (mode === 'initial') {
        setInitialLoading(true);
        setError(null);
      }
      if (mode === 'pull') {
        setRefreshing(true);
        setError(null);
      }
      if (mode === 'more') {
        setLoadingMore(true);
      }

      try {
        // 1) Interests + Location parallel ermitteln
        const [interestsCSV, loc] = await Promise.all([
          interestsCSVFromStorage(),
          getLocation(),
        ]);

        // 2) Request auf neue GET /offers mit Geo/Pagination
        const params = {
          lat: loc.lat,
          lng: loc.lng,
          maxDistanceM: 1500,                 // anpassbar
          activeNow: 1,
          withProvider: 1,
          page: pageToLoad,
          limit,
          // Schlanke Felder (distance kommt vom Server, falls geo)
          fields: '_id,name,description,category,subcategory,location,images,provider,distance',
        };
        if (interestsCSV) params.interests = interestsCSV;

        // Perf: Zeit messen
        const t0 = performance.now();
        const res = await api.get('/offers', { params, signal: controller.signal });
        const t1 = performance.now();

        const payload = res?.data || {};
        const newData = Array.isArray(payload.data) ? payload.data : [];
        const serverHasMore = !!payload.hasMore;

        // 3) State aktualisieren
        if (!mountedRef.current) return;

        setLastUpdated(new Date());
        setHasMore(serverHasMore);
        setPage(pageToLoad);

        // Ersetzen vs. Anhängen
        if (pageToLoad === 1) {
          setOffers(newData);
          setGrouped(groupByCategory(newData));
        } else {
          const merged = [...offers, ...newData];
          setOffers(merged);
          setGrouped(groupByCategory(merged));
        }

        // Cache letzte Query (für spätere Vergleiche/Debug)
        lastQueryRef.current = { lat: loc.lat, lng: loc.lng, interestsCSV };

        // Perf Logs
        const netMs = (t1 - t0).toFixed(0);
        console.log(
          `[HomeTab] GET /offers p=${pageToLoad} n=${newData.length} hasMore=${serverHasMore} ` +
          `net=${netMs}ms took=${payload.tookMs ?? '—'}ms`
        );
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
        if (mode === 'initial') setInitialLoading(false);
        if (mode === 'pull') setRefreshing(false);
        if (mode === 'more') setLoadingMore(false);
      }
    },
    [limit, interestsCSVFromStorage, getLocation, offers]
  );

  /* Initial load */
  useEffect(() => {
    mountedRef.current = true;
    fetchPage({ pageToLoad: 1, mode: 'initial' });
    return () => {
      mountedRef.current = false;
      if (abortRef.current) try { abortRef.current.abort(); } catch {}
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [fetchPage]);

  /* Pull-to-Refresh */
  const onRefresh = useCallback(() => {
    fetchPage({ pageToLoad: 1, mode: 'pull' });
  }, [fetchPage]);

  /* Auto-Refresh: App wieder im Vordergrund + Intervall */
  useEffect(() => {
    const handleAppState = (next) => {
      const prev = appState.current;
      appState.current = next;
      if (prev?.match(/inactive|background/) && next === 'active') {
        const now = Date.now();
        if (now - lastFocusAtRef.current > 5000) {
          lastFocusAtRef.current = now;
          fetchPage({ pageToLoad: 1, mode: 'auto' });
        }
      }
    };
    const sub = AppState.addEventListener('change', handleAppState);

    refreshTimerRef.current = setInterval(() => {
      fetchPage({ pageToLoad: 1, mode: 'auto' });
    }, 180000); // alle 3 Minuten

    return () => {
      sub.remove();
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [fetchPage]);

  /* UI */

  const OfferCard = useCallback(({ item }) => {
    const distance =
      typeof item.distance === 'number'
        ? (item.distance < 1000 ? `${Math.round(item.distance)} m` : `${(item.distance / 1000).toFixed(1)} km`)
        : '';

    return (
      <TouchableOpacity style={styles.card} onPress={() => router.push(`/offers/${item._id}`)}>
        {!!distance && <Text style={styles.distanceText}>{distance} entfernt</Text>}
        <Text style={styles.title}>{item.name}</Text>
        {!!item.description && (
          <Text style={styles.desc} numberOfLines={3}>
            {item.description}
          </Text>
        )}
        <View style={styles.imagesRow}>
          {(item.images || []).slice(0, 3).map((src, i) =>
            src ? (
              <Image key={i} source={{ uri: src }} style={styles.offerImage} />
            ) : (
              <View key={i} style={styles.offerImagePlaceholder} />
            )
          )}
        </View>
      </TouchableOpacity>
    );
  }, [router]);

  const groupedEntries = useMemo(() => Object.entries(grouped), [grouped]);

  if (initialLoading) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.categoryContainer}>
          <SkeletonSection titleWidth={140} />
          <SkeletonSection titleWidth={120} />
          <SkeletonSection titleWidth={160} />
        </ScrollView>
      </View>
    );
  }

  if (err) {
    return (
      <View style={styles.containerCenter}>
        <Text style={styles.error}>{err}</Text>
        <TouchableOpacity
          onPress={() => fetchPage({ pageToLoad: 1, mode: 'pull' })}
          style={[styles.card, { marginTop: 16, paddingVertical: 12, width: 220, alignItems: 'center' }]}
          activeOpacity={0.9}
        >
          <Text style={{ color: colors.primary, fontWeight: '700' }}>Erneut versuchen</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.categoryContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {lastUpdated && (
          <Text style={styles.updatedHint}>Aktualisiert: {lastUpdated.toLocaleTimeString()}</Text>
        )}

        {groupedEntries.length === 0 ? (
          <Text style={styles.empty}>Zurzeit leider keine passenden Angebote in deiner Nähe!</Text>
        ) : (
          groupedEntries.map(([category, catOffers]) => (
            <View key={category} style={styles.categoryBlock}>
              <Text style={styles.categoryTitle}>{category}</Text>
              <FlatList
                data={catOffers}
                keyExtractor={(it) => it._id}
                renderItem={OfferCard}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalList}
                style={{ marginBottom: 26 }}
              />
            </View>
          ))
        )}

        {/* Pagination Footer */}
        {hasMore && (
          <View style={{ alignItems: 'center', marginTop: 4 }}>
            {loadingMore ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <TouchableOpacity
                style={styles.loadMoreBtn}
                onPress={() => fetchPage({ pageToLoad: page + 1, mode: 'more' })}
                activeOpacity={0.9}
              >
                <Text style={styles.loadMoreText}>Mehr laden</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/* ───────────────────────── Styles ───────────────────────── */

const IMAGE_WIDTH = 90;
const IMAGE_HEIGHT = 70;
const IMAGE_MARGIN = 8;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  containerCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  categoryContainer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 },
  categoryBlock: { marginBottom: 8 },
  categoryTitle: { fontSize: 20, fontWeight: '700', color: '#1f2937', marginBottom: 10 },
  horizontalList: { paddingLeft: 2, paddingRight: 2 },

  updatedHint: { color: '#6b7280', fontSize: 12, marginBottom: 8 },

  card: {
    backgroundColor: '#f6f8fa',
    borderRadius: 16,
    padding: 20,
    marginRight: 15,
    width: 250,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    minHeight: 190,
    justifyContent: 'flex-start',
  },

  distanceText: { fontSize: 14, color: '#2c3e50', marginBottom: 3, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: 'bold', color: colors.primary, marginBottom: 6 },
  desc: { fontSize: 15, color: '#555', marginBottom: 8 },

  imagesRow: {
    flexDirection: 'row',
    marginTop: 10,
    justifyContent: 'flex-start',
    alignItems: 'center',
    minHeight: IMAGE_HEIGHT,
  },
  offerImage: {
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    borderRadius: 8,
    backgroundColor: '#eee',
    marginRight: IMAGE_MARGIN,
  },
  offerImagePlaceholder: {
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
    marginRight: IMAGE_MARGIN,
    opacity: 0.35,
  },

  /* Skeleton */
  skel: {
    backgroundColor: '#e9eef5',
    borderRadius: 8,
  },
  skelImg: {
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    borderRadius: 8,
    backgroundColor: '#e9eef5',
    marginRight: IMAGE_MARGIN,
  },

  /* Footer */
  loadMoreBtn: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#eef2ff',
  },
  loadMoreText: {
    color: colors.primary,
    fontWeight: '700',
  },

  error: { color: 'red', marginTop: 30, textAlign: 'center' },
  empty: { color: '#999', marginTop: 20, textAlign: 'center', fontSize: 16 },
});
