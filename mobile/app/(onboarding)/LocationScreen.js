import React, { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Animated, Easing } from 'react-native';
import * as Location from 'expo-location';
import colors from '../../theme/colors';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';

export default function LocationScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Micro-motions
  const headY = useRef(new Animated.Value(12)).current;
  const headOpacity = useRef(new Animated.Value(0)).current;
  const subY = useRef(new Animated.Value(12)).current;
  const subOpacity = useRef(new Animated.Value(0)).current;
  const btnY = useRef(new Animated.Value(16)).current;
  const btnOpacity = useRef(new Animated.Value(0)).current;
  const laterOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(90, [
      Animated.parallel([
        Animated.timing(headOpacity, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(headY, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(subOpacity, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(subY, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(btnOpacity, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(btnY, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.timing(laterOpacity, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [headY, headOpacity, subY, subOpacity, btnY, btnOpacity, laterOpacity]);

  const goNext = () => router.replace('/(onboarding)/InterestsScreen');

  const handleLocationPermission = async () => {
    if (loading) return;
    setLoading(true);

    try {
      // 1) Prüfen, ob bereits gewährt
      const current = await Location.getForegroundPermissionsAsync();
      if (current.status === 'granted') {
        await Haptics.selectionAsync().catch(() => {});
        setLoading(false);
        return goNext();
      }

      // 2) Wenn nicht gewährt: nachfragen
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();

      if (status === 'granted') {
        await Haptics.selectionAsync().catch(() => {});
        setLoading(false);
        return goNext();
      }

      // 3) Abgelehnt
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      setLoading(false);

      if (!canAskAgain) {
        // User hat "Nicht erneut fragen" o.ä. gesetzt → in Einstellungen öffnen
        Alert.alert(
          'Standort deaktiviert',
          'Bitte erlaube den Standortzugriff in den Systemeinstellungen, damit StepsMatch in deiner Nähe passende Angebote finden kann.',
          [
            { text: 'Abbrechen', style: 'cancel' },
            { text: 'Einstellungen öffnen', onPress: () => Linking.openSettings() },
          ],
        );
      } else {
        Alert.alert(
          'Standort benötigt',
          'Ohne Standort können wir dir keine Angebote in deiner Nähe anzeigen. Du kannst das später jederzeit in den Einstellungen aktivieren.',
          [{ text: 'OK' }],
        );
      }
    } catch (e) {
      setLoading(false);
      Alert.alert('Unerwarteter Fehler', 'Bitte versuche es in wenigen Sekunden erneut.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Animated.Text
        style={[
          styles.headline,
          { opacity: headOpacity, transform: [{ translateY: headY }] },
        ]}
      >
        Standort freigeben
      </Animated.Text>

      <Animated.Text
        style={[
          styles.subheadline,
          { opacity: subOpacity, transform: [{ translateY: subY }] },
        ]}
      >
        Damit wir passende Angebote in deiner Nähe finden, brauchen wir Zugriff auf deinen Standort.
      </Animated.Text>

      <Animated.View
        style={{ width: '100%', opacity: btnOpacity, transform: [{ translateY: btnY }] }}
      >
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLocationPermission}
          activeOpacity={0.9}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Standort erlauben"
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>Standort erlauben</Text>
          )}
        </TouchableOpacity>
      </Animated.View>

      <Animated.View style={{ opacity: laterOpacity, marginTop: 6 }}>
        <TouchableOpacity
          style={styles.later}
          onPress={goNext}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Später entscheiden"
        >
          <Text style={styles.laterText}>Später entscheiden</Text>
        </TouchableOpacity>
      </Animated.View>
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
    fontSize: 26,
    color: colors.primary,
    marginBottom: 18,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  subheadline: {
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 38,
    lineHeight: 24,
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
    alignSelf: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 18,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  later: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  laterText: {
    color: colors.accent,
    fontWeight: '500',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
});
