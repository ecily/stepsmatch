// stepsmatch/mobile/app/(tabs)/NavigationScreen.js
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Vibration, Animated, PanResponder, Easing } from 'react-native';
import MapView, { Marker, Circle, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { DeviceMotion } from 'expo-sensors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '../../theme/colors';
import fetchRoute from '../../services/directions'; // default import
import mapStyleStepsmatchLight from '../../theme/mapStyleDark';
import { MaterialIcons } from '@expo/vector-icons';
import { isOfferActiveNow } from '../../utils/isOfferActiveNow';
import Constants from 'expo-constants';

const API_URL = 'https://lobster-app-ie9a5.ondigitalocean.app/api';
const OID24 = /^[0-9a-fA-F]{24}$/;

/* ─────────── Directions-Key robust ─────────── */
function resolveDirectionsKey() {
  const kExtra =
    Constants?.expoConfig?.extra?.directionsKey ??
    Constants?.manifest?.extra?.directionsKey ??
    null;
  const kEnv =
    (typeof process !== 'undefined' && process?.env?.EXPO_PUBLIC_GOOGLE_DIRECTIONS_KEY) ||
    null;
  const key = String(kExtra ?? kEnv ?? '').trim();
  const origin = kExtra ? 'extra.directionsKey' : kEnv ? 'env.EXPO_PUBLIC_GOOGLE_DIRECTIONS_KEY' : 'none';
  const len = key.length;
  const masked = len >= 8 ? `${key.slice(0, 4)}…${key.slice(-4)}` : '(leer)';
  console.log('[NavigationScreen] directionsKey source=', origin, 'len=', len, 'mask=', masked);
  return key;
}
const DIRECTIONS_KEY = resolveDirectionsKey();
const DIRECTIONS_KEY_LEN = DIRECTIONS_KEY.length;

/* ─────────── Geo Helpers ─────────── */
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
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}
function bearingDegrees(from, to) {
  const φ1 = toRad(from.latitude), φ2 = toRad(to.latitude);
  const λ1 = toRad(from.longitude), λ2 = toRad(to.longitude);
  const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}
const angleDeltaDeg = (a, b) => ((b - a + 540) % 360) - 180;
function smoothHeading(prev, next, alpha = 0.25) {
  const d = angleDeltaDeg(prev, next);
  let h = prev + d * alpha; if (h < 0) h += 360; if (h >= 360) h -= 360;
  return h;
}
function aheadOf(pos, headingDeg, meters = 25) {
  if (!pos || !Number.isFinite(meters)) return pos;
  const R = 6371e3, δ = meters / R, θ = toRad(headingDeg);
  const φ1 = toRad(pos.latitude), λ1 = toRad(pos.longitude);
  const sinφ1 = Math.sin(φ1), cosφ1 = Math.cos(φ1), sinδ = Math.sin(δ), cosδ = Math.cos(δ);
  const sinφ2 = sinφ1 * cosδ + cosφ1 * sinδ * Math.cos(θ); const φ2 = Math.asin(sinφ2);
  const y = Math.sin(θ) * sinδ * cosφ1; const x = cosδ - sinφ1 * sinφ2; const λ2 = λ1 + Math.atan2(y, x);
  return { latitude: toDeg(φ2), longitude: toDeg(λ2) };
}

/* ─────────── Route Helpers ─────────── */
const lerpCoord = (p1, p2, t) => ({
  latitude: p1.latitude + (p2.latitude - p1.latitude) * t,
  longitude: p1.longitude + (p2.longitude - p1.longitude) * t,
});
const haversine = distanceMeters;
const nearestOnPolyline = (pos, route) => {
  if (!route || route.length < 2) return { dist: 0, index: 0, t: 0, point: route?.[0] ?? pos };
  let best = { dist: Infinity, index: 0, t: 0, point: route[0] };
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i], b = route[i + 1];
    const ax = a.longitude, ay = a.latitude;
    const bx = b.longitude, by = b.latitude;
    const px = pos.longitude, py = pos.latitude;
    const abx = bx - ax, aby = by - ay;
    const apx = px - ax, apy = py - ay;
    const ab2 = abx * abx + aby * aby || 1e-12;
    let t = (apx * abx + apy * aby) / ab2; t = Math.max(0, Math.min(1, t));
    const proj = { latitude: ay + aby * t, longitude: ax + abx * t };
    const d = haversine(pos, proj);
    if (d < best.dist) best = { dist: d, index: i, t, point: proj };
  }
  return best;
};
const remainingRouteFrom = (pos, fullRoute, snapAheadMeters = 10) => {
  if (!fullRoute || fullRoute.length < 2 || !pos) return fullRoute ?? [];
  const snap = nearestOnPolyline(pos, fullRoute);
  const nextIdx = Math.min(snap.index + 1, fullRoute.length - 1);
  const distToNext = haversine(pos, fullRoute[nextIdx]) ?? 0;
  let head = lerpCoord(fullRoute[snap.index], fullRoute[snap.index + 1], snap.t);
  let startIdx = snap.index + 1;
  if (distToNext < snapAheadMeters) { head = fullRoute[nextIdx]; startIdx = nextIdx + 1; }
  return [head, ...fullRoute.slice(startIdx)];
};
const sampleEvery = (route, stepMeters = 18, maxPoints = 420) => {
  if (!route || route.length === 0) return [];
  if (route.length === 1) return [route[0]];
  const out = []; let leftover = 0;
  for (let i = 0; i < route.length - 1 && out.length < maxPoints; i++) {
    const a = route[i], b = route[i + 1];
    const segLen = haversine(a, b) ?? 0;
    let dist = leftover;
    while (dist <= segLen && out.length < maxPoints) {
      const t = segLen === 0 ? 0 : dist / segLen;
      out.push(lerpCoord(a, b, t));
      dist += stepMeters;
    }
    leftover = dist - segLen;
  }
  if (out.length < maxPoints) out.push(route[route.length - 1]);
  return out;
};

/* ─────────── Config/Tuning ─────────── */
const FALLBACK_CENTER = { latitude: 47.0707, longitude: 15.4395 };
const POSITION_UPDATE_MIN_DIST = 3;
const ANIMATE_THROTTLE_MS = 600;
const HEADING_UPDATE_EVERY_METERS = 100;
const HEADING_SNAP_DEG = 15;
const REMAINING_TICK_MS = 1000;
const ARRIVAL_THRESHOLD_METERS = 15;

/* Off-Route Tuning */
const OFF_ROUTE_THRESHOLD_M = 35;
const OFF_ROUTE_CONFIRM_SECS = 3;
const REROUTE_COOLDOWN_MS = 15000;

/* Haptik */
const ARRIVAL_HAPTIC_BURSTS = 3;
const ARRIVAL_HAPTIC_INTERVAL_MS = 120;
const ARRIVAL_VIBRATION_PATTERN = [0, 220, 80, 260, 80, 300];

/* Turn-Hints */
const TURN_MIN_ANGLE_DEG = 30;

/* Storage Keys */
const STORE_ROUTE = 'stepsmatch:lastRoute';
const STORE_OFFER = 'stepsmatch:lastOffer';
const STORE_AVOID_STAIRS = 'stepsmatch:avoidStairs';

export default function NavigationScreen() {
  const { id: rawId } = useLocalSearchParams();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const insets = useSafeAreaInsets();

  /* ── 1) State ── */
  const [offer, setOffer] = useState(null);
  const [providerDoc, setProviderDoc] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [userAccuracy, setUserAccuracy] = useState(null);
  const [heading, setHeading] = useState(0);
  const [loading, setLoading] = useState(true);
  const [remaining, setRemaining] = useState(null);
  const [mapType, setMapType] = useState('standard');
  const [follow, setFollow] = useState(true);
  const [isTilt3D, setIsTilt3D] = useState(true);
  const [routeCoords, setRouteCoords] = useState([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState(null);
  const [arrived, setArrived] = useState(false);
  const [isOffRoute, setIsOffRoute] = useState(false);
  const [reroutePending, setReroutePending] = useState(false);
  const [offRouteDist, setOffRouteDist] = useState(null);
  const [sheetH, setSheetH] = useState(0);
  const [avoidStairs, setAvoidStairs] = useState(false);
  const [showOffRouteToast, setShowOffRouteToast] = useState(false);

  /* ── 2) Refs ── */
  const mapRef = useRef(null);
  const posSub = useRef(null);
  const offerPosRef = useRef(null);
  const lastAnimRef = useRef(0);
  const lastPosRef = useRef(null);
  const lastHeadingUpdatePosRef = useRef(null);
  const arrivalNotifiedRef = useRef(false);
  const soundRef = useRef(null);
  const offRouteSinceRef = useRef(null);
  const lastRerouteTsRef = useRef(0);
  const sheetY = useRef(new Animated.Value(0)).current;
  const destPulse = useRef(new Animated.Value(1)).current;
  const deviceMotionHeadingRef = useRef(null);

  // HUD-Pull-Down
  const hudPullY = useRef(new Animated.Value(0)).current;

  /* ── 3) Derived ── */
  const offerPos = useMemo(() => {
    const lat = Number(offer?.location?.coordinates?.[1]);
    const lng = Number(offer?.location?.coordinates?.[0]);
    return Number.isFinite(lat) && Number.isFinite(lng)
      ? { latitude: lat, longitude: lng }
      : null;
  }, [offer]);

  const initialCamera = useMemo(() => {
    const center = userLocation || offerPos || FALLBACK_CENTER;
    return { center, zoom: 18, pitch: isTilt3D ? 45 : 0, heading };
  }, [userLocation, offerPos, heading, isTilt3D]);

  const remainingRoute = useMemo(() => {
    if (routeCoords.length > 1 && userLocation) return remainingRouteFrom(userLocation, routeCoords, 10);
    if (userLocation && offerPos) return [userLocation, offerPos];
    return [];
  }, [routeCoords, userLocation, offerPos]);

  const providerAddress = useMemo(() => {
    const fromOffer =
      (offer && typeof offer.provider === 'object' && offer.provider?.address) ||
      offer?.address;
    const fromDoc = providerDoc?.address;
    return fromOffer || fromDoc || 'Adresse nicht verfügbar';
  }, [offer, providerDoc]);

  const activeNow = useMemo(() => {
    if (!offer) return false;
    const ok = isOfferActiveNow(offer, 'Europe/Vienna');
    console.log('[NavigationScreen] activeNow:', ok, 'offerId:', offer?._id || offer?.id);
    return ok;
  }, [offer]);

  /* ─────────── Animations/Helpers ─────────── */
  const openSheet = useCallback(() => {
    Animated.timing(sheetY, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [sheetY]);

  const closeSheet = useCallback((cb) => {
    Animated.timing(sheetY, { toValue: sheetH || 280, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true })
      .start(() => { setArrived(false); if (cb) cb(); });
  }, [sheetY, sheetH]);

  const addrOpacity = useMemo(
    () => hudPullY.interpolate({ inputRange: [0, 20, 120], outputRange: [0, 0.4, 1], extrapolate: 'clamp' }),
    [hudPullY]
  );
  const hudTranslateY = useMemo(
    () => hudPullY.interpolate({ inputRange: [0, 140], outputRange: [0, 140], extrapolate: 'clamp' }),
    [hudPullY]
  );

  const animateTo = useCallback((pos, maybeUpdateHeading = false) => {
    const now = Date.now();
    if (now - lastAnimRef.current < ANIMATE_THROTTLE_MS) return;

    const last = lastPosRef.current;
    const moved = last ? distanceMeters(last, pos) ?? 0 : Infinity;
    if (moved < POSITION_UPDATE_MIN_DIST) return;

    const speed = last ? (moved / ((now - lastAnimRef.current) / 1000 || 1)) : 0;

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

    if (Date.now() < (deviceMotionHeadingRef.current ? Date.now() + 0 : 0) && deviceMotionHeadingRef.current != null) {
      const dm = deviceMotionHeadingRef.current;
      nextHeading = smoothHeading(nextHeading, dm, 0.18);
      setHeading(nextHeading);
    }

    const ahead = speed > 1.6 ? 34 : speed > 0.8 ? 28 : 22;
    const dynPitch = isTilt3D ? (speed > 1.6 ? 52 : speed > 0.8 ? 46 : 40) : 0;
    const center = follow ? aheadOf(pos, nextHeading, ahead) : undefined;

    try {
      mapRef.current?.animateCamera(
        follow ? { center, heading: nextHeading, pitch: dynPitch } : { heading: nextHeading, pitch: dynPitch },
        { duration: 450 }
      );
      lastAnimRef.current = now;
      lastPosRef.current = pos;
    } catch {}
  }, [follow, heading, isTilt3D]);

  /* ─────────── PanResponder ─────────── */
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
    onPanResponderMove: (_, g) => { const next = Math.max(0, g.dy); sheetY.setValue(next); },
    onPanResponderRelease: (_, g) => { (g.dy > 120 || g.vy > 1.0) ? closeSheet() : openSheet(); },
  }), [sheetY, openSheet, closeSheet]);

  const hudPan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_, g) => { hudPullY.setValue(Math.max(0, g.dy)); },
    onPanResponderRelease: () => {
      Animated.timing(hudPullY, { toValue: 0, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    },
  }), [hudPullY]);

  /* ─────────── DeviceMotion ─────────── */
  const headingBiasUntilRef = useRef(0);
  const lastSpeedRef = useRef(0);

  useEffect(() => {
    let sub;
    try {
      sub = DeviceMotion.addListener((data) => {
        const { rotation } = data || {};
        if (!rotation) return;
        const yawDeg = ((rotation.alpha || 0) * 180) / Math.PI;
        const norm = ((yawDeg % 360) + 360) % 360;
        deviceMotionHeadingRef.current = norm;
      });
      DeviceMotion.setUpdateInterval(200);
    } catch {}
    return () => { try { sub?.remove?.(); } catch {} };
  }, []);

  /* ─────────── Effects ─────────── */

  // Zielpos als Ref spiegeln
  useEffect(() => { offerPosRef.current = offerPos; }, [offerPos]);

  // Sounds (Arrival)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const asset = require('../../assets/sounds/arrival.mp3');
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false, playsInSilentModeIOS: true, shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false, staysActiveInBackground: false,
        });
        const { sound } = await Audio.Sound.createAsync(asset, { shouldPlay: false });
        if (mounted) soundRef.current = sound;
      } catch { soundRef.current = null; }
    })();
    return () => { try { soundRef.current?.unloadAsync?.(); } catch {} };
  }, []);

  // Ziel-Pin Animation
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(destPulse, { toValue: 1.12, duration: 900, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
        Animated.timing(destPulse, { toValue: 1.00, duration: 900, useNativeDriver: true, easing: Easing.in(Easing.quad) }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [destPulse]);

  // Avoid-Stairs Präferenz laden
  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem(STORE_AVOID_STAIRS);
      if (saved != null) setAvoidStairs(saved === '1');
    })();
  }, []);

  // Initial: Angebot, Location, Watcher (+ Provider)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);

        // ✅ Guard: ungültige ID → kein Fetch (verhindert /offers/undefined)
        if (!OID24.test(String(id || ''))) {
          setOffer(null);
          setLoading(false);
          return;
        }

        // Offer inkl. Provider versuchen
        let res;
        try {
          res = await axios.get(`${API_URL}/offers/${id}`, { params: { withProvider: 1 } });
        } catch {
          // Fallback: ohne Param
          res = await axios.get(`${API_URL}/offers/${id}`);
        }

        if (!mounted) return;
        const offerData = res?.data?.offer ?? res?.data ?? null;
        setOffer(offerData);
        await AsyncStorage.setItem(STORE_OFFER, JSON.stringify(offerData));

        // Provider Detail laden, falls nötig
        try {
          if (offerData?.provider && typeof offerData.provider === 'string') {
            const pRes = await axios.get(`${API_URL}/providers/${offerData.provider}`);
            if (mounted) setProviderDoc(pRes.data);
          } else if (offerData?.provider && offerData.provider?.address) {
            setProviderDoc(offerData.provider);
          } else {
            setProviderDoc(null);
          }
        } catch {}

        // Location permission
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        const watchOpts = { accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 2 };

        // Startposition
        const loc = await Location.getCurrentPositionAsync({});
        if (!mounted) return;
        const pos = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setUserLocation(pos);
        setUserAccuracy(loc.coords.accuracy ?? null);
        lastPosRef.current = pos;
        lastHeadingUpdatePosRef.current = pos;

        if (offerData?.location?.coordinates) {
          const dest = { latitude: Number(offerData.location.coordinates[1]), longitude: Number(offerData.location.coordinates[0]) };
          setRemaining(distanceMeters(pos, dest));
        }

        posSub.current = await Location.watchPositionAsync(
          watchOpts,
          (l) => {
            const p = { latitude: l.coords.latitude, longitude: l.coords.longitude };
            setUserLocation(p);
            setUserAccuracy(l.coords.accuracy ?? null);

            const now = Date.now();
            const prev = lastPosRef.current;
            const sp = prev ? ((distanceMeters(prev, p) ?? 0) / Math.max(1, (now - lastAnimRef.current) / 1000)) : 0;
            if (sp < 0.5) {
              headingBiasUntilRef.current = now + 5000;
            }

            animateTo(p, true);
          }
        );
      } catch {
        try {
          const cachedOffer = await AsyncStorage.getItem(STORE_OFFER);
          if (cachedOffer) setOffer(JSON.parse(cachedOffer));
        } catch {}
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      try { posSub.current?.remove?.(); } catch {}
      posSub.current = null;
    };
  }, [id, animateTo]);

  // Distanz + leichte Turn-Hints
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
  }, [remainingRoute]);

  // Arrival
  useEffect(() => {
    if (remaining != null && remaining < ARRIVAL_THRESHOLD_METERS && !arrivalNotifiedRef.current) {
      arrivalNotifiedRef.current = true;
      setArrived(true);
      (async () => {
        try {
          for (let i = 0; i < ARRIVAL_HAPTIC_BURSTS; i++) {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            await new Promise(r => setTimeout(r, ARRIVAL_HAPTIC_INTERVAL_MS));
          }
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
        try { Vibration.vibrate(ARRIVAL_VIBRATION_PATTERN); } catch {}
        try {
          if (soundRef.current) { await soundRef.current.setPositionAsync(0); await soundRef.current.playAsync(); }
          else { Vibration.vibrate(250); }
        } catch {}
      })();
    }
  }, [remaining]);

  // Route laden / aktualisieren
  const loadRouteFrom = useCallback(async (origin, dest) => {
    if (!dest || !origin || !DIRECTIONS_KEY) {
      setRouteCoords([]); setRouteError(!DIRECTIONS_KEY ? 'Kein Directions-Key' : null); return;
    }
    try {
      setRouteLoading(true); setRouteError(null);
      console.log('[directions] fetchRoute origin/dest=', origin, dest, 'keyLen=', DIRECTIONS_KEY_LEN);
      const coords = await fetchRoute(
        origin,
        dest,
        DIRECTIONS_KEY,
        'walking',
        { avoidStairs: !!avoidStairs, timeoutMs: 10000 }
      );
      const arr = Array.isArray(coords) ? coords : [];
      setRouteCoords(arr);
      await AsyncStorage.setItem(STORE_ROUTE, JSON.stringify(arr));
      if (arr.length > 1) {
        setTimeout(() => {
          mapRef.current?.fitToCoordinates(arr, {
            edgePadding: { top: 80, right: 80, bottom: 120, left: 80 }, animated: true,
          });
        }, 250);
      }
    } catch (e) {
      const msg = String(e?.message || e || '');
      let pretty = msg;
      if (/REQUEST_DENIED/i.test(msg) || /api key/i.test(msg)) {
        pretty = 'Google Directions: REQUEST_DENIED – separater Directions-Key (ohne Android/HTTP-Referrer-Restriktion).';
      } else if (/OVER_QUERY_LIMIT/i.test(msg)) {
        pretty = 'Google Directions: OVER_QUERY_LIMIT – Quota/Billing prüfen.';
      } else if (/NOT_FOUND/i.test(msg)) {
        pretty = 'Google Directions: NOT_FOUND – Koordinaten prüfen.';
      }
      const cached = await AsyncStorage.getItem(STORE_ROUTE);
      if (cached) {
        const arr = JSON.parse(cached);
        setRouteCoords(arr);
        setRouteError(pretty + ' – Offline: zwischengespeicherte Route.');
      } else {
        setRouteError(pretty);
        setRouteCoords([]);
      }
      console.log('[directions] error:', msg);
    } finally { setRouteLoading(false); }
  }, [avoidStairs]);

  useEffect(() => {
    if (offerPos && userLocation) loadRouteFrom(userLocation, offerPos);
    else { setRouteCoords([]); setRouteError(!DIRECTIONS_KEY ? 'Kein Directions-Key' : null); }
  }, [offerPos, userLocation, loadRouteFrom]);

  // Off-Route Monitor
  useEffect(() => {
    const t = setInterval(async () => {
      const pos = lastPosRef.current;
      if (!pos || routeCoords.length < 2) return;

      const snap = nearestOnPolyline(pos, routeCoords);
      const dist = snap?.dist ?? null;
      setOffRouteDist(dist);

      const offNow = dist != null && dist > OFF_ROUTE_THRESHOLD_M;
      if (offNow && !isOffRoute) setIsOffRoute(true);
      if (!offNow && isOffRoute && dist != null && dist < OFF_ROUTE_THRESHOLD_M * 0.6) {
        setIsOffRoute(false);
        offRouteSinceRef.current = null;
      }

      if (!offNow) return;
      const now = Date.now();
      if (!offRouteSinceRef.current) { offRouteSinceRef.current = now; return; }
      const elapsed = (now - offRouteSinceRef.current) / 1000;
      const cooldownOk = now - lastRerouteTsRef.current > REROUTE_COOLDOWN_MS;

      if (!reroutePending && elapsed >= OFF_ROUTE_CONFIRM_SECS && cooldownOk) {
        if (!DIRECTIONS_KEY || !offerPosRef.current) return;
        try {
          setReroutePending(true);
          setShowOffRouteToast(true);
          setTimeout(() => setShowOffRouteToast(false), 2500);
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          await loadRouteFrom(pos, offerPosRef.current);
          lastRerouteTsRef.current = Date.now();
          setIsOffRoute(false);
          offRouteSinceRef.current = null;
        } finally {
          setReroutePending(false);
        }
      }
    }, 1000);
    return () => clearInterval(t);
  }, [routeCoords, isOffRoute, reroutePending, loadRouteFrom]);

  // Bottom-Sheet öffnen, sobald Höhe bekannt & arrived
  useEffect(() => {
    if (arrived && sheetH) {
      sheetY.setValue(sheetH);
      openSheet();
    }
  }, [arrived, sheetH, openSheet, sheetY]);

  /* ─────────── UI Actions ─────────── */
  function getEtaText() {
    if (remaining == null) return '…';
    if (remaining < ARRIVAL_THRESHOLD_METERS) return 'Ziel erreicht';
    const paceMPerMin = 5000 / 60; // ~5 km/h
    const mins = Math.max(1, Math.round(remaining / paceMPerMin));
    const eta = new Date(Date.now() + mins * 60000);
    const hh = String(eta.getHours()).padStart(2, '0');
    const mm = String(eta.getMinutes()).padStart(2, '0');
    return `Ankunft in ${mins} min (≈ ${hh}:${mm})`;
  }
  const onUserPan = () => { if (!follow) return; setFollow(false); };
  const actionFollow = () => {
    if (!userLocation) return;
    setFollow(true);
    const center = aheadOf(userLocation, heading, 25);
    try { mapRef.current?.animateCamera({ center, heading, pitch: isTilt3D ? 45 : 0 }, { duration: 300 }); lastAnimRef.current = Date.now(); } catch {}
  };
  const actionToggleTilt = () => {
    const next = !isTilt3D; setIsTilt3D(next);
    try { mapRef.current?.animateCamera({ pitch: next ? 45 : 0 }, { duration: 250 }); } catch {}
  };
  const actionToggleMapType = () => { setMapType((t) => (t === 'standard' ? 'satellite' : 'standard')); };
  const actionToggleAvoidStairs = async () => {
    const next = !avoidStairs;
    setAvoidStairs(next);
    await AsyncStorage.setItem(STORE_AVOID_STAIRS, next ? '1' : '0');
    if (userLocation && offerPos) loadRouteFrom(userLocation, offerPos);
  };

  /* ─────────── Early Returns ─────────── */
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
        <TouchableOpacity
          onPress={() => router.replace(`/offers/${id}`)}
          style={styles.backBtn}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel="Zurück zu den Angebotsdetails"
          testID="nav_back_missing_offer"
        >
          <Text style={styles.backText}>Zurück</Text>
        </TouchableOpacity>
      </View>
    );
  }

  /* ─────────── Render ─────────── */
  let navPillText = routeLoading ? 'Route…' : routeError ? 'Fallback' : 'Fußweg';
  let navPillStyle = [styles.hudPill, routeLoading ? styles.pillNeutral : routeError ? styles.pillWarn : styles.pillOk];
  if (reroutePending) { navPillText = 'Reroute…'; navPillStyle = [styles.hudPill, styles.pillNeutral]; }
  else if (isOffRoute) { navPillText = 'Abseits Route'; navPillStyle = [styles.hudPill, styles.pillWarn]; }
  const followPillStyle = [styles.hudPill, styles.pillFollowOff];

  const backdropOpacity = sheetY.interpolate({
    inputRange: [0, sheetH || 1],
    outputRange: [0.5, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        provider={PROVIDER_GOOGLE}
        initialCamera={initialCamera}
        mapType={mapType}
        customMapStyle={mapType === 'standard' ? mapStyleStepsmatchLight : []}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        loadingEnabled={false}
        scrollEnabled
        zoomEnabled
        pitchEnabled
        rotateEnabled
        onPanDrag={onUserPan}
        onMapReady={() => console.log('Map ready')}
        onError={(e) => console.log('Nav map error', e?.nativeEvent)}
        accessibilityLabel="Karte zur Navigation"
        testID="nav_map"
      >
        {/* Ziel-Marker */}
        {offerPos && (
          <Marker coordinate={offerPos} title={offer?.name || 'Ziel'} opacity={activeNow ? 1 : 0.5}>
            <Animated.View style={{ alignItems: 'center', transform: [{ scale: destPulse }] }}>
              <View style={[styles.pinCore, { backgroundColor: colors.primary, borderColor: '#fff', shadowColor: colors.primary }]} />
              <View style={[styles.pinDot, { backgroundColor: colors.primary }]} />
            </Animated.View>
          </Marker>
        )}

        {/* Confidence-Ring */}
        {userLocation && userAccuracy != null && userAccuracy > 0 && (
          <Circle
            center={userLocation}
            radius={Math.max(8, Math.min(userAccuracy, 60))}
            strokeWidth={0}
            fillColor="rgba(13,78,166,0.12)" // BRAND_BLUE 12%
            zIndex={1}
          />
        )}

        {/* Route */}
        {remainingRoute.length >= 2 && (
          <Polyline
            coordinates={remainingRoute}
            strokeWidth={6}
            strokeColor="rgba(13,78,166,0.95)" // BRAND_BLUE
            zIndex={2}
          />
        )}
      </MapView>

      {/* HUD oben (Safe-Area aware) */}
      <Animated.View
        {...hudPan.panHandlers}
        style={[
          styles.hudTop,
          { transform: [{ translateY: hudTranslateY }], top: insets.top + 8 }
        ]}
        pointerEvents="box-none"
        testID="nav_hud_top"
        accessible
        accessibilityRole="summary"
        accessibilityLabel={`Navigation zu ${offer?.name || 'Angebot'}`}
      >
        <View style={styles.hudRow}>
          <Text style={styles.hudTitle} numberOfLines={1}>
            {offer?.name || 'Navigation'}
          </Text>
          <View style={styles.pillsRow}>
            <Text style={[styles.hudPill, activeNow ? styles.pillOk : styles.pillWarn]}>
              {activeNow ? 'Aktiv' : 'Derzeit nicht aktiv'}
            </Text>

            {!follow && <Text style={followPillStyle}>Folgen aus</Text>}
            {avoidStairs && <Text style={[styles.hudPill, styles.pillNeutral]}>Stufenfrei</Text>}
            <Text style={navPillStyle}>{navPillText}</Text>
          </View>
        </View>

        <Text style={styles.hudInstr}>
          {remaining != null
            ? (remaining < ARRIVAL_THRESHOLD_METERS
                ? '🎯 Ziel erreicht'
                : `➡ ${getEtaText()} • Noch ${formatDistance(remaining)}`)
            : 'Routeninfo wird berechnet …'}
        </Text>

        {/* Adresse beim Herunterziehen */}
        <Animated.View style={{ marginTop: 8, opacity: addrOpacity }}>
          <Text style={styles.addrText} numberOfLines={2}>{providerAddress}</Text>
          <Text style={styles.addrHint}>(Nach unten ziehen – lässt beim Loslassen wieder einziehen)</Text>
        </Animated.View>

        {isOffRoute && offRouteDist != null && (
          <Text style={styles.hudWarnSmall}>Du bist ca. {Math.round(offRouteDist)} m neben der Route.</Text>
        )}
        {!DIRECTIONS_KEY && <Text style={styles.hudWarn}>Kein Google Directions API-Key verfügbar.</Text>}
        {routeError && <Text style={styles.hudWarnSmall}>Hinweis: {String(routeError).replace('Error: ', '')}</Text>}
      </Animated.View>

      {/* FAB-Cluster (Safe-Area aware) */}
      <View style={[styles.fabCluster, { bottom: (insets.bottom || 0) + 112 }]} pointerEvents="box-none">
        <TouchableOpacity
          onPress={actionFollow}
          style={styles.fab}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel={follow ? 'Auf Position zentrieren' : 'Kartenverfolgung aktivieren'}
          testID="nav_follow_fab"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.fabText}>{follow ? '◎' : '⟲'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={actionToggleTilt}
          style={styles.fab}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel={isTilt3D ? '3D-Ansicht deaktivieren' : '3D-Ansicht aktivieren'}
          testID="nav_tilt_fab"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.fabText}>{isTilt3D ? '3D' : '2D'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={actionToggleMapType}
          style={styles.fab}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel={mapType === 'standard' ? 'Satellitenkarte anzeigen' : 'Standardkarte anzeigen'}
          testID="nav_maptype_fab"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.fabText}>{mapType === 'standard' ? 'SAT' : 'MAP'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={actionToggleAvoidStairs}
          style={styles.fab}
          activeOpacity={0.9}
          accessibilityRole="switch"
          accessibilityState={{ checked: !!avoidStairs }}
          accessibilityLabel="Stufenfreie Route bevorzugen"
          testID="nav_avoid_stairs_fab"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialIcons name="accessible" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* HUD unten (Safe-Area aware) */}
      <View style={[styles.hudBottom, { bottom: (insets.bottom || 0) + 16 }]}>
        <TouchableOpacity
          onPress={() => router.replace(`/offers/${id}`)}
          style={[styles.btn, { backgroundColor: colors.primary }]}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel="Zurück zu den Angebotsdetails"
          testID="nav_back_to_details"
        >
          <Text style={[styles.btnText, { color: '#fff' }]}>Zurück zu Details</Text>
        </TouchableOpacity>
      </View>

      {/* Off-Route Toast */}
      {showOffRouteToast && (
        <View style={[styles.toastWrap, { bottom: (insets.bottom || 0) + 76 }]} pointerEvents="none">
          <View style={styles.toast}>
            <Text style={styles.toastText}>Kleiner Umweg – ich passe die Route an ✨</Text>
          </View>
        </View>
      )}

      {/* Arrival Bottom-Sheet (Safe-Area aware) */}
      {arrived && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none" testID="nav_arrival_overlay">
          <ConfettiOverlay />
          <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
          <Animated.View
            {...pan.panHandlers}
            style={[styles.sheetWrap, { transform: [{ translateY: sheetY }], bottom: (insets.bottom || 0) + 16 }]}
            onLayout={(e) => setSheetH(e.nativeEvent.layout.height)}
            accessibilityViewIsModal
            accessible
            accessibilityRole="dialog"
            accessibilityLabel="Ziel erreicht"
            testID="nav_arrival_sheet"
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>🎯 Ziel erreicht</Text>
            <Text style={styles.sheetSub}>Du bist am Angebot angekommen.</Text>
            <View style={{ height: 12 }} />
            <TouchableOpacity
              onPress={() => closeSheet(() => router.replace(`/offers/${id}`))}
              style={[styles.sheetBtn, styles.sheetBtnPrimary]}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel="Zurück zu den Angebotsdetails"
              testID="nav_arrival_back"
            >
              <Text style={styles.sheetBtnText}>Zurück zu Details</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => closeSheet()}
              style={[styles.sheetBtn, { marginTop: 8 }]}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel="Weiter navigieren"
              testID="nav_arrival_continue"
            >
              <Text style={styles.sheetBtnText}>Weiter navigieren</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

/* ─────────── Konfetti ─────────── */
function ConfettiOverlay() {
  const count = 12;
  const drops = React.useMemo(() => Array.from({ length: count }, () => new Animated.Value(-20)), []);
  useEffect(() => {
    drops.forEach((drop, i) => {
      Animated.timing(drop, {
        toValue: 300,
        duration: 1400 + (i % 4) * 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    });
  }, [drops]);

  return (
    <View pointerEvents="none" style={styles.confettiWrap}>
      {drops.map((drop, i) => {
        const leftPct = (i / drops.length) * 100;
        const rotate = `${i * 45}deg`;
        return (
          <Animated.View key={`conf-${i}`} style={{ position: 'absolute', top: 0, left: `${leftPct}%`, transform: [{ translateY: drop }, { rotate }] }}>
            <View style={[styles.confettiPiece, { backgroundColor: confettiColor(i) }]} />
          </Animated.View>
        );
      })}
    </View>
  );
}
function confettiColor(i) {
  const palette = ['#0d4ea6', '#7dd3fc', '#34d399', '#fbbf24', '#f472b6', '#a78bfa']; // BRAND first
  return palette[i % palette.length];
}

/* ─────────── Styles ─────────── */
const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  hudTop: {
    position: 'absolute',
    left: 12, right: 12,
    backgroundColor: 'rgba(16,18,22,0.66)',
    borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  hudRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pillsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  hudTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  hudInstr: { color: '#E9F1FF', fontSize: 14, marginTop: 8, lineHeight: 20 },

  addrText: { color: '#E9F1FF', fontSize: 13, fontWeight: '600' },
  addrHint: { color: 'rgba(233,241,255,0.7)', fontSize: 11, marginTop: 2 },

  hudWarn: { color: '#ffd966', fontSize: 12, marginTop: 8 },
  hudWarnSmall: { color: '#ffb3b3', fontSize: 11, marginTop: 6 },

  hudPill: {
    color: '#fff', fontSize: 12,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  pillOk:   { backgroundColor: 'rgba(46, 213, 115, 0.22)' },
  pillWarn: { backgroundColor: 'rgba(255, 149, 0, 0.22)' },
  pillNeutral: { backgroundColor: 'rgba(255,255,255,0.18)' },
  pillFollowOff: { backgroundColor: 'rgba(255, 180, 0, 0.25)' },

  hudBottom: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  btn: {
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)'
  },
  btnText: { fontWeight: '700' },

  fabCluster: { position: 'absolute', right: 16, alignItems: 'center', gap: 10 },
  fab: {
    backgroundColor: '#0F1115', opacity: 0.95,
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    elevation: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  fabText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },

  sheetWrap: {
    position: 'absolute',
    left: 12, right: 12,
    backgroundColor: '#0f1522',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#0d4ea6'
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44, height: 5, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.28)',
    marginBottom: 10,
  },
  sheetTitle: { color: '#E9F1FF', fontSize: 16, fontWeight: 'bold' },
  sheetSub: { color: '#c9d8f5', fontSize: 13, marginTop: 4 },
  sheetBtn: {
    backgroundColor: '#111', opacity: 0.95,
    paddingHorizontal: 18, paddingVertical: 12,
    borderRadius: 12, alignItems: 'center'
  },
  sheetBtnPrimary: { backgroundColor: '#0d4ea6' },
  sheetBtnText: { color: '#fff', fontWeight: 'bold' },

  pinCore: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#0d4ea6',
    borderWidth: 2, borderColor: 'white',
    shadowColor: '#0d4ea6', shadowOpacity: 0.55, shadowRadius: 6, shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  pinDot: { marginTop: 4, width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(13,78,166,0.85)' },

  dot: {
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: 'rgba(13,78,166,0.92)',
    borderWidth: 1, borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },

  toastWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  toast: {
    backgroundColor: 'rgba(16,18,22,0.9)',
    borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  toastText: { color: '#E9F1FF' },

  confettiWrap: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  confettiPiece: { width: 10, height: 16, borderRadius: 3, marginHorizontal: 2 },

  backBtn: {
    marginTop: 14,
    backgroundColor: '#0F1115',
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  backText: { color: '#fff', fontWeight: '700' },
});
