import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Image, ScrollView } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import colors from '../../theme/colors';

const API_URL = 'https://lobster-app-ie9a5.ondigitalocean.app/api';

function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const toRad = (x) => x * Math.PI / 180;
  const R = 6371e3;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function getTimeLeft(validTo) {
  const to = new Date(validTo);
  const now = new Date();
  let diff = to - now;
  if (diff <= 0) return 'abgelaufen';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  diff -= days * (1000 * 60 * 60 * 24);
  const hours = Math.floor(diff / (1000 * 60 * 60));
  return `Noch ${days} Tag${days !== 1 ? 'e' : ''}, ${hours} Stunde${hours !== 1 ? 'n' : ''} gültig.`;
}

function isOfferValidNow(offer) {
  const now = new Date();
  const weekdayString = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][now.getDay()];
  const hours = now.getHours();
  const minutes = now.getMinutes();

  if (offer.validDays?.length && !offer.validDays.includes(weekdayString)) return false;

  if (offer.validTimes?.start && offer.validTimes?.end) {
    const nowMinutes = hours * 60 + minutes;
    const [fromH, fromM] = offer.validTimes.start.split(':').map(Number);
    const [toH, toM] = offer.validTimes.end.split(':').map(Number);
    const fromMinutes = fromH * 60 + fromM;
    const toMinutes = toH * 60 + toM;
    if (!(nowMinutes >= fromMinutes && nowMinutes <= toMinutes)) return false;
  }

  if (offer.validDates?.from && offer.validDates?.to) {
    const nowDate = now.toISOString().slice(0, 10);
    const fromDate = offer.validDates.from.slice(0, 10);
    const toDate = offer.validDates.to.slice(0, 10);
    if (!(nowDate >= fromDate && nowDate <= toDate)) return false;
  }
  return true;
}

export default function IndexScreen() {
  const router = useRouter();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userLocation, setUserLocation] = useState(null);

  const groupOffersByCategory = (list) => {
    const map = {};
    for (const o of list) {
      const cat = o.category || 'Andere';
      if (!map[cat]) map[cat] = [];
      map[cat].push(o);
    }
    return map;
  };

  const fetchNearbyOffers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Standortberechtigung benötigt, um Angebote in deiner Nähe anzuzeigen.');
        setOffers([]);
        setLoading(false);
        return;
      }
      const location = await Location.getCurrentPositionAsync({});
      const lat = location.coords.latitude;
      const lng = location.coords.longitude;
      setUserLocation({ lat, lng });

      const interestsStr = await AsyncStorage.getItem('userInterests');
      const interests = interestsStr ? JSON.parse(interestsStr) : [];

      const res = await axios.post(`${API_URL}/offers/nearby`, { lat, lng, interests });
      const valid = (res.data || []).filter(isOfferValidNow);
      setOffers(valid);
    } catch (err) {
      setError('Fehler beim Laden der Angebote oder beim Standortzugriff.');
      setOffers([]);
      console.log('Nearby fetch error:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchNearbyOffers(); }, [fetchNearbyOffers]);

  const OfferCard = ({ item }) => {
    let distance = '?';
    if (userLocation && item.location?.coordinates?.length === 2) {
      const [offerLng, offerLat] = item.location.coordinates;
      distance = getDistanceMeters(userLocation.lat, userLocation.lng, offerLat, offerLng);
    }
    const validity = item.validDates?.to ? getTimeLeft(item.validDates.to) : '';
    let images = Array.isArray(item.images) ? [...item.images] : [];
    if (images.length < 3) images = images.concat(Array(3 - images.length).fill(null));
    else if (images.length > 3) images = images.slice(0, 3);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push({ pathname: '/(tabs)/OffersScreen', params: { id: item._id } })}
        activeOpacity={0.93}
      >
        <View style={{ marginBottom: 8 }}>
          <Text style={styles.distanceText}>Nur {distance} Meter entfernt. {validity}</Text>
        </View>
        <Text style={styles.title}>{item.name}</Text>
        <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
        <View style={styles.imagesRow}>
          {images.map((img, idx) =>
            img ? <Image key={idx} source={{ uri: img }} style={styles.offerImage} resizeMode="cover" />
                : <View key={idx} style={styles.offerImagePlaceholder} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const grouped = groupOffersByCategory(offers);

  return (
    <View style={styles.container}>
      <Text style={styles.headline}>Angebote in deiner Nähe</Text>
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 48 }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : offers.length === 0 ? (
        <Text style={styles.empty}>Zurzeit leider keine passenden Angebote in deiner Nähe!</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.categoryContainer}>
          {Object.entries(grouped).map(([category, catOffers]) => (
            <View key={category} style={styles.categoryBlock}>
              <Text style={styles.categoryTitle}>{category}</Text>
              <FlatList
                data={catOffers}
                keyExtractor={(it) => it._id}
                renderItem={OfferCard}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalList}
                style={{ marginBottom: 26 }}
              />
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const IMAGE_WIDTH = 70, IMAGE_HEIGHT = 50, IMAGE_MARGIN = 6;

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 18, backgroundColor: colors.background },
  headline: { fontSize: 24, fontWeight: 'bold', color: colors.primary, marginBottom: 8, textAlign: 'center' },
  categoryContainer: { paddingBottom: 80, paddingHorizontal: 8 },
  categoryBlock: { marginBottom: 16 },
  categoryTitle: { fontSize: 20, fontWeight: 'bold', color: colors.primary, marginBottom: 7, marginLeft: 7, marginTop: 7 },
  horizontalList: { paddingLeft: 2, paddingRight: 2, alignItems: 'flex-start' },
  card: {
    backgroundColor: '#f6f8fa', borderRadius: 16, padding: 20, marginRight: 15, width: 250,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowOffset: { width: 0, height: 2 }, shadowRadius: 5,
    minHeight: 190, justifyContent: 'flex-start',
  },
  distanceText: { fontSize: 14, color: '#2c3e50', marginBottom: 3, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: 'bold', color: colors.primary, marginBottom: 6 },
  desc: { fontSize: 15, color: '#555', marginBottom: 8 },
  imagesRow: { flexDirection: 'row', marginTop: 10, justifyContent: 'flex-start', alignItems: 'center', minHeight: IMAGE_HEIGHT },
  offerImage: { width: IMAGE_WIDTH, height: IMAGE_HEIGHT, borderRadius: 8, backgroundColor: '#eee', marginRight: IMAGE_MARGIN },
  offerImagePlaceholder: { width: IMAGE_WIDTH, height: IMAGE_HEIGHT, borderRadius: 8, backgroundColor: '#e0e0e0', marginRight: IMAGE_MARGIN, opacity: 0.35 },
  error: { color: 'red', marginTop: 30, textAlign: 'center' },
  empty: { color: '#999', marginTop: 50, textAlign: 'center', fontSize: 17 },
});
