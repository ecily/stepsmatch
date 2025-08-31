// mobile/app/(tabs)/navigation.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import axios from 'axios';

import colors from '../../theme/colors';
import mapStyleStepsmatchLight from '../../theme/mapStyleDark'; // so belassen
import { isOfferActiveNow } from '../../utils/isOfferActiveNow'; // strikt Europe/Vienna

const API_URL = 'https://lobster-app-ie9a5.ondigitalocean.app/api';
const FALLBACK_CENTER = { latitude: 47.0707, longitude: 15.4395 };

/* ---- Geo utils ---- */
const toRad = (x) => (x * Math.PI) / 180;
function distanceMeters(a, b) {
  if (!a || !b) return null;
  const { latitude: lat1, longitude: lon1 } = a;
  const { latitude: lat2, longitude: lon2 } = b;
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null;
  const R = 6371e3;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const A =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(A), Math.sqrt(1 - A)));
}
function formatDistance(m) {
  if (m == null) return '';
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}

/* Radius **immer zuerst am Offer** lesen; Provider nur Fallback */
function readRadiusMeters(offer) {
  const fromOffer = [
    offer?.radius,
    offer?.radiusMeters,
    offer?.radius_m,
    offer?.coverageRadius,
    offer?.rangeMeters,
  ].find((v) => Number.isFinite(Number(v)));

  if (Number.isFinite(Number(fromOffer))) return Number(fromOffer);

  const p = (offer?.provider && typeof offer.provider === 'object') ? offer.provider : null;
  if (!p) return null;

  const fromProvider = [
    p?.radius,
    p?.radiusMeters,
    p?.radius_m,
    p?.coverageRadius,
    p?.rangeMeters,
  ].find((v) => Number.isFinite(Number(v)));

  return Number.isFinite(Number(fromProvider)) ? Number(fromProvider) : null;
}

/* Koordinaten: **zuerst offer.location**, dann provider.location (GeoJSON oder {lat,lng}) */
function readLatLng(offer) {
  const locs = [];
  if (offer?.location) locs.push(offer.location);
  if (offer?.provider && typeof offer.provider === 'object' && offer.provider.location) {
    locs.push(offer.provider.location);
  }
  for (const loc of locs) {
    if (!loc) continue;
    // GeoJSON: { type:'Point', coordinates:[lng,lat] }
    if (loc?.type === 'Point' && Array.isArray(loc?.coordinates) && loc.coordinates.length >= 2) {
      const lat = Number(loc.coordinates[1]);
      const lng = Number(loc.coordinates[0]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { latitude: lat, longitude: lng };
    }
    // Plain
    const lat = Number(loc.lat ?? loc.latitude);
    const lng = Number(loc.lng ?? loc.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { latitude: lat, longitude: lng };
  }
  return null;
}

/* Gültig-JETZT + User im Offer-Radius */
function isOfferRelevantNow(offer, userPos) {
  if (!offer || !userPos) return false;
  const active = isOfferActiveNow(offer, 'Europe/Vienna');
  if (!active) return false;

  const pos = readLatLng(offer);
  const r = readRadiusMeters(offer);
  if (!pos || !Number.isFinite(r)) return false;

  const d = distanceMeters(userPos, pos);
  if (d == null) return false;

  return d <= r;
}

export default function NavigationMap() {
  const router = useRouter();

  const [userPos, setUserPos] = useState(null);
  const [loadingPos, setLoadingPos] = useState(true);

  const [offers, setOffers] = useState([]);
  const [loadingOffers, setLoadingOffers] = useState(true);

  const [selected, setSelected] = useState(null);

  const mapRef = useRef(null);
  const posSubRef = useRef(null);
  const firstFixDoneRef = useRef(false);

  /* Standort laden + live verfolgen */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingPos(true);
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setUserPos(null);
          return;
        }

        // Initialer Fix
        const loc = await Location.getCurrentPositionAsync({});
        if (!mounted) return;
        const first = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setUserPos(first);

        // sanft auf den ersten Fix animieren
        try {
          mapRef.current?.animateToRegion(
            { latitude: first.latitude, longitude: first.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 },
            500
          );
          firstFixDoneRef.current = true;
        } catch {}

        // Watcher
        posSubRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 5 },
          (l) => {
            const p = { latitude: l.coords.latitude, longitude: l.coords.longitude };
            setUserPos(p);
            if (!firstFixDoneRef.current) {
              try {
                mapRef.current?.animateToRegion(
                  { latitude: p.latitude, longitude: p.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 },
                  400
                );
                firstFixDoneRef.current = true;
              } catch {}
            }
          }
        );
      } finally {
        if (mounted) setLoadingPos(false);
      }
    })();
    return () => {
      mounted = false;
      try { posSubRef.current?.remove?.(); } catch {}
      posSubRef.current = null;
    };
  }, []);

  /* Offers laden (möglichst inkl. Provider; Fallback vorhanden) */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingOffers(true);

        // 1) bevorzugt: mit Provider-Objekt
        let res;
        try {
          res = await axios.get(`${API_URL}/offers`, { params: { withProvider: 1 } });
        } catch {
          // 2) Fallback: ohne Params
          res = await axios.get(`${API_URL}/offers`);
        }
        if (!mounted) return;

        const arr = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        setOffers(arr || []);
      } finally {
        if (mounted) setLoadingOffers(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const center = userPos || FALLBACK_CENTER;

  /* gefilterte Offers: aktiv + im Offer-Radius */
  const visibleOffers = useMemo(() => {
    if (!userPos) return [];
    return (offers || []).filter((o) => isOfferRelevantNow(o, userPos));
  }, [offers, userPos]);

  /* Distanz Cache */
  const distances = useMemo(() => {
    const m = new Map();
    if (userPos) {
      for (const o of visibleOffers) {
        const p = readLatLng(o);
        m.set(o._id || o.id, p ? distanceMeters(userPos, p) : null);
      }
    }
    return m;
  }, [visibleOffers, userPos]);

  function validUntilText(o) {
    const raw = o?.validTo || o?.end || o?.endsAt || o?.validUntil;
    if (!raw) return '—';
    try {
      const dt = new Date(raw);
      const dd = String(dt.getDate()).padStart(2, '0');
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const hh = String(dt.getHours()).padStart(2, '0');
      const mi = String(dt.getMinutes()).padStart(2, '0');
      return `${dd}.${mm}. ${hh}:${mi} Uhr`;
    } catch { return '—'; }
  }

  function categoryText(o) {
    const cat = o?.category || o?.provider?.category || '—';
    const sub = o?.subcategory || o?.subCategory || '—';
    return { cat, sub };
  }

  const onGoNavigate = useCallback((o) => {
    const id = o?._id || o?.id;
    if (!id) return;
    router.push(`/NavigationScreen?id=${id}`); // bestehender Turn-by-Turn Screen
  }, [router]);

  const onMarkerPress = (o) => setSelected(o);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: center.latitude,
          longitude: center.longitude,
          latitudeDelta: 0.035,
          longitudeDelta: 0.035,
        }}
        showsUserLocation
        showsMyLocationButton={false}
        customMapStyle={mapStyleStepsmatchLight}
      >
        {visibleOffers.map((o) => {
          const pos = readLatLng(o);
          if (!pos) return null;
          const id = o._id || o.id || String(Math.random());
          return (
            <Marker
              key={id}
              coordinate={pos}
              onPress={() => onMarkerPress(o)}
              title={o?.name || 'Angebot'}
              description={o?.provider?.name || ''}
            />
          );
        })}
      </MapView>

      {(loadingPos || loadingOffers) && (
        <View style={styles.loading}>
          <ActivityIndicator size="small" />
          <Text style={styles.loadingText}>
            {loadingPos ? 'Position… ' : ''}{loadingOffers ? 'Angebote…' : ''}
          </Text>
        </View>
      )}

      {selected && (
        <View style={styles.cardWrap} pointerEvents="box-none">
          <View style={styles.card}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {selected?.name || selected?.title || 'Angebot'}
            </Text>

            <View style={{ height: 8 }} />

            <View style={styles.row}>
              <Text style={styles.label}>Kategorie</Text>
              <Text style={styles.value}>
                {categoryText(selected).cat} • {categoryText(selected).sub}
              </Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Entfernung</Text>
              <Text style={styles.value}>
                {formatDistance(distances.get(selected._id || selected.id))}
              </Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Gültig bis</Text>
              <Text style={styles.value}>{validUntilText(selected)}</Text>
            </View>

            <View style={{ height: 8 }} />

            <ScrollView style={{ maxHeight: 84 }}>
              <Text style={styles.desc} numberOfLines={4}>
                {selected?.description || selected?.desc || '—'}
              </Text>
            </ScrollView>

            <View style={{ height: 12 }} />

            <View style={styles.actions}>
              <TouchableOpacity onPress={() => setSelected(null)} style={[styles.btn, styles.btnGhost]}>
                <Text style={styles.btnGhostText}>Schließen</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onGoNavigate(selected)} style={[styles.btn, styles.btnPrimary]}>
                <Text style={styles.btnPrimaryText}>GO</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

/* ---- Styles ---- */
const styles = StyleSheet.create({
  loading: {
    position: 'absolute',
    top: 12, right: 12,
    backgroundColor: 'rgba(16,18,22,0.75)',
    borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  loadingText: { color: '#cfd7e6', fontSize: 12 },

  cardWrap: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    padding: 12,
  },
  card: {
    backgroundColor: 'rgba(16,18,22,0.96)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  label: { color: '#9fb0c6', fontSize: 12 },
  value: { color: '#e8f0ff', fontSize: 13, fontWeight: '600', marginLeft: 8 },
  desc: { color: '#e8f0ff', fontSize: 13, lineHeight: 18 },

  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  btn: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1,
  },
  btnGhost: { borderColor: 'rgba(255,255,255,0.18)' },
  btnGhostText: { color: '#e8f0ff', fontWeight: '700' },
  btnPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  btnPrimaryText: { color: '#0b1220', fontWeight: '800' },
});
