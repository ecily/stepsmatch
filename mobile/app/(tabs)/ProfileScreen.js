import React from 'react';
import { View, Text, Button, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import colors from '../../theme/colors';

export default function ProfileScreen() {
  const router = useRouter();

  // Handler für Logout (alles zurücksetzen)
  const handleLogout = async () => {
    Alert.alert(
      'Abmelden',
      'Willst du dich wirklich abmelden und alle App-Daten löschen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.clear();
            router.replace('/(auth)/LoginScreen');
          },
        },
      ]
    );
  };

  // Handler für Interessen ändern
  const handleChangeInterests = () => {
    router.push('/(onboarding)/InterestsScreen');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headline}>Profil</Text>
      {/* Interessen ändern */}
      <Button
        title="Interessen ändern"
        onPress={handleChangeInterests}
        color={colors.primary}
      />
      {/* Logout */}
      <View style={{ marginTop: 20 }}>
        <Button
          title="Logout & App zurücksetzen"
          onPress={handleLogout}
          color={colors.accent || colors.primary}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 32, backgroundColor: colors.background },
  headline: { fontSize: 24, fontWeight: 'bold', color: colors.primary, marginBottom: 30, textAlign: 'center' },
});
