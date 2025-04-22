// mobile/src/screens/HomeScreen.js

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
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

const RADIUS = 2000;
const CACHE_KEY = 'cachedOffers';
const CACHE_DURATION = 5 * 60 * 1000;

export default function HomeScreen({ navigation }) {
  const [offers, setOffers] = useState([]);
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mapType, setMapType] = useState('standard');
  const [userInterests, setUserInterests] = useState([]);
  const reloadTimer = useRef(null);

  useEffect(() => {
    const loadInterests = async () => {
      const stored = await AsyncStorage.getItem('userInterests');
      setUserInterests(stored ? JSON.parse(stored) : []);
    };
    loadInterests();
  }, []);

  useEffect(() => {
    const getLocation = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation(loc.coords);
    };
    getLocation();
  }, []);

  useEffect(() => {
    if (!location || userInterests.length === 0) return;

    const refresh = async () => {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        const filtered = parsed?.data?.filter((o) =>
          isValidOffer(o, location, userInterests)
        ) || [];
        setOffers(filtered);
        setLoading(false);
      } else {
        await fetchAndFilterOffers();
      }
    };

    refresh();

    if (reloadTimer.current) clearInterval(reloadTimer.current);
    reloadTimer.current = setInterval(() => {
      console.log('🔄 Automatischer Reload nach 5 Minuten');
      fetchAndFilterOffers();
    }, CACHE_DURATION);

    return () => clearInterval(reloadTimer.current);
  }, [location, userInterests]);

  const fetchAndFilterOffers = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.post('/offers/nearby', {
        lat: location.latitude,
        lng: location.longitude,
        interests: userInterests,
      });

      const filtered = res.data.filter((offer) =>
        isValidOffer(offer, location, userInterests)
      );

      setOffers(filtered);

      const cacheData = res.data.map((o) => ({ ...o, images: [] }));
      await AsyncStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ timestamp: Date.now(), data: cacheData })
      );
    } catch (err) {
      console.error('❌ Fehler beim Laden der Angebote:', err.message);
      alert('Netzwerkfehler beim Laden der Angebote');
    } finally {
      setLoading(false);
    }
  };

  const isValidOffer = (offer, userLoc, interests) => {
    const now = new Date();
    const from = new Date(offer.validDates?.from);
    const to = new Date(offer.validDates?.to);
    if (isNaN(from) || isNaN(to)) return false;
    to.setHours(23, 59, 59, 999);
    if (now < from || now > to) return false;

    const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
    if (!offer.validDays?.includes(weekday)) return false;

    const [startH, startM] = offer.validTimes?.start?.split(':').map(Number);
    const [endH, endM] = offer.validTimes?.end?.split(':').map(Number);
    const start = new Date(now);
    const end = new Date(now);
    start.setHours(startH, startM, 0, 0);
    end.setHours(endH, endM, 0, 0);
    if (now < start || now > end) return false;

    const distance = getDistance(userLoc, {
      latitude: offer.location.coordinates[1],
      longitude: offer.location.coordinates[0],
    });

    return distance <= Math.min(RADIUS, offer.radius) && interests.includes(offer.subcategory);
  };

  const getDistance = (a, b) => {
    const R = 6371;
    const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
    const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
    const lat1 = (a.latitude * Math.PI) / 180;
    const lat2 = (b.latitude * Math.PI) / 180;
    const x =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    return Math.round(R * c * 1000);
  };

  const getValidityText = (offer) => {
    const now = new Date();
    const end = new Date(offer.validDates?.to);
    const [h, m] = offer.validTimes?.end?.split(':')?.map(Number) || [23, 59];
    end.setHours(h, m, 0);
    const diff = end - now;
    if (diff <= 0) return '';
    const min = Math.floor(diff / 60000);
    const days = Math.floor(min / 1440);
    const hrs = Math.floor((min % 1440) / 60);
    const mins = min % 60;
    return `Jetzt gültig • noch ${days ? days + ' Tage, ' : ''}${hrs ? hrs + ' Std., ' : ''}${mins} Min.`;
  };

  const groupedOffers = offers.reduce((acc, offer) => {
    const cat = offer.category || 'Sonstiges';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(offer);
    return acc;
  }, {});

  const renderOfferCard = ({ item }) => {
    const dist = getDistance(location, {
      latitude: item.location.coordinates[1],
      longitude: item.location.coordinates[0],
    });

    return (
      <TouchableOpacity style={styles.card}>
        <View style={styles.cardContent}>
          <Text style={styles.title}>{item.name}</Text>
          <Text style={styles.category}>{item.subcategory}</Text>
          <Text style={styles.description} numberOfLines={3}>
            {item.description}
          </Text>
          <Text style={styles.validity}>{getValidityText(item)}</Text>
          <Text style={styles.distance}>Entfernung: {dist} m</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.heading}>Angebote in deiner Nähe</Text>

      {location && (
        <View style={styles.mapCard}>
          <MapView
            style={styles.map}
            region={{
              latitude: location.latitude,
              longitude: location.longitude,
              latitudeDelta: 0.002,
              longitudeDelta: 0.002,
            }}
            mapType={mapType}
          >
            <Marker coordinate={location} />
          </MapView>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <Button
          title={`Wechsel zu ${mapType === 'standard' ? 'Satellitenansicht' : 'Standardansicht'}`}
          onPress={() => setMapType(mapType === 'standard' ? 'satellite' : 'standard')}
        />
        <View style={{ marginTop: 10 }}>
          <Button title="Neu laden" onPress={fetchAndFilterOffers} color="#10b981" />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 30 }} />
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
  card: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    marginRight: 12,
    width: 220,
    overflow: 'hidden',
    elevation: 3,
  },
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
    height: 250,
    marginBottom: 20,
    marginHorizontal: 16,
    borderRadius: 10,
    overflow: 'hidden',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  buttonContainer: {
    marginVertical: 10,
    marginHorizontal: 16,
  },
});
