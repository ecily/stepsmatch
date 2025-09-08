import React, { useEffect, useRef, useState } from 'react';
import {
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import colors from '../../theme/colors';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';

export default function LocationScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Micro-motions (beibehalten)
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

  // ⚠️ Logik unverändert lassen (nur UI verbessert)
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
        // In Einstellungen öffnen
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
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>

        {/* Headline */}
        <Animated.Text
          style={[
            styles.headline,
            { opacity: headOpacity, transform: [{ translateY: headY }] },
          ]}
          accessibilityRole="header"
          allowFontScaling
        >
          Standort freigeben
        </Animated.Text>

        {/* Subheadline */}
        <Animated.Text
          style={[
            styles.subheadline,
            { opacity: subOpacity, transform: [{ translateY: subY }] },
          ]}
          allowFontScaling
        >
          Damit wir passende Angebote in deiner Nähe finden, brauchen wir Zugriff auf deinen Standort.
        </Animated.Text>

        {/* Benefits */}
        <View style={styles.benefits} accessible accessibilityLabel="Vorteile der Standortfreigabe">
          <Benefit text="Sofort informiert bei Ankunft in der Nähe" />
          <Benefit text="Nur relevante Hinweise – keine Werbung" />
          <Benefit text="Datenschutz: Standort bleibt bei dir" />
        </View>

        {/* Primary CTA */}
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
            testID="btn-location-allow"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText} allowFontScaling>Standort erlauben</Text>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Secondary CTA */}
        <Animated.View style={{ opacity: laterOpacity, marginTop: 6 }}>
          <TouchableOpacity
            style={styles.later}
            onPress={goNext}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Später entscheiden"
            testID="btn-location-later"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.laterText} allowFontScaling>Später entscheiden</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

/** Kleine, neutrale Benefit-Zeile */
function Benefit({ text }: { text: string }) {
  return (
    <View style={benefitStyles.row} accessible accessibilityRole="text">
      <Text style={benefitStyles.bullet} accessibilityElementsHidden>{'•'}</Text>
      <Text style={benefitStyles.text} allowFontScaling>{text}</Text>
    </View>
  );
}

const R = { s2: 8, s3: 12, s4: 16, s5: 20, s6: 24, s7: 32 };

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24, // Safe-Area freundlich – kein Randkontakt
    paddingTop: R.s6,
    paddingBottom: R.s6,
    backgroundColor: colors.background,
  },
  headline: {
    fontWeight: 'bold',
    fontSize: 26,
    color: colors.primary, // Brand-Blau
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  subheadline: {
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 24,
  },
  benefits: {
    width: '100%',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border || '#e5e9ef',
    backgroundColor: (colors.elevated || '#f7f8fb'),
    borderRadius: 14,
    paddingVertical: R.s4,
    paddingHorizontal: R.s4,
    marginBottom: R.s6,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    minHeight: 48, // Tap-Target
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
    marginBottom: R.s3,
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
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  laterText: {
    color: colors.accent,
    fontWeight: '500',
    fontSize: 16,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
});

const benefitStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: R.s3,
  },
  bullet: {
    fontSize: 18,
    lineHeight: 22,
    color: colors.primary,
    marginRight: R.s3,
  },
  text: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
});
