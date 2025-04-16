// stepsmatch/mobile/App.js
import { registerRootComponent } from 'expo';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import axios from 'axios';

import RadiusSelectionScreen from './screens/RadiusSelectionScreen';
import InterestSelectionScreen from './screens/InterestSelectionScreen';
import LocationAccessScreen from './screens/LocationAccessScreen';  // Neu hinzugefügt

const Stack = createNativeStackNavigator();

function App() {
  const [radius, setRadius] = useState(null);
  const [interests, setInterests] = useState(null);
  const [categories, setCategories] = useState([]);  // Kategorien werden hier gespeichert
  const [loading, setLoading] = useState(false);

  // Kategorien von Backend holen
  useEffect(() => {
    const fetchCategories = async () => {
      setLoading(true);
      try {
        const response = await axios.get('https://lobster-app-ie9a5.ondigitalocean.app/api/categories');
        setCategories(response.data);  // Speichern der Kategorien
      } catch (error) {
        console.error("Fehler beim Abrufen der Kategorien:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!radius ? (
          <Stack.Screen name="Radius">
            {() => (
              <SafeAreaView style={{ flex: 1 }}>
                <RadiusSelectionScreen onFinish={setRadius} />
              </SafeAreaView>
            )}
          </Stack.Screen>
        ) : !interests ? (
          <Stack.Screen name="Interests">
            {() => (
              <SafeAreaView style={{ flex: 1 }}>
                <InterestSelectionScreen 
                  onFinish={setInterests} 
                  categories={categories}  // Kategorien werden hier übergeben
                  loading={loading}  // Zeigt den Ladezustand
                />
              </SafeAreaView>
            )}
          </Stack.Screen>
        ) : (
          <Stack.Screen name="LocationAccess">
            {() => (
              <LocationAccessScreen 
                selectedCategories={interests} 
                radius={radius}
              />
            )}
          </Stack.Screen>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e0f7fa',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  text: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#00796b',
    marginBottom: 10,
    textAlign: 'center',
  },
  interests: {
    fontSize: 18,
    color: '#004d40',
    textAlign: 'center',
  },
});

export default registerRootComponent(App);
