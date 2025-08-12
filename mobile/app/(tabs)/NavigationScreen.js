import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Vibration, Platform } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import axios from 'axios';
import { useLocalSearchParams, useRouter } from 'expo-router';
import colors from '../../theme/colors';
import { fetchRoute } from '../../services/directions';

const API_URL = 'https://lobster-app-ie9a5.ondigitalocean.app/api';

// ---- Geo-Helpers ----
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
  const A =
    Math.sin(dLat / 2) ** 2 +
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
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}
function angleDeltaDeg(a, b) { return ((b - a + 540) % 360) - 180; }
function smoothHeading(prev, next, alpha = 0.25) {
  const d = angleDeltaDeg(prev, next);
  let h = prev + d * alpha;
  if (h < 0) h += 360;
  if (h >= 360) h -= 360;
  return h;
}

// ---- Konfiguration / Tuning ----
const DIRECTIONS_KEY = process.env.EXPO_PUBLIC_GOOGLE_DIRECTIONS_KEY || '';
const FALLBACK_CENTER = { latitude: 47.0707, longitude: 15.4395 };

const POSITION_UPDATE_MIN_DIST = 3;
const ANIMATE_THROTTLE_MS = 600;
const HEADING_UPDATE_EVERY_METERS = 100;
const HEADING_SNAP_DEG = 15;
const REMAINING_TICK_MS = 1000;
const ARRIVAL_THRESHOLD_METERS = 15;

// ---- Haptik-Tuning ----
const ARRIVAL_HAPTIC_BURSTS = 3;            // Anzahl Heavy-Bursts
const ARRIVAL_HAPTIC_INTERVAL_MS = 120;     // Abstand zwischen Bursts
const ARRIVAL_VIBRATION_PATTERN = [0, 220, 80, 260, 80, 300]; // Android-Pattern (ms)

export default function NavigationScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [offer, setOffer] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [heading, setHeading] = useState(0);
  const [loading, setLoading] = useState(true);
  const [remaining, setRemaining] = useState(null);
  const [mapType, setMapType] = useState('standard');

  const [routeCoords, setRouteCoords] = useState([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState(null);

  const [arrived, setArrived] = useState(false);

  const mapRef = useRef(null);
  const posSub = useRef(null);
  const offerPosRef = useRef(null);
  const lastAnimRef = useRef(0);
  const lastPosRef = useRef(null);
  const lastHeadingUpdatePosRef = useRef(null);
  const arrivalNotifiedRef = useRef(false);

  // ---- Beep/Haptik ----
  const soundRef = useRef(null);
  const [hapticsAvailable, setHapticsAvailable] = useState(true);

  async function loadBeep() {
    try {
      const asset = require('../../assets/sounds/arrival.mp3');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });
      const { sound } = await Audio.Sound.createAsync(asset, { shouldPlay: false });
      soundRef.current = sound;
      console.log('[Beep] asset loaded');
    } catch (e) {
      soundRef.current = null;
      console.log('[Beep] init failed:', String(e));
    }
  }
  async function playBeep() {
    try {
      if (soundRef.current) {
        await soundRef.current.setPositionAsync(0);
        await soundRef.current.playAsync();
        console.log('[Beep] played');
      } else {
        console.log('[Beep] no soundRef, using vibration fallback');
        Vibration.vibrate(250);
      }
    } catch (e) {
      console.log('[Beep] play failed:', String(e));
    }
  }

  useEffect(() => {
    (async () => {
      try { setHapticsAvailable(await Haptics.isAvailableAsync()); } catch {}
      await loadBeep();
    })();
    return () => { try { soundRef.current?.unloadAsync?.(); } catch {} };
  }, []);

  // ---- Offer/Pos ----
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

    let nextHeading = heading;
    if (maybeUpdateHeading && lastHeadingUpdatePosRef.current) {
      const since = distanceMeters(lastHeadingUpdatePosRef.current, pos) ?? 0;
      if (since >= HEADING_UPDATE_EVERY_METERS) {
        const raw = bearingDegrees(lastHeadingUpdatePosRef.current, pos);
        const delta = Math.abs(angleDeltaDeg(nextHeading, raw));
        if (delta >= HEADING_SNAP_DEG) {
          nextHeading = smoothHeading(nextHeading, raw, 0.25);
          setHeading(nextHeading);
          lastHeadingUpdatePosRef.current = pos;
        }
      }
    }

    try {
      mapRef.current?.animateCamera({ center: pos, heading: nextHeading }, { duration: 450 });
      lastAnimRef.current = now;
      lastPosRef.current = pos;
    } catch {}
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);

        // Angebot laden
        const res = await axios.get(`${API_URL}/offers/${id}`);
        if (!mounted) return;
        setOffer(res.data);

        // Standort-Berechtigung
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        // Initial-Position
        const loc = await Location.getCurrentPositionAsync({});
        if (!mounted) return;
        const pos = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setUserLocation(pos);
        lastPosRef.current = pos;
        lastHeadingUpdatePosRef.current = pos;

        // initiale Restdistanz
        if (res.data?.location?.coordinates) {
          const dest = {
            latitude: Number(res.data.location.coordinates[1]),
            longitude: Number(res.data.location.coordinates[0]),
          };
          setRemaining(distanceMeters(pos, dest));
        }

        // Live-Position
        posSub.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 2 },
          (l) => {
            const p = { latitude: l.coords.latitude, longitude: l.coords.longitude };
            setUserLocation(p);
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

  // Distanzanzeige 1x pro Sekunde (stabil)
  useEffect(() => {
    const t = setInterval(() => {
      const pos = lastPosRef.current;
      const dest = offerPosRef.current;
      if (pos && dest) {
        const m = distanceMeters(pos, dest);
        if (m !== null) setRemaining(m);
      }
    }, REMAINING_TICK_MS);
    return () => clearInterval(t);
  }, []);

  // Arrival-Trigger
  useEffect(() => {
    if (remaining != null && remaining < ARRIVAL_THRESHOLD_METERS && !arrivalNotifiedRef.current) {
      arrivalNotifiedRef.current = true;
      setArrived(true);
      console.log('[Arrival] threshold hit, remaining=', remaining);

      (async () => {
        try {
          // Mehrfach kräftig hämmern
          for (let i = 0; i < ARRIVAL_HAPTIC_BURSTS; i++) {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            await new Promise(r => setTimeout(r, ARRIVAL_HAPTIC_INTERVAL_MS));
          }
          // Abschluss-Notification
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          console.log('[Haptics] multi-burst done');
        } catch (e) {
          console.log('[Haptics] error:', String(e));
        }

        // Booster/Fallback: kräftiges Vibrationsmuster
        try { Vibration.vibrate(ARRIVAL_VIBRATION_PATTERN); } catch {}

        // Sound dazu
        await playBeep();
      })();

      // TODO: später Arrival-Event ans Backend senden
      // await sendArrivalEventSafely();
    }
  }, [remaining]);

  // Route laden/aktualisieren
  useEffect(() => {
    const loadRoute = async () => {
      if (!offerPos || !userLocation || !DIRECTIONS_KEY) {
        setRouteCoords([]);
        setRouteError(!DIRECTIONS_KEY ? 'Kein Directions-Key' : null);
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

  async function sendArrivalEventSafely() {
    try {
      // Beispiel – später mit axiosInstance + Auth:
      // await axiosInstance.post(`/offers/${id}/arrival`, { ts: Date.now() });
    } catch (e) {
      console.log('Arrival-Event failed (non-blocking):', String(e));
    }
  }

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

  const recenter = () => {
    if (!userLocation) return;
    try {
      mapRef.current?.animateCamera({ center: userLocation, heading }, { duration: 350 });
    } catch {}
  };

  // --- DEV: Test-Buttons für Sound/Haptik ---
  const DevTest = __DEV__ ? (
    <View style={styles.devBar}>
      <TouchableOpacity
        onPress={async () => {
          try {
            for (let i = 0; i < ARRIVAL_HAPTIC_BURSTS; i++) {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              await new Promise(r => setTimeout(r, ARRIVAL_HAPTIC_INTERVAL_MS));
            }
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            console.log('[Dev] haptics burst ok');
          } catch (e) { console.log('[Dev] haptics error', String(e)); }
          try { Vibration.vibrate(ARRIVAL_VIBRATION_PATTERN); } catch {}
        }}
        style={[styles.devBtn, { marginRight: 8 }]}
      >
        <Text style={styles.devBtnText}>Test Haptik</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={async () => { await playBeep(); }} style={styles.devBtn}>
        <Text style={styles.devBtnText}>Test Sound</Text>
      </TouchableOpacity>
    </View>
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        provider={PROVIDER_GOOGLE}
        initialCamera={initialCamera}
        mapType={mapType}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
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

        {!routeCoords.length && userLocation && offerPos && (
          <Polyline coordinates={[userLocation, offerPos]} strokeWidth={4} />
        )}
      </MapView>

      {/* HUD oben */}
      <View style={styles.hudTop}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={styles.hudTitle} numberOfLines={1}>
            {offer?.name || 'Navigation'}
          </Text>
          <Text style={styles.hudPill}>
            {routeLoading ? 'Route…' : routeError ? 'Fallback' : 'Fußweg'}
          </Text>
        </View>
        <Text style={styles.hudSub}>
          {remaining != null
            ? (remaining < ARRIVAL_THRESHOLD_METERS ? 'Ziel erreicht' : `Noch ${formatDistance(remaining)}`)
            : 'Berechne Distanz …'}
        </Text>
        {!DIRECTIONS_KEY && (
          <Text style={styles.hudWarn}>Kein Google Directions API-Key verfügbar.</Text>
        )}
        {routeError && (
          <Text style={styles.hudWarnSmall}>
            Hinweis: {String(routeError).replace('Error: ', '')}
          </Text>
        )}
      </View>

      {/* Recenter-Button */}
      <TouchableOpacity onPress={recenter} style={styles.fabRecenter}>
        <Text style={styles.fabText}>◎</Text>
      </TouchableOpacity>

      {/* HUD unten */}
      <View style={styles.hudBottom}>
        <TouchableOpacity onPress={() => router.back()} style={styles.btn}>
          <Text style={styles.btnText}>Zurück zu Details</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setMapType(t => (t === 'standard' ? 'satellite' : 'standard'))}
          style={[styles.btn, { marginTop: 8 }]}
        >
          <Text style={styles.btnText}>
            {mapType === 'standard' ? 'Sat-View' : 'Karten-View'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Arrival-Sheet */}
      {arrived && (
        <View style={styles.sheetWrap}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>🎯 Ziel erreicht</Text>
            <Text style={styles.sheetSub}>Du bist am Angebot angekommen.</Text>
            <View style={{ height: 12 }} />
            <TouchableOpacity onPress={() => router.back()} style={[styles.sheetBtn, styles.sheetBtnPrimary]}>
              <Text style={styles.sheetBtnText}>Zurück zu Details</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setArrived(false)} style={[styles.sheetBtn, { marginTop: 8 }]}>
              <Text style={styles.sheetBtnText}>Weiter navigieren</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {DevTest}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  hudTop: {
    position: 'absolute',
    top: 12, left: 12, right: 12,
    backgroundColor: 'rgba(20,20,20,0.74)',
    borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 12,
  },
  hudTitle: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  hudSub: { color: '#eee', fontSize: 13, marginTop: 2 },
  hudWarn: { color: '#ffd966', fontSize: 12, marginTop: 6 },
  hudWarnSmall: { color: '#ffb3b3', fontSize: 11, marginTop: 4 },
  hudPill: {
    color: '#fff', fontSize: 12,
    paddingHorizontal: 10, paddingVertical: 2,
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

  fabRecenter: {
    position: 'absolute', right: 16, bottom: 112,
    backgroundColor: '#111', opacity: 0.92,
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    elevation: 3,
  },
  fabText: { color: '#fff', fontSize: 20, marginTop: -2 },

  sheetWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 12, paddingBottom: 16
  },
  sheet: {
    width: '100%',
    backgroundColor: '#0f1a0f',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e7a1e'
  },
  sheetTitle: { color: '#d5ffd5', fontSize: 16, fontWeight: 'bold' },
  sheetSub: { color: '#bfe8bf', fontSize: 13, marginTop: 4 },

  sheetBtn: {
    backgroundColor: '#111', opacity: 0.95,
    paddingHorizontal: 18, paddingVertical: 12,
    borderRadius: 12, alignItems: 'center'
  },
  sheetBtnPrimary: { backgroundColor: '#1c6f1c' },
  sheetBtnText: { color: '#fff', fontWeight: 'bold' },

  // DEV bar
  devBar: {
    position: 'absolute', left: 12, right: 12, bottom: 170,
    flexDirection: 'row', justifyContent: 'center'
  },
  devBtn: {
    backgroundColor: '#222', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, opacity: 0.95
  },
  devBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
});
