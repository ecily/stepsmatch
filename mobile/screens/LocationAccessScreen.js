// mobile/screens/LocationAccessScreen.jsx
import React from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import { useNavigation, useRoute } from '@react-navigation/native';

const LocationAccessScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId } = route.params;

  const handleGrantAccess = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Standort benötigt',
        'Bitte erlaube den Standortzugriff, um passende Angebote in deiner Nähe zu erhalten.'
      );
      return;
    }

    // ✅ Optional: aktuelle Position abrufen, z. B. für spätere Mongo-Abfrage
    // const location = await Location.getCurrentPositionAsync({});

    // ➡️ Weiter zum Interessen-Screen
    navigation.navigate('InterestSelection', { userId });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headline}>Standortzugriff erlauben</Text>
      <Text style={styles.text}>
        Damit wir dir passende Angebote in deiner Nähe anzeigen können, benötigen wir Zugriff auf
        deinen aktuellen Standort.
      </Text>

      <TouchableOpacity onPress={handleGrantAccess} style={styles.button}>
        <Text style={styles.buttonText}>Zugriff erlauben & weiter</Text>
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
