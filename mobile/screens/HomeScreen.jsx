import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Button,
} from 'react-native';
import * as Location from 'expo-location';
import axiosInstance from '../api/axios';
import MapView, { Marker } from 'react-native-maps';

export default function HomeScreen({ navigation }) {
  const [offers, setOffers] = useState([]);
  const [location, setLocation] = useState(null);
  const [lastLocation, setLastLocation] = useState(null); // Track the last location to check distance
  const [loading, setLoading] = useState(true);
  const [mapType, setMapType] = useState('standard'); // State für den Kartentyp

  // 📍 Standort ermitteln und nur bei signifikanten Änderungen (50m) Angebote holen
  useEffect(() => {
    const getLocation = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('❌ Standort-Zugriff verweigert');
        return;
      }

      // Setze den Watcher für den Standort, der alle 10 Sekunden oder bei jeder Bewegung aktualisiert wird
      const locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High, // Hohe Genauigkeit
          timeInterval: 10000, // Alle 10 Sekunden aktualisieren
          distanceInterval: 1, // Aktualisierung bei jeder Bewegung
        },
        (newLocation) => {
          console.log('📍 Neue Standortdaten:', newLocation.coords);
          
          if (lastLocation) {
            const distance = getDistance(lastLocation, newLocation.coords);
            if (distance > 50) { // Nur wenn der Standort um mehr als 50m geändert wurde
              setLocation(newLocation.coords);
              setLastLocation(newLocation.coords); // Update last location
            }
          } else {
            setLocation(newLocation.coords);
            setLastLocation(newLocation.coords); // Setze die initiale Position
          }
        }
      );

      // Aufräumen, wenn der Effekt nicht mehr benötigt wird
      return () => {
        locationSubscription.remove();
      };
    };

    getLocation();
  }, [lastLocation]); // Nur bei Änderungen an der letzten Position

  // 🔄 Sobald der Standort gesetzt ist: Angebote holen
  useEffect(() => {
    if (location) {
      fetchOffers();
    }
  }, [location]); // Nur wenn der Standort sich geändert hat

  const fetchOffers = async () => {
    setLoading(true);
    try {
      console.log('📡 API-Aufruf ohne Filter');

      const response = await axiosInstance.get('/offers/nearby', {
        params: {
          lat: location.latitude,
          lng: location.longitude,
        },
      });

      console.log('✅ Angebote erhalten:', response.data);

      if (response.data.length === 0) {
        console.log('Keine Angebote gefunden.');
      }

      setOffers(response.data);
    } catch (error) {
      console.error('❌ Fehler beim Laden der Angebote:', error.message);
      console.log('Fehler-Details:', error.toJSON?.() || error);
    } finally {
      setLoading(false);
    }
  };

  const renderOfferCard = ({ item }) => (
    <TouchableOpacity style={styles.card}>
      {item.images && item.images.length > 0 && (
        <Image source={{ uri: item.images[0] }} style={styles.image} />
      )}
      <View style={styles.cardContent}>
        <Text style={styles.title}>{item.name}</Text>
        <Text style={styles.category}>{item.subcategory}</Text>
        <Text style={styles.description} numberOfLines={3}>
          {item.description}
        </Text>
      </View>
    </TouchableOpacity>
  );

  // Berechnet die Distanz zwischen zwei Punkten (in Metern)
  const getDistance = (coords1, coords2) => {
    const R = 6371; // Erdradius in Kilometern
    const dLat = (coords2.latitude - coords1.latitude) * Math.PI / 180;
    const dLon = (coords2.longitude - coords1.longitude) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(coords1.latitude * Math.PI / 180) * Math.cos(coords2.latitude * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c * 1000; // Entfernung in Metern
    return distance;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Angebote in deiner Nähe</Text>

      {/* Google Map Karte oben */}
      {location && (
        <View style={styles.mapCard}>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: location.latitude,
              longitude: location.longitude,
              latitudeDelta: 0.002, // Zoom-Level für ca. 1 km Radius
              longitudeDelta: 0.002, // Zoom-Level für ca. 1 km Radius
            }}
            region={{
              latitude: location.latitude,
              longitude: location.longitude,
              latitudeDelta: 0.002,
              longitudeDelta: 0.002,
            }}
            mapType={mapType} // Verwende den Kartentyp aus dem State
          >
            <Marker coordinate={{ latitude: location.latitude, longitude: location.longitude }} />
          </MapView>
        </View>
      )}

      {/* Button für den Wechsel der Kartenansicht */}
      <View style={styles.buttonContainer}>
        <Button
          title={`Wechsel zu ${mapType === 'standard' ? 'Satellitenansicht' : 'Standardansicht'}`}
          onPress={() => setMapType(mapType === 'standard' ? 'satellite' : 'standard')}
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 30 }} />
      ) : offers.length === 0 ? (
        <Text style={styles.noResults}>Keine passenden Angebote gefunden</Text>
      ) : (
        <FlatList
          data={offers}
          keyExtractor={(item) => item._id}
          renderItem={renderOfferCard}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 50 },
  heading: { fontSize: 24, fontWeight: 'bold', paddingHorizontal: 16, marginBottom: 10 },
  list: { paddingHorizontal: 16 },
  card: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 3,
  },
  image: { width: '100%', height: 180 },
  cardContent: { padding: 12 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  category: { fontSize: 14, color: '#777', marginBottom: 6 },
  description: { fontSize: 14, color: '#333' },
  noResults: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 40,
  },
  mapCard: {
    width: '100%',
    height: 250, // Höhe der Map-Karte
    marginBottom: 20,
  },
  map: {
    flex: 1,
  },
  buttonContainer: {
    marginVertical: 10,
    marginHorizontal: 16,
  },
});
