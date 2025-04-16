// stepsmatch/mobile/screens/InterestSelectionScreen.js
import React, { useEffect, useState } from "react";
import { View, Text, Button, StyleSheet, ScrollView } from "react-native";
import axios from "axios";

const InterestSelectionScreen = ({ onFinish }) => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState([]);

  useEffect(() => {
    const fetchCategories = async () => {
      setLoading(true);
      try {
        const response = await axios.get('https://lobster-app-ie9a5.ondigitalocean.app/api/categories');
        setCategories(response.data);  // Speichert die Kategorien aus der DB
      } catch (error) {
        console.error("Fehler beim Laden der Kategorien:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  // Handle Category Selection
  const handleSelection = (categoryName) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryName)
        ? prev.filter((item) => item !== categoryName)  // Entfernen, wenn bereits ausgewählt
        : [...prev, categoryName]  // Hinzufügen, wenn noch nicht ausgewählt
    );
  };

  const handleFinish = () => {
    onFinish(selectedCategories);  // Überträgt die ausgewählten Kategorien
  };

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Wähle deine Interessen:</Text>
      {loading ? (
        <Text>Lade Kategorien...</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.buttonsContainer}>
          {categories.map((category) => (
            <Button
              key={category._id}
              title={category.name}
              onPress={() => handleSelection(category.name)}  // Toggle Auswahl
              color={selectedCategories.includes(category.name) ? 'green' : 'blue'}  // Auswahl anzeigen
            />
          ))}
        </ScrollView>
      )}
      <Button title="Fertig" onPress={handleFinish} />
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
    marginBottom: 20,
  },
  buttonsContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 20,
  }
});

export default InterestSelectionScreen;
