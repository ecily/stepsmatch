// mobile/screens/InterestsScreen.jsx

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import colors from '../../theme/colors';

const MOCK_INTERESTS = [
  { id: '1', label: 'Sport' },
  { id: '2', label: 'Musik' },
  { id: '3', label: 'Kunst & Kultur' },
  { id: '4', label: 'Essen & Trinken' },
  { id: '5', label: 'Reisen' },
  { id: '6', label: 'Technik' },
  { id: '7', label: 'Natur' },
  { id: '8', label: 'Mode' },
];

export default function InterestsScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState([]);

  // Beim Mounten: bisherige Auswahl laden (falls vorhanden)
  useEffect(() => {
    AsyncStorage.getItem('userInterests').then((data) => {
      if (data) setSelected(JSON.parse(data));
    });
  }, []);

  const toggleInterest = (id) => {
    setSelected((curr) =>
      curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id]
    );
  };

  const handleSave = async () => {
    await AsyncStorage.setItem('userInterests', JSON.stringify(selected));
    router.replace('/(tabs)');
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.chip,
        selected.includes(item.id) && styles.chipSelected,
      ]}
      onPress={() => toggleInterest(item.id)}
    >
      <Text style={[
        styles.chipText,
        selected.includes(item.id) && styles.chipTextSelected,
      ]}>
        {item.label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.headline}>Wähle deine Interessen</Text>
      <FlatList
        data={MOCK_INTERESTS}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        numColumns={2}
      />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 28, backgroundColor: colors.background },
  headline: { fontSize: 24, fontWeight: 'bold', color: colors.primary, marginBottom: 22, textAlign: 'center' },
  list: { alignItems: 'center', justifyContent: 'center' },
  chip: {
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 24,
    margin: 8,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 16,
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
    marginTop: 36,
  },
  saveText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
});
