import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance from '../api/axios';

const LocationAccessScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId } = route.params;

  const [loading, setLoading] = useState(false);

  const handleGrantAccess = async () => {
    setLoading(true);

    try {
      // 1. Standortfreigabe anfordern
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Standort benötigt',
          'Bitte erlaube den Standortzugriff, um passende Angebote in deiner Nähe zu erhalten.'
        );
        setLoading(false);
        return;
      }

      // 2. Standort abrufen
      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      // 3. Interessen aus AsyncStorage laden
      const interestsRaw = await AsyncStorage.getItem('userInterests');
      const interests = interestsRaw ? JSON.parse(interestsRaw) : [];

      if (interests.length === 0) {
        Alert.alert('Keine Interessen gefunden', 'Bitte wähle zuerst Interessen aus.');
        setLoading(false);
        return;
      }

      // 4. Angebote vom Server laden
      const res = await axiosInstance.post('/offers/nearby', {
        lat: latitude,
        lng: longitude,
        interests: interests,
      });

      const offers = res.data;

      // 5. Weiter zur Startseite mit Angeboten
      navigation.navigate('Home', { offers });

    } catch (error) {
      console.error('Fehler beim Abrufen der Angebote:', error);
      Alert.alert('Fehler', 'Beim Abrufen der Angebote ist ein Problem aufgetreten.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headline}>Standortzugriff erlauben</Text>
      <Text style={styles.text}>
        Damit wir dir passende Angebote in deiner Nähe anzeigen können, benötigen wir Zugriff auf
        deinen aktuellen Standort.
      </Text>

      <TouchableOpacity onPress={handleGrantAccess} style={styles.button} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Zugriff erlauben & weiter</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

export default LocationAccessScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  headline: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  text: {
    fontSize: 16,
    color: '#4b5563',
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
