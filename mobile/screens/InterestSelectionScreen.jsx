// stepsmatch/mobile/screens/InterestSelectionScreen.js
import React, { useEffect, useState } from "react";
import { View, Text, Button, StyleSheet } from "react-native";
import axios from "axios";

const InterestSelectionScreen = ({ onFinish }) => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchCategories = async () => {
      setLoading(true);
      try {
        const response = await axios.get('http://localhost:5000/api/categories');
        setCategories(response.data);  // Speichert die Kategorien aus der DB
      } catch (error) {
        console.error("Fehler beim Laden der Kategorien:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  const handleSelection = (selectedCategories) => {
    onFinish(selectedCategories);  // Überträgt die ausgewählten Kategorien
  };

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Wähle deine Interessen:</Text>
      {loading ? (
        <Text>Lade Kategorien...</Text>
      ) : (
        categories.map((category) => (
          <Button
            key={category._id}
            title={category}
            onPress={() => handleSelection([category])}  // Beispiel: Auswahl einer Kategorie
          />
        ))
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  text: {
    fontSize: 18,
    fontWeight: "bold",
  },
});

export default InterestSelectionScreen;
