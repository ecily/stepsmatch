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
} from 'react-native';
import * as Location from 'expo-location';
import axiosInstance from '../src/api/axios';
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
  const [userId, setUserId] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const reloadTimer = useRef(null);

  useEffect(() => {
    const loadUserId = async () => {
      const id = await AsyncStorage.getItem('userId');
      console.log('📦 Geladene User-ID aus AsyncStorage:', id);
      setUserId(id);
    };
    loadUserId();
  }, []);

  useEffect(() => {
    const loadInterests = async () => {
      const stored = await AsyncStorage.getItem('userInterests');
      if (!stored) {
        console.warn('⚠️ Keine gespeicherten Interessen gefunden');
        setInitialLoading(false);
        return;
      }
      try {
        setUserInterests(JSON.parse(stored));
      } catch (err) {
        console.error('❌ Fehler beim Parsen der Interessen:', err);
      }
      setInitialLoading(false);
    };
    loadInterests();
  }, []);

  useEffect(() => {
    let unsubscribe;
    const getLocation = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      unsubscribe = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 10 },
        (newLocation) => setLocation(newLocation.coords)
      );
    };
    getLocation();
    return () => {
      if (unsubscribe) unsubscribe.remove();
    };
  }, []);

  useEffect(() => {
    if (location) {
      loadFromCacheOrFetch();
      if (reloadTimer.current) clearInterval(reloadTimer.current);
      reloadTimer.current = setInterval(() => {
        console.log('🔄 Automatischer Reload nach 5 Minuten');
        fetchAllValidOffers();
      }, CACHE_DURATION);
      return () => clearInterval(reloadTimer.current);
    }
  }, [location]);

  useEffect(() => {
    if (location && userInterests.length > 0) {
      console.log('🔁 Interessen wurden geändert → Neufilterung');
      applyInterestFilter();
    }
  }, [userInterests]);

  const loadFromCacheOrFetch = async () => {
    if (!location) return;
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const { timestamp, data } = JSON.parse(cached);
        const isFresh = Date.now() - timestamp < CACHE_DURATION;
        const filtered = data?.filter((o) =>
          isValidOffer(o, location, userInterests)
        ) || [];

        setOffers(filtered);
        setLoading(false);

        if (!isFresh) {
          console.log('🕒 Cache ist alt → revalidiere im Hintergrund...');
          fetchAllValidOffers();
        }
      } else {
        await fetchAllValidOffers();
      }
    } catch (err) {
      console.error('❌ Fehler beim Laden des Caches:', err);
      await fetchAllValidOffers();
    }
  };

  const applyInterestFilter = async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data } = JSON.parse(cached);
        const filtered = data?.filter((o) =>
          isValidOffer(o, location, userInterests)
        ) || [];
        setOffers(filtered);
      }
    } catch (err) {
      console.error('❌ Fehler bei der Neufilterung nach Interessen:', err);
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
      await AsyncStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ timestamp: Date.now(), data: cacheData })
      );

      const filtered = cacheData.filter((offer) =>
        isValidOffer(offer, location, userInterests)
      );

      setOffers(filtered);
    } catch (err) {
      console.error('❌ Fehler beim Laden der Angebote:', err.message || err);
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

    return (
      distance <= Math.min(RADIUS, offer.radius) &&
      (interests.length === 0 || interests.includes(offer.subcategory))
    );
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
          disabled={!userId}
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
