import React from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import colors from '../../theme/colors';
import Button from '../../components/ui/Button';

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
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <Text style={styles.headline} accessibilityRole="header" allowFontScaling>
          Profil
        </Text>

        {/* Aktionen */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle} allowFontScaling>Deine Einstellungen</Text>

          <Button
            title="Interessen ändern"
            variant="primary"
            size="lg"
            onPress={handleChangeInterests}
            testID="profile-edit-interests"
            accessibilityLabel="Interessen ändern"
          />
        </View>

        {/* Danger Zone */}
        <View style={[styles.section, styles.sectionDanger]}>
          <Text style={styles.sectionTitle} allowFontScaling>Abmelden</Text>

          <Button
            title="Logout & App zurücksetzen"
            variant="secondary"
            size="lg"
            onPress={handleLogout}
            testID="profile-logout"
            accessibilityLabel="Logout und App zurücksetzen"
          />
          <Text style={styles.hint} allowFontScaling>
            Dadurch werden lokale App-Daten gelöscht. Deine Push-Einstellungen kannst du später erneut aktivieren.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: colors.background,
  },
  headline: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 16,
    textAlign: 'left',
    letterSpacing: 0.2,
  },

  section: {
    backgroundColor: '#f7f8fb',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderColor: '#e7ebf2',
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionDanger: {
    backgroundColor: '#fff7f7',
    borderColor: '#ffd6d6',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
  },
  hint: {
    marginTop: 10,
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
  },
});
