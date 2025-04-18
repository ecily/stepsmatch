import React, { useState, useEffect } from 'react';
import { View, Text, Button, Alert, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import { useNavigation, useRoute } from '@react-navigation/native';

const LocationAccessScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId } = route.params;

  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    requestPermission();
  }, []);

  const requestPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      setPermissionGranted(true);
    } else {
      Alert.alert(
        'Standort erforderlich',
        'Bitte erlaube den Zugriff auf deinen Standort, um passende Angebote zu sehen.'
      );
    }
  };

  const handleNext = () => {
    navigation.navigate('InterestSelection', { userId });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headline}>Standortzugriff</Text>
      <Text style={styles.text}>
        Wir benötigen deinen Standort, um dir passende Angebote in deiner Nähe zeigen zu können.
      </Text>

      <Button
        title="Zugriff erneut anfragen"
        onPress={requestPermission}
        color="#2563eb"
      />

      {permissionGranted && (
        <View style={{ marginTop: 24 }}>
          <Button
            title="Weiter"
            onPress={handleNext}
            color="#10b981"
          />
        </View>
      )}
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
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#111827',
  },
  text: {
    fontSize: 16,
    marginBottom: 32,
    color: '#4b5563',
  },
});
