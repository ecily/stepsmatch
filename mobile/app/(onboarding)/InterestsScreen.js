import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import axios from 'axios';
import colors from '../../theme/colors';

const API_URL = 'https://lobster-app-ie9a5.ondigitalocean.app/api';

export default function InterestsScreen() {
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCats = async () => {
      try {
        const res = await axios.get(`${API_URL}/categories`);
        setCategories(res.data || []);
      } catch (err) {
        setCategories([]);
      } finally {
        setLoading(false);
      }
    };
    fetchCats();
    AsyncStorage.getItem('userInterests').then((data) => {
      if (data) setSelected(JSON.parse(data));
    });
  }, []);

  const toggleInterest = (interest) => {
    setSelected((curr) =>
      curr.includes(interest) ? curr.filter((x) => x !== interest) : [...curr, interest]
    );
  };

  const handleSave = async () => {
    await AsyncStorage.setItem('userInterests', JSON.stringify(selected));
    router.replace('/(tabs)');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.headline}>Wähle deine Interessen</Text>
      {categories.map((cat) => (
        <View key={cat._id} style={styles.categorySection}>
          <Text style={styles.categoryTitle}>{cat.name}</Text>
          <View style={styles.subcatRow}>
            {(cat.subcategories || []).map((subcat) => (
              <TouchableOpacity
                key={subcat}
                style={[
                  styles.chip,
                  selected.includes(subcat) && styles.chipSelected,
                ]}
                onPress={() => toggleInterest(subcat)}
              >
                <Text style={[
                  styles.chipText,
                  selected.includes(subcat) && styles.chipTextSelected,
                ]}>
                  {subcat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
      <TouchableOpacity
        style={[
          styles.saveButton,
          selected.length === 0 && { backgroundColor: '#ccc' },
        ]}
        onPress={handleSave}
        disabled={selected.length === 0}
      >
        <Text style={styles.saveText}>Auswahl speichern</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: 28, paddingBottom: 64 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  headline: { fontSize: 24, fontWeight: 'bold', color: colors.primary, marginBottom: 18, textAlign: 'center' },
  categorySection: { marginBottom: 28 },
  categoryTitle: { fontSize: 19, fontWeight: 'bold', color: colors.accent || colors.primary, marginBottom: 7 },
  subcatRow: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: {
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 18,
    margin: 6,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 15,
    color: '#444',
  },
  chipTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  saveText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
});
