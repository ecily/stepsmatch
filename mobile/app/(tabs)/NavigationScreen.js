import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import axios from 'axios';
import { useLocalSearchParams, useRouter } from 'expo-router';
import colors from '../../theme/colors';

const API_URL = 'https://lobster-app-ie9a5.ondigitalocean.app/api';

// --- Distanz-Helfer (Haversine, Ergebnis in Metern) ---
const toRad = (x) => (x * Math.PI) / 180;
function distanceMeters(a, b) {
  const R = 6371e3;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)));
}
function formatDistance(m) {
  if (m == null) return '';
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export default function NavigationScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [offer, setOffer] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [heading, setHeading] = useState(0);
  const [loading, setLoading] = useState(true);
  const [remaining, setRemaining] = useState(null); // 👈 Live-Distanz in Metern

  const mapRef = useRef(null);
  const posSub = useRef(null);
  const headSub = useRef(null);

  const followCameraTo = (pos, hdg = 0) => {
    if (!mapRef.current || !pos) return;
    mapRef.current.animateCamera(
      { center: pos, zoom: 18, pitch: 45, heading: hdg },
      { duration: 300 }
    );
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await axios.get(`${API_URL}/offers/${id}`);
        if (!mounted) return;
        setOffer(res.data);

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { setLoading(false); return; }

        const loc = await Location.getCurrentPositionAsync({});
        if (!mounted) return;
        const pos = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setUserLocation(pos);

        // initiale Distanz berechnen
        const offerLat = res.data?.location?.coordinates?.[1] ?? 0;
        const offerLng = res.data?.location?.coordinates?.[0] ?? 0;
        const dest = { latitude: offerLat, longitude: offerLng };
        setRemaining(distanceMeters(pos, dest));

        // live position verfolgen
        posSub.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 1 },
          (l) => {
            const p = { latitude: l.coords.latitude, longitude: l.coords.longitude };
            setUserLocation(p);
            followCameraTo(p, heading);
            // live Distanz updaten
            setRemaining(distanceMeters(p, dest));
          }
        );

        // heading/kompass
        headSub.current = await Location.watchHeadingAsync((h) => {
          const hdg = h?.trueHeading ?? h?.magHeading ?? 0;
          setHeading(hdg);
          if (userLocation) followCameraTo(userLocation, hdg);
        });
      } catch {}
      if (mounted) setLoading(false);
    })();

    return () => {
      mounted = false;
      if (posSub.current) { posSub.current.remove(); posSub.current = null; }
      if (headSub.current) { headSub.current.remove(); headSub.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!offer) {
    return (
      <View style={styles.center}>
        <Text style={{ color: '#999' }}>{loading ? 'Lade Navigation …' : 'Angebot nicht gefunden'}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Text style={styles.backText}>Zurück</Text></TouchableOpacity>
      </View>
    );
  }

  const offerLat = offer.location?.coordinates?.[1] || 0;
  const offerLng = offer.location?.coordinates?.[0] || 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        provider={PROVIDER_GOOGLE}
        initialCamera={{
          center: userLocation || { latitude: offerLat, longitude: offerLng },
          zoom: 18, pitch: 45, heading: heading || 0,
        }}
        showsUserLocation
        showsMyLocationButton={false}
        loadingEnabled
        scrollEnabled
        zoomEnabled
        pitchEnabled
        rotateEnabled
      >
        {/* Ziel */}
        <Marker coordinate={{ latitude: offerLat, longitude: offerLng }} title={offer.name} pinColor="#0077FF" />
        {/* einfache Linie User → Ziel (bleibt; Route bauen wir separat weiter aus) */}
        {userLocation && (
          <Polyline coordinates={[userLocation, { latitude: offerLat, longitude: offerLng }]} strokeWidth={5} />
        )}
      </MapView>

      {/* HUD oben – bleibt offen: Name + Live-Distanz (und später Anweisungen) */}
      <View style={styles.hudTop}>
        <Text style={styles.hudTitle} numberOfLines={1}>{offer.name}</Text>
        <Text style={styles.hudSub}>
          {remaining != null
            ? (remaining < 15 ? 'Ziel erreicht' : `Noch ${formatDistance(remaining)}`)
            : 'Berechne Distanz …'}
        </Text>
      </View>

      {/* HUD unten: Zurück */}
      <View style={styles.hudBottom}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>Zurück zu Details</Text>
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
  hudBottom: { position: 'absolute', bottom: 16, left: 0, right: 0, alignItems: 'center' },
  backBtn: { backgroundColor: '#111', opacity: 0.85, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12 },
  backText: { color: '#fff', fontWeight: 'bold' },
});
