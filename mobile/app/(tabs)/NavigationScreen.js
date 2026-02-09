// stepsmatch/mobile/app/(tabs)/NavigationScreen.js
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Vibration, Animated, PanResponder, Easing, Dimensions } from 'react-native';
import MapView, { Marker, Circle, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { DeviceMotion } from 'expo-sensors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@react-navigation/native';
import colors from '../../theme/colors';
import fetchRoute from '../../services/directions';
import mapStyleStepsmatchLight from '../../theme/mapStyleDark';
import { MaterialIcons } from '@expo/vector-icons';
import { isOfferActiveNow } from '../../utils/isOfferActiveNow';
import Constants from 'expo-constants';

/* ───────── constants / config ───────── */
const API_URL = 'https://lobster-app-ie9a5.ondigitalocean.app/api';
const OID24 = /^[0-9a-fA-F]{24}$/;

function resolveDirectionsKey() {
  const kExtra = Constants?.expoConfig?.extra?.directionsKey ?? Constants?.manifest?.extra?.directionsKey ?? null;
  const kEnv = (typeof process !== 'undefined' && process?.env?.EXPO_PUBLIC_GOOGLE_DIRECTIONS_KEY) || null;
  const key = String(kExtra ?? kEnv ?? '').trim();
  return key;
}
const DIRECTIONS_KEY = resolveDirectionsKey();

const { width, height } = Dimensions.get('window');
const ASPECT = width / height;

/* ───────── geo helpers ───────── */
const sin2 = (x)=> Math.sin(x)**2; // vor Nutzung definieren (Fix)
const toRad = (x) => (x * Math.PI) / 180;
const toDeg = (x) => (x * 180) / Math.PI;
function distanceMeters(a, b) {
  if (!a || !b) return null;
  const R = 6371e3;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const A = Math.sin(dLat/2)**2 + Math.cos(toRad(a.latitude))*Math.cos(toRad(b.latitude))*sin2(dLon/2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(A), Math.sqrt(1 - A)));
}

const FALLBACK_CENTER = { latitude: 47.0707, longitude: 15.4395 };
const ARRIVAL_THRESHOLD_METERS = 15;
const REMAINING_TICK_MS = 1000;
const POSITION_UPDATE_MIN_DIST = 3;
const ANIMATE_THROTTLE_MS = 600;
const HEADING_UPDATE_EVERY_METERS = 100;
const HEADING_SNAP_DEG = 15;
const OFF_ROUTE_THRESHOLD_M = 35;
const OFF_ROUTE_CONFIRM_SECS = 3;
const REROUTE_COOLDOWN_MS = 15000;

const ARRIVAL_HAPTIC_BURSTS = 3;
const ARRIVAL_HAPTIC_INTERVAL_MS = 120;
const ARRIVAL_VIBRATION_PATTERN = [0,220,80,260,80,300];

const TURN_MIN_ANGLE_DEG = 30;

const STORE_ROUTE = 'stepsmatch:lastRoute';
const STORE_OFFER = 'stepsmatch:lastOffer';
const STORE_AVOID_STAIRS = 'stepsmatch:avoidStairs';

/* ───────── vector helpers ───────── */
const toDegAngle = (a) => ((a % 360) + 360) % 360;
const angleDeltaDeg = (a, b) => ((b - a + 540) % 360) - 180;
const smoothHeading = (prev, next, alpha = 0.2) => {
  const d = angleDeltaDeg(prev, next);
  let h = prev + d*alpha; if (h < 0) h += 360; if (h >= 360) h -= 360; return h;
};
const aheadOf = (pos, headingDeg, meters = 25) => {
  if (!pos || !Number.isFinite(meters)) return pos;
  const R = 6371e3, δ = meters / R, θ = toRad(headingDeg);
  const φ1 = toRad(pos.latitude), λ1 = toRad(pos.longitude);
  const sinφ1 = Math.sin(φ1), cosφ1 = Math.cos(φ1), sinδ = Math.sin(δ), cosδ = Math.cos(δ);
  const sinφ2 = sinφ1*cosδ + cosφ1*sinδ*Math.cos(θ); const φ2 = Math.asin(sinφ2);
  const y = Math.sin(θ)*sinδ*cosφ1; const x = cosδ - sinφ1*sinφ2; const λ2 = λ1 + Math.atan2(y, x);
  return { latitude: toDeg(φ2), longitude: toDeg(λ2) };
};
const bearingDegrees = (from, to) => {
  const φ1 = toRad(from.latitude), φ2 = toRad(to.latitude);
  const λ1 = toRad(from.longitude), λ2 = toRad(to.longitude);
  const y = Math.sin(λ2-λ1)*Math.cos(φ2);
  const x = Math.cos(φ1)*Math.sin(φ2) - Math.sin(φ1)*Math.cos(φ2)*Math.cos(λ2-λ1);
  return toDegAngle(toDeg(Math.atan2(y, x)));
};

/* ───────── polyline helpers ───────── */
const lerpCoord = (p1, p2, t)=>({ latitude: p1.latitude + (p2.latitude - p1.latitude)*t, longitude: p1.longitude + (p2.longitude - p1.longitude)*t });
const nearestOnPolyline = (pos, route) => {
  if (!route || route.length < 2) return { dist: 0, index: 0, t: 0, point: route?.[0] ?? pos };
  let best = { dist: Infinity, index: 0, t: 0, point: route[0] };
  for (let i=0;i<route.length-1;i++){
    const a=route[i], b=route[i+1];
    const ax=a.longitude, ay=a.latitude, bx=b.longitude, by=b.latitude;
    const px=pos.longitude, py=pos.latitude;
    const abx=bx-ax, aby=by-ay;
    const apx=px-ax, apy=py-ay;
    const ab2=abx*abx+aby*aby || 1e-12;
    let t=(apx*abx+apy*aby)/ab2; t=Math.max(0, Math.min(1,t));
    const proj={ latitude: ay+aby*t, longitude: ax+abx*t };
    const d=distanceMeters(pos, proj);
    if(d<best.dist) best={ dist:d, index:i, t, point:proj };
  }
  return best;
};
const remainingRouteFrom = (pos, fullRoute, snapAheadMeters = 10) => {
  if (!fullRoute || fullRoute.length < 2 || !pos) return fullRoute ?? [];
  const snap = nearestOnPolyline(pos, fullRoute);
  const nextIdx = Math.min(snap.index + 1, fullRoute.length - 1);
  const distToNext = distanceMeters(pos, fullRoute[nextIdx]) ?? 0;
  let head = lerpCoord(fullRoute[snap.index], fullRoute[snap.index+1], snap.t);
  let startIdx = snap.index + 1;
  if (distToNext < snapAheadMeters) { head = fullRoute[nextIdx]; startIdx = nextIdx + 1; }
  return [head, ...fullRoute.slice(startIdx)];
};
const approxRouteDistance = (coords=[]) => {
  let m = 0;
  for (let i=0;i<coords.length-1;i++) m += distanceMeters(coords[i], coords[i+1]) || 0;
  return m;
};

/* ───────── component ───────── */
export default function NavigationScreen() {
  const t = useTheme();
  const pal = t?.colors ?? colors;

  const { id: rawId } = useLocalSearchParams();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const insets = useSafeAreaInsets();

  /* state */
  const [offer, setOffer] = useState(null);
  const [providerDoc, setProviderDoc] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [userAccuracy, setUserAccuracy] = useState(null);
  const [heading, setHeading] = useState(0);           // Kurs (aus Bewegung), NICHT Gerät-Orientation
  const [compassMode, setCompassMode] = useState(false); // optionaler Kompass (Standard: aus)
  const [loading, setLoading] = useState(true);
  const [remaining, setRemaining] = useState(null);
  const [mapType, setMapType] = useState('standard');
  const [follow, setFollow] = useState(true);
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

  /* refs */
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
  const hudPullY = useRef(new Animated.Value(0)).current;

  // Fortschritt (Startdistanz → Prozent)
  const initialDistanceRef = useRef(null);

  /* derived */
  const offerPos = useMemo(() => {
    const lat = Number(offer?.location?.coordinates?.[1]);
    const lng = Number(offer?.location?.coordinates?.[0]);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { latitude: lat, longitude: lng } : null;
  }, [offer]);

  const initialRegion = useMemo(() => {
    const c = userLocation || offerPos || FALLBACK_CENTER;
    return { latitude: c.latitude, longitude: c.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 * ASPECT };
  }, [userLocation, offerPos]);

  const remainingRoute = useMemo(() => {
    if (routeCoords.length > 1 && userLocation) return remainingRouteFrom(userLocation, routeCoords, 10);
    if (userLocation && offerPos) return [userLocation, offerPos];
    return [];
  }, [routeCoords, userLocation, offerPos]);

  const providerAddress = useMemo(() => {
    const fromOffer = (offer && typeof offer.provider === 'object' && offer.provider?.address) || offer?.address;
    const fromDoc = providerDoc?.address;
    return fromOffer || fromDoc || 'Adresse nicht verfügbar';
  }, [offer, providerDoc]);

  const activeNow = useMemo(() => (offer ? isOfferActiveNow(offer, 'Europe/Vienna') : false), [offer]);

  // Pfeil-Marker (dezent, alle ~80 m)
  const arrowMarkers = useMemo(() => {
    if (!remainingRoute || remainingRoute.length < 2) return [];
    const out = [];
    let acc = 0;
    for (let i = 0; i < remainingRoute.length - 1; i++) {
      const a = remainingRoute[i], b = remainingRoute[i + 1];
      const seg = distanceMeters(a, b) || 0;
      acc += seg;
      if (acc >= 80) {
        acc = 0;
        const rot = bearingDegrees(a, b);
        out.push({ coord: b, rot });
      }
    }
    return out;
  }, [remainingRoute]);

  /* animations */
  const openSheet   = useCallback(()=> Animated.timing(sheetY,{toValue:0,duration:240,easing:Easing.out(Easing.cubic),useNativeDriver:true}).start(),[sheetY]);
  const closeSheet  = useCallback((cb)=> Animated.timing(sheetY,{toValue:sheetH||280,duration:220,easing:Easing.in(Easing.cubic),useNativeDriver:true}).start(()=>{ setArrived(false); cb&&cb(); }),[sheetY,sheetH]);

  const addrOpacity   = useMemo(()=> hudPullY.interpolate({inputRange:[0,20,120],outputRange:[0,0.4,1],extrapolate:'clamp'}),[hudPullY]);
  const hudTranslateY = useMemo(()=> hudPullY.interpolate({inputRange:[0,140],outputRange:[0,140],extrapolate:'clamp'}),[hudPullY]);

  // Sanftes Folgen: Karte bleibt Nord-oben. Optionaler Kompass dreht Karte nur bei Bedarf.
  const animateTo = useCallback((pos, maybeHeading=false)=>{
    const now = Date.now();
    if (now - lastAnimRef.current < ANIMATE_THROTTLE_MS) return;
    const last = lastPosRef.current;
    theMove: {
      const moved = last ? (distanceMeters(last, pos) ?? 0) : Infinity;
      if (moved < POSITION_UPDATE_MIN_DIST) break theMove;
    }

    // Kurs (aus Bewegung) für Look-ahead ermitteln
    let course = heading;
    if (maybeHeading && lastHeadingUpdatePosRef.current) {
      const since = distanceMeters(lastHeadingUpdatePosRef.current, pos) ?? 0;
      if (since >= HEADING_UPDATE_EVERY_METERS) {
        const raw = bearingDegrees(lastHeadingUpdatePosRef.current, pos);
        const delta = Math.abs(angleDeltaDeg(course, raw));
        if (delta >= HEADING_SNAP_DEG) {
          course = smoothHeading(course, raw, 0.25);
          setHeading(course);
          lastHeadingUpdatePosRef.current = pos;
        }
      }
    }

    // Optional: Gerätekopmass nur wenn Kompassmodus aktiv
    let nextHeading = 0;
    if (compassMode) {
      if (deviceMotionHeadingRef.current != null) {
        nextHeading = smoothHeading(course, deviceMotionHeadingRef.current, 0.18);
      } else {
        nextHeading = course;
      }
    }

    const center = follow ? aheadOf(pos, course, 28) : undefined;

    try {
      if (compassMode) {
        mapRef.current?.animateCamera({ center, heading: nextHeading, pitch: 0 }, { duration: 450 });
      } else {
        mapRef.current?.animateCamera({ center }, { duration: 450 }); // Nord-oben, keine Drehung
      }
      lastAnimRef.current = now; lastPosRef.current = pos;
    } catch {}
  }, [follow, compassMode, heading]);

  /* pans */
  const pan = useMemo(()=> PanResponder.create({
    onMoveShouldSetPanResponder:(_,g)=> Math.abs(g.dy)>5,
    onPanResponderMove:(_,g)=>{ const next=Math.max(0,g.dy); sheetY.setValue(next); },
    onPanResponderRelease:(_,g)=>{ (g.dy>120||g.vy>1.0)? closeSheet(): openSheet(); },
  }),[sheetY,openSheet,closeSheet]);

  const hudPan = useMemo(()=> PanResponder.create({
    onMoveShouldSetPanResponder:(_,g)=> g.dy>6 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove:(_,g)=> hudPullY.setValue(Math.max(0,g.dy)),
    onPanResponderRelease:()=> Animated.timing(hudPullY,{toValue:0,duration:180,easing:Easing.out(Easing.cubic),useNativeDriver:true}).start(),
  }),[hudPullY]);

  /* device motion subscription – nur im Kompassmodus */
  useEffect(()=> {
    let sub;
    if (compassMode) {
      try {
        sub = DeviceMotion.addListener(d=>{
          const yawDeg=((d?.rotation?.alpha||0)*180)/Math.PI;
          deviceMotionHeadingRef.current=((yawDeg%360)+360)%360;
        });
        DeviceMotion.setUpdateInterval(200);
      } catch {}
    }
    return ()=> {
      try { sub?.remove?.(); } catch {}
      try { DeviceMotion.removeAllListeners?.(); } catch {}
      deviceMotionHeadingRef.current = null;
    };
  }, [compassMode]);

  /* initial load */
  useEffect(()=>{
    console.log('[NAV]', JSON.stringify({ evt:'start', offerId:id, directionsKeyPresent: !!DIRECTIONS_KEY }));
    let mounted = true;
    (async()=>{
      try{
        setLoading(true);
        if (!OID24.test(String(id||''))) { setOffer(null); setLoading(false); console.log('[ERROR]', JSON.stringify({ code:'invalid_offer_id', id })); return; }

        let res;
        try{ res = await axios.get(`${API_URL}/offers/${id}`, { params:{ withProvider:1 } }); }
        catch(e) { console.log('[ERROR]', JSON.stringify({ code:'offer_fetch_withProvider_fail', id, msg: String(e?.message||e) })); res = await axios.get(`${API_URL}/offers/${id}`); }

        if (!mounted) return;
        const offerData = res?.data?.offer ?? res?.data ?? null;
        setOffer(offerData);
        await AsyncStorage.setItem(STORE_OFFER, JSON.stringify(offerData));
        const coords = offerData?.location?.coordinates;
        console.log('[NAV]', JSON.stringify({ evt:'offer_loaded', id, dest: coords ? { lng:coords[0], lat:coords[1] } : null }));

        try{
          if (offerData?.provider && typeof offerData.provider === 'string'){
            const pRes = await axios.get(`${API_URL}/providers/${offerData.provider}`);
            if (mounted) setProviderDoc(pRes.data);
          } else if (offerData?.provider && offerData.provider?.address) {
            setProviderDoc(offerData.provider);
          } else { setProviderDoc(null); }
        } catch(e) {
          console.log('[ERROR]', JSON.stringify({ code:'provider_fetch_fail', id, msg:String(e?.message||e) }));
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.log('[ERROR]', JSON.stringify({ code:'location_denied' }));
          return;
        }

        const loc = await Location.getCurrentPositionAsync({});
        if (!mounted) return;
        const pos = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setUserLocation(pos);
        setUserAccuracy(loc.coords.accuracy ?? null);
        lastPosRef.current = pos; lastHeadingUpdatePosRef.current = pos;
        console.log('[NAV]', JSON.stringify({ evt:'initial_pos', pos, acc: loc.coords.accuracy }));

        if (offerData?.location?.coordinates) {
          const dest = { latitude: Number(offerData.location.coordinates[1]), longitude: Number(offerData.location.coordinates[0]) };
          const d0 = distanceMeters(pos, dest);
          setRemaining(d0);
          initialDistanceRef.current = d0;
        }

        posSub.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 2 },
          (l)=>{ const p={ latitude:l.coords.latitude, longitude:l.coords.longitude }; setUserLocation(p); setUserAccuracy(l.coords.accuracy ?? null); animateTo(p, true); }
        );
      } catch (e) {
        console.log('[ERROR]', JSON.stringify({ code:'init_fail', msg:String(e?.message||e) }));
        try { const cachedOffer = await AsyncStorage.getItem(STORE_OFFER); if (cachedOffer) setOffer(JSON.parse(cachedOffer)); } catch {}
      } finally { setLoading(false); }
    })();
    return()=>{ mounted=false; try{ posSub.current?.remove?.(); }catch{} posSub.current=null; };
  },[id,animateTo]);

  /* remaining ticker */
  useEffect(()=>{
    const t = setInterval(()=>{
      const pos = lastPosRef.current; const dest = offerPosRef.current;
      if (pos && dest) {
        const m = distanceMeters(pos, dest);
        if (m!==null) setRemaining(m);
        if (initialDistanceRef.current==null && m!=null) initialDistanceRef.current = m;
      }
    }, REMAINING_TICK_MS);
    return ()=> clearInterval(t);
  },[]);

  /* offer pos mirror */
  useEffect(()=>{ offerPosRef.current = offerPos; },[offerPos]);

  /* arrival feedback */
  useEffect(()=>{
    if (remaining != null && remaining < ARRIVAL_THRESHOLD_METERS && !arrivalNotifiedRef.current) {
      arrivalNotifiedRef.current = true; setArrived(true);
      console.log('[ROUTE]', JSON.stringify({ evt:'arrived', remaining }));
      (async ()=>{
        try{ for (let i=0;i<ARRIVAL_HAPTIC_BURSTS;i++){ await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); await new Promise(r=>setTimeout(r,ARRIVAL_HAPTIC_INTERVAL_MS)); } await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);}catch{}
        try{ Vibration.vibrate(ARRIVAL_VIBRATION_PATTERN); }catch{}
        try{ const asset = require('../../assets/sounds/arrival.mp3'); const { sound } = await Audio.Sound.createAsync(asset,{ shouldPlay:true }); soundRef.current=sound; }catch{}
      })();
    }
  },[remaining]);

  /* load route */
  const loadRouteFrom = useCallback(async (origin,dest)=>{
    if (!dest || !origin || !DIRECTIONS_KEY) {
      setRouteCoords([]);
      setRouteError(!DIRECTIONS_KEY?'Kein Directions-Key':null);
      console.log('[DIRECTIONS]', JSON.stringify({ evt:'skip', reason: !DIRECTIONS_KEY ? 'no_key' : 'missing_origin_or_dest' }));
      return;
    }
    const t0 = Date.now();
    try{
      setRouteLoading(true); setRouteError(null);
      console.log('[DIRECTIONS]', JSON.stringify({ evt:'request', origin, dest, mode:'walking' }));
      const coords = await fetchRoute(origin,dest,DIRECTIONS_KEY,'walking',{ avoidStairs: !!avoidStairs, timeoutMs: 10000 });
      const arr = Array.isArray(coords)?coords:[];
      setRouteCoords(arr);
      await AsyncStorage.setItem(STORE_ROUTE, JSON.stringify(arr));
      const took = Date.now()-t0;
      const distApprox = approxRouteDistance(arr);
      console.log('[DIRECTIONS]', JSON.stringify({ evt:'ok', tookMs:took, points:arr.length, distMetersApprox: distApprox }));
      if (arr.length>1) setTimeout(()=> mapRef.current?.fitToCoordinates(arr,{ edgePadding:{ top:80,right:80,bottom:120,left:80 }, animated:true }), 250);
    }catch(e){
      const msg = String(e?.message||e||'');
      console.log('[DIRECTIONS]', JSON.stringify({ evt:'fail', msg }));
      let pretty = msg;
      if (/REQUEST_DENIED/i.test(msg)) pretty = 'Google Directions: REQUEST_DENIED – Key/Restriktion prüfen.';
      else if (/OVER_QUERY_LIMIT/i.test(msg)) pretty = 'Google Directions: OVER_QUERY_LIMIT – Quota/Billing prüfen.';
      else if (/NOT_FOUND/i.test(msg)) pretty = 'Google Directions: NOT_FOUND – Koordinaten prüfen.';
      const cached = await AsyncStorage.getItem(STORE_ROUTE);
      if (cached){ const arr=JSON.parse(cached); setRouteCoords(arr); setRouteError(pretty+' – Offline: Cache benutzt.'); }
      else { setRouteError(pretty); setRouteCoords([]); }
    } finally { setRouteLoading(false); }
  },[avoidStairs]);

  useEffect(()=>{ if (offerPos && userLocation) loadRouteFrom(userLocation, offerPos); else { setRouteCoords([]); setRouteError(!DIRECTIONS_KEY?'Kein Directions-Key':null); } },[offerPos,userLocation,loadRouteFrom]);

  /* off-route monitor */
  useEffect(()=>{
    const t = setInterval(async ()=>{
      const pos = lastPosRef.current;
      if (!pos || routeCoords.length < 2) return;
      const snap = nearestOnPolyline(pos, routeCoords);
      const dist = snap?.dist ?? null; setOffRouteDist(dist);
      const offNow = dist!=null && dist>OFF_ROUTE_THRESHOLD_M;
      if (offNow && !isOffRoute) { setIsOffRoute(true); console.log('[ROUTE]', JSON.stringify({ evt:'off_path', deltaM:Math.round(dist) })); }
      if (!offNow && isOffRoute && dist!=null && dist<OFF_ROUTE_THRESHOLD_M*0.6) { setIsOffRoute(false); offRouteSinceRef.current=null; }
      if (!offNow) return;
      const now = Date.now();
      if (!offRouteSinceRef.current) { offRouteSinceRef.current = now; return; }
      const elapsed = (now - offRouteSinceRef.current)/1000;
      const cooldownOk = now - lastRerouteTsRef.current > REROUTE_COOLDOWN_MS;
      if (!reroutePending && elapsed>=OFF_ROUTE_CONFIRM_SECS && cooldownOk) {
        if (!DIRECTIONS_KEY || !offerPosRef.current) return;
        try{
          setReroutePending(true); setShowOffRouteToast(true); setTimeout(()=>setShowOffRouteToast(false),2500);
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(()=>{});
          console.log('[ROUTE]', JSON.stringify({ evt:'reroute', reason:'off_path', elapsedSec: elapsed }));
          await loadRouteFrom(pos, offerPosRef.current);
          lastRerouteTsRef.current = Date.now();
          setIsOffRoute(false); offRouteSinceRef.current=null;
        } finally { setReroutePending(false); }
      }
    }, 1000);
    return ()=> clearInterval(t);
  },[routeCoords,isOffRoute,reroutePending,loadRouteFrom]);

  /* actions */
  const onUserPan = ()=>{ if (!follow) return; setFollow(false); };
  const actionFollow = ()=>{
    if (!userLocation) return; setFollow(true);
    const center = aheadOf(userLocation, heading, 25);
    try{ mapRef.current?.animateCamera({ center }, { duration:300 }); lastAnimRef.current=Date.now(); }catch{}
    console.log('[NAV]', JSON.stringify({ evt:'follow' }));
  };
  const actionToggleMapType = ()=> { const next = mapType==='standard'?'satellite':'standard'; setMapType(next); console.log('[NAV]', JSON.stringify({ evt:'toggle_maptype', next })); };
  const actionToggleAvoidStairs = async ()=>{ const next=!avoidStairs; setAvoidStairs(next); await AsyncStorage.setItem(STORE_AVOID_STAIRS,next?'1':'0'); if (userLocation&&offerPos) loadRouteFrom(userLocation,offerPos); console.log('[NAV]', JSON.stringify({ evt:'toggle_avoid_stairs', next })); };
  const actionToggleCompass = ()=>{ const next = !compassMode; setCompassMode(next); console.log('[NAV]', JSON.stringify({ evt:'toggle_compass', next })); };

  /* early returns */
  if (!offer && loading) return <View style={styles.center}><Text style={{ color: (t?.colors?.inkLow) || '#999' }}>Lade Navigation …</Text></View>;
  if (!offer) {
    return (
      <View style={styles.center}>
        <Text style={{ color: (t?.colors?.inkLow) || '#999' }}>Angebot nicht gefunden</Text>
        <TouchableOpacity
          onPress={()=>router.replace(`/offers/${id}`)}
          style={[styles.backBtn,{ backgroundColor: (t?.colors?.card) || '#0F1115', borderColor: 'rgba(255,255,255,0.08)'}]}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel="Zurück zu den Angebotsdetails"
          testID="nav_back_missing_offer"
        >
          <Text style={[styles.backText,{ color:'#fff'}]}>Zurück</Text>
        </TouchableOpacity>
      </View>
    );
  }

  /* turn hint + coach text */
  let turnText = null;
  if (remainingRoute.length >= 2 && userLocation) {
    const next = remainingRoute[1];
    const brg = bearingDegrees(userLocation, next);
    const delta = angleDeltaDeg(heading, brg);
    const abs = Math.abs(delta);
    if (abs > TURN_MIN_ANGLE_DEG)      turnText = delta > 0 ? 'rechts abbiegen' : 'links abbiegen';
    else                               turnText = 'geradeaus';
  }

  const etaText = (() => {
    if (remaining == null) return '…';
    if (remaining < ARRIVAL_THRESHOLD_METERS) return 'Ziel erreicht';
    const paceMPerMin = 5000/60;
    const mins = Math.max(1, Math.round(remaining / paceMPerMin));
    return `Ankunft in ${mins} min`;
  })();

  const progressPct = (() => {
    const d0 = initialDistanceRef.current;
    if (!Number.isFinite(d0) || !Number.isFinite(remaining)) return 0;
    const done = Math.max(0, d0 - remaining);
    return Math.max(0, Math.min(1, done / Math.max(1, d0)));
  })();

  // Coach-Motivation
  const coachLine = (() => {
    if (remaining == null) return 'Los geht’s 🚶';
    if (remaining < ARRIVAL_THRESHOLD_METERS) return '🎯 Geschafft!';
    if (remaining < 30)  return `Go, nur noch ${remaining} m ✨`;
    if (remaining < 100) return `Fast da – ${remaining} m`;
    if (remaining < 300) return 'Super Tempo 💪';
    return 'Let’s go 🚶';
  })();

  let navPillText = routeLoading ? 'Route…' : routeError ? 'Fallback' : 'Fußweg';
  let navPillStyle = [styles.badgeUniform, styles.badgeNeutral];
  if (reroutePending) { navPillText = 'Reroute…'; }
  else if (isOffRoute) { navPillText = 'Abseits Route'; navPillStyle = [styles.badgeUniform, styles.badgeWarn]; }

  const backdropOpacity = sheetY.interpolate({ inputRange:[0, sheetH||1], outputRange:[0.5,0], extrapolate:'clamp' });

  return (
    <View style={{ flex:1, backgroundColor: (t?.colors?.background) }}>
      <MapView
        ref={mapRef}
        style={{ flex:1 }}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        mapType={mapType}
        customMapStyle={mapType==='standard' ? mapStyleStepsmatchLight : []}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        scrollEnabled
        zoomEnabled
        pitchEnabled={false}
        rotateEnabled={compassMode}     // Standard: keine Rotation (Nord-oben)
        onPanDrag={onUserPan}
        accessibilityLabel="Karte zur Navigation"
        testID="nav_map"
      >
        {/* Ziel */}
        {offerPos && (
          <Marker coordinate={offerPos} title={offer?.name || 'Ziel'} opacity={activeNow ? 1 : 0.6} tracksViewChanges={false}>
            <Animated.View style={{ alignItems:'center', transform:[{ scale: destPulse }] }}>
              <View style={[styles.pinCore,{ backgroundColor: (t?.colors?.primary) || colors.primary }]} />
              <View style={[styles.pinDot,{ backgroundColor: (t?.colors?.primary) || colors.primary }]} />
            </Animated.View>
          </Marker>
        )}

        {/* Genauigkeitskreis */}
        {userLocation && userAccuracy!=null && userAccuracy>0 && (
          <Circle center={userLocation} radius={Math.max(8, Math.min(userAccuracy, 60))} strokeWidth={0} fillColor="rgba(13,78,166,0.12)" zIndex={1} />
        )}

        {/* ROUTE – Doppel-Polyline (Kontrast + Lesbarkeit) */}
        {remainingRoute.length>=2 && (
          <>
            <Polyline coordinates={remainingRoute} strokeWidth={9} strokeColor="rgba(255,255,255,0.9)" zIndex={2} />
            <Polyline coordinates={remainingRoute} strokeWidth={6} strokeColor={((t?.colors?.primary) || '#0d4ea6')+'F2'} zIndex={3} />
          </>
        )}

        {/* Richtungs-Pfeile */}
        {arrowMarkers.map((m, i)=>(
          <Marker key={`arr-${i}`} coordinate={m.coord} anchor={{ x:0.5, y:0.5 }} zIndex={4} tracksViewChanges={false}>
            <View style={{ transform:[{ rotate: `${m.rot}deg` }] }}>
              <View style={styles.arrowHead} />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* COACH-BANNER */}
      <Animated.View
        {...hudPan.panHandlers}
        style={[
          styles.hudTop,
          { top: insets.top + 8, backgroundColor: (t?.colors?.card ? t.colors.card + 'EE' : 'rgba(16,18,22,0.66)'), borderColor: (t?.colors?.separator || 'rgba(0,0,0,0.06)'), transform:[{ translateY: hudTranslateY }] }
        ]}
        pointerEvents="box-none"
        testID="nav_hud_top"
        accessible
        accessibilityRole="summary"
        accessibilityLabel={`Navigation: Jetzt ${turnText || 'geradeaus'}. ${etaText}. Noch ${remaining ?? '…'} Meter.`}
      >
        <View style={styles.hudRow}>
          <Text style={[styles.titleXL, { color: (t?.colors?.ink) || '#111827' }]} numberOfLines={2}>
            {offer?.name || 'Navigation'}
          </Text>
          <View style={styles.badgesRow}>
            <Text style={[styles.badgeUniform, activeNow ? styles.badgeOk : styles.badgeWarn]}>{activeNow ? 'Aktiv' : 'Inaktiv'}</Text>
            <Text style={navPillStyle}>{navPillText}</Text>
          </View>
        </View>

        <Text style={[styles.hudInstr, { color: (t?.colors?.ink) || '#111827' }]}>
          {remaining != null
            ? (remaining < ARRIVAL_THRESHOLD_METERS
                ? '🎯 Ziel erreicht'
                : `➜ Jetzt ${turnText || 'geradeaus'} • ${etaText} • Noch ${remaining < 1000 ? `${remaining} m` : `${(remaining/1000).toFixed(1)} km`}`)
            : 'Routeninfo wird berechnet …'}
        </Text>

        {/* Motivation */}
        <Text style={[styles.metaSmall, { color: (t?.colors?.inkMid) || '#4b5563', marginTop: 4 }]}>{coachLine}</Text>

        {/* Fortschrittsbalken */}
        <View style={[styles.progressBar, { backgroundColor: (t?.colors?.separator) || '#e5e7eb' }]}>
          <View style={[styles.progressFill, { width: `${Math.round(progressPct*100)}%`, backgroundColor: (t?.colors?.primary) || colors.primary }]} />
        </View>

        {/* Adresse beim Herunterziehen */}
        <Animated.View style={{ marginTop: 6, opacity: addrOpacity }}>
          <Text style={[styles.addrText, { color: (t?.colors?.inkMid) || '#4b5563' }]} numberOfLines={2}>{providerAddress}</Text>
          <Text style={[styles.addrHint, { color: (t?.colors?.inkLow) || '#6b7280' }]}>Nach unten ziehen – blendet Adresse ein</Text>
        </Animated.View>

        {isOffRoute && offRouteDist!=null && <Text style={[styles.hudWarnSmall, { color: '#b85600' }]}>Kein Stress – kleiner Umweg (~{Math.round(offRouteDist)} m). Ich richte dich neu aus ✨</Text>}
        {!DIRECTIONS_KEY && <Text style={[styles.hudWarn, { color: '#b8860b' }]}>Kein Google Directions API-Key verfügbar.</Text>}
        {!!routeError && <Text style={[styles.hudWarnSmall, { color: '#b85600' }]}>Hinweis: {String(routeError).replace('Error: ','')}</Text>}
      </Animated.View>

      {/* FABs – Icons (rechts) */}
      <View style={[styles.fabCluster, { bottom: (insets.bottom||0) + 112 }]} pointerEvents="box-none">
        <TouchableOpacity onPress={actionFollow} style={[styles.fab, styles.fabOverlay]} activeOpacity={0.9} accessibilityRole="button" accessibilityLabel="Auf Position zentrieren" testID="nav_follow_fab">
          <MaterialIcons name="my-location" size={22} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity onPress={actionToggleCompass} style={[styles.fab, styles.fabOverlay]} activeOpacity={0.9} accessibilityRole="switch" accessibilityState={{ checked: !!compassMode }} accessibilityLabel="Kompassmodus umschalten" testID="nav_compass_fab">
          <MaterialIcons name="explore" size={22} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity onPress={actionToggleMapType} style={[styles.fab, styles.fabOverlay]} activeOpacity={0.9} accessibilityRole="button" accessibilityLabel={mapType==='standard'?'Satellitenkarte anzeigen':'Standardkarte anzeigen'} testID="nav_maptype_fab">
          <MaterialIcons name="layers" size={22} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity onPress={actionToggleAvoidStairs} style={[styles.fab, styles.fabOverlay]} activeOpacity={0.9} accessibilityRole="switch" accessibilityState={{ checked: !!avoidStairs }} accessibilityLabel="Stufenfreie Route bevorzugen" testID="nav_avoid_stairs_fab">
          <MaterialIcons name="accessible" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Bottom CTA */}
      <View style={[styles.hudBottom, { bottom: (insets.bottom || 0) + 16 }]}>
        <TouchableOpacity
          onPress={()=>router.replace(`/offers/${id}`)}
          style={[styles.btnPrimary, { backgroundColor: (t?.colors?.primary) || colors.primary }]}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel="Zurück zu den Angebotsdetails"
          testID="nav_back_to_details"
        >
          <Text style={styles.btnPrimaryText}>Zurück zu Details</Text>
        </TouchableOpacity>
      </View>

      {/* Off-Route Toast */}
      {showOffRouteToast && (
        <View style={[styles.toastWrap, { bottom: (insets.bottom || 0) + 76 }]} pointerEvents="none">
          <View style={[styles.toast, { backgroundColor: 'rgba(16,18,22,0.9)', borderColor: 'rgba(255,255,255,0.08)'}]}>
            <Text style={styles.toastText}>Kleiner Umweg – ich passe die Route an ✨</Text>
          </View>
        </View>
      )}

      {/* Arrival-Sheet */}
      {arrived && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none" testID="nav_arrival_overlay">
          <ConfettiOverlay />
          <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
          <Animated.View
            {...pan.panHandlers}
            style={[styles.sheetWrap, { transform: [{ translateY: sheetY }], bottom: (insets.bottom || 0) + 16, backgroundColor: (t?.colors?.card) || '#0f1522', borderColor: (t?.colors?.primary) || '#0d4ea6' }]}
            onLayout={(e)=> setSheetH(e.nativeEvent.layout.height)}
            accessibilityViewIsModal
            accessible
            accessibilityRole="none"
            accessibilityLabel="Ziel erreicht"
            testID="nav_arrival_sheet"
          >
            <View style={styles.sheetHandle} />
            <Text style={[styles.cardTitleBig, { color: '#E9F1FF' }]}>🎯 Ziel erreicht</Text>
            <Text style={[styles.cardBody, { color: '#c9d8f5' }]}>Du bist am Angebot angekommen.</Text>
            <View style={{ height: 12 }} />
            <TouchableOpacity onPress={()=> closeSheet(()=>router.replace(`/offers/${id}`))} style={[styles.sheetBtn, styles.sheetBtnPrimary]} activeOpacity={0.9} accessibilityRole="button" accessibilityLabel="Zurück zu den Angebotsdetails" testID="nav_arrival_back">
              <Text style={styles.sheetBtnText}>Zurück zu Details</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={()=> closeSheet()} style={[styles.sheetBtn, { marginTop: 8 }]} activeOpacity={0.9} accessibilityRole="button" accessibilityLabel="Weiter navigieren" testID="nav_arrival_continue">
              <Text style={styles.sheetBtnText}>Weiter navigieren</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

/* ───────── Confetti ───────── */
function ConfettiOverlay() {
  const count = 12;
  const drops = React.useMemo(()=> Array.from({ length: count }, ()=> new Animated.Value(-20)),[]);
  useEffect(()=>{ drops.forEach((d,i)=> Animated.timing(d,{ toValue:300, duration:1400+(i%4)*200, easing:Easing.out(Easing.quad), useNativeDriver:true }).start()); },[drops]);
  return (
    <View pointerEvents="none" style={styles.confettiWrap}>
      {drops.map((drop,i)=>(
        <Animated.View key={`conf-${i}`} style={{ position:'absolute', top:0, left:`${(i/drops.length)*100}%`, transform:[{ translateY: drop }, { rotate: `${i*45}deg` }] }}>
          <View style={[styles.confettiPiece, { backgroundColor: ['#0d4ea6','#7dd3fc','#34d399','#fbbf24','#f472b6','#a78bfa'][i%6] }]} />
        </Animated.View>
      ))}
    </View>
  );
}

/* ───────── styles ───────── */
const styles = StyleSheet.create({
  center: { flex:1, alignItems:'center', justifyContent:'center' },

  titleXL: { fontSize:20, fontWeight:'800', lineHeight:24 },
  cardTitleBig: { fontSize:18, fontWeight:'900', lineHeight:22 },
  cardBody: { fontSize:14, lineHeight:20 },
  metaSmall: { fontSize:12 },

  badgesRow: { flexDirection:'row', flexWrap:'wrap', gap:8 },
  badgeUniform: { paddingHorizontal:10, paddingVertical:6, borderRadius:14, minHeight:28, borderWidth:1, marginRight:8, marginBottom:8, fontSize:12, fontWeight:'700' },
  badgeNeutral: { backgroundColor:'rgba(0,0,0,0.06)', borderColor:'rgba(0,0,0,0.08)' },
  badgeWarn: { backgroundColor:'rgba(255,149,0,0.22)', borderColor:'rgba(255,149,0,0.45)' },
  badgeOk: { backgroundColor:'rgba(46,213,115,0.22)', borderColor:'rgba(46,213,115,0.45)' },

  hudTop: { position:'absolute', left:12, right:12, borderRadius:16, paddingVertical:12, paddingHorizontal:16, elevation:8, shadowColor:'#000', shadowOpacity:0.18, shadowRadius:10, shadowOffset:{ width:0, height:6 }, borderWidth:1 },
  hudRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  hudInstr: { fontSize:14, marginTop:8, lineHeight:20 },
  addrText: { fontSize:13, fontWeight:'600' },
  addrHint: { fontSize:11, marginTop:2 },
  hudWarn: { fontSize:12, marginTop:8 },
  hudWarnSmall: { fontSize:11, marginTop:6 },

  progressBar: { height:6, borderRadius:999, overflow:'hidden', marginTop:10 },
  progressFill: { height:'100%' },

  fabCluster: { position:'absolute', right:16, alignItems:'center', gap:10 },
  fab: {
    width:52, height:52, borderRadius:26, alignItems:'center', justifyContent:'center',
    elevation:6, borderWidth:1,
  },
  // Immer dunkler Hintergrund für klare Icons – unabhängig vom Theme
  fabOverlay: {
    backgroundColor: 'rgba(16,18,22,0.92)',
    borderColor: 'rgba(0,0,0,0.25)',
  },

  hudBottom: { position:'absolute', left:0, right:0, alignItems:'center' },
  btnPrimary: { paddingHorizontal:18, paddingVertical:12, borderRadius:12, minWidth:220, alignItems:'center' },
  btnPrimaryText: { color:'#fff', fontWeight:'700' },

  toastWrap: { position:'absolute', left:0, right:0, alignItems:'center' },
  toast: { borderRadius:12, paddingVertical:10, paddingHorizontal:14, borderWidth:1 },
  toastText: { color:'#E9F1FF' },

  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor:'#000' },

  sheetWrap: { position:'absolute', left:12, right:12, borderRadius:16, padding:16 },
  sheetHandle: { alignSelf:'center', width:44, height:5, borderRadius:50, backgroundColor:'rgba(255,255,255,0.28)', marginBottom:10 },
  sheetBtn: { backgroundColor:'#111', opacity:0.95, paddingHorizontal:18, paddingVertical:12, borderRadius:12, alignItems:'center' },
  sheetBtnPrimary: { backgroundColor:'#0d4ea6' },
  sheetBtnText: { color:'#fff', fontWeight:'bold' },

  pinCore: { width:22, height:22, borderRadius:11, borderWidth:2, borderColor:'#fff', shadowColor:'#0d4ea6', shadowOpacity:0.55, shadowRadius:6, shadowOffset:{ width:0,height:0 }, elevation:6 },
  pinDot: { marginTop:4, width:6, height:6, borderRadius:3 },

  backBtn: { marginTop:14, paddingHorizontal:16, paddingVertical:10, borderRadius:10, borderWidth:1 },
  backText: { fontWeight:'700' },

  confettiWrap: { ...StyleSheet.absoluteFillObject, overflow:'hidden' },
  confettiPiece: { width:10, height:16, borderRadius:3, marginHorizontal:2 },

  arrowHead: { width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderBottomWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#0d4ea6', opacity: 0.9 },
});
