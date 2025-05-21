import React, { useState } from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import Slider from '@react-native-community/slider';
import { useNavigation, useRoute } from '@react-navigation/native';

const RadiusSelectionScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const userId = route.params?.userId;

  const [radius, setRadius] = useState(500);

  const handleNext = () => {
    navigation.navigate('InterestSelection', { preferredRadius: radius, userId });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headline}>Wie weit bist du bereit zu gehen?</Text>
      <Text style={styles.subline}>
        Wähle einen Radius, in dem du Angebote angezeigt bekommen möchtest.
      </Text>

      <Text style={styles.value}>{radius} m</Text>
      <Slider
        style={{ width: '100%', height: 40 }}
        minimumValue={100}
        maximumValue={5000}
        step={100}
        value={radius}
        onValueChange={setRadius}
        minimumTrackTintColor="#2563eb"
        maximumTrackTintColor="#ccc"
      />

      <View style={styles.buttonContainer}>
        <Button title="Weiter" onPress={handleNext} color="#2563eb" />
      </View>
    </View>
  );
};

export default RadiusSelectionScreen;

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
    marginBottom: 8,
  },
  subline: {
    fontSize: 16,
    color: '#4b5563',
    marginBottom: 32,
  },
  value: {
    fontSize: 22,
    fontWeight: '600',
    color: '#2563eb',
    textAlign: 'center',
    marginBottom: 12,
  },
  buttonContainer: {
    marginTop: 40,
  },
});
