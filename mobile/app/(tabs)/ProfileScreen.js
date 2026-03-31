import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../theme/ThemeProvider';
import Button from '../../components/ui/Button';
import { stopBackgroundServices, syncRemoteServiceState } from '../../components/PushInitializer';
import { isStoppedUntilRestartNow, setServiceEnabled, setStopUntilRestart } from '../../components/push/service-control';

const PRIVACY_OPTIN_KEY = 'privacy.push.optin.v1';

export default function ProfileScreen() {
  const router = useRouter();
  const t = useTheme();
  const [privacyOptIn, setPrivacyOptIn] = useState(null);
  const [hardStopped, setHardStopped] = useState(false);

  const loadPrivacy = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(PRIVACY_OPTIN_KEY);
      if (raw == null) {
        setPrivacyOptIn(null);
        return;
      }
      setPrivacyOptIn(raw === '1');
    } catch {
      setPrivacyOptIn(null);
    }
  }, []);

  useEffect(() => {
    loadPrivacy();
  }, [loadPrivacy]);

  const refreshHardStopState = useCallback(async () => {
    try {
      setHardStopped(await isStoppedUntilRestartNow());
    } catch {
      setHardStopped(false);
    }
  }, []);

  useEffect(() => {
    refreshHardStopState();
  }, [refreshHardStopState]);

  const setPrivacy = useCallback(async (next) => {
    try {
      await AsyncStorage.setItem(PRIVACY_OPTIN_KEY, next ? '1' : '0');
      setPrivacyOptIn(!!next);
    } catch {}
  }, []);

  const hardStopUntilAppRestart = useCallback(async (reason = 'manual-stop') => {
    try { await setStopUntilRestart(true); } catch {}
    try { await syncRemoteServiceState(false, reason); } catch {}
    try { await stopBackgroundServices(reason); } catch {}
    setHardStopped(true);
  }, []);

  const handleStopUntilRestart = useCallback(() => {
    Alert.alert(
      'Hintergrunddienst stoppen',
      'Der Hintergrunddienst wird jetzt beendet und bleibt aus, bis du die App neu startest.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Jetzt stoppen',
          style: 'destructive',
          onPress: async () => {
            await hardStopUntilAppRestart('profile-stop-until-restart');
          },
        },
      ]
    );
  }, [hardStopUntilAppRestart]);

  const handleLogout = async () => {
    Alert.alert('Abmelden', 'Willst du dich wirklich abmelden und lokale App-Daten loeschen?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await hardStopUntilAppRestart('logout');
            await setServiceEnabled(false, 'logout');
          } catch {}
          await AsyncStorage.clear();
          await setStopUntilRestart(true);
          router.replace('/(auth)/LoginScreen');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <Text style={[styles.headline, { color: t.colors.inkHigh }]}>Profil</Text>

        <View style={[styles.section, { backgroundColor: t.colors.card, borderColor: t.colors.divider }]}> 
          <Text style={[styles.sectionTitle, { color: t.colors.inkHigh }]}>Einstellungen</Text>
          <Button title="Interessen aendern" variant="primary" size="lg" onPress={() => router.push('/(onboarding)/InterestsScreen')} />
          <Button
            title={hardStopped ? 'Hintergrunddienst bereits gestoppt' : 'Hintergrunddienst stoppen'}
            variant="secondary"
            size="lg"
            onPress={handleStopUntilRestart}
            disabled={hardStopped}
          />
          <Text style={[styles.hint, { color: hardStopped ? t.colors.warning : t.colors.inkLow }]}>
            {hardStopped ? 'Hintergrunddienst ist bis zum naechsten App-Start deaktiviert.' : 'Stoppt Push-/Standortdienst komplett bis zum naechsten App-Start.'}
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: t.colors.card, borderColor: t.colors.divider }]}> 
          <Text style={[styles.sectionTitle, { color: t.colors.inkHigh }]}>Datenschutz & Push</Text>
          <Text style={[styles.hint, { color: t.colors.inkLow }]}>Standortdaten werden fuer Matching im Hintergrund verarbeitet. Du kannst die Push-Einwilligung jederzeit aendern.</Text>
          <Text style={[styles.state, { color: privacyOptIn === false ? t.colors.warning : t.colors.success }]}>Status: {privacyOptIn === null ? 'Noch nicht festgelegt' : (privacyOptIn ? 'Einwilligung aktiv' : 'Einwilligung pausiert')}</Text>
          <View style={styles.row}>
            <Button title="Einwilligen" variant="primary" size="sm" onPress={() => setPrivacy(true)} />
            <Button title="Ablehnen" variant="secondary" size="sm" onPress={() => setPrivacy(false)} />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: t.colors.card, borderColor: t.colors.divider }]}> 
          <Text style={[styles.sectionTitle, { color: t.colors.inkHigh }]}>Konto</Text>
          <Button title="Logout & App zuruecksetzen" variant="secondary" size="lg" onPress={handleLogout} />
          <Text style={[styles.hint, { color: t.colors.inkLow }]}>Lokale Daten werden geloescht. Push und Service kannst du danach neu aktivieren.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 8, gap: 14 },
  headline: { fontSize: 30, fontWeight: '800', marginBottom: 4 },
  section: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  hint: { fontSize: 12, lineHeight: 18 },
  state: { fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
});
