import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import axios from 'axios';

const API_URL = 'http://10.0.0.34:5000/api/offers/nearby';

const NearbyTest = () => {
  const [loading, setLoading] = useState(true);
  const [offers, setOffers] = useState([]);
  const [error, setError] = useState(null);

  // Beispielkoordinaten: Graz, Radius 1000 Meter
  const lat = 47.0707;
  const lng = 15.4395;
  const radius = 1000;

  useEffect(() => {
    const fetchNearbyOffers = async () => {
      try {
        const response = await axios.get(`${API_URL}?lat=${lat}&lng=${lng}&radius=${radius}`);
        setOffers(response.data || []);
      } catch (err) {
        console.error('❌ Fehler beim Abrufen:', err.message);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchNearbyOffers();
  }, []);

  if (loading) return <ActivityIndicator size="large" color="#007aff" />;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Geo-Abfrage: Nearby Offers</Text>
      {error && <Text style={styles.error}>❌ Fehler: {error}</Text>}
      {!error && offers.length === 0 && <Text>⚠️ Keine Angebote im Umkreis gefunden.</Text>}
      {offers.map((offer, index) => (
        <View key={index} style={styles.card}>
          <Text style={styles.name}>{offer.name}</Text>
          <Text>{offer.description}</Text>
        </View>
      ))}
    </ScrollView>
  );
};

export default NearbyTest;

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
