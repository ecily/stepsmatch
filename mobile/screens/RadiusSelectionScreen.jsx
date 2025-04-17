import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import axios from 'axios';

const radiusOptions = [
  { label: 'bis 100 m', value: 100 },
  { label: 'bis 500 m', value: 500 },
  { label: 'bis 1 km', value: 1000 },
  { label: 'bis 3 km', value: 3000 },
];

export default function RadiusSelectionScreen() {
  const [selectedRadius, setSelectedRadius] = useState(null);
  const [providerCount, setProviderCount] = useState(null);
  const [loading, setLoading] = useState(false);

  // Benutzer-Standort simulieren oder abfragen
  const userLocation = {
    lat: 47.0707,  // Beispiel Koordinaten (ändern, falls notwendig)
    lng: 15.4395,
  };

  const handleRadiusSelect = async (radius) => {
    setSelectedRadius(radius);
    setLoading(true);

    try {
      // Anfrage an die API mit den Benutzerkoordinaten und dem Radius
      const res = await axios.get(`http://localhost:5000/api/offers/nearby`, {
        params: {
          lat: userLocation.lat,
          lng: userLocation.lng,
          radius: radius,
        },
      });
      console.log(res)

      // Die Anzahl der Anbieter im angegebenen Radius
      const count = res.data.length;
      setProviderCount(count);
    } catch (err) {
      console.error('Fehler beim Abrufen der Angebote:', err);
      setProviderCount('Fehler');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Wie weit bist du bereit für ein Angebot zu gehen?</Text>
      {radiusOptions.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={[styles.option, selectedRadius === opt.value && styles.selectedOption]}
          onPress={() => handleRadiusSelect(opt.value)}
        >
          <Text
            style={[ 
              styles.optionText,
              selectedRadius === opt.value && styles.selectedOptionText,
            ]}
          >
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}

      {loading && <ActivityIndicator style={{ marginTop: 16 }} size="large" color="#00796b" />}

      {providerCount !== null && !loading && (
        <Text style={styles.info}>
          Toll! Momentan, wären {providerCount} Angebote in deiner Reichweite.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e0f7fa',
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#00796b',
    textAlign: 'center',
  },
  option: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: '#b2dfdb',
  },
  selectedOption: {
    backgroundColor: '#00796b',
  },
  optionText: {
    fontSize: 18,
    textAlign: 'center',
    color: '#004d40',
  },
  selectedOptionText: {
    color: 'white',
  },
  info: {
    fontSize: 16,
    marginTop: 24,
    textAlign: 'center',
    color: '#00796b',
  },
});
