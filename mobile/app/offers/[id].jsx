import React, { useEffect, useState } from 'react';
import { useLocalSearchParams, Stack } from 'expo-router';
import { View, Text, ActivityIndicator, Image, ScrollView, StyleSheet, TouchableOpacity, Linking } from 'react-native';

const API_BASE = 'https://lobster-app-ie9a5.ondigitalocean.app';

export default function OfferDetailsScreen() {
  const { id } = useLocalSearchParams();
  const [offer, setOffer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/api/offers/${id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (isMounted) setOffer(json);
      } catch (e) {
        if (isMounted) setErr(e.message || String(e));
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    if (id) load();
    return () => { isMounted = false; };
  }, [id]);

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: offer?.name || 'Angebot' }} />
      <ScrollView contentContainerStyle={styles.container}>
        {loading && <ActivityIndicator size="large" />}
        {err && <Text style={styles.error}>Fehler beim Laden: {err}</Text>}
        {!loading && !offer && !err && <Text>Kein Angebot gefunden.</Text>}

        {offer && (
          <View style={{ gap: 12 }}>
            <Text style={styles.title}>{offer.name}</Text>
            {Array.isArray(offer.images) && offer.images.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }}>
                {offer.images.map((img, idx) => (
                  <Image
                    key={idx}
                    source={{ uri: img?.url || img }}
                    style={styles.image}
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>
            )}
            {offer.description ? <Text style={styles.desc}>{offer.description}</Text> : null}

            {/* optional: Link zur externen Karte */}
            {offer.location?.coordinates && (
              <TouchableOpacity
                onPress={() => {
                  const [lng, lat] = offer.location.coordinates;
                  const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
                  Linking.openURL(url);
                }}
                style={styles.button}
              >
                <Text style={styles.buttonText}>In Google Maps öffnen</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 22, fontWeight: '700' },
  desc: { fontSize: 16, lineHeight: 22, opacity: 0.85 },
  image: { width: 220, height: 150, borderRadius: 12, marginRight: 10 },
  error: { color: 'red' },
  button: { backgroundColor: '#0A84FF', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, alignSelf: 'flex-start' },
  buttonText: { color: 'white', fontWeight: '700' }
});
