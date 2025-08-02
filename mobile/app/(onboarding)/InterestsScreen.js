// /mobile/app/(onboarding)/InterestsScreen.js

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import colors from '../../theme/colors';
import fonts from '../../theme/fonts';
import { useRouter } from 'expo-router';

const INTERESTS = [
  { id: '1', label: 'Freizeit & Events' },
  { id: '2', label: 'Sport & Fitness' },
  { id: '3', label: 'Essen & Trinken' },
  { id: '4', label: 'Shopping' },
  { id: '5', label: 'Haushalt & Services' },
  { id: '6', label: 'Familie & Kinder' },
  { id: '7', label: 'Kunst & Kultur' },
  { id: '8', label: 'Natur & Outdoor' },
];

export default function InterestsScreen() {
  const [selected, setSelected] = useState([]);
  const router = useRouter();

  const toggleInterest = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleContinue = () => {
    // TODO: Speichere Auswahl persistent (z. B. AsyncStorage)
    router.replace('/(tabs)/HomeScreen');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headline}>Was interessiert dich?</Text>
      <Text style={styles.subheadline}>
        Wähle aus, was dich begeistert. So bekommst du nur passende Angebote angezeigt.
      </Text>
      <FlatList
        data={INTERESTS}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.chip,
              selected.includes(item.id) && styles.chipSelected,
            ]}
            onPress={() => toggleInterest(item.id)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.chipText,
                selected.includes(item.id) && styles.chipTextSelected,
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
        numColumns={2}
        contentContainerStyle={styles.chipContainer}
        columnWrapperStyle={{ justifyContent: 'space-between' }}
        showsVerticalScrollIndicator={false}
      />
      <TouchableOpacity
        style={[
          styles.button,
          selected.length === 0 && { backgroundColor: colors.accent },
        ]}
        onPress={handleContinue}
        disabled={selected.length === 0}
        activeOpacity={0.85}
      >
        <Text style={styles.buttonText}>Weiter</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
    paddingTop: 50,
    alignItems: 'center',
  },
  headline: {
    fontFamily: fonts.bold,
    fontSize: 25,
    color: colors.primary,
    marginBottom: 8,
  },
  subheadline: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 24,
  },
  chipContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  chip: {
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: colors.accent,
    paddingVertical: 12,
    paddingHorizontal: 18,
    margin: 8,
    backgroundColor: colors.white,
    minWidth: 130,
    alignItems: 'center',
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontFamily: fonts.medium,
    color: colors.text,
    fontSize: 15,
  },
  chipTextSelected: {
    color: colors.white,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 44,
    shadowColor: colors.primary,
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
    marginTop: 12,
  },
  buttonText: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 18,
    letterSpacing: 0.2,
  },
});
