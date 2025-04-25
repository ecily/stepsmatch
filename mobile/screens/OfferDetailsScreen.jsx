// mobile/screens/OfferDetailsScreen.jsx

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Alert,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import axiosInstance from '../src/api/axios';
import customMapStyle from '../components/mapStyle';

const GOOGLE_MAPS_API_KEY = 'AIzaSyDshmx1ihpF6C2jtBykjeilBxmF7l3LX3s';

export default function OfferDetailsScreen({ route, navigation }) {
  const { offerId } = route.params;
  const [offer, setOffer] = useState(null);
  const [location, setLocation] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [instructions, setInstructions] = useState([]);
  const [currentInstruction, setCurrentInstruction] = useState('');
  const [distance, setDistance] = useState(null);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef(null);
  const watchId = useRef(null);

  useEffect(() => {
    const fetchOffer = async () => {
      try {
        const res = await axiosInstance.get(`/offers/${offerId}`);
        setOffer(res.data);
        setLoading(false); // Stop loading once data is fetched
      } catch (err) {
        Alert.alert('Fehler', 'Angebot konnte nicht geladen werden.');
        navigation.goBack();
      }
    };

    fetchOffer();
  }, [offerId]);

  useEffect(() => {
    if (!offer) return;

    const startTracking = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 2 },
        async (loc) => {
          setLocation(loc.coords);
          if (offer) {
            await fetchRoute(loc.coords);
          }
        }
      );

      watchId.current = subscription;
    };

    startTracking();

    return () => watchId.current?.remove();
  }, [offer]);

  const fetchRoute = async (coords) => {
    try {
      const origin = `${coords.latitude},${coords.longitude}`;
      const destination = `${offer.location.coordinates[1]},${offer.location.coordinates[0]}`;
      const res = await axiosInstance.get(
        `https://maps.googleapis.com/maps/api/directions/json`, {
          params: {
            origin,
            destination,
            key: GOOGLE_MAPS_API_KEY,
            mode: 'walking'
          }
        }
      );

      const route = res.data.routes[0];
      const points = decodePolyline(route.overview_polyline.points);
      const steps = route.legs[0].steps.map(step => step.html_instructions.replace(/<[^>]+>/g, ''));

      setRouteCoords(points);
      setDistance(route.legs[0].distance.text);
      setInstructions(steps);
      setCurrentInstruction(steps[0] || '');
    } catch (err) {
      console.error('Fehler bei der Routenberechnung:', err);
    }
  };

  const decodePolyline = (t) => {
    let points = [];
    let index = 0, len = t.length;
    let lat = 0, lng = 0;

    while (index < len) {
      let b, shift = 0, result = 0;
      do {
        b = t.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
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

  return (
    <View style={{ flex: 1 }}>
      {loading || !offer || !location ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={{ marginTop: 12 }}>Lade Angebot...</Text>
        </View>
      ) : (
        <ScrollView style={styles.container}>
          <View style={styles.card}>
            <Text style={styles.title}>{offer.name}</Text>
            <Text style={styles.category}>{offer.subcategory}</Text>
            <Text style={styles.description}>{offer.description}</Text>
            <Text style={styles.validity}>Gültig bis: {new Date(offer.validDates?.to).toLocaleDateString()}</Text>
            {distance && <Text style={styles.distance}>Entfernung: {distance}</Text>}
            {currentInstruction && <Text style={styles.instruction}>📍 {currentInstruction}</Text>}
            {offer.images?.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageRow}>
                {offer.images.slice(0, 3).map((img, index) => (
                  <Image key={index} source={{ uri: img }} style={styles.image} resizeMode="cover" />
                ))}
              </ScrollView>
            )}
          </View>

          <View style={styles.mapContainer}>
            <MapView
              ref={mapRef}
              style={styles.map}
              customMapStyle={customMapStyle}
              initialRegion={{
                latitude: location.latitude,
                longitude: location.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
            >
              <Marker coordinate={location} pinColor="blue" />
              <Marker
                coordinate={{
                  latitude: offer.location.coordinates[1],
                  longitude: offer.location.coordinates[0],
                }}
              />
              <Polyline coordinates={routeCoords} strokeWidth={4} strokeColor="#2563eb" />
            </MapView>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.buttonBack} onPress={() => navigation.goBack()}>
              <Text style={styles.buttonText}>Zurück</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.buttonGo} onPress={() => Alert.alert('Navigation gestartet')}>
              <Text style={styles.buttonText}>Los geht’s</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { padding: 16 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  category: { fontSize: 14, color: '#777', marginBottom: 4 },
  description: { fontSize: 14, color: '#333', marginBottom: 8 },
  validity: { fontSize: 13, color: '#059669', marginBottom: 8 },
  distance: { fontSize: 13, color: '#1d4ed8', marginBottom: 8 },
  instruction: { fontSize: 14, color: '#2563eb', marginBottom: 8 },
  imageRow: { flexDirection: 'row', marginBottom: 16 },
  image: { width: 200, height: 120, borderRadius: 8, marginRight: 12 },
  mapContainer: { height: 250, marginHorizontal: 16, borderRadius: 10, overflow: 'hidden', marginBottom: 20 },
  map: { flex: 1 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-around', padding: 20 },
  buttonBack: { backgroundColor: '#e5e7eb', padding: 12, borderRadius: 8 },
  buttonGo: { backgroundColor: '#2563eb', padding: 12, borderRadius: 8 },
  buttonText: { color: '#fff', fontWeight: 'bold' },
});
