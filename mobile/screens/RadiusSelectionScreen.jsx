import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import axios from 'axios';
import * as Location from 'expo-location';
import haversine from 'haversine-distance';
import moment from 'moment';

const radiusOptions = [
  { label: 'bis 100 m', value: 100 },
  { label: 'bis 500 m', value: 500 },
  { label: 'bis 1 km', value: 1000 },
  { label: 'bis 3 km', value: 3000 },
];

const categoryIcons = {
  herberge: '🎥️',
  supermarkt: '🛒️',
  restaurant: '🍽️',
  apotheke: '💊',
  default: '🫽',
};

const screenWidth = Dimensions.get('window').width;

export default function RadiusSelectionScreen() {
  const [selectedRadius, setSelectedRadius] = useState(null);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState(null);

  const API_URL = 'http://10.0.0.34:5000/api/offers/nearby';

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('Standortberechtigung wurde nicht erteilt');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setUserLocation({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      });
    })();
  }, []);

  const isOfferCurrentlyValid = (offer) => {
    const now = moment();
    const fromDate = moment(offer.validDates?.from);
    const toDate = moment(offer.validDates?.to);

    const [startHour, startMin] = offer.validTimes?.start?.split(':') || ["00", "00"];
    const [endHour, endMin] = offer.validTimes?.end?.split(':') || ["23", "59"];

    const validFrom = moment(fromDate).hour(startHour).minute(startMin);
    const validTo = moment(toDate).hour(endHour).minute(endMin);

    if (!now.isBetween(validFrom, validTo, null, '[]')) return false;

    const today = now.format('dddd');
    if (
      offer.validDays &&
      !offer.validDays.map((d) => d.toLowerCase()).includes(today.toLowerCase())
    ) {
      return false;
    }

    return true;
  };

  const getTimeMessage = (offer) => {
    const now = moment();
    const toDate = moment(offer.validDates?.to);
    const [endHour, endMin] = offer.validTimes?.end?.split(':') || ["23", "59"];
    const validTo = moment(toDate).hour(endHour).minute(endMin);

    const [startHour, startMin] = offer.validTimes?.start?.split(':') || ["00", "00"];
    const startToday = moment().hour(startHour).minute(startMin);

    if (isOfferCurrentlyValid(offer)) {
      const diff = moment.duration(validTo.diff(now));
      const days = Math.floor(diff.asDays());
      const hours = diff.hours();
      const minutes = diff.minutes();
      return `✅ Gültig! Noch ${days > 0 ? days + 'd ' : ''}${hours > 0 ? hours + 'h ' : ''}${minutes}min`;
    } else if (
      now.isBefore(startToday) &&
      startToday.diff(now, 'minutes') <= 60
    ) {
      const minutesLeft = startToday.diff(now, 'minutes');
      return `⏳ Gültig in ${minutesLeft}min`;
    } else {
      return null;
    }
  };

  const handleRadiusSelect = async (radius) => {
    if (!userLocation) {
      alert('Standortdaten noch nicht verfügbar');
      return;
    }

    setSelectedRadius(radius);
    setLoading(true);
    setOffers([]);

    try {
      const res = await axios.get(API_URL, {
        params: {
          lat: userLocation.lat,
          lng: userLocation.lng,
          radius: radius,
        },
      });

      const offersWithMeta = res.data
        .map((offer) => {
          const offerLocation = {
            lat: offer.location.coordinates[1],
            lng: offer.location.coordinates[0],
          };
          const distance = haversine(userLocation, offerLocation);
          const isValid = isOfferCurrentlyValid(offer);
          return {
            ...offer,
            distance: Math.round(distance),
            timeStatus: isValid ? getTimeMessage(offer) : null,
            isValid,
          };
        })
        .filter((o) => o.isValid);

      setOffers(offersWithMeta);
    } catch (err) {
      console.error('❌ Fehler beim Abrufen der Angebote:', err.message);
      setOffers([{ error: true }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Wie weit bist du bereit für ein Angebot zu gehen?</Text>

      {radiusOptions.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={[styles.option, selectedRadius === opt.value && styles.selectedOption]}
          onPress={() => handleRadiusSelect(opt.value)}
        >
          <Text style={[styles.optionText, selectedRadius === opt.value && styles.selectedOptionText]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}

      {loading && <ActivityIndicator style={{ marginTop: 16 }} size="large" color="#00796b" />}

      {!loading && selectedRadius && (
        <>
          {offers.length === 0 && (
            <Text style={styles.info}>Keine aktuell gültigen Angebote gefunden.</Text>
          )}

          {offers.length > 0 && (
            <>
              <Text style={styles.info}>Toll! Es gibt {offers.length} gültige Angebot(e):</Text>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                {offers.map((offer, index) => {
                  const icon = categoryIcons[offer.category?.toLowerCase()] || categoryIcons.default;
                  const lat = offer.location.coordinates[1];
                  const lng = offer.location.coordinates[0];

                  const [startHour, startMin] = offer.validTimes?.start?.split(':') || ["00", "00"];
                  const [endHour, endMin] = offer.validTimes?.end?.split(':') || ["23", "59"];

                  const validFrom = moment(offer.validDates?.from)
                    .hour(startHour)
                    .minute(startMin)
                    .format('DD.MM.YYYY, HH:mm');
                  const validTo = moment(offer.validDates?.to)
                    .hour(endHour)
                    .minute(endMin)
                    .format('DD.MM.YYYY, HH:mm');

                  return (
                    <View key={index} style={styles.offerCard}>
                      <Text style={styles.offerTitle}>
                        {icon} {offer.name}
                      </Text>
                      <Text style={styles.offerAddress}>
                        {offer.provider?.address || 'Keine Adresse vorhanden'}
                      </Text>
                      <Text style={styles.offerDistance}>📏 {offer.distance} m</Text>
                      <Text style={{ marginTop: 6 }}>{offer.timeStatus}</Text>
                      <Text style={{ marginTop: 4, fontSize: 12 }}>🕒 Gültig von: {validFrom}</Text>
                      <Text style={{ fontSize: 12 }}>Gültig bis: {validTo}</Text>

                      <MapView
                        style={styles.miniMap}
                        initialRegion={{
                          latitude: lat,
                          longitude: lng,
                          latitudeDelta: 0.002,
                          longitudeDelta: 0.002,
                        }}
                        scrollEnabled={false}
                        zoomEnabled={false}
                      >
                        <Marker coordinate={{ latitude: lat, longitude: lng }} />
                      </MapView>
                    </View>
                  );
                })}
              </ScrollView>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#e0f7fa',
    padding: 24,
    paddingBottom: 60,
    alignItems: 'stretch',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#00796b',
    textAlign: 'center',
  },
  option: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: '#b2dfdb',
  },
  selectedOption: {
    backgroundColor: '#00796b',
  },
  optionText: {
    fontSize: 18,
    textAlign: 'center',
    color: '#004d40',
  },
  selectedOptionText: {
    color: 'white',
  },
  info: {
    fontSize: 16,
    marginTop: 24,
    textAlign: 'center',
    color: '#00796b',
  },
  horizontalScroll: {
    marginTop: 12,
  },
  offerCard: {
    width: Dimensions.get('window').width * 0.8,
    marginRight: 16,
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 8,
    borderColor: '#ccc',
    borderWidth: 1,
  },
  offerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#004d40',
  },
  offerAddress: {
    marginTop: 4,
    color: '#333',
  },
  offerDistance: {
    marginTop: 4,
    fontSize: 14,
    color: '#555',
  },
  miniMap: {
    height: 150,
    marginTop: 10,
    borderRadius: 8,
  },
});
