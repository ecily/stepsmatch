import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import axios from 'axios';
import { useLocalSearchParams, useRouter } from 'expo-router';
import colors from '../../theme/colors';
import { fetchRoute } from '../../services/directions';

const API_URL = 'https://lobster-app-ie9a5.ondigitalocean.app/api';

// ---- Helpers ----
const toRad = (x) => (x * Math.PI) / 180;
const toDeg = (x) => (x * 180) / Math.PI;
function distanceMeters(a, b) {
  if (!a || !b) return null;
  const { latitude: lat1, longitude: lon1 } = a;
  const { latitude: lat2, longitude: lon2 } = b;
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null;
  const R = 6371e3;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const A = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(A), Math.sqrt(1 - A)));
}
function formatDistance(m) {
  if (m == null) return '';
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(1)} km`;
}
// Bearing aus zwei GPS-Punkten (0..360, 0=N)
function bearingDegrees(from, to) {
  const φ1 = toRad(from.latitude), φ2 = toRad(to.latitude);
  const λ1 = toRad(from.longitude), λ2 = toRad(to.longitude);
  const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) -
            Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
  const brng = (toDeg(Math.atan2(y, x)) + 360) % 360;
  return brng;
}

const DIRECTIONS_KEY = process.env.EXPO_PUBLIC_GOOGLE_DIRECTIONS_KEY || '';
const FALLBACK_CENTER = { latitude: 47.0707, longitude: 15.4395 };

// Tuning
const POSITION_UPDATE_MIN_DIST = 3;     // ab 3 m Bewegung animieren
const ANIMATE_THROTTLE_MS = 500;        // max alle 500 ms animieren
const HEADING_UPDATE_EVERY_METERS = 100;// nur alle 100 m Heading neu setzen

export default function NavigationScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [offer, setOffer] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [heading, setHeading] = useState(0); // wird nur aus Bearing gesetzt
  const [loading, setLoading] = useState(true);
  const [remaining, setRemaining] = useState(null);
  const [mapType, setMapType] = useState('standard'); // 'standard' | 'satellite' | 'hybrid' | 'terrain(android)'

  const [routeCoords, setRouteCoords] = useState([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState(null);

  const mapRef = useRef(null);
  const posSub = useRef(null);

  // Refs für Drossel & Zustände
  const offerPosRef = useRef(null);
  const lastAnimRef = useRef(0);
  const lastPosRef = useRef(null);
  const lastHeadingUpdatePosRef = useRef(null);

  const offerPos = useMemo(() => {
    const lat = Number(offer?.location?.coordinates?.[1]);
    const lng = Number(offer?.location?.coordinates?.[0]);
    return Number.isFinite(lat) && Number.isFinite(lng)
      ? { latitude: lat, longitude: lng }
      : null;
  }, [offer]);

  useEffect(() => { offerPosRef.current = offerPos; }, [offerPos]);

  const initialCamera = useMemo(() => {
    const center = userLocation || offerPos || FALLBACK_CENTER;
    return { center, zoom: 18, pitch: 45, heading };
  }, [userLocation, offerPos, heading]);

  const animateTo = (pos, maybeUpdateHeading = false) => {
    const now = Date.now();
    if (now - lastAnimRef.current < ANIMATE_THROTTLE_MS) return;

    const last = lastPosRef.current;
    const moved = last ? distanceMeters(last, pos) ?? 0 : Infinity;
    if (moved < POSITION_UPDATE_MIN_DIST) return;

    // Heading nur selten und aus Bewegungsrichtung aktualisieren
    let nextHeading = heading;
    if (maybeUpdateHeading && lastHeadingUpdatePosRef.current) {
      const since = distanceMeters(lastHeadingUpdatePosRef.current, pos) ?? 0;
      if (since >= HEADING_UPDATE_EVERY_METERS) {
        nextHeading = bearingDegrees(lastHeadingUpdatePosRef.current, pos);
        setHeading(nextHeading);
        lastHeadingUpdatePosRef.current = pos;
      }
    }

    try {
      mapRef.current?.animateCamera(
        { center: pos, heading: nextHeading }, // Zoom/Pitch NICHT anfassen
        { duration: 450 }
      );
      lastAnimRef.current = now;
      lastPosRef.current = pos;
    } catch {}
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${API_URL}/offers/${id}`);
        if (!mounted) return;
        setOffer(res.data);

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        const loc = await Location.getCurrentPositionAsync({});
        if (!mounted) return;
        const pos = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setUserLocation(pos);
        lastPosRef.current = pos;
        lastHeadingUpdatePosRef.current = pos;

        if (res.data?.location?.coordinates) {
          const dest = {
            latitude: Number(res.data.location.coordinates[1]),
            longitude: Number(res.data.location.coordinates[0]),
          };
          setRemaining(distanceMeters(pos, dest));
        }

        // Live-Position
        posSub.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 700,
            distanceInterval: 1,
          },
          (l) => {
            const p = { latitude: l.coords.latitude, longitude: l.coords.longitude };
            setUserLocation(p);

            const dest = offerPosRef.current;
            if (dest) {
              const m = distanceMeters(p, dest);
              if (m !== null) setRemaining(m);
            }

            // Kamera sanft → Heading nur alle X Meter aktualisieren
            animateTo(p, true);
          }
        );
      } catch {
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      try { posSub.current?.remove?.(); } catch {}
      posSub.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Route laden
  useEffect(() => {
    const loadRoute = async () => {
      if (!offerPos || !userLocation || !DIRECTIONS_KEY) {
        setRouteCoords([]);
        setRouteError(!DIRECTIONS_KEY ? 'Kein Directions‑Key' : null);
        return;
      }
      try {
        setRouteLoading(true);
        setRouteError(null);
        const coords = await fetchRoute(userLocation, offerPos, DIRECTIONS_KEY, 'walking');
        setRouteCoords(Array.isArray(coords) ? coords : []);
        if (coords?.length > 1) {
          setTimeout(() => {
            mapRef.current?.fitToCoordinates(coords, {
              edgePadding: { top: 80, right: 80, bottom: 120, left: 80 },
              animated: true,
            });
          }, 250);
        }
      } catch (e) {
        setRouteError(String(e));
        setRouteCoords([]);
      } finally {
        setRouteLoading(false);
      }
    };
    loadRoute();
  }, [offerPos, userLocation]);

  if (!offer && loading) {
    return (
      <View style={styles.center}>
        <Text style={{ color: '#999' }}>Lade Navigation …</Text>
      </View>
    );
  }
  if (!offer) {
    return (
      <View style={styles.center}>
        <Text style={{ color: '#999' }}>Angebot nicht gefunden</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>Zurück</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        provider={PROVIDER_GOOGLE}
        initialCamera={initialCamera}
        mapType={mapType}                 // <— Togglebar
        showsUserLocation
        showsMyLocationButton={false}
        loadingEnabled={false}
        scrollEnabled
        zoomEnabled
        pitchEnabled
        rotateEnabled
        onMapReady={() => console.log('Nav map ready')}
        onError={(e) => console.log('Nav map error', e?.nativeEvent)}
      >
        {offerPos && (
          <Marker coordinate={offerPos} title={offer?.name || 'Ziel'} pinColor="#0077FF" />
        )}

        {routeCoords.length > 1 && (
          <Polyline coordinates={routeCoords} strokeWidth={6} />
        )}

        {(!routeCoords.length && userLocation && offerPos) && (
          <Polyline coordinates={[userLocation, offerPos]} strokeWidth={4} />
        )}
      </MapView>

      {/* HUD oben */}
      <View style={styles.hudTop}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={styles.hudTitle} numberOfLines={1}>{offer?.name || 'Navigation'}</Text>
          <Text style={styles.hudPill}>
            {routeLoading ? 'Route…' : routeError ? 'Fallback' : 'Fußweg'}
          </Text>
        </View>
        <Text style={styles.hudSub}>
          {remaining != null
            ? (remaining < 15 ? 'Ziel erreicht' : `Noch ${formatDistance(remaining)}`)
            : 'Berechne Distanz …'}
        </Text>
        {!DIRECTIONS_KEY && (
          <Text style={styles.hudWarn}>Kein Google Directions API‑Key verfügbar.</Text>
        )}
        {routeError && (
          <Text style={styles.hudWarnSmall}>Hinweis: {String(routeError).replace('Error: ', '')}</Text>
        )}
      </View>

      {/* HUD unten: Back + MapType Toggle */}
      <View style={styles.hudBottom}>
        <TouchableOpacity onPress={() => router.back()} style={styles.btn}>
          <Text style={styles.btnText}>Zurück zu Details</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setMapType(t => (t === 'standard' ? 'satellite' : 'standard'))}
          style={[styles.btn, { marginTop: 8 }]}
        >
          <Text style={styles.btnText}>
            {mapType === 'standard' ? 'Sat‑View' : 'Karten‑View'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  hudTop: {
    position: 'absolute', top: 12, left: 12, right: 12,
    backgroundColor: 'rgba(20,20,20,0.74)', borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 12,
  },
  hudTitle: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  hudSub: { color: '#eee', fontSize: 13, marginTop: 2 },
  hudWarn: { color: '#ffd966', fontSize: 12, marginTop: 6 },
  hudWarnSmall: { color: '#ffb3b3', fontSize: 11, marginTop: 4 },
  hudPill: {
    color: '#fff', fontSize: 12, paddingHorizontal: 10, paddingVertical: 2,
    borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden'
  },

  hudBottom: {
    position: 'absolute', bottom: 16, left: 0, right: 0, alignItems: 'center'
  },
  btn: {
    backgroundColor: '#111', opacity: 0.88,
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12
  },
  btnText: { color: '#fff', fontWeight: 'bold' },
});
