// stepsmatch/mobile/app/(tabs)/OffersScreen.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Image,
  SafeAreaView,
  ScrollView,
  Dimensions,
} from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const API_BASE_URL =
  (process.env.EXPO_PUBLIC_API_BASE_URL || 'https://lobster-app-ie9a5.ondigitalocean.app/api').replace(/\/$/, '');

const SCREEN_W = Dimensions.get('window').width;

/* ───────── Geo Helpers ───────── */
function toRad(deg) { return (deg * Math.PI) / 180; }
function haversineM(a, b) {
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const aa = s1 * s1 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * s2 * s2;
  return 2 * R * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}
function fmtDistance(m) { return m < 995 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`; }

/* ───────── Helpers ───────── */
function normalizeToken(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/\s+/g, ' ').trim();
}
async function getSelectedInterestsSet() {
  const candidates = ['selectedInterests', 'interests', 'userInterests'];
  for (const key of candidates) {
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return new Set(parsed.map(normalizeToken));
      } catch {
        const list = raw.split(',').map(normalizeToken).filter(Boolean);
        if (list.length) return new Set(list);
      }
    }
  }
  return new Set();
}
function offerMatchesInterests(offer, interestSet) {
  if (!interestSet || interestSet.size === 0) return true;
  const cat = normalizeToken(offer?.category);
  const sub = normalizeToken(offer?.subcategory);
  const name = normalizeToken(offer?.name);
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
  const coords = offer?.location?.coordinates || offer?.provider?.location?.coordinates || null;
  if (Array.isArray(coords) && coords.length >= 2) {
    const [lng, lat] = coords;
    const latN = Number(lat), lngN = Number(lng);
    if (Number.isFinite(latN) && Number.isFinite(lngN)) return { latitude: latN, longitude: lngN };
  }
  return null;
}
function pickRadiusMeters(offer) {
  const r1 = Number(offer?.radius);
  if (Number.isFinite(r1) && r1 >= 0) return r1;
  const r2 = Number(offer?.provider?.radius);
  if (Number.isFinite(r2) && r2 >= 0) return r2;
  return null;
}

// Restlaufzeit (robust)
function getRemainingMs(offer) {
  const keys = ['activeUntil','activeEnd','validUntil','endAt','validTo','dateTo','activeWindowEnd','endTime'];
  const vd = offer?.validDates;
  if (vd && typeof vd === 'object') {
    const toRaw = vd.to ?? vd.end ?? vd.toDate ?? vd.endDate;
    if (toRaw) {
      const d = new Date(toRaw);
      if (!isNaN(d)) {
        const diff = d.getTime() - Date.now();
        if (diff > 0) return diff;
      }
    }
  }
  for (const k of keys) {
    const v = offer?.[k]; if (!v) continue;
    const d = new Date(v); if (!isNaN(d)) {
      const diff = d.getTime() - Date.now();
      if (diff > 0) return diff;
    }
  }
  return null;
}
function formatRemaining(diffMs) {
  if (diffMs == null) return '—';
  const totalMin = Math.ceil(diffMs / 60000);
  if (totalMin <= 0) return '—';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}\u00A0min`;
  if (m === 0) return `${h}\u00A0h`;
  return `${h}\u00A0h ${m}\u00A0min`;
}

/* ───────── Screen ───────── */
export default function OffersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, name: paramName, image: paramImage, distance: paramDistance } = useLocalSearchParams();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offers, setOffers] = useState([]);
  const [error, setError] = useState(null);
  const [provider, setProvider] = useState(null);
  const [mapType, setMapType] = useState('standard');

  const userPosRef = useRef(null);
  const mapRef = useRef(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const interestSet = await getSelectedInterestsSet();

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') throw new Error('Standortberechtigung verweigert');
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Platform.OS === 'android' ? Location.Accuracy.Balanced : Location.Accuracy.High,
      });
      const userPos = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      userPosRef.current = userPos;

      if (id) {
        const resDetail = await fetch(`${API_BASE_URL}/offers/${encodeURIComponent(id)}?withProvider=1`);
        if (resDetail.status === 404) throw new Error('Offer nicht gefunden (404)');
        if (!resDetail.ok) throw new Error(`GET /offers/:id failed: ${resDetail.status}`);
        const obj = await resDetail.json();
        const offer = obj?.offer || obj?.data || obj;
        if (!offer || !offer._id) throw new Error('Unerwartete Antwort für /offers/:id');

        const loc = pickOfferLocation(offer);
        const radiusM = pickRadiusMeters(offer);
        const distanceM = loc ? haversineM(userPos, loc) : Number.POSITIVE_INFINITY;
        setOffers([{ offer, loc, radiusM, distanceM, include: true }]);

        if (offer?.provider && typeof offer.provider === 'object') setProvider(offer.provider);
        else if (offer?.provider) {
          try {
            const rp = await fetch(`${API_BASE_URL}/providers/${encodeURIComponent(offer.provider)}`);
            if (rp.ok) setProvider(await rp.json());
          } catch {}
        }
        return;
      }

      const res = await fetch(`${API_BASE_URL}/offers?withProvider=1&page=1&limit=200`);
      if (!res.ok) throw new Error(`GET /offers failed: ${res.status}`);
      const json = await res.json();
      const rows = Array.isArray(json?.offers) ? json.offers : Array.isArray(json) ? json : [];

      const kept = rows
        .filter((o) => offerMatchesInterests(o, interestSet))
        .map((offer) => {
          const loc = pickOfferLocation(offer);
          const radiusM = pickRadiusMeters(offer);
          const distanceM = loc ? haversineM(userPos, loc) : Number.POSITIVE_INFINITY;
          const include = !!loc && Number.isFinite(radiusM) && distanceM <= radiusM;
          return { offer, loc, radiusM, distanceM, include };
        })
        .filter((r) => r.include)
        .sort((a, b) => a.distanceM - b.distanceM);

      setOffers(kept);
    } catch (e) {
      setError(e?.message || 'Unbekannter Fehler beim Laden der Angebote');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { setLoading(true); load(); }, [load, id]);
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  /* List Items (unchanged) */
  const renderItem = useCallback(({ item }) => {
    const { offer, distanceM, radiusM } = item;
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push({ pathname: '/offers/[id]', params: { id: offer._id } })}
      >
        {offer.images?.[0] ? <Image source={{ uri: offer.images[0] }} style={styles.cardImage} /> : null}
        <Text style={styles.cardTitle}>{offer.name}</Text>
        {!!offer.description && <Text style={styles.cardDesc} numberOfLines={2}>{offer.description}</Text>}
        <View style={styles.bottomRow}>
          <Text style={styles.distance}>{fmtDistance(distanceM)} innerhalb Radius ✅</Text>
          <Text style={styles.radius}>Radius: {Number.isFinite(radiusM) ? `${radiusM} m` : '—'}</Text>
        </View>
      </TouchableOpacity>
    );
  }, [router]);

  /* Detail helpers */
  const first = offers?.[0];
  const offer = first?.offer;
  const offerLoc = first?.loc || (offer ? pickOfferLocation(offer) : null);
  const distanceMDetail = useMemo(() => {
    if (Number.isFinite(first?.distanceM)) return first.distanceM;
    const prm = typeof paramDistance === 'string' ? Number(paramDistance) : null;
    if (Number.isFinite(prm)) return prm;
    if (userPosRef.current && offerLoc) return haversineM(userPosRef.current, offerLoc);
    return null;
  }, [first, paramDistance, offerLoc]);

  useEffect(() => {
    if (!id || !mapRef.current || !userPosRef.current || !offerLoc) return;
    try {
      mapRef.current.fitToCoordinates([userPosRef.current, offerLoc], {
        edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
        animated: true,
      });
    } catch {}
  }, [id, offerLoc]);

  const remainingMs = offer ? getRemainingMs(offer) : null;
  const hurry = remainingMs != null && remainingMs <= 60 * 60 * 1000;

  const handleStartRoute = () => {
    if (!offer) return;
    router.push({ pathname: '/(tabs)/NavigationScreen', params: { id: offer._id } });
  };
  const handleBackToIndex = () => {
    try {
    if (router.canGoBack?.()) {
      router.back();
      return;
    }
  } catch {}
  // (tabs) ist eine URL‑Gruppe → Index ist unter "/"
  router.replace('/');
  };

  /* Render */
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

  if (id && offer) {
    const images = Array.isArray(offer.images) && offer.images.length ? offer.images : (paramImage ? [paramImage] : []);
    const heroHeight = 200;

    return (
      <SafeAreaView style={{ flex: 1 }}>
        {/* HERO */}
        {images.length ? (
          <FlatList
            data={images}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(uri, i) => `${offer._id}-img-${i}`}
            renderItem={({ item: uri }) => (
              <Image
                source={{ uri }}
                style={{ width: SCREEN_W, height: heroHeight }}
                resizeMode="cover"
              />
            )}
            style={{ height: heroHeight }}
            getItemLayout={(_, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
          />
        ) : (
          <View style={[styles.heroPlaceholder, { height: heroHeight }]}>
            <Text style={styles.heroPlaceholderText}>Sorry. Kein Bild.</Text>
          </View>
        )}

        <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
          {/* MAP */}
          <View style={styles.mapWrap}>
            <MapView
              ref={mapRef}
              style={styles.map}
              provider={PROVIDER_GOOGLE}
              mapType={mapType}
              initialRegion={{
                latitude: offerLoc?.latitude || (userPosRef.current?.latitude ?? 47.0707),
                longitude: offerLoc?.longitude || (userPosRef.current?.longitude ?? 15.4395),
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              }}
            >
              {userPosRef.current && <Marker coordinate={userPosRef.current} title="Du" />}
              {offerLoc && <Marker coordinate={offerLoc} title={offer?.name || 'Ziel'} pinColor="#0077FF" />}
            </MapView>

            <View style={styles.mapToggle}>
              <TouchableOpacity
                onPress={() => setMapType('standard')}
                style={[styles.toggleBtn, mapType === 'standard' && styles.toggleBtnActive]}
              >
                <Text style={[styles.toggleText, mapType === 'standard' && styles.toggleTextActive]}>Map</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setMapType('satellite')}
                style={[styles.toggleBtn, mapType === 'satellite' && styles.toggleBtnActive]}
              >
                <Text style={[styles.toggleText, mapType === 'satellite' && styles.toggleTextActive]}>Sat</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Badges */}
          <View style={styles.badgesRow}>
            {!!offer.category && (
              <View style={[styles.badge, styles.badgeNeutral]}>
                <Text style={styles.badgeText}>{offer.category}</Text>
              </View>
            )}
            {!!offer.subcategory && (
              <View style={[styles.badge, styles.badgeNeutral]}>
                <Text style={styles.badgeText}>{offer.subcategory}</Text>
              </View>
            )}
            {Number.isFinite(distanceMDetail) && (
              <View style={[styles.badge, styles.badgeBlue]}>
                <Text style={styles.badgeText}>Entf.: {fmtDistance(distanceMDetail)}</Text>
              </View>
            )}
            <View style={[styles.badge, styles.badgeOrange]}>
              <Text style={styles.badgeText}>Rest: {formatRemaining(remainingMs)}</Text>
            </View>
            {hurry && (
              <View style={[styles.badge, styles.badgeRed]}>
                <Text style={[styles.badgeText, { color: '#7c2d12' }]}>Beeilung!</Text>
              </View>
            )}
          </View>

          {/* Offer Card (wie Index-Card) */}
          <View style={styles.infoCard}>
            <Text style={styles.cardTitleBig}>{offer?.name || paramName || 'Angebot'}</Text>
            {!!offer?.description && <Text style={styles.cardBody}>{offer.description}</Text>}
          </View>

          {/* Provider Card (wie Index-Card; ohne Labels) */}
          <View style={styles.infoCard}>
            <Text style={styles.cardTitleBig}>{provider?.name || offer?.provider?.name || 'Anbieter'}</Text>
            {!!(provider?.address || offer?.provider?.address) && (
              <Text style={styles.cardBody}>{provider?.address || offer?.provider?.address}</Text>
            )}
            {!!(provider?.contact || offer?.provider?.contact) && (
              <Text style={styles.cardBody}>{provider?.contact || offer?.provider?.contact}</Text>
            )}
            {!!(provider?.description || offer?.provider?.description) && (
              <Text style={styles.cardBody}>{provider?.description || offer?.provider?.description}</Text>
            )}
          </View>
        </ScrollView>

        {/* CTA-Bar */}
        <View style={[styles.ctaBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <TouchableOpacity style={[styles.ctaBtn, styles.ctaPrimary]} onPress={handleStartRoute} activeOpacity={0.9}>
            <Text style={styles.ctaPrimaryText}>Los!</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.ctaBtn, styles.ctaGhost]} onPress={handleBackToIndex} activeOpacity={0.9}>
            <Text style={styles.ctaGhostText}>Zurück</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
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

  /* Index-like card for list mode */
  card: {
    backgroundColor: '#f7f8fb',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
  },
  cardImage: { width: '100%', height: 140, borderRadius: 10, marginBottom: 8, backgroundColor: '#eee' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#1f2937' },
  cardDesc: { marginTop: 6, color: '#4b5563' },

  bottomRow: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  distance: { fontWeight: '600', color: '#111827' },
  radius: { color: '#6b7280' },

  heroPlaceholder: { width: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' },
  heroPlaceholderText: { color: '#6b7280', fontWeight: '600' },

  mapWrap: { height: 220, marginTop: 10 },
  map: { flex: 1, borderRadius: 10 },

  mapToggle: {
    position: 'absolute', top: 10, right: 10, flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 999, overflow: 'hidden',
  },
  toggleBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  toggleBtnActive: { backgroundColor: '#111827' },
  toggleText: { fontSize: 12, color: '#111827', fontWeight: '700' },
  toggleTextActive: { color: '#fff' },

  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingTop: 12 },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, marginRight: 8, marginBottom: 8 },
  badgeNeutral: { backgroundColor: '#f3f4f6', borderColor: '#e5e7eb' },
  badgeBlue: { backgroundColor: '#e5f0ff', borderColor: '#bfdbfe' },
  badgeOrange: { backgroundColor: '#fff7ed', borderColor: '#fed7aa' },
  badgeRed: { backgroundColor: '#ffe4e6', borderColor: '#fecdd3' },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#0f172a' },

  /* Info cards (like index) */
  infoCard: {
    backgroundColor: '#f7f8fb',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 12,
    marginTop: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
  },
  cardTitleBig: { fontSize: 18, fontWeight: '800', color: '#1f2937', marginBottom: 6, lineHeight: 22 },
  cardBody: { fontSize: 14, color: '#4b5563', lineHeight: 20, marginBottom: 6 },

  /* CTA */
  ctaBar: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    paddingHorizontal: 12, paddingTop: 8,
    backgroundColor: '#ffffffF2',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e5e7eb',
    flexDirection: 'row', gap: 10,
  },
  ctaBtn: { flex: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  ctaPrimary: { backgroundColor: '#111827' },
  ctaPrimaryText: { color: '#fff', fontWeight: '700' },
  ctaGhost: { backgroundColor: '#eef2ff' },
  ctaGhostText: { color: '#111827', fontWeight: '700' },
});
