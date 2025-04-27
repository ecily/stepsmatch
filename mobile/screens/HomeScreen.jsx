import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Alert,
  ScrollView,
} from 'react-native';
import * as Location from 'expo-location';
import axiosInstance from '../src/api/axios';
import MapView, { Marker } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import customMapStyle from '../components/mapStyle';

const RADIUS = 2000;
const CACHE_KEY = 'cachedOffers';
const CACHE_DURATION = 5 * 60 * 1000;
const CARD_OPACITY = 0.6;

const colors = [
  '#93c5fd', '#fcd34d', '#86efac', '#fda4af',
  '#f9a8d4', '#ddd6fe', '#fdba74',
];

export default function HomeScreen({ navigation }) {
  const [offers, setOffers] = useState([]);
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mapType, setMapType] = useState('standard');
  const [userInterests, setUserInterests] = useState([]);
  const [userId, setUserId] = useState(null);
  const [status, setStatus] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);

  const reloadTimer = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    const startApp = async () => {
      try {
        await checkBackendConnection();
        await loadUserSettings();
      } catch (err) {
        console.error('Fehler beim Start der App:', err);
      }
    };
    startApp();

    return () => {
      if (reloadTimer.current) clearInterval(reloadTimer.current);
    };
  }, []);

  useEffect(() => {
    if (userInterests.length > 0) {
      getLocationAndOffers();
    }
  }, [userInterests]);

  const checkBackendConnection = async () => {
    try {
      await axiosInstance.get('/offers');
      setStatus('✅ Server OK');
    } catch (err) {
      console.error('❌ Netzwerkfehler:', err.message);
      setStatus('❌ Serverfehler');
      Alert.alert('Verbindung fehlgeschlagen', 'Die App konnte das Backend nicht erreichen.');
    }
  };

  const loadUserSettings = async () => {
    try {
      const interests = await AsyncStorage.getItem('userInterests');
      const id = await AsyncStorage.getItem('userId');
      if (interests) setUserInterests(JSON.parse(interests));
      if (id) setUserId(id);
    } catch (err) {
      console.error('Fehler beim Laden der Nutzerdaten:', err);
    } finally {
      setInitialLoading(false);
    }
  };

  const getLocationAndOffers = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Standort benötigt', 'Bitte erlaube den Zugriff auf den Standort.');
      return;
    }
    const loc = await Location.getCurrentPositionAsync({});
    setLocation(loc.coords);
    await fetchAllValidOffers(loc.coords, true);
    reloadTimer.current = setInterval(() => fetchAllValidOffers(loc.coords), CACHE_DURATION);
  };

  const fetchAllValidOffers = async (coords, updateCache = false) => {
    if (!coords) return;
    try {
      setLoading(true);
      const res = await axiosInstance.post('/offers/nearby-noauth', {
        lat: coords.latitude,
        lng: coords.longitude,
      });
      const data = res.data.map(({ images, ...rest }) => rest);
      if (updateCache) {
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data }));
      }
      const filtered = filterOffers(data, coords);
      setOffers(filtered);
    } catch (err) {
      console.error('Fehler beim Neu-Laden:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const filterOffers = (data, coords) => {
    if (!coords) return [];
    return data.filter((offer) => isValidOffer(offer, coords, userInterests));
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

    const [startH, startM] = offer.validTimes?.start?.split(':').map(Number) || [0, 0];
    const [endH, endM] = offer.validTimes?.end?.split(':').map(Number) || [23, 59];
    const start = new Date(now);
    const end = new Date(now);
    start.setHours(startH, startM, 0, 0);
    end.setHours(endH, endM, 0, 0);
    if (now < start || now > end) return false;

    const dist = getDistance(userLoc, {
      latitude: offer.location.coordinates[1],
      longitude: offer.location.coordinates[0],
    });
    return dist <= Math.min(RADIUS, offer.radius) &&
      (interests.length === 0 || interests.includes(offer.subcategory));
  };

  const getDistance = (a, b) => {
    const R = 6371;
    const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
    const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
    const lat1 = (a.latitude * Math.PI) / 180;
    const lat2 = (b.latitude * Math.PI) / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    return Math.round(R * c * 1000);
  };

  const getTimeLeft = (offer) => {
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
    return `Noch gültig: ${days ? days + ' Tage, ' : ''}${hrs ? hrs + ' Std., ' : ''}${mins} Min.`;
  };

  const groupedOffers = offers.reduce((acc, offer) => {
    const category = offer.category || 'Sonstiges';
    if (!acc[category]) acc[category] = [];
    acc[category].push(offer);
    return acc;
  }, {});

  const renderSubcategoryCard = (item, index) => {
    const dist = location ? getDistance(location, {
      latitude: item.location.coordinates[1],
      longitude: item.location.coordinates[0],
    }) : null;
    const color = colors[index % colors.length];
    return (
      <TouchableOpacity
        style={[styles.offerCard, { backgroundColor: color + Math.floor(CARD_OPACITY * 255).toString(16) }]}
        onPress={() => navigation.navigate('OfferDetails', { offerId: item._id })}
      >
        {dist !== null && <Text style={styles.distanceAlert}>Nur {dist} m entfernt!</Text>}
        <Text style={styles.timeLeft}>{getTimeLeft(item)}</Text>
        <Text style={styles.subcategory}>{item.subcategory}</Text>
        <Text style={styles.offerTitle}>{item.name}</Text>
      </TouchableOpacity>
    );
  };

  if (initialLoading || loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={{ marginTop: 12 }}>Lade Angebote...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={{ height: 40 }} />
      <View style={styles.menuBar}>
        <Pressable style={styles.menuButton} onPress={() => navigation.navigate('InterestSelection', { userId })}>
          <Text style={styles.menuButtonText}>🎯 Interessen</Text>
        </Pressable>
        <Pressable style={styles.menuButton} onPress={() => setMapType(mapType === 'standard' ? 'satellite' : 'standard')}>
          <Text style={styles.menuButtonText}>🛰 Karte</Text>
        </Pressable>
      </View>

      {location && (
        <View style={styles.mapCard}>
          <MapView
            ref={mapRef}
            style={styles.map}
            region={{
              latitude: location.latitude,
              longitude: location.longitude,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            }}
            mapType={mapType}
            customMapStyle={mapType === 'standard' ? customMapStyle : []}
          >
            <Marker coordinate={location} pinColor="blue" />
            {offers.map((offer) => (
              <Marker
                key={offer._id}
                coordinate={{
                  latitude: offer.location.coordinates[1],
                  longitude: offer.location.coordinates[0],
                }}
                title={offer.name}
                description={offer.description}
              />
            ))}
          </MapView>
        </View>
      )}

      {Object.entries(groupedOffers).map(([category, items], idx) => (
        <View key={category}>
          <Text style={styles.categoryTitle}>{category}</Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={items}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => renderSubcategoryCard(item, idx)}
            contentContainerStyle={{ paddingLeft: 16, paddingBottom: 20 }}
          />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  menuBar: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16, paddingHorizontal: 10 },
  menuButton: { backgroundColor: '#2563eb', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, alignItems: 'center', flexDirection: 'row' },
  menuButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  mapCard: { height: 250, margin: 16, borderRadius: 12, overflow: 'hidden' },
  map: { width: '100%', height: '100%' },
  categoryTitle: { fontSize: 22, fontWeight: 'bold', marginLeft: 16, marginVertical: 12, color: '#111827' },
  offerCard: { borderRadius: 12, padding: 14, marginRight: 16, width: 240, borderWidth: 1, borderColor: '#d1d5db' },
  distanceAlert: { color: '#dc2626', fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
  timeLeft: { color: '#059669', fontSize: 13, marginBottom: 4 },
  subcategory: { color: '#6b7280', fontSize: 13, marginBottom: 4 },
  offerTitle: { color: '#111827', fontSize: 16, fontWeight: 'bold' },
});
