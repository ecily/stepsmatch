import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Button, ScrollView, TouchableOpacity, Alert } from 'react-native';
import axiosInstance from '../api/axios';
import { useRoute } from '@react-navigation/native';

const InterestSelectionScreen = () => {
  const route = useRoute();
  const { preferredRadius, userId } = route.params;

  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await axiosInstance.get('/categories');
        const allSubcategories = res.data.flatMap(cat => cat.subcategories);
        setCategories(allSubcategories);
      } catch (err) {
        console.error(err);
        Alert.alert('Fehler', 'Kategorien konnten nicht geladen werden');
      }
    };

    fetchCategories();
  }, []);

  const toggleCategory = (cat) => {
    setSelected((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleSubmit = async () => {
    try {
      await axiosInstance.patch(`/auth/preferences/${userId}`, {
        interests: selected,
        preferredRadius,
      });

      Alert.alert('Danke!', 'Deine Einstellungen wurden gespeichert.');
      // TODO: Weiterleitung zum Startscreen
    } catch (err) {
      console.error(err);
      Alert.alert('Fehler', 'Einstellungen konnten nicht gespeichert werden.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headline}>Was interessiert dich?</Text>
      <Text style={styles.subline}>Wähle so viele Kategorien wie du willst.</Text>

      <ScrollView contentContainerStyle={styles.categories}>
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.chip,
              selected.includes(cat) && styles.chipSelected,
            ]}
            onPress={() => toggleCategory(cat)}
          >
            <Text
              style={[
                styles.chipText,
                selected.includes(cat) && styles.chipTextSelected,
              ]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.buttonContainer}>
        <Button
          title="Fertig"
          onPress={handleSubmit}
          color="#2563eb"
          disabled={selected.length === 0}
        />
      </View>
    </View>
  );
};

export default InterestSelectionScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#fff',
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
    marginBottom: 24,
  },
  categories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    margin: 4,
  },
  chipSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  chipText: {
    color: '#111827',
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#fff',
  },
  buttonContainer: {
    marginTop: 32,
  },
});
