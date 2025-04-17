// stepsmatch/mobile/screens/LocationAccessScreen.js
import React, { useEffect, useState } from "react";
import { View, Text, Button, StyleSheet } from "react-native";
import axios from "axios";
import * as Location from "expo-location";

const LocationAccessScreen = ({ selectedCategories }) => {
  const [location, setLocation] = useState(null);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const getLocation = async () => {
      let { status } = await Location.requestPermissionsAsync();
      if (status !== "granted") {
        alert("Zugriff auf den Standort wurde verweigert.");
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setLocation(location.coords);
    };

    getLocation();
  }, []);

  useEffect(() => {
    if (location && selectedCategories.length > 0) {
      setLoading(true);
      axios
        .get("https://http://localhost:5000/api/offers", {
          params: { categories: selectedCategories, lat: location.latitude, lng: location.longitude },
        })
        .then((response) => {
          setOffers(response.data);
        })
        .catch((error) => {
          console.error("Fehler beim Abrufen der Angebote:", error);
        })
        .finally(() => setLoading(false));
    }
  }, [location, selectedCategories]);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Angebote in deiner Nähe:</Text>
      {loading ? (
        <Text>Lade Angebote...</Text>
      ) : (
        offers.map((offer) => (
          <View key={offer._id}>
            <Text>{offer.name}</Text>
            <Text>{offer.description}</Text>
            <Button title="Zum Angebot" onPress={() => {}} />
          </View>
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

export default LocationAccessScreen;
