// BLOCK 1: Imports & Konstanten
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  Vibration,
  Dimensions,
  ScrollView,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import axiosInstance from '../src/api/axios';
import customMapStyle from '../components/mapStyle';
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
} from 'react-native-reanimated';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const GOOGLE_MAPS_API_KEY = 'AIzaSyDshmx1ihpF6C2jtBykjeilBxmF7l3LX3s';

// BLOCK 2: State, Refs & useEffect
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

  const mapHeight = useSharedValue(300);
  const animatedMapStyle = useAnimatedStyle(() => ({
    height: withTiming(mapHeight.value, { duration: 300 }),
  }));

  const [detailsVisible, setDetailsVisible] = useState(true);  // Track details visibility

  useEffect(() => {
    fetchOffer();
    preloadPingSound();
  }, [offerId]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 8,
        },
        (loc) => {
          setLocation(loc.coords);
          if (isNavigating && offer?.location) {
            const moved =
              !lastLocation.current ||
              getDistance(lastLocation.current, loc.coords) > 5;
            if (moved) {
              updateRemainingDistance(loc.coords);
              lastLocation.current = loc.coords;
            }
            if (
              Date.now() - lastAnimate.current > 8000 &&
              mapRef.current
            ) {
              mapRef.current.animateCamera(
                {
                  center: loc.coords,
                  pitch: 60,
                  zoom: 18,
                },
                { duration: 800 }
              );
              lastAnimate.current = Date.now();
            }
          }
        }
      );
      return () => subscription.remove();
    })();
  }, [isNavigating]);

  // BLOCK 3: Funktionen
  const fetchOffer = async () => {
    try {
      const res = await axiosInstance.get(`/offers/${offerId}`);
      setOffer(res.data);
      if (res.data?.location?.coordinates) {
        const [lng, lat] = res.data.location.coordinates;
        setLocation({ latitude: lat, longitude: lng });const coords = { latitude: lat, longitude: lng };
        setLocation(coords);
        if (mapRef.current) {
          mapRef.current.animateCamera({
            center: coords,
            pitch: 60,
            zoom: 18,
          });
        }
       
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

  const fetchAndSetRoute = async (coords) => {
    const origin = `${coords.latitude},${coords.longitude}`;
    const destination = `${offer.location.coordinates[1]},${offer.location.coordinates[0]}`;
    try {
      const res = await axiosInstance.get('https://maps.googleapis.com/maps/api/directions/json', {
        params: {
          origin,
          destination,
          key: GOOGLE_MAPS_API_KEY,
          mode: 'walking',
        },
      });

      if (res.data.routes && res.data.routes.length > 0) {
        const points = decodePolyline(res.data.routes[0].overview_polyline.points);
        setRouteCoords(points);
        return true;
      } else {
        console.warn('⚠️ No route found');
        return false;
      }
    } catch (err) {
      console.error('❌ Error fetching route:', err);
      return false;
    }
  };

  const handleStartNavigation = async () => {
    if (!location || !offer?.location?.coordinates) return;

    setLoading(true);
    destinationReached.current = false;

    const success = await fetchAndSetRoute(location);
    if (success) {
      mapHeight.value = 500;
      requestAnimationFrame(() => {
        setIsNavigating(true);
        setLoading(false);
        showToast('start');
      });
    } else {
      setLoading(false);
    }
  };

  const getDistance = (loc1, loc2) => {
    const R = 6371e3;
    const φ1 = loc1.latitude * Math.PI / 180;
    const φ2 = loc2.latitude * Math.PI / 180;
    const Δφ = (loc2.latitude - loc1.latitude) * Math.PI / 180;
    const Δλ = (loc2.longitude - loc1.longitude) * Math.PI / 180;
    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
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
      mapHeight.value = 300;
      showToast('arrived');
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

  // BLOCK 4: JSX Layout
  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40, paddingTop: 40 }}>
        {/* DETAILS CARD */}
        {detailsVisible && (
          <View style={[styles.detailsCard, { marginBottom: 10 }]}>
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
        )}

        {/* TOGGLE BUTTON TO EXPAND/COLLAPSE MAP */}
        <TouchableOpacity
          onPress={() => {
            setDetailsVisible(!detailsVisible);
            mapHeight.value = detailsVisible ? 500 : 300;
          }}
          style={{ alignSelf: 'center', marginBottom: 10 }}
        >
          <Text style={{ color: '#6b7280' }}>
            {detailsVisible ? 'Details ausblenden ⬆️' : 'Details anzeigen ⬇️'}
          </Text>
        </TouchableOpacity>

        {/* MAP CARD */}
        <Animated.View style={[animatedMapStyle, {
          marginHorizontal: 16,
          borderRadius: 12,
          overflow: 'hidden',
          borderColor: '#d1d5db',
          borderWidth: 1,
        }]}>
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
        </Animated.View>

        {/* Navigation Banner */}
        {isNavigating && (
          <View style={styles.navigationBanner}>
            <Text style={styles.navigationBannerText}>
              Noch {Math.round(remainingDistance)} m bis zum Ziel
            </Text>
          </View>
        )}

        {/* Control Buttons */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginHorizontal: 16 }}>
          <TouchableOpacity
            disabled={loading}
            onPress={() => {
              if (isNavigating) {
                setIsNavigating(false);
                setRouteCoords([]);
                mapHeight.value = 300;
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

// BLOCK 5: Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
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
    zIndex: 1000,
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
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  mapTypeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  detailsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
});
