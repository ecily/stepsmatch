import React, { useEffect, useState } from 'react';
import {
  View,
  FlatList,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import axiosInstance from "../src/utils/axiosInstance";
import { useNavigation } from '@react-navigation/native';

const HomeScreen = () => {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigation = useNavigation();

  useEffect(() => {
    const fetchOffers = async () => {
      try {
        console.log('📤 [AXIOS] Anfrage an: /offers');
        const response = await axiosInstance.get('/offers');
        const data = response?.data || [];

        console.log('✅ [AXIOS] Antwort:', data);
        setOffers(data);
      } catch (err) {
        console.error('❌ Fehler beim Laden der Angebote:', err.message);
        setError('Fehler beim Laden der Angebote');
      } finally {
        setLoading(false);
      }
    };

    fetchOffers();
  }, []);

  const renderItem = ({ item }) => {
    if (!item || !item.name) return null;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('OfferDetails', { offerId: item._id })}
      >
        <Text style={styles.title}>{item.name}</Text>
        {item.description && <Text>{item.description}</Text>}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00aaff" />
        <Text>Wird geladen…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text>{error}</Text>
      </View>
    );
  }

  if (!offers || offers.length === 0) {
    return (
      <View style={styles.centered}>
        <Text>Keine Angebote verfügbar</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={offers}
      keyExtractor={(item) => item._id || Math.random().toString()}
      renderItem={renderItem}
      contentContainerStyle={styles.container}
    />
  );
};

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    padding: 10,
  },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 10,
    borderRadius: 8,
    elevation: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default HomeScreen;
