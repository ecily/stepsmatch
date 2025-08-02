// /mobile/app/(onboarding)/LocationScreen.js

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import colors from '../../theme/colors';
import fonts from '../../theme/fonts';
import { useRouter } from 'expo-router';

export default function LocationScreen() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLocationPermission = async () => {
    setLoading(true);
    let { status } = await Location.requestForegroundPermissionsAsync();
    setLoading(false);
    if (status === 'granted') {
      router.replace('/(onboarding)/InterestsScreen');
    } else {
      alert('Um Stepsmatch optimal zu nutzen, benötigen wir deinen Standort.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headline}>Standort freigeben</Text>
      <Text style={styles.subheadline}>
        Damit wir passende Angebote in deiner Nähe finden, brauchen wir Zugriff auf deinen Standort.
      </Text>
      <TouchableOpacity
        style={styles.button}
        onPress={handleLocationPermission}
        activeOpacity={0.85}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.buttonText}>Standort erlauben</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.later}
        onPress={() => router.replace('/(onboarding)/InterestsScreen')}
        disabled={loading}
      >
        <Text style={styles.laterText}>Später entscheiden</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  headline: {
    fontFamily: fonts.bold,
    fontSize: 25,
    color: colors.primary,
    marginBottom: 18,
  },
  subheadline: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 38,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 44,
    shadowColor: colors.primary,
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 20,
  },
  buttonText: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 18,
    letterSpacing: 0.2,
  },
  later: {
    marginTop: 6,
  },
  laterText: {
    color: colors.accent,
    fontFamily: fonts.medium,
    fontSize: 16,
    textDecorationLine: 'underline',
  },
});
