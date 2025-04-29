import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Image,
  FlatList,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import axiosInstance from '../src/api/axios';
import customMapStyle from '../components/mapStyle';

const GOOGLE_MAPS_API_KEY = 'AIzaSyDshmx1ihpF6C2jtBykjeilBxmF7l3LX3s';

export default function OfferDetailsScreen({ route, navigation }) {
  const { offerId } = route.params;
  const [offer, setOffer] = useState(null);
  const [location, setLocation] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [isNavigating, setIsNavigating] = useState(false);
  const [remainingDistance, setRemainingDistance] = useState(0);
  const [mapType, setMapType] = useState('standard');
  const [pingSound, setPingSound] = useState(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const mapRef = useRef(null);
  const lastAnimate = useRef(Date.now());
  const lastLocation = useRef(null);

  useEffect(() => {
    fetchOffer();
    preloadPingSound();
  }, [offerId]);

  const fetchOffer = async () => {
    try {
      const res = await axiosInstance.get(`/offers/${offerId}`);
      setOffer(res.data);
    } catch (err) {
      Alert.alert('Fehler', 'Angebot konnte nicht geladen werden.');
      navigation.goBack();
    }
  };

  const preloadPingSound = async () => {
    const { sound } = await Audio.Sound.createAsync(
      require('../assets/ping.mp3')
    );
    setPingSound(sound);
  };

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 8 },
        (loc) => {
          setLocation(loc.coords);

          if (isNavigating) {
            const moved = !lastLocation.current || getDistance(lastLocation.current, loc.coords) > 5;

            if (moved) {
              updateRemainingDistance(loc.coords);
              lastLocation.current = loc.coords;
            }

            if (Date.now() - lastAnimate.current > 8000) {
              smoothFollowUser(loc.coords);
              lastAnimate.current = Date.now();
            }
          }
        }
      );
      return () => subscription.remove();
    })();
  }, [isNavigating]);

  const updateRoute = async (coords) => {
    try {
      setLoadingRoute(true);
      const origin = `${coords.latitude},${coords.longitude}`;
      const destination = `${offer.location.coordinates[1]},${offer.location.coordinates[0]}`;
      const res = await axiosInstance.get(`https://maps.googleapis.com/maps/api/directions/json`, {
        params: { origin, destination, key: GOOGLE_MAPS_API_KEY, mode: 'walking' },
      });
      const route = res.data.routes[0];
      const points = decodePolyline(route.overview_polyline.points);
      setRouteCoords(points);
      setRemainingDistance(calculateRouteDistance(points));
    } catch (err) {
      console.error('Fehler beim Abrufen der Route:', err);
      Alert.alert('Routenfehler', 'Die Route konnte nicht geladen werden.');
    } finally {
      setLoadingRoute(false);
    }
  };

  const updateRemainingDistance = (currentLocation) => {
    if (!routeCoords.length) return;
    const remaining = routeCoords.filter(point => getDistance(currentLocation, point) > 10);
    setRouteCoords(remaining);
    setRemainingDistance(calculateRouteDistance(remaining));

    if (remaining.length === 0) {
      playPing();
      Alert.alert('🎯 Ziel erreicht!', 'Du bist am Ziel angekommen.');
      stopNavigation();
    }
  };

  const decodePolyline = (t) => {
    let points = [], index = 0, lat = 0, lng = 0;
    while (index < t.length) {
      let b, shift = 0, result = 0;
      do {
        b = t.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;
      shift = 0; result = 0;
      do {
        b = t.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;
      points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
    return points;
  };

  const calculateRouteDistance = (coords) => {
    let distance = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      distance += getDistance(coords[i], coords[i + 1]);
    }
    return distance;
  };

  const animateInitialZoom = (coords) => {
    if (mapRef.current) {
      mapRef.current.animateCamera({ center: coords, zoom: 18, pitch: 60 }, { duration: 800 });
    }
  };

  const smoothFollowUser = (coords) => {
    if (mapRef.current) {
      mapRef.current.animateCamera({ center: coords, heading: coords.heading || 0, pitch: 60, zoom: 18 }, { duration: 800 });
    }
  };

  const handleGoPress = () => {
    if (location) {
      setIsNavigating(true);
      updateRoute(location);
    }
  };

  const confirmStopNavigation = () => {
    Alert.alert('Navigation beenden?', 'Willst du die Navigation wirklich abbrechen?', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Ja', style: 'destructive', onPress: () => stopNavigation() },
    ]);
  };

  const stopNavigation = () => {
    setIsNavigating(false);
    setRouteCoords([]);
    setRemainingDistance(0);
  };

  const toggleMapType = () => {
    const nextType = mapType === 'standard' ? 'satellite' : 'standard';
    setMapType(nextType);
    if (mapRef.current) {
      mapRef.current.animateCamera({ pitch: nextType === 'satellite' ? 0 : 60 }, { duration: 500 });
    }
  };

  const playPing = async () => {
    if (pingSound) {
      await pingSound.replayAsync();
    }
  };

  const getDistance = (loc1, loc2) => {
    const R = 6371e3;
    const φ1 = loc1.latitude * Math.PI/180;
    const φ2 = loc2.latitude * Math.PI/180;
    const Δφ = (loc2.latitude-loc1.latitude) * Math.PI/180;
    const Δλ = (loc2.longitude-loc1.longitude) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  if (!offer || !location) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={{ marginTop: 12 }}>Lade Daten...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {isNavigating && (
        <View style={styles.navigationBanner}>
          <Text style={styles.navigationBannerText}>Noch {Math.round(remainingDistance)} m bis zum Ziel</Text>
        </View>
      )}

      <ScrollView style={styles.container}>
        <View style={styles.cardWrapper}>
          <View style={styles.card}>
            {offer.images && (
              <FlatList
                data={offer.images}
                horizontal
                keyExtractor={(item, index) => index.toString()}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => (
                  <Image source={{ uri: item }} style={styles.offerImage} />
                )}
              />
            )}
            <Text style={styles.title}>{offer.name}</Text>
            <Text style={styles.subcategory}>{offer.subcategory}</Text>
            <Text style={styles.description}>{offer.description}</Text>
          </View>
        </View>

        <View style={styles.mapCard}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={{
              latitude: location.latitude,
              longitude: location.longitude,
              latitudeDelta: 0.0015,
              longitudeDelta: 0.0015,
            }}
            mapType={mapType}
            customMapStyle={mapType === 'standard' ? customMapStyle : []}
            showsUserLocation
            followsUserLocation
            showsCompass
            pitchEnabled
            rotateEnabled
            zoomEnabled
          >
            <Marker coordinate={location} pinColor="blue" />
            <Marker coordinate={{
              latitude: offer.location.coordinates[1],
              longitude: offer.location.coordinates[0],
            }} />
            {routeCoords.length > 0 && (
              <Polyline coordinates={routeCoords} strokeWidth={6} strokeColor="#f87171" />
            )}
          </MapView>

          <TouchableOpacity style={styles.mapTypeButton} onPress={toggleMapType}>
            <Text style={styles.mapTypeButtonText}>🛰️ Sat / Map</Text>
          </TouchableOpacity>

          {loadingRoute && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#2563eb" />
            </View>
          )}
        </View>

        <View style={styles.buttonRow}>
          {!isNavigating ? (
            <TouchableOpacity style={styles.buttonGo} onPress={handleGoPress}>
              <Text style={styles.buttonTextGo}>Los geht’s</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.buttonAbort} onPress={confirmStopNavigation}>
              <Text style={styles.buttonTextAbort}>Abbruch</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.buttonBack} onPress={() => navigation.goBack()}>
            <Text style={styles.buttonTextBack}>Zurück</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  navigationBanner: { backgroundColor: '#f87171', paddingTop: 50, paddingBottom: 10, alignItems: 'center' },
  navigationBannerText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  cardWrapper: { marginTop: 20 },
  card: { backgroundColor: '#f9fafb', borderColor: '#d1d5db', borderWidth: 1, borderRadius: 12, margin: 16, padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 8 },
  subcategory: { fontSize: 16, color: '#6b7280', marginBottom: 4 },
  description: { fontSize: 14, color: '#374151', marginBottom: 10 },
  offerImage: { width: 250, height: 150, borderRadius: 12, marginRight: 10, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4 },
  mapCard: { height: 320, marginHorizontal: 16, borderRadius: 12, overflow: 'hidden', borderColor: '#d1d5db', borderWidth: 1, marginBottom: 20 },
  map: { flex: 1 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.7)' },
  mapTypeButton: { position: 'absolute', bottom: 15, left: 15, backgroundColor: '#2563eb', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  mapTypeButtonText: { color: 'white', fontWeight: 'bold' },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: 30, marginHorizontal: 16 },
  buttonGo: { backgroundColor: '#2563eb', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 10, minWidth: 110, alignItems: 'center' },
  buttonAbort: { backgroundColor: '#f87171', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 10, minWidth: 110, alignItems: 'center' },
  buttonBack: { backgroundColor: '#e5e7eb', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 10, minWidth: 90, alignItems: 'center' },
  buttonTextGo: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  buttonTextAbort: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  buttonTextBack: { color: '#111827', fontSize: 16, fontWeight: 'bold' },
});
