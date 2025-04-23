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

const LocationAccessScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId } = route.params;

  const [loading, setLoading] = useState(false);

  const handleGrantAccess = async () => {
    setLoading(true);

    try {
      // Speichere die userId dauerhaft
      if (userId) {
        await AsyncStorage.setItem('userId', userId);
      } else {
        Alert.alert('Fehler', 'User-ID fehlt. Bitte erneut einloggen.');
        setLoading(false);
        return;
      }

      // Standortfreigabe anfordern
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Standort benötigt',
          'Bitte erlaube den Standortzugriff, um passende Angebote in deiner Nähe zu erhalten.'
        );
        setLoading(false);
        return;
      }

      // Weiter zur InterestSelection (immer, egal ob schon gespeichert oder nicht)
      navigation.navigate('InterestSelection', { userId });

    } catch (error) {
      console.error('Fehler bei der Standortfreigabe:', error);
      Alert.alert('Fehler', 'Beim Anfordern der Standortfreigabe ist etwas schiefgelaufen.');
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
