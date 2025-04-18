import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance from '../api/axios';

export default function HomeScreen({ navigation }) {
  const [offers, setOffers] = useState([]);
  const [location, setLocation] = useState(null);
  const [interests, setInterests] = useState([]);
  const [loading, setLoading] = useState(true);

  // 📦 Interessen laden
  useEffect(() => {
    const fetchInterests = async () => {
      const saved = await AsyncStorage.getItem('userInterests');
      const parsed = saved ? JSON.parse(saved) : [];
      console.log('🎯 Interessen geladen:', parsed);
      setInterests(parsed);
    };
    fetchInterests();
  }, []);

  // 📍 Standort ermitteln
  useEffect(() => {
    const getLocation = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('❌ Standort-Zugriff verweigert');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      console.log('📍 Standort geladen:', loc.coords);
      setLocation(loc.coords);
    };
    getLocation();
  }, []);

  // 🔄 Sobald Standort & Interessen da sind: Angebote holen
  useEffect(() => {
    if (location && interests.length > 0) {
      fetchOffers();
    }
  }, [location, interests]);

  const fetchOffers = async () => {
    setLoading(true);
    try {
      console.log('📡 API-Aufruf mit:', {
        lat: location.latitude,
        lng: location.longitude,
        subcategories: interests,  // Ändere dies zu 'subcategories'
      });

      const response = await axiosInstance.get('/offers/nearby', {
        params: {
          lat: location.latitude,
          lng: location.longitude,
          subcategories: interests,  // Verwende 'subcategories'
        },
      });

      console.log('✅ Angebote erhalten:', response.data);

      if (response.data.length === 0) {
        console.log('Keine Angebote gefunden, überprüfen Sie die Kategorien.');
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

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Angebote in deiner Nähe</Text>

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
  
});
