import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import axios from 'axios';

const API_URL = 'http://10.0.0.34:5000/api/offers/test-offers'; // ⬅️ Deine lokale IP

const MongoDBTest = () => {
  const [loading, setLoading] = useState(true);
  const [offers, setOffers] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOffers = async () => {
      try {
        const response = await axios.get(API_URL);
        setOffers(response.data.offers || []);
      } catch (err) {
        console.error('❌ Fehler beim Abrufen:', err.message);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchOffers();
  }, []);

  if (loading) return <ActivityIndicator size="large" color="#007aff" />;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>MongoDB Verbindungstest</Text>
      {error && <Text style={styles.error}>❌ Fehler: {error}</Text>}
      {!error && offers.length === 0 && <Text>⚠️ Keine Angebote gefunden.</Text>}
      {offers.map((offer, index) => (
        <View key={index} style={styles.card}>
          <Text style={styles.name}>{offer.name}</Text>
          <Text>{offer.description}</Text>
        </View>
      ))}
    </ScrollView>
  );
};

export default MongoDBTest;

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 12 },
  error: { color: 'red', marginBottom: 10 },
  card: {
    marginBottom: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
  },
  name: { fontWeight: 'bold' },
});
