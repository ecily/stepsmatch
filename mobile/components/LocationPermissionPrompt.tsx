import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Platform, Linking } from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Props = {
  /** Cooldown in ms, wie lange wir nach "Später" nicht erneut nerven. */
  remindAfterMs?: number;
  /** Wird aufgerufen, sobald BG-Location effektiv verfügbar ist. */
  onGranted?: () => void;
};

const COOLDOWN_KEY = 'perm.location.nudge.cooldownUntil';

export default function LocationPermissionPrompt({ remindAfterMs = 6 * 60 * 60 * 1000, onGranted }: Props) {
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<'explain' | 'settings'>('explain'); // Schritt 1 / Schritt 2
  const needsBgForPlatform = Platform.OS === 'android'; // iOS läuft auch "when in use", aber "always" ist besser

  async function hasEffectivePermission() {
    // FG muss granted sein
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== 'granted') return false;

    // Android: BG ist Pflicht für Geofencing & BG-Updates
    if (needsBgForPlatform) {
      const bg = await Location.getBackgroundPermissionsAsync();
      return bg.status === 'granted';
    }

    // iOS: wir akzeptieren auch whenInUse, true zurück
    return true;
  }

  async function checkAndMaybeShow() {
    try {
      if (await hasEffectivePermission()) {
        setVisible(false);
        onGranted?.();
        return;
      }
      const cooldownUntil = Number(await AsyncStorage.getItem(COOLDOWN_KEY) || 0);
      if (!cooldownUntil || Date.now() >= cooldownUntil) {
        setPhase('explain');
        setVisible(true);
      }
    } catch {
      // im Zweifel zeigen wir an
      setPhase('explain');
      setVisible(true);
    }
  }

  useEffect(() => {
    checkAndMaybeShow();
  }, []);

  async function handleAskNow() {
    try {
      // 1) FG
      let fg = await Location.getForegroundPermissionsAsync();
      if (fg.status !== 'granted') {
        fg = await Location.requestForegroundPermissionsAsync();
      }
      if (fg.status !== 'granted') return; // User hat abgelehnt → im Modal bleiben

      // 2) BG
      let bg = await Location.getBackgroundPermissionsAsync();
      if (bg.status !== 'granted') {
        bg = await Location.requestBackgroundPermissionsAsync();
      }

      // Erfolg?
      if (await hasEffectivePermission()) {
        setVisible(false);
        onGranted?.();
        return;
      }

      // Android 11+: oft nur via Einstellungen
      if (Platform.OS === 'android') {
        setPhase('settings');
      }
    } catch {
      // bleib im Modal
    }
  }

  async function handleOpenSettings() {
    try {
      await Linking.openSettings();
    } catch {}
  }

  async function handleIAllowed() {
    // Nach Rückkehr aus Einstellungen nochmal prüfen
    if (await hasEffectivePermission()) {
      setVisible(false);
      onGranted?.();
    }
  }

  async function handleLater() {
    try {
      await AsyncStorage.setItem(COOLDOWN_KEY, String(Date.now() + remindAfterMs));
    } catch {}
    setVisible(false);
  }

  const copy = useMemo(() => {
    if (phase === 'settings') {
      return {
        title: 'Hintergrund-Standort aktivieren',
        body:
          'Damit Angebote automatisch ausgelöst werden, bitte in den App-Einstellungen unter\n\n' +
          'Einstellungen → Apps → StepsMatch → Standort\n\n' +
          ' „Immer zulassen“ wählen.',
        primary: 'Einstellungen öffnen',
        secondary: 'Ich habe es erlaubt',
        tertiary: 'Später',
      };
    }
    // explain
    return {
      title: 'Warum Standort erlauben?',
      body:
        '• Damit wir dir genau dann Angebote zeigen, wenn du in der Nähe bist.\n' +
        '• Dafür läuft eine Hintergrund-Aktualisierung des Standorts.\n' +
        '• Ohne „Immer erlauben“ sind automatische Standort-Hinweise nicht möglich.\n\n' +
        'Du kannst das jederzeit in den App-Einstellungen ändern.',
      primary: 'Jetzt erlauben',
      secondary: needsBgForPlatform ? undefined : 'Später',
      tertiary: needsBgForPlatform ? 'Später' : undefined,
    };
  }, [phase, needsBgForPlatform]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.body}>{copy.body}</Text>

          <View style={styles.actions}>
            {phase === 'settings' ? (
              <>
                <Pressable onPress={handleOpenSettings} style={[styles.btn, styles.primary]}>
                  <Text style={styles.primaryText}>{copy.primary}</Text>
                </Pressable>
                <Pressable onPress={handleIAllowed} style={[styles.btn, styles.secondary]}>
                  <Text style={styles.secondaryText}>{copy.secondary}</Text>
                </Pressable>
                <Pressable onPress={handleLater} style={[styles.btn, styles.tertiary]}>
                  <Text style={styles.tertiaryText}>{copy.tertiary}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable onPress={handleAskNow} style={[styles.btn, styles.primary]}>
                  <Text style={styles.primaryText}>{copy.primary}</Text>
                </Pressable>
                <Pressable onPress={handleLater} style={[styles.btn, styles.tertiary]}>
                  <Text style={styles.tertiaryText}>{copy.tertiary ?? 'Später'}</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 18,
    backgroundColor: '#fff',
    padding: 18,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    color: '#222',
    marginBottom: 14,
  },
  actions: { gap: 10 },
  btn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: '#0d4ea6' },
  primaryText: { color: '#fff', fontWeight: '700' },
  secondary: { backgroundColor: '#e9effa' },
  secondaryText: { color: '#0d4ea6', fontWeight: '700' },
  tertiary: { backgroundColor: '#f3f4f6' },
  tertiaryText: { color: '#111827', fontWeight: '600' },
});
