import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import colors from '../../theme/colors';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const router = useRouter();

  const handleReset = async () => {
    try {
      await AsyncStorage.clear(); // Alle gespeicherten Daten löschen
      router.replace('/(auth)/LoginScreen'); // Direkt zum Login navigieren (korrekter, absoluter Pfad)
    } catch (e) {
      console.error('Fehler beim Logout:', e);
      // Optional: Fehlerbehandlung/UI-Feedback
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.headline}>Profil</Text>
      <Text style={styles.subheadline}>
        Hier kannst du deine persönlichen Einstellungen anpassen.
      </Text>
      <Button
        title="Logout & App zurücksetzen"
        onPress={handleReset}
        color={colors.primary}
      />
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
  },
  headline: {
    fontWeight: 'bold',
    fontSize: 23,
    color: colors.primary,
    marginBottom: 14,
  },
  subheadline: {
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 24,
  },
});
