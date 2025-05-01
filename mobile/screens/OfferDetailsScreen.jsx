import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  Vibration,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
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
  const [loading, setLoading] = useState(false);
  const [remainingDistance, setRemainingDistance] = useState(0);
  const [pingSound, setPingSound] = useState(null);
  const [mapType, setMapType] = useState('standard');
  const [navigationMessageVisible, setNavigationMessageVisible] = useState(false);
  const [abortMessageVisible, setAbortMessageVisible] = useState(false);
  const [arrivedMessageVisible, setArrivedMessageVisible] = useState(false);

  const mapRef = useRef(null);
  const lastAnimate = useRef(Date.now());
  const lastLocation = useRef(null);
  const destinationReached = useRef(false);

  useEffect(() => {
    fetchOffer();
    preloadPingSound();
  }, [offerId]);

  const fetchOffer = async () => {
    try {
      const res = await axiosInstance.get(`/offers/${offerId}`);
      setOffer(res.data);
      if (res.data?.location?.coordinates) {
        const [lng, lat] = res.data.location.coordinates;
        setLocation({ latitude: lat, longitude: lng });
      }
    } catch (err) {
      console.error('Error fetching offer:', err);
      navigation.goBack();
    }
  };

  const preloadPingSound = async () => {
    const { sound } = await Audio.Sound.createAsync(
      require('../assets/ping.mp3')
    );
    setPingSound(sound);
  };

  const decodePolyline = (encoded) => {
    let points = [];
    let index = 0, lat = 0, lng = 0;
    while (index < encoded.length) {
      let b, shift = 0, result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;
      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;
      points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
    return points;
  };
  const updateRemainingDistance = (coords) => {
    if (!offer?.location?.coordinates) return;
    const target = {
      latitude: offer.location.coordinates[1],
      longitude: offer.location.coordinates[0],
    };
    const distance = getDistance(coords, target);
    setRemainingDistance(distance);

    if (distance <= 20 && !destinationReached.current) {
      destinationReached.current = true;
      Vibration.vibrate(1000);
      if (pingSound) pingSound.replayAsync();
      setIsNavigating(false);
      setRouteCoords([]);
      showToast('arrived');
    }
  };

  const getDistance = (loc1, loc2) => {
    const R = 6371e3;
    const φ1 = loc1.latitude * Math.PI / 180;
    const φ2 = loc2.latitude * Math.PI / 180;
    const Δφ = (loc2.latitude - loc1.latitude) * Math.PI / 180;
    const Δλ = (loc2.longitude - loc1.longitude) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 8 },
        (loc) => {
          setLocation(loc.coords);

          if (isNavigating && offer?.location) {
            const moved = !lastLocation.current || getDistance(lastLocation.current, loc.coords) > 5;
            if (moved) {
              updateRemainingDistance(loc.coords);
              lastLocation.current = loc.coords;
            }
            if (Date.now() - lastAnimate.current > 8000 && mapRef.current) {
              mapRef.current.animateCamera({ center: loc.coords, pitch: 60, zoom: 18 }, { duration: 800 });
              lastAnimate.current = Date.now();
            }
          }
        }
      );
      return () => subscription.remove();
    })();
  }, [isNavigating]);

  const handleStartNavigation = async () => {
    if (!location || !offer?.location?.coordinates) {
      console.log('Location or destination not available');
      return;
    }

    console.log('🔵 START handleStartNavigation');
    setLoading(true);
    destinationReached.current = false;

    const origin = `${location.latitude},${location.longitude}`;
    const destination = `${offer.location.coordinates[1]},${offer.location.coordinates[0]}`;

    try {
      const res = await axiosInstance.get(`https://maps.googleapis.com/maps/api/directions/json`, {
        params: {
          origin,
          destination,
          key: GOOGLE_MAPS_API_KEY,
          mode: 'walking'
        }
      });

      console.log('📦 Directions API response received');

      if (res.data.routes && res.data.routes.length > 0) {
        const points = decodePolyline(res.data.routes[0].overview_polyline.points);
        console.log('✅ Polyline decoded:', points.length, 'points');

        setRouteCoords(points);
        console.log('📍 routeCoords set');

        requestAnimationFrame(() => {
          setIsNavigating(true);
          setLoading(false);
          console.log('🟢 isNavigating set to true');
          showToast('start');
        });
      } else {
        console.warn('⚠️ No route found from API');
        setLoading(false);
      }
    } catch (err) {
      console.error('❌ Error fetching route:', err);
      setLoading(false);
    }
  };
  const showToast = (type) => {
    if (type === 'start') {
      setNavigationMessageVisible(true);
      setTimeout(() => setNavigationMessageVisible(false), 2000);
    }
    if (type === 'abort') {
      setAbortMessageVisible(true);
      setTimeout(() => setAbortMessageVisible(false), 2000);
    }
    if (type === 'arrived') {
      setArrivedMessageVisible(true);
      setTimeout(() => setArrivedMessageVisible(false), 2000);
    }
  };

  const toggleMapType = () => {
    setMapType((prev) => (prev === 'standard' ? 'satellite' : 'standard'));
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40, paddingTop: 40 }}>
        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 8 }}>{offer?.name}</Text>
          <Text style={{ color: '#6b7280', marginBottom: 6 }}>{offer?.subcategory}</Text>
          <Text style={{ color: '#374151', marginBottom: 12 }}>{offer?.description}</Text>
          {offer?.images && (
            <FlatList
              data={offer.images}
              horizontal
              keyExtractor={(item, index) => index.toString()}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <Image source={{ uri: item }} style={{ width: 240, height: 140, borderRadius: 10, marginRight: 12 }} />
              )}
            />
          )}
        </View>

        <View style={{ height: 300, marginHorizontal: 16, borderRadius: 12, overflow: 'hidden', borderColor: '#d1d5db', borderWidth: 1, marginBottom: 10 }}>
          <MapView
            provider={PROVIDER_GOOGLE}
            ref={mapRef}
            style={{ flex: 1 }}
            region={{
              latitude: location?.latitude || 48.2082,
              longitude: location?.longitude || 16.3738,
              latitudeDelta: 0.0015,
              longitudeDelta: 0.0015,
            }}
            showsUserLocation
            followsUserLocation
            showsCompass
            pitchEnabled
            rotateEnabled
            zoomEnabled
            mapType={mapType}
            customMapStyle={mapType === 'standard' ? customMapStyle : []}
          >
            {location && <Marker coordinate={location} pinColor="blue" />}
            {offer?.location?.coordinates && (
              <Marker coordinate={{
                latitude: offer.location.coordinates[1],
                longitude: offer.location.coordinates[0],
              }} />
            )}
            {routeCoords.length > 0 && (
              <Polyline coordinates={routeCoords} strokeWidth={6} strokeColor="#f87171" />
            )}
          </MapView>
          <TouchableOpacity onPress={toggleMapType} style={styles.mapTypeButton}>
            <Text style={styles.mapTypeButtonText}>
              {mapType === 'standard' ? 'Satellitenansicht' : 'Kartenansicht'}
            </Text>
          </TouchableOpacity>
        </View>

        {isNavigating && (
          <View style={styles.navigationBanner}>
            <Text style={styles.navigationBannerText}>Noch {Math.round(remainingDistance)} m bis zum Ziel</Text>
          </View>
        )}

        <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginHorizontal: 16 }}>
          <TouchableOpacity
            disabled={loading}
            onPress={() => {
              if (isNavigating) {
                setIsNavigating(false);
                setRouteCoords([]);
                showToast('abort');
              } else {
                handleStartNavigation();
              }
            }}
            style={{
              backgroundColor: isNavigating ? '#f87171' : '#2563eb',
              paddingVertical: 14,
              paddingHorizontal: 24,
              borderRadius: 10
            }}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
              {loading ? 'Lade Route…' : isNavigating ? 'Abbruch' : 'Los geht’s'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ backgroundColor: '#e5e7eb', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 10 }}
          >
            <Text style={{ color: '#111827', fontWeight: 'bold', fontSize: 16 }}>Zurück</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {navigationMessageVisible && (
        <View style={styles.toastOverlay}>
          <Text style={styles.toastText}>🚶 Navigation gestartet</Text>
        </View>
      )}
      {abortMessageVisible && (
        <View style={styles.toastOverlay}>
          <Text style={styles.toastText}>🛑 Navigation abgebrochen</Text>
        </View>
      )}
      {arrivedMessageVisible && (
        <View style={styles.toastOverlay}>
          <Text style={styles.toastText}>🎯 Ziel erreicht!</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  navigationBanner: {
    backgroundColor: '#f87171',
    paddingVertical: 10,
    alignItems: 'center',
    marginHorizontal: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  navigationBannerText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  toastOverlay: {
    position: 'absolute',
    top: '45%',
    left: '10%',
    right: '10%',
    backgroundColor: '#111827ee',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  toastText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  mapTypeButton: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  mapTypeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
