import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import axiosInstance from '../src/api/axios';
import MapView, { Marker } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RADIUS = 2000;
const CACHE_KEY = 'cachedOffers';
const CACHE_DURATION = 5 * 60 * 1000;
export default function HomeScreen({ navigation }) {
  const [offers, setOffers] = useState([]);
  const [newOffers, setNewOffers] = useState([]);
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mapType, setMapType] = useState('standard');
  const [userInterests, setUserInterests] = useState([]);
  const [userId, setUserId] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);

  const reloadTimer = useRef(null);
  const mapRef = useRef(null);
  useEffect(() => {
    AsyncStorage.getItem('userId').then(setUserId);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('userInterests').then((stored) => {
      if (stored) {
        try {
          setUserInterests(JSON.parse(stored));
        } catch (err) {
          console.error('Fehler beim Parsen der Interessen:', err);
        }
      }
      setInitialLoading(false);
    });
  }, []);

  useEffect(() => {
    let unsubscribe;
    const getLocation = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      unsubscribe = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 1 },
        (loc) => {
          setLocation(loc.coords);
          mapRef.current?.animateToRegion({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            latitudeDelta: 0.002,
            longitudeDelta: 0.002,
          }, 500);
        }
      );
    };
    getLocation();
    return () => unsubscribe && unsubscribe.remove();
  }, []);
  useEffect(() => {
    if (!location) return;
    loadFromCacheOrFetch();
    if (reloadTimer.current) clearInterval(reloadTimer.current);
    reloadTimer.current = setInterval(fetchAllValidOffers, CACHE_DURATION);
    return () => clearInterval(reloadTimer.current);
  }, [location]);

  const loadFromCacheOrFetch = async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const { timestamp, data } = JSON.parse(cached);
        const isFresh = Date.now() - timestamp < CACHE_DURATION;
        const filtered = data.filter((o) => isValidOffer(o, location, userInterests));
        setOffers(filtered);
        setLoading(false);
        if (!isFresh) fetchAllValidOffers();
      } else {
        await fetchAllValidOffers();
      }
    } catch {
      await fetchAllValidOffers();
    }
  };
  const fetchAllValidOffers = async () => {
    if (!location) return;
    setLoading(true);
    try {
      const res = await axiosInstance.post('/offers/nearby-noauth', {
        lat: location.latitude,
        lng: location.longitude,
      });
      const cacheData = res.data.map((o) => ({ ...o, images: [] }));
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: cacheData }));

      const filtered = cacheData.filter((o) => isValidOffer(o, location, userInterests));
      const newOnes = filtered.filter((o) => !offers.some((old) => old._id === o._id));
      if (newOnes.length > 0) {
        setNewOffers(newOnes.map((o) => o._id));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('🎉 Neue Angebote!', `Du hast ${newOnes.length} neue Angebote erreicht.`);
      }
      setOffers(filtered);
    } catch (err) {
      console.error('Fehler beim Laden:', err.message);
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
    const isNew = newOffers.includes(item._id);

    return (
      <TouchableOpacity style={[styles.card, isNew && styles.newCard]}>
        <View style={styles.cardContent}>
          <Text style={styles.title}>
            {item.name} {isNew && <Text style={styles.newBadge}>NEU</Text>}
          </Text>
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

  if (initialLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={{ marginTop: 12 }}>Lade Einstellungen...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.menuBar}>
        <Pressable
          style={styles.menuButton}
          onPress={() => {
            if (!userId) {
              alert('User-ID fehlt');
              return;
            }
            navigation.navigate('InterestSelection', { userId });
          }}
        >
          <Text style={styles.menuText}>🎯 Interessen</Text>
        </Pressable>
        <Pressable
          style={styles.menuButton}
          onPress={() => setMapType(mapType === 'standard' ? 'satellite' : 'standard')}
        >
          <Text style={styles.menuText}>🗺 Karte</Text>
        </Pressable>
        <Pressable style={styles.menuButton} onPress={fetchAllValidOffers}>
          <Text style={styles.menuText}>🔄 Neu</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={{ paddingTop: 70 }}>
        <Text style={styles.heading}>Angebote in deiner Nähe</Text>

        {location && (
          <View style={styles.mapCard}>
            <MapView
              ref={mapRef}
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
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
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
  newCard: {
    borderColor: '#2563eb',
    borderWidth: 2,
  },
  cardContent: { padding: 12 },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  newBadge: {
    backgroundColor: '#2563eb',
    color: 'white',
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    marginLeft: 6,
  },
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
  menuBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 40,
    paddingBottom: 10,
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
  },
  menuButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#e0e7ff',
  },
  menuText: {
    fontWeight: '600',
    color: '#1e3a8a',
  },
});
