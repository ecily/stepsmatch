import React, { useEffect, useState, useCallback, useRef } from 'react';
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

// ---------- Helpers -----------------------------------------------------------

function withTimeout(promise, ms, label = 'operation') {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      (timer = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms))
    ),
  ]).finally(() => clearTimeout(timer));
}

function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const toRad = (x) => x * Math.PI / 180;
  const R = 6371e3;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// EN/DE Wochentage akzeptieren
const WEEKDAY_EN = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const WEEKDAY_DE = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
function normalizeDays(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((d) => {
    const iDe = WEEKDAY_DE.indexOf(d);
    return iDe >= 0 ? WEEKDAY_EN[iDe] : d;
  });
}

function isOfferValidNow(offer) {
  const now = new Date();
  const weekdayNow = WEEKDAY_EN[now.getDay()];
  const hours = now.getHours();
  const minutes = now.getMinutes();

  const validDays = normalizeDays(offer.validDays || []);
  if (validDays.length && !validDays.includes(weekdayNow)) return false;

  if (offer.validTimes?.start && offer.validTimes?.end) {
    const nowMinutes = hours * 60 + minutes;
    const [fromH, fromM] = String(offer.validTimes.start).split(':').map(Number);
    const [toH, toM] = String(offer.validTimes.end).split(':').map(Number);
    const fromMinutes = (fromH || 0) * 60 + (fromM || 0);
    const toMinutes = (toH || 0) * 60 + (toM || 0);
    if (!(nowMinutes >= fromMinutes && nowMinutes <= toMinutes)) return false;
  }

  if (offer.validDates?.from && offer.validDates?.to) {
    const nowDate = now.toISOString().slice(0, 10);
    const fromDate = String(offer.validDates.from).slice(0, 10);
    const toDate = String(offer.validDates.to).slice(0, 10);
    if (!(nowDate >= fromDate && nowDate <= toDate)) return false;
  }
  return true;
}

function shallowOffersEqual(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i]?._id !== b[i]?._id || a[i]?.__distanceM !== b[i]?.__distanceM) return false;
  }
  return true;
}

// ---------- API Client --------------------------------------------------------

const apiBase = axios.create({ baseURL: API_URL, timeout: 8000 });

// ---------- Screen ------------------------------------------------------------

export default function HomeTab() {
  const router = useRouter();

  const [offers, setOffers] = useState([]);
  const [grouped, setGrouped] = useState({});
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);
  const abortRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const lastFocusAtRef = useRef(0);
  const appState = useRef(AppState.currentState);

  const groupByCategory = useCallback((list) => {
    const m = {};
    for (const o of list) {
      const cat = o.category || 'Andere';
      if (!m[cat]) m[cat] = [];
      m[cat].push(o);
    }
    return m;
  }, []);

  const fetchAndSetOffers = useCallback(
    async (mode = 'auto') => {
      // mode: 'initial' | 'pull' | 'auto'
      if (inFlightRef.current) return; // Entprellen
      inFlightRef.current = true;

      if (mode === 'initial') {
        setInitialLoading(true);
        setError(null);
      }
      if (mode === 'pull') {
        setRefreshing(true);
        setError(null);
      }

      // Vorherige Requests abbrechen
      if (abortRef.current) {
        try { abortRef.current.abort(); } catch {}
      }
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        // API Request sofort (parallel zur Location)
        const reqPromise = apiBase.get('/offers', {
          params: { withProvider: 1 },
          signal: controller.signal,
        });

        // Permissions (mit Timeout) + Location (lastKnown -> ggf. fresh)
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
            6000,
            'getCurrentPosition'
          );
        }
        const { latitude: lat, longitude: lng } = pos.coords;

        // Interessen lesen
        let interests = [];
        try {
          const raw = await AsyncStorage.getItem('userInterests');
          interests = raw ? JSON.parse(raw) : [];
        } catch {}

        // Serverantwort holen
        const res = await withTimeout(reqPromise, 8000, 'offers request');
        const all = Array.isArray(res.data) ? res.data : [];

        // Filtern
        const filtered = all
          .map((o) => {
            const coords = o?.location?.coordinates;
            if (!coords || coords.length < 2) return null;
            const [lngO, latO] = coords;
            const dist = getDistanceMeters(lat, lng, latO, lngO);
            const radiusM = Number(o.radius) || 0;
            if (Array.isArray(interests) && interests.length > 0) {
              if (o.subcategory && !interests.includes(o.subcategory)) return null;
            }
            if (!isOfferValidNow(o)) return null;
            if (radiusM > 0 && dist > radiusM) return null;
            return { ...o, __distanceM: Math.round(dist) };
          })
          .filter(Boolean)
          .sort((a, b) => (a.__distanceM || 0) - (b.__distanceM || 0));

        // Nur updaten, wenn sich was geändert hat
        if (mountedRef.current) {
          setError(null);
          setLastUpdated(new Date());
          if (!shallowOffersEqual(filtered, offers)) {
            setOffers(filtered);
            setGrouped(groupByCategory(filtered));
          }
        }
      } catch (e) {
        if (mountedRef.current) {
          setError(
            e?.message?.includes('timeout')
              ? 'Zeitüberschreitung – bitte erneut versuchen.'
              : 'Fehler beim Laden der Angebote.'
          );
          console.warn('[OffersTab] fetch failed:', e?.message || e);
        }
      } finally {
        inFlightRef.current = false;
        if (mountedRef.current) {
          if (mode === 'initial') setInitialLoading(false);
          if (mode === 'pull') setRefreshing(false);
        }
      }
    },
    [groupByCategory, offers]
  );

  // Initial
  useEffect(() => {
    mountedRef.current = true;
    fetchAndSetOffers('initial');
    return () => {
      mountedRef.current = false;
      if (abortRef.current) try { abortRef.current.abort(); } catch {}
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [fetchAndSetOffers]);

  // Pull-to-Refresh
  const onRefresh = useCallback(() => {
    fetchAndSetOffers('pull');
  }, [fetchAndSetOffers]);

  // Auto-Refresh: App kommt in den Vordergrund (debounced) + Intervall
  useEffect(() => {
    const handleAppState = (next) => {
      const prev = appState.current;
      appState.current = next;
      if (prev?.match(/inactive|background/) && next === 'active') {
        const now = Date.now();
        if (now - lastFocusAtRef.current > 5000) { // 5s Debounce
          lastFocusAtRef.current = now;
          fetchAndSetOffers('auto');
        }
      }
    };
    const sub = AppState.addEventListener('change', handleAppState);

    refreshTimerRef.current = setInterval(() => {
      fetchAndSetOffers('auto');
    }, 180000); // 3 min

    return () => {
      sub.remove();
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [fetchAndSetOffers]);

  // ---------- UI -------------------------------------------------------------

  const OfferCard = ({ item }) => {
    const distance = typeof item.__distanceM === 'number' ? `${item.__distanceM} m entfernt` : '';
    return (
      <TouchableOpacity style={styles.card} onPress={() => router.push(`/offers/${item._id}`)}>
        <Text style={styles.distanceText}>{distance}</Text>
        <Text style={styles.title}>{item.name}</Text>
        <Text style={styles.desc} numberOfLines={3}>{item.description}</Text>
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
  };

  if (initialLoading) {
    return (
      <View style={styles.containerCenter}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (err) {
    return (
      <View style={styles.containerCenter}>
        <Text style={styles.error}>{err}</Text>
        <TouchableOpacity
          onPress={() => fetchAndSetOffers('pull')}
          style={[styles.card, { marginTop: 16, paddingVertical: 12, width: 220, alignItems: 'center' }]}
        >
          <Text style={{ color: colors.primary, fontWeight: '700' }}>Erneut versuchen</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {offers.length === 0 ? (
        <ScrollView
          contentContainerStyle={[styles.categoryContainer, { flexGrow: 1, justifyContent: 'center', alignItems: 'center' }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Text style={styles.empty}>Zurzeit leider keine passenden Angebote in deiner Nähe!</Text>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.categoryContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {lastUpdated && (
            <Text style={styles.updatedHint}>
              Aktualisiert: {lastUpdated.toLocaleTimeString()}
            </Text>
          )}
          {Object.entries(grouped).map(([category, catOffers]) => (
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
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ---------- Styles ------------------------------------------------------------

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

  imagesRow: { flexDirection: 'row', marginTop: 10, justifyContent: 'flex-start', alignItems: 'center', minHeight: IMAGE_HEIGHT },
  offerImage: { width: IMAGE_WIDTH, height: IMAGE_HEIGHT, borderRadius: 8, backgroundColor: '#eee', marginRight: IMAGE_MARGIN },
  offerImagePlaceholder: { width: IMAGE_WIDTH, height: IMAGE_HEIGHT, borderRadius: 8, backgroundColor: '#e0e0e0', marginRight: IMAGE_MARGIN, opacity: 0.35 },

  error: { color: 'red', marginTop: 30, textAlign: 'center' },
  empty: { color: '#999', marginTop: 50, textAlign: 'center', fontSize: 17 },
});
