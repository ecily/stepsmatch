import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import axiosInstance from '../api/axios';
import { useNavigation, useRoute } from '@react-navigation/native';

const colors = [
  '#93c5fd', // blue-300
  '#fcd34d', // yellow-300
  '#86efac', // green-300
  '#fda4af', // pink-300
  '#f9a8d4', // rose-300
  '#ddd6fe', // violet-300
  '#fdba74', // orange-300
];

const InterestSelectionScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId } = route.params;
  const [categories, setCategories] = useState([]);
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await axiosInstance.get('/categories');
        setCategories(res.data);
      } catch (error) {
        console.error('Fehler beim Laden der Kategorien:', error);
      }
    };

    fetchCategories();
  }, []);

  const toggleInterest = (subcategory) => {
    setSelectedInterests((prev) =>
      prev.includes(subcategory)
        ? prev.filter((i) => i !== subcategory)
        : [...prev, subcategory]
    );
  };

  const handleSubmit = async () => {
    if (selectedInterests.length === 0) return;
    setLoading(true);
    try {
      await axiosInstance.put(`/auth/preferences/${userId}`, {
        interests: selectedInterests,
        preferredRadius: 1000, // 🔧 später dynamisch ersetzen
      });
      navigation.navigate('Home'); // ❗ Später Home-Screen definieren
    } catch (error) {
      console.error('Fehler beim Speichern der Präferenzen:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      <Text style={styles.headline}>Was interessiert dich?</Text>
      <Text style={styles.subline}>
        Wähle Kategorien aus, die dir wichtig sind. Du kannst sie später jederzeit ändern.
      </Text>

      {categories.map((cat, index) => (
        <View key={cat.category} style={styles.categoryBlock}>
          <Text style={styles.categoryTitle}>{cat.category}</Text>
          <View style={styles.bubbleContainer}>
            {cat.subcategories.map((sub) => (
              <TouchableOpacity
                key={sub}
                onPress={() => toggleInterest(sub)}
                style={[
                  styles.bubble,
                  {
                    backgroundColor: selectedInterests.includes(sub)
                      ? colors[index % colors.length]
                      : '#f3f4f6',
                    borderColor: colors[index % colors.length],
                  },
                ]}
              >
                <Text
                  style={{
                    color: selectedInterests.includes(sub) ? '#111827' : '#6b7280',
                    fontWeight: '500',
                  }}
                >
                  {sub}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      <TouchableOpacity
        onPress={handleSubmit}
        style={styles.submitButton}
        disabled={loading || selectedInterests.length === 0}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>Weiter</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

export default InterestSelectionScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    paddingTop: 40,
  },
  headline: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  subline: {
    fontSize: 16,
    color: '#4b5563',
    marginBottom: 20,
  },
  categoryBlock: {
    marginBottom: 24,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  bubbleContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bubble: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  submitButton: {
    marginTop: 24,
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
