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
  ScrollView,
} from 'react-native';
import * as Location from 'expo-location';
import axiosInstance from '../api/axios';
import MapView, { Marker } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function HomeScreen({ navigation }) {
  const [offers, setOffers] = useState([]);
  const [location, setLocation] = useState(null);
  const [lastLocation, setLastLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mapType, setMapType] = useState('standard');
  const [userInterests, setUserInterests] = useState([]);

  useEffect(() => {
    const loadInterests = async () => {
      const stored = await AsyncStorage.getItem('userInterests');
      if (stored) {
        setUserInterests(JSON.parse(stored));
      } else {
        setUserInterests([]);
      }
    };
    loadInterests();
  }, []);

  useEffect(() => {
    const getLocation = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('❌ Standort-Zugriff verweigert');
        return;
      }

      const locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000,
          distanceInterval: 1,
        },
        (newLocation) => {
          if (lastLocation) {
            const distance = getDistance(lastLocation, newLocation.coords);
            if (distance > 50) {
              setLocation(newLocation.coords);
              setLastLocation(newLocation.coords);
            }
          } else {
            setLocation(newLocation.coords);
            setLastLocation(newLocation.coords);
          }
        }
      );

      return () => {
        locationSubscription.remove();
      };
    };

    getLocation();
  }, [lastLocation]);

  useEffect(() => {
    if (location && userInterests.length > 0) {
      fetchOffers();
    }
  }, [location, userInterests]);

  const fetchOffers = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.post('/offers/nearby', {
        lat: location.latitude,
        lng: location.longitude,
        interests: userInterests,
      });

      const filtered = response.data.filter((offer) => isValidNowOrSoon(offer));
      setOffers(filtered);
    } catch (error) {
      console.error('❌ Fehler beim Laden der Angebote:', error.message);
      alert('Netzwerkfehler beim Laden der Angebote');
    } finally {
      setLoading(false);
    }
  };

  const isValidNowOrSoon = (offer) => {
    const now = new Date();
    const fromDate = new Date(offer.validDates?.from);
    const toDate = new Date(offer.validDates?.to);
    if (isNaN(fromDate) || isNaN(toDate)) return false;

    const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
    const days = offer.validDays || [];
    if (!days.includes(weekday)) return false;

    const fromTime = offer.validTimes?.start;
    const toTime = offer.validTimes?.end;
    if (!fromTime || !toTime) return false;

    const [fromHours, fromMinutes] = fromTime.split(':').map(Number);
    const [toHours, toMinutes] = toTime.split(':').map(Number);

    const start = new Date(fromDate);
    start.setHours(fromHours, fromMinutes, 0, 0);

    const end = new Date(toDate);
    end.setHours(toHours, toMinutes, 0, 0);

    if (now >= start && now <= end) return true;

    const minutesUntilStart = (start - now) / 60000;
    return minutesUntilStart > 0 && minutesUntilStart <= 60;
  };

  const getValidityText = (offer) => {
    const now = new Date();
    const endDate = new Date(offer.validDates?.to);
    const [endHours, endMinutes] = offer.validTimes?.end?.split(':')?.map(Number) || [23, 59];
    endDate.setHours(endHours, endMinutes, 0, 0);

    const totalMs = endDate - now;
    if (totalMs <= 0) return '';

    const totalMinutes = Math.floor(totalMs / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    let parts = [];
    if (days > 0) parts.push(`${days} Tage`);
    if (hours > 0) parts.push(`${hours} Std.`);
    if (minutes > 0) parts.push(`${minutes} Min.`);

    return `Jetzt gültig • noch ${parts.join(', ')}`;
  };

  const getDistance = (coords1, coords2) => {
    const R = 6371;
    const dLat = (coords2.latitude - coords1.latitude) * Math.PI / 180;
    const dLon = (coords2.longitude - coords1.longitude) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(coords1.latitude * Math.PI / 180) *
        Math.cos(coords2.latitude * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 1000);
  };

  const renderOfferCard = ({ item }) => {
    const distance = location
      ? getDistance(location, {
          latitude: item.location.coordinates[1],
          longitude: item.location.coordinates[0],
        })
      : null;

    return (
      <TouchableOpacity style={styles.card}>
        {item.images && item.images.length > 0 && (
          <Image source={{ uri: item.images[0] }} style={styles.imageSmall} />
        )}
        <View style={styles.cardContent}>
          <Text style={styles.title}>{item.name}</Text>
          <Text style={styles.category}>{item.subcategory}</Text>
          <Text style={styles.description} numberOfLines={3}>
            {item.description}
          </Text>
          <Text style={styles.validity}>{getValidityText(item)}</Text>
          {distance !== null && (
            <Text style={styles.distance}>Entfernung: {distance} m</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const groupedOffers = offers.reduce((acc, offer) => {
    const key = offer.category || 'Sonstiges';
    if (!acc[key]) acc[key] = [];
    acc[key].push(offer);
    return acc;
  }, {});

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.heading}>Angebote in deiner Nähe</Text>

      {location && (
        <View style={styles.mapCard}>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: location.latitude,
              longitude: location.longitude,
              latitudeDelta: 0.002,
              longitudeDelta: 0.002,
            }}
            region={{
              latitude: location.latitude,
              longitude: location.longitude,
              latitudeDelta: 0.002,
              longitudeDelta: 0.002,
            }}
            mapType={mapType}
          >
            <Marker
              coordinate={{
                latitude: location.latitude,
                longitude: location.longitude,
              }}
            />
          </MapView>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <Button
          title={`Wechsel zu ${
            mapType === 'standard' ? 'Satellitenansicht' : 'Standardansicht'
          }`}
          onPress={() =>
            setMapType(mapType === 'standard' ? 'satellite' : 'standard')
          }
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 30 }} />
      ) : userInterests.length === 0 ? (
        <Text style={styles.noResults}>Bitte wähle zuerst deine Interessen aus.</Text>
      ) : offers.length === 0 ? (
        <Text style={styles.noResults}>Keine passenden Angebote gefunden</Text>
      ) : (
        Object.entries(groupedOffers).map(([category, items]) => (
          <View key={category} style={{ marginBottom: 24 }}>
            <Text style={styles.sectionTitle}>{category}</Text>
            <FlatList
              horizontal
              data={items}
              keyExtractor={(item) => item._id}
              renderItem={renderOfferCard}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16 }}
            />
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 50 },
  heading: { fontSize: 24, fontWeight: 'bold', paddingHorizontal: 16, marginBottom: 10 },
  sectionTitle: { fontSize: 20, fontWeight: '600', paddingHorizontal: 16, marginBottom: 8 },
  list: { paddingHorizontal: 16 },
  card: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    marginRight: 12,
    width: 220,
    overflow: 'hidden',
    elevation: 3,
  },
  imageSmall: { width: '100%', height: 100 },
  cardContent: { padding: 12 },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  category: { fontSize: 13, color: '#777', marginBottom: 4 },
  description: { fontSize: 13, color: '#333' },
  validity: { fontSize: 13, color: '#059669', marginTop: 6 },
  distance: { fontSize: 13, color: '#1d4ed8', marginTop: 2 },
  noResults: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 40,
  },
  mapCard: {
    width: '100%',
    height: 250,
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
