import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Image, Dimensions } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import axios from 'axios';
import { useLocalSearchParams } from 'expo-router'; // Expo Router Hook!
import colors from '../../theme/colors';

const API_URL = 'https://lobster-app-ie9a5.ondigitalocean.app/api';

export default function OffersScreen() {
  const { id } = useLocalSearchParams();
  const [offer, setOffer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    async function fetchOfferAndLocation() {
      setLoading(true);
      try {
        // 1. Angebot holen
        const res = await axios.get(`${API_URL}/offers/${id}`);
        setOffer(res.data);

        // 2. User Location holen
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          setUserLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        }
      } catch (err) {
        setOffer(null);
      }
      setLoading(false);
    }
    fetchOfferAndLocation();
  }, [id]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!offer) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text style={{ color: 'red', textAlign: 'center' }}>Angebot konnte nicht geladen werden.</Text>
      </View>
    );
  }

  // Angebot Standort (GeoJSON)
  const offerLat = offer.location?.coordinates?.[1] || 0;
  const offerLng = offer.location?.coordinates?.[0] || 0;

  // Karte mittig zwischen User und Angebot
  let region = {
    latitude: offerLat,
    longitude: offerLng,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };
  if (userLocation) {
    region = {
      latitude: (offerLat + userLocation.latitude) / 2,
      longitude: (offerLng + userLocation.longitude) / 2,
      latitudeDelta: Math.abs(offerLat - userLocation.latitude) * 2.5 || 0.01,
      longitudeDelta: Math.abs(offerLng - userLocation.longitude) * 2.5 || 0.01,
    };
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20 }}>
      <View style={styles.card}>
        <Text style={styles.title}>{offer.name}</Text>
        <Text style={styles.desc}>{offer.description}</Text>

        {offer.images && Array.isArray(offer.images) && offer.images.length > 0 && (
          <View style={styles.imageRow}>
            {offer.images.slice(0, 3).map((img, idx) => (
              <Image key={idx} source={{ uri: img }} style={styles.offerImage} />
            ))}
          </View>
        )}

        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            initialRegion={region}
            region={region}
            loadingEnabled
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
            pointerEvents="none"
            customMapStyle={mapStyle}
          >
            {/* Pin für Angebot */}
            <Marker
              coordinate={{ latitude: offerLat, longitude: offerLng }}
              title={offer.name}
              pinColor="#0077FF"
              description="Standort des Angebots"
            />
            {/* Pin für User */}
            {userLocation && (
              <Marker
                coordinate={userLocation}
                title="Du bist hier"
                pinColor="#FF5252"
                description="Dein aktueller Standort"
              />
            )}
          </MapView>
        </View>
      </View>
    </ScrollView>
  );
}

const mapStyle = [
  // Optional: Google Maps Custom Style, sonst leer lassen
];

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#f6f8fa',
    borderRadius: 18,
    padding: 22,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.09,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 7,
    alignItems: 'stretch',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 14,
    textAlign: 'center',
  },
  desc: {
    fontSize: 16,
    color: '#555',
    marginBottom: 14,
    textAlign: 'center',
  },
  imageRow: {
    flexDirection: 'row',
    marginBottom: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 9,
  },
  offerImage: {
    width: 84,
    height: 58,
    borderRadius: 9,
    marginRight: 9,
    backgroundColor: '#eee',
  },
  mapContainer: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.3,
    borderColor: '#e4e9f1',
    marginTop: 12,
    backgroundColor: '#dde6ef',
  },
  map: {
    width: '100%',
    height: 210,
  },
});
