import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, ActivityIndicator } from 'react-native';
import MapView, { Marker, Polyline, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import directionsFetch from '../../services/directions';
import { useTheme } from '../../theme/ThemeProvider';
import mapStyleStepsmatchLight from '../../theme/mapStyleDark';
import { MaterialIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';

const API_URL = 'https://lobster-app-ie9a5.ondigitalocean.app/api';
const OID24 = /^[0-9a-fA-F]{24}$/;
const FALLBACK_CENTER = { latitude: 47.0707, longitude: 15.4395 };
const ARRIVAL_THRESHOLD_METERS = 15;

const toRad = (x) => (x * Math.PI) / 180;
function distanceMeters(a, b) {
  if (!a || !b) return null;
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);
  const aa = s1 * s1 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * s2 * s2;
  return Math.round(2 * R * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa)));
}

function resolveDirectionsKey() {
  const extra =
    Constants?.expoConfig?.extra ||
    Constants?.manifest?.extra ||
    Constants?.manifest2?.extra ||
    {};

  const kFromExtra = extra?.directionsKey;
  const kFromEnv =
    (typeof process !== 'undefined' && process?.env?.EXPO_PUBLIC_GOOGLE_DIRECTIONS_KEY) ||
    null;

  return String(kFromExtra ?? kFromEnv ?? '').trim();
}

const DIRECTIONS_KEY = resolveDirectionsKey();

export default function NavigationScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id: rawId } = useLocalSearchParams();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const [offer, setOffer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [userLocation, setUserLocation] = useState(null);
  const [remaining, setRemaining] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [routeError, setRouteError] = useState(null);
  const [follow, setFollow] = useState(true);
  const [arrived, setArrived] = useState(false);
  const [mapType, setMapType] = useState('standard');

  const mapRef = useRef(null);
  const posSub = useRef(null);
  const pulse = useRef(new Animated.Value(1)).current;
  const arrivalNotified = useRef(false);

  const offerPos = useMemo(() => {
    const lat = Number(offer?.location?.coordinates?.[1]);
    const lng = Number(offer?.location?.coordinates?.[0]);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { latitude: lat, longitude: lng } : null;
  }, [offer]);

  const initialRegion = useMemo(() => {
    const p = userLocation || offerPos || FALLBACK_CENTER;
    return { latitude: p.latitude, longitude: p.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 };
  }, [userLocation, offerPos]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);

        if (!OID24.test(String(id || ''))) {
          setError('Ungueltige Angebots-ID.');
          return;
        }

        const res = await axios.get(`${API_URL}/offers/${id}`, { params: { withProvider: 1 } });
        if (!mounted) return;
        const data = res?.data?.offer ?? res?.data ?? null;
        setOffer(data);

        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted') {
          setError('Standortberechtigung fehlt.');
          return;
        }

        const current = await Location.getCurrentPositionAsync({});
        if (!mounted) return;

        const p = { latitude: current.coords.latitude, longitude: current.coords.longitude };
        setUserLocation(p);

        posSub.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 3, timeInterval: 2000 },
          (next) => {
            const point = { latitude: next.coords.latitude, longitude: next.coords.longitude };
            setUserLocation(point);
            if (follow) {
              try {
                mapRef.current?.animateCamera({ center: point }, { duration: 350 });
              } catch {}
            }
          }
        );
      } catch (e) {
        setError(String(e?.message || 'Navigation konnte nicht gestartet werden.'));
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      try {
        posSub.current?.remove?.();
      } catch {}
      posSub.current = null;
    };
  }, [id, follow]);

  const loadRoute = useCallback(async (origin, dest) => {
    if (!origin || !dest) return;
    if (!DIRECTIONS_KEY) {
      setRouteError('Kein Directions-Key verfuegbar.');
      setRouteCoords([origin, dest]);
      return;
    }

    try {

      setRouteError(null);
      const coords = await directionsFetch(origin, dest, DIRECTIONS_KEY, 'walking');
      if (Array.isArray(coords) && coords.length >= 2) {
        setRouteCoords(coords);
      } else {
        setRouteCoords([origin, dest]);
      }
    } catch (e) {
      setRouteError(String(e?.message || 'Route konnte nicht berechnet werden.'));
      setRouteCoords([origin, dest]);
    } finally {

    }
  }, []);

  useEffect(() => {
    if (userLocation && offerPos) {
      loadRoute(userLocation, offerPos);
    }
  }, [userLocation, offerPos, loadRoute]);

  useEffect(() => {
    if (!userLocation || !offerPos) return;
    const m = distanceMeters(userLocation, offerPos);
    setRemaining(m);
    if (m != null && m <= ARRIVAL_THRESHOLD_METERS && !arrivalNotified.current) {
      arrivalNotified.current = true;
      setArrived(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [userLocation, offerPos]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  const etaText = useMemo(() => {
    if (remaining == null) return '...';
    if (remaining <= ARRIVAL_THRESHOLD_METERS) return 'Ziel erreicht';
    const mins = Math.max(1, Math.ceil(remaining / 80));
    return `${mins} min`; // walking rough estimate
  }, [remaining]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: t.colors.background }]}> 
        <ActivityIndicator size="large" color={t.colors.primary} />
        <Text style={{ marginTop: 8, color: t.colors.inkLow }}>Navigation wird vorbereitet ...</Text>
      </View>
    );
  }

  if (error || !offer) {
    return (
      <View style={[styles.center, { backgroundColor: t.colors.background }]}> 
        <Text style={{ color: t.colors.danger, textAlign: 'center', paddingHorizontal: 16 }}>{error || 'Angebot nicht gefunden.'}</Text>
        <TouchableOpacity
          onPress={() => router.replace('/(tabs)')}
          style={[styles.backBtn, { backgroundColor: t.colors.card, borderColor: t.colors.divider }]}
        >
          <Text style={{ color: t.colors.ink, fontWeight: '700' }}>Zurueck</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        mapType={mapType}
        customMapStyle={mapType === 'standard' ? mapStyleStepsmatchLight : []}
        showsUserLocation
        showsMyLocationButton={false}
        rotateEnabled={false}
        onPanDrag={() => setFollow(false)}
      >
        {offerPos ? (
          <Marker coordinate={offerPos} title={offer?.name || 'Ziel'}>
            <Animated.View style={{ transform: [{ scale: pulse }] }}>
              <View style={[styles.targetDot, { backgroundColor: t.colors.primary }]} />
            </Animated.View>
          </Marker>
        ) : null}

        {userLocation ? (
          <Circle
            center={userLocation}
            radius={45}
            fillColor="rgba(31,111,235,0.12)"
            strokeColor="rgba(31,111,235,0.4)"
            strokeWidth={1}
          />
        ) : null}

        {routeCoords.length >= 2 ? (
          <>
            <Polyline coordinates={routeCoords} strokeColor="rgba(255,255,255,0.95)" strokeWidth={9} />
            <Polyline coordinates={routeCoords} strokeColor={t.colors.primary} strokeWidth={6} />
          </>
        ) : null}
      </MapView>

      <View style={[styles.hudTop, { top: insets.top + 10, backgroundColor: t.colors.card, borderColor: t.colors.divider }]}> 
        <Text style={[styles.offerTitle, { color: t.colors.inkHigh }]} numberOfLines={1}>{offer?.name || 'Navigation'}</Text>
        <Text style={[styles.offerMeta, { color: t.colors.inkLow }]}>
          {remaining == null ? 'Distanz ...' : `Noch ${remaining < 1000 ? `${remaining} m` : `${(remaining / 1000).toFixed(1)} km`} · ETA ${etaText}`}
        </Text>
        {routeError ? <Text style={[styles.warn, { color: t.colors.warning }]}>{routeError}</Text> : null}
        {routeCoords.length < 2 ? <Text style={[styles.warn, { color: t.colors.inkLow }]}>Route wird vorbereitet ...</Text> : null}
      </View>

      <View style={[styles.fabColumn, { bottom: 110 + insets.bottom }]}> 
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: t.colors.card, borderColor: t.colors.divider }]}
          onPress={() => {
            if (!userLocation) return;
            setFollow(true);
            try {
              mapRef.current?.animateCamera({ center: userLocation }, { duration: 280 });
            } catch {}
          }}
        >
          <MaterialIcons name="my-location" size={22} color={t.colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.fab, { backgroundColor: t.colors.card, borderColor: t.colors.divider }]}
          onPress={() => setMapType((prev) => (prev === 'standard' ? 'satellite' : 'standard'))}
        >
          <MaterialIcons name="layers" size={22} color={t.colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={[styles.bottomBar, { bottom: insets.bottom + 14 }]}> 
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: t.colors.primary }]}
          onPress={() => router.replace(`/offers/${id}`)}
        >
          <Text style={styles.primaryBtnText}>{arrived ? 'Zurueck zu Details' : 'Details anzeigen'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backBtn: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },

  targetDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 4,
  },

  hudTop: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  offerTitle: { fontSize: 16, fontWeight: '900' },
  offerMeta: { marginTop: 4, fontSize: 13 },
  warn: { marginTop: 6, fontSize: 12 },

  fabColumn: {
    position: 'absolute',
    right: 16,
    gap: 10,
  },
  fab: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
  },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  primaryBtn: {
    minWidth: 240,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '800' },
});