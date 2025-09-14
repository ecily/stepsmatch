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
  Platform,
} from 'react-native';
import * as Location from 'expo-location';
import colors from '../../theme/colors';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import * as IntentLauncher from 'expo-intent-launcher';
import Constants from 'expo-constants';

/* ────────────────────────────────────────────────────────────
   Android Settings: Deep-Links
   ──────────────────────────────────────────────────────────── */
const ANDROID_PKG =
  (Constants?.expoConfig?.android?.package) ||
  (Constants?.manifest?.android?.package) ||
  'com.ecily.mobile';

async function openAppDetailsSettings() {
  if (Platform.OS !== 'android') return;
  try {
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
      { data: `package:${ANDROID_PKG}` }
    );
  } catch {
    await Linking.openSettings();
  }
}

async function openNotificationSettings() {
  if (Platform.OS !== 'android') return;
  try {
    // funktioniert ab Android 5+
    await IntentLauncher.startActivityAsync('android.settings.APP_NOTIFICATION_SETTINGS', {
      extra: { app_package: ANDROID_PKG },
    });
  } catch {
    await openAppDetailsSettings();
  }
}

async function openBatteryOptimizationList() {
  if (Platform.OS !== 'android') return;
  try {
    await IntentLauncher.startActivityAsync('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS');
  } catch {
    await openAppDetailsSettings();
  }
}

// Direkter Dialog: "Von Akku-Optimierung ausnehmen" für diese App
async function requestIgnoreBatteryOptimizations() {
  if (Platform.OS !== 'android') return;
  try {
    await IntentLauncher.startActivityAsync('android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS', {
      data: `package:${ANDROID_PKG}`,
    });
  } catch {
    await openBatteryOptimizationList();
  }
}

async function openLocationPermissionSettings() {
  if (Platform.OS !== 'android') return;
  try {
    await IntentLauncher.startActivityAsync('android.settings.APPLICATION_DETAILS_SETTINGS', {
      data: `package:${ANDROID_PKG}`,
    });
  } catch {
    await openAppDetailsSettings();
  }
}

export default function LocationScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fgStatus, setFgStatus] = useState('undetermined'); // 'granted' | 'denied' | 'undetermined'
  const [bgStatus, setBgStatus] = useState('undetermined'); // 'granted' | 'denied' | 'undetermined'

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

  useEffect(() => {
    (async () => {
      const f = await Location.getForegroundPermissionsAsync();
      setFgStatus(f.status);
      const b = await Location.getBackgroundPermissionsAsync();
      setBgStatus(b.status);
    })();
  }, []);

  const goNext = () => router.replace('/(onboarding)/InterestsScreen');

  // Vordergrund
  const handleLocationPermission = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const current = await Location.getForegroundPermissionsAsync();
      if (current.status === 'granted') {
        await Haptics.selectionAsync().catch(() => {});
        setLoading(false);
        return goNext();
      }

      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();

      if (status === 'granted') {
        setFgStatus('granted');
        await Haptics.selectionAsync().catch(() => {});
        setLoading(false);
        return goNext();
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      setLoading(false);

      if (!canAskAgain) {
        Alert.alert(
          'Standort deaktiviert',
          'Bitte erlaube den Standortzugriff in den Systemeinstellungen, damit StepsMatch in deiner Nähe passende Angebote finden kann.',
          [
            { text: 'Abbrechen', style: 'cancel' },
            { text: 'Einstellungen öffnen', onPress: () => openLocationPermissionSettings() },
          ],
        );
      } else {
        Alert.alert(
          'Standort benötigt',
          'Ohne Standort können wir dir keine Angebote in deiner Nähe anzeigen. Du kannst das später jederzeit in den Einstellungen aktivieren.',
          [{ text: 'OK' }],
        );
      }
    } catch {
      setLoading(false);
      Alert.alert('Unerwarteter Fehler', 'Bitte versuche es in wenigen Sekunden erneut.');
    }
  };

  // Hintergrund („Immer zulassen“)
  const handleBackgroundLocation = async () => {
    try {
      const res = await Location.requestBackgroundPermissionsAsync();
      setBgStatus(res.status);
      if (res.status !== 'granted') {
        Alert.alert(
          'Hintergrund-Standort',
          'Bitte stelle in den App-Einstellungen auf „Immer zulassen“, damit Pushes im Hintergrund zuverlässig kommen.',
          [
            { text: 'Abbrechen', style: 'cancel' },
            { text: 'Einstellungen öffnen', onPress: () => openLocationPermissionSettings() },
          ],
        );
      } else {
        await Haptics.selectionAsync().catch(() => {});
      }
    } catch {}
  };

  const handleBatteryOptOut = async () => {
    try {
      await requestIgnoreBatteryOptimizations();
      await Haptics.selectionAsync().catch(() => {});
    } catch {}
  };

  const handleOpenNotifSettings = async () => {
    await openNotificationSettings();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>

        {/* Headline */}
        <Animated.Text
          style={[styles.headline, { opacity: headOpacity, transform: [{ translateY: headY }] }]}
          accessibilityRole="header"
          allowFontScaling
        >
          Standort freigeben
        </Animated.Text>

        {/* Subheadline */}
        <Animated.Text
          style={[styles.subheadline, { opacity: subOpacity, transform: [{ translateY: subY }] }]}
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

        {/* Status */}
        {Platform.OS === 'android' ? (
          <View style={styles.statusRow}>
            <Text style={styles.statusText}>Vordergrund: {fgStatus}</Text>
            <Text style={styles.statusText}>Hintergrund: {bgStatus}</Text>
          </View>
        ) : null}

        {/* Primary CTA */}
        <Animated.View style={{ width: '100%', opacity: btnOpacity, transform: [{ translateY: btnY }] }}>
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
              <Text style={styles.buttonText} allowFontScaling>Vordergrund-Standort erlauben</Text>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Android: Background & Battery */}
        {Platform.OS === 'android' ? (
          <View style={{ width: '100%' }}>
            <TouchableOpacity
              style={[styles.buttonSecondary]}
              onPress={handleBackgroundLocation}
              activeOpacity={0.9}
              accessibilityRole="button"
            >
              <Text style={styles.buttonSecondaryText} allowFontScaling>Hintergrund-Standort („Immer zulassen“)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.buttonSecondary]}
              onPress={handleBatteryOptOut}
              activeOpacity={0.9}
              accessibilityRole="button"
            >
              <Text style={styles.buttonSecondaryText} allowFontScaling>Akku-Optimierung für StepsMatch ausschalten</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.buttonSecondary]}
              onPress={handleOpenNotifSettings}
              activeOpacity={0.9}
              accessibilityRole="button"
            >
              <Text style={styles.buttonSecondaryText} allowFontScaling>Benachrichtigungs-Einstellungen öffnen</Text>
            </TouchableOpacity>
          </View>
        ) : null}

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
function Benefit({ text }) {
  return (
    <View style={benefitStyles.row} accessible accessibilityRole="text">
      <Text style={benefitStyles.bullet} accessibilityElementsHidden>{'•'}</Text>
      <Text style={benefitStyles.text} allowFontScaling>{text}</Text>
    </View>
  );
}

const R = { s2: 8, s3: 12, s4: 16, s5: 20, s6: 24, s7: 32 };

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 24, paddingTop: R.s6, paddingBottom: R.s6, backgroundColor: colors.background,
  },
  headline: {
    fontWeight: 'bold', fontSize: 26, color: colors.primary, marginBottom: 12, textAlign: 'center', letterSpacing: 0.3,
  },
  subheadline: {
    fontSize: 16, color: colors.text, textAlign: 'center', marginBottom: 18, lineHeight: 24,
  },
  benefits: {
    width: '100%', borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border || '#e5e9ef', backgroundColor: (colors.elevated || '#f7f8fb'),
    borderRadius: 14, paddingVertical: R.s4, paddingHorizontal: R.s4, marginBottom: R.s6,
  },
  statusRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  statusText: { color: colors.text, fontSize: 13 },
  button: {
    backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24,
    minHeight: 48, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primary, shadowOpacity: 0.12, shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10, elevation: 3, marginBottom: R.s3,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: colors.white, fontWeight: 'bold', fontSize: 18, letterSpacing: 0.2, textAlign: 'center' },
  buttonSecondary: {
    backgroundColor: '#0b3b6810', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16,
    alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', marginBottom: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: '#cfe2ff',
  },
  buttonSecondaryText: { color: colors.primary, fontWeight: '600', fontSize: 15, textAlign: 'center' },
  later: { paddingVertical: 8, paddingHorizontal: 8 },
  laterText: { color: colors.accent, fontWeight: '500', fontSize: 16, textDecorationLine: 'underline', textAlign: 'center' },
});

const benefitStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: R.s3 },
  bullet: { fontSize: 18, lineHeight: 22, color: colors.primary, marginRight: R.s3 },
  text: { flex: 1, fontSize: 15, lineHeight: 22, color: colors.text },
});
