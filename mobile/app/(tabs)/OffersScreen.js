// stepsmatch/mobile/app/(tabs)/OffersScreen.js
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl, Platform } from 'react-native';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL =
  (process.env.EXPO_PUBLIC_API_BASE_URL || 'https://lobster-app-ie9a5.ondigitalocean.app/api').replace(/\/$/, '');

/* ───────── Geo Helpers ───────── */
function toRad(deg) { return (deg * Math.PI) / 180; }
function haversineM(a, b) {
  const R = 6371000; // meters
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const aa = s1 * s1 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * s2 * s2;
  return 2 * R * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}
function fmtDistance(m) { return m < 995 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`; }

/* ───────── Daten-Helpers ───────── */
function normalizeToken(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\s+/g, ' ')
    .trim();
}

async function getSelectedInterestsSet() {
  // Wir versuchen mehrere mögliche Keys, um kompatibel zu bleiben.
  const candidates = ['selectedInterests', 'interests', 'userInterests'];
  for (const key of candidates) {
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return new Set(parsed.map(normalizeToken));
        }
      } catch {
        // evtl. CSV
        const list = raw.split(',').map(normalizeToken).filter(Boolean);
        if (list.length) return new Set(list);
      }
    }
  }
  return new Set(); // leer = keine Einschränkung
}

function offerMatchesInterests(offer, interestSet) {
  if (!interestSet || interestSet.size === 0) return true; // keine Einschränkung

  const cat = normalizeToken(offer?.category);
  const sub = normalizeToken(offer?.subcategory);
  const name = normalizeToken(offer?.name);

  // Minimale Heuristik: Kategorie/Subkategorie/Name muss einen der Tokens enthalten
  for (const t of interestSet) {
    if (!t) continue;
    if ((cat && (cat === t || cat.includes(t))) ||
        (sub && (sub === t || sub.includes(t))) ||
        (name && name.includes(t))) {
      return true;
    }
  }
  return false;
}

function pickOfferLocation(offer) {
  // Mongo GeoJSON: { type:"Point", coordinates:[lng, lat] }
  const coords =
    offer?.location?.coordinates ||
    offer?.provider?.location?.coordinates ||
    null;

  if (Array.isArray(coords) && coords.length >= 2) {
    const [lng, lat] = coords;
    const latN = Number(lat);
    const lngN = Number(lng);
    if (Number.isFinite(latN) && Number.isFinite(lngN)) {
      return { latitude: latN, longitude: lngN };
    }
  }
  return null;
}

function pickRadiusMeters(offer) {
  const r1 = Number(offer?.radius);
  if (Number.isFinite(r1) && r1 >= 0) return r1;
  const r2 = Number(offer?.provider?.radius);
  if (Number.isFinite(r2) && r2 >= 0) return r2;
  return null; // ohne Radius -> AUS
}

/* ───────── Screen ───────── */
export default function OffersScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offers, setOffers] = useState([]);
  const [error, setError] = useState(null);
  const userPosRef = useRef(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      // 0) Interessen lesen
      const interestSet = await getSelectedInterestsSet();
      console.log('[Offers] Interests selected:', Array.from(interestSet));

      // 1) Standort
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Standortberechtigung verweigert');
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Platform.OS === 'android' ? Location.Accuracy.Balanced : Location.Accuracy.High,
      });
      const userPos = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      userPosRef.current = userPos;
      console.log('[Offers] User position:', userPos);

      // 2) Angebote laden (inkl. Provider, genug Limit)
      const url = `${API_BASE_URL}/offers?withProvider=1&page=1&limit=200`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`GET /offers failed: ${res.status}`);
      const json = await res.json();

      const rows = Array.isArray(json?.offers) ? json.offers : Array.isArray(json) ? json : [];
      console.log('[Offers] Count received:', rows.length);

      // 3) Zuerst Interessenfilter (clientseitig), dann Geofilter
      const afterInterest = rows.filter((offer) => {
        const match = offerMatchesInterests(offer, interestSet);
        if (!match) {
          // Debug nur knapp halten
          console.log('[Offers][interest OUT]', { id: offer?._id, name: offer?.name, cat: offer?.category, sub: offer?.subcategory });
        }
        return match;
      });
      console.log('[Offers] After interest filter:', afterInterest.length);

      const evaluated = afterInterest.map((offer) => {
        const loc = pickOfferLocation(offer);
        const radiusM = pickRadiusMeters(offer);
        const distanceM = loc && userPos ? haversineM(userPos, loc) : Number.POSITIVE_INFINITY;

        const include = !!loc && Number.isFinite(radiusM) && distanceM <= radiusM;

        console.log('[Offers][calc]', {
          id: offer?._id,
          name: offer?.name,
          cat: offer?.category,
          sub: offer?.subcategory,
          loc,
          radiusM,
          distanceM: Number.isFinite(distanceM) ? Math.round(distanceM) : '∞',
          decision: include ? 'IN' : 'OUT'
        });

        return { offer, loc, radiusM, distanceM, include };
      });

      const kept = evaluated
        .filter((r) => r.include)
        .sort((a, b) => a.distanceM - b.distanceM);

      console.log('[Offers] Kept inside radius:', kept.length);

      setOffers(kept);
    } catch (e) {
      console.warn('[Offers] load error:', e);
      setError(e?.message || 'Unbekannter Fehler beim Laden der Angebote');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const renderItem = useCallback(({ item }) => {
    const { offer, distanceM, radiusM } = item;
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push({ pathname: '/offers/[id]', params: { id: offer._id } })}
      >
        <Text style={styles.title}>{offer.name}</Text>
        <Text style={styles.meta}>
          {offer.category}{offer.subcategory ? ` · ${offer.subcategory}` : ''}
        </Text>
        <Text style={styles.desc} numberOfLines={2}>{offer.description || ''}</Text>
        <View style={styles.bottomRow}>
          <Text style={styles.distance}>{fmtDistance(distanceM)} innerhalb Radius ✅</Text>
          <Text style={styles.radius}>Radius: {Number.isFinite(radiusM) ? `${radiusM} m` : '—'}</Text>
        </View>
      </TouchableOpacity>
    );
  }, [router]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.muted}>Angebote werden geladen…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Fehler: {error}</Text>
        <TouchableOpacity style={styles.btn} onPress={load}>
          <Text style={styles.btnText}>Erneut versuchen</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!offers.length) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Keine Angebote im Radius deiner Interessen.</Text>
        <TouchableOpacity style={styles.btn} onPress={load}>
          <Text style={styles.btnText}>Neu laden</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={styles.list}
      data={offers}
      keyExtractor={(row) => row.offer._id}
      renderItem={renderItem}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    />
  );
}

/* ───────── Styles ───────── */
const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { color: '#777', marginTop: 8 },
  error: { color: '#B00020', marginBottom: 12, textAlign: 'center' },
  btn: { backgroundColor: '#111827', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '600' },

  list: { padding: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  title: { fontSize: 16, fontWeight: '700', color: '#111827' },
  meta: { marginTop: 4, color: '#6b7280' },
  desc: { marginTop: 8, color: '#374151' },
  bottomRow: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  distance: { fontWeight: '600', color: '#111827' },
  radius: { color: '#6b7280' },
});
