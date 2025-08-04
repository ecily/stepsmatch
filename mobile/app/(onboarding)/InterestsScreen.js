import React, { useState, useEffect } from 'react';
import { Text, Button, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

const INTERESTS = [
  'Sport', 'Musik', 'Essen', 'Technik', 'Kunst', 'Reisen'
];

export default function InterestsScreen() {
  const [selected, setSelected] = useState([]);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem('userInterests');
      if (saved) setSelected(JSON.parse(saved));
    })();
  }, []);

  const toggleInterest = (interest) => {
    setSelected((prev) =>
      prev.includes(interest)
        ? prev.filter((item) => item !== interest)
        : [...prev, interest]
    );
  };

  const handleContinue = async () => {
    await AsyncStorage.setItem('userInterests', JSON.stringify(selected));
    router.replace('/(tabs)'); // <- Das ist jetzt sicher und zukunftsfähig!
  };

  return (
    <SafeAreaView style={{ flex: 1, padding: 24 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 16 }}>Was interessiert dich?</Text>
      <FlatList
        data={INTERESTS}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={{
              padding: 16,
              marginVertical: 8,
              backgroundColor: selected.includes(item) ? '#0062FF' : '#eee',
              borderRadius: 10,
            }}
            onPress={() => toggleInterest(item)}
          >
            <Text style={{ color: selected.includes(item) ? '#fff' : '#222' }}>{item}</Text>
          </TouchableOpacity>
        )}
      />
      <Button
        title="Weiter"
        onPress={handleContinue}
        disabled={selected.length === 0}
        color="#0062FF"
      />
    </SafeAreaView>
  );
}
