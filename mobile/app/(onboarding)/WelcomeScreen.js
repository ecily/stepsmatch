import React from 'react';
import { Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import colors from '../../theme/colors';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={[styles.container, { paddingBottom: insets.bottom || 24 }]}>
      <Image
        source={require('../../assets/logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.headline}>finden. nicht suchen.</Text>
      <Text style={styles.subheadline}>
        Willkommen bei Stepsmatch! Finde Angebote in deiner Nähe, die wirklich zu dir passen.
      </Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => router.replace('/(onboarding)/LocationScreen')}
        activeOpacity={0.85}
      >
        <Text style={styles.buttonText}>Jetzt starten</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    // KEIN HARDCODED paddingBottom!
  },
  logo: {
    width: 110,
    height: 110,
    marginBottom: 36,
  },
  headline: {
    fontWeight: 'bold',
    fontSize: 30,
    color: colors.primary,
    marginBottom: 18,
    letterSpacing: 0.5,
  },
  subheadline: {
    fontSize: 17,
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
  },
  buttonText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 18,
    letterSpacing: 0.2,
  },
});
