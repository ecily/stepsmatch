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
  const [remainingTime, setRemainingTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [isNavigating, setIsNavigating] = useState(false);
  const mapRef = useRef(null);
  const watchId = useRef(null);

  useEffect(() => {
    const fetchOffer = async () => {
      try {
        const res = await axiosInstance.get(`/offers/${offerId}`);
        setOffer(res.data);
        setLoading(false);
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
            fitMap(loc.coords);
          }
        }
      );

      watchId.current = subscription;
    };

    startTracking();
    return () => watchId.current?.remove();
  }, [offer]);

  useEffect(() => {
    if (!offer) return;
    const interval = setInterval(() => {
      setRemainingTime(getRemainingTimeText());
    }, 60000);
    setRemainingTime(getRemainingTimeText());
    return () => clearInterval(interval);
  }, [offer]);

  const fetchRoute = async (coords) => {
    try {
      const origin = `${coords.latitude},${coords.longitude}`;
      const destination = `${offer.location.coordinates[1]},${offer.location.coordinates[0]}`;
      const res = await axiosInstance.get(`https://maps.googleapis.com/maps/api/directions/json`, {
        params: {
          origin,
          destination,
          key: GOOGLE_MAPS_API_KEY,
          mode: 'walking',
        },
      });

      const route = res.data.routes[0];
      const points = decodePolyline(route.overview_polyline.points);
      const steps = route.legs[0].steps.map((step) => step.html_instructions.replace(/<[^>]+>/g, ''));

      setRouteCoords(points);
      setDistance(route.legs[0].distance.text);
      setInstructions(steps);
      setCurrentInstruction(translateToGerman(steps[0] || ''));
    } catch (err) {
      console.error('Fehler bei der Routenberechnung:', err);
    }
  };

  const fitMap = (coords) => {
    if (!mapRef.current || !offer) return;
    mapRef.current.fitToCoordinates([
      coords,
      {
        latitude: offer.location.coordinates[1],
        longitude: offer.location.coordinates[0],
      },
    ], {
      edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
      animated: true,
    });
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

  const translateToGerman = (text) => {
    return text
      .replace(/Head/g, 'Folge')
      .replace(/on /g, 'der Straße ')
      .replace(/Turn right/g, 'Biege rechts ab')
      .replace(/Turn left/g, 'Biege links ab')
      .replace(/Continue/g, 'Gehe weiter');
  };

  const getRemainingTimeText = () => {
    if (!offer?.validDates?.to) return '';
    const end = new Date(offer.validDates.to);
    const now = new Date();
    const diffMs = end - now;
    if (diffMs <= 0) return 'Angebot abgelaufen';
    const minutes = Math.floor(diffMs / 60000);
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const mins = minutes % 60;
    return `Noch gültig: ${days ? days + ' Tage, ' : ''}${hours ? hours + ' Std., ' : ''}${mins} Min.`;
  };

  const distanceText = distance ? `Nur ${distance} entfernt!` : '';

  return (
    <View style={{ flex: 1 }}>
      {loading || !offer || !location ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={{ marginTop: 12 }}>Lade Angebot...</Text>
        </View>
      ) : (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 30, paddingTop: 30 }}>
          <View style={styles.card}>
            {distanceText !== '' && <Text style={styles.distanceText}>{distanceText}</Text>}
            <Text style={styles.subcategory}>{offer.subcategory}</Text>
            <Text style={styles.title}>{offer.name}</Text>
            <Text style={styles.description}>{offer.description}</Text>
            <Text style={styles.validity}>{remainingTime}</Text>
          </View>

          {offer.images?.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageRow}>
              {offer.images.slice(0, 3).map((img, index) => (
                <Image key={index} source={{ uri: img }} style={styles.image} resizeMode="cover" />
              ))}
            </ScrollView>
          )}

          <View style={styles.mapCard}>
            <MapView
              ref={mapRef}
              style={styles.map}
              customMapStyle={customMapStyle}
              scrollEnabled={true}
              zoomEnabled={true}
              rotateEnabled={true}
              showsCompass={true}
              showsUserLocation={false}
              showsMyLocationButton={false}
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

          {currentInstruction ? (
            <Text style={styles.instruction}>📍 {currentInstruction}</Text>
          ) : null}

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.buttonBack} onPress={() => navigation.goBack()}>
              <Text style={styles.buttonTextBack}>Zurück</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.buttonGo} onPress={() => setIsNavigating(true)}>
              <Text style={styles.buttonTextGo}>Los geht’s</Text>
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
  card: {
    backgroundColor: '#f9fafb',
    borderColor: '#d1d5db',
    borderWidth: 1,
    borderRadius: 12,
    marginHorizontal: 16,
    padding: 16,
    marginBottom: 16,
  },
  distanceText: {
    fontSize: 16,
    color: '#dc2626',
    fontWeight: '700',
    marginBottom: 8,
  },
  subcategory: { fontSize: 14, color: '#6b7280', marginBottom: 4 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#111827', marginBottom: 6 },
  description: { fontSize: 14, color: '#374151', marginBottom: 6 },
  validity: { fontSize: 13, color: '#059669' },
  imageRow: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 20 },
  image: { width: 220, height: 130, borderRadius: 10, marginRight: 12 },
  mapCard: {
    height: 250,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    borderColor: '#d1d5db',
    borderWidth: 1,
    marginBottom: 20,
  },
  map: { flex: 1 },
  instruction: {
    fontSize: 14,
    color: '#2563eb',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  buttonBack: {
    backgroundColor: '#e5e7eb',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  buttonGo: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  buttonTextBack: {
    color: '#111827',
    fontWeight: 'bold',
    fontSize: 16,
  },
  buttonTextGo: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
