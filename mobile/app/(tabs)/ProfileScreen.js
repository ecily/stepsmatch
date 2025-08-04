import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import colors from '../../theme/colors';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const router = useRouter();

  const handleReset = async () => {
    await AsyncStorage.removeItem('userInterests');
    router.replace('/(onboarding)/WelcomeScreen');
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.headline}>Profil</Text>
      <Text style={styles.subheadline}>
        Hier kannst du deine persönlichen Einstellungen anpassen.
      </Text>
      <Button
        title="Interessen & Onboarding zurücksetzen"
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
