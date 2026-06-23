import React, { useState } from 'react';
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ensureBgAfterOnboarding } from '../../components/PushInitializer';
import { useTheme } from '../../theme/ThemeProvider';
import Button from '../../components/ui/Button';

export default function LocationScreen() {
  const router = useRouter();
  const t = useTheme();
  const [busy, setBusy] = useState(false);

  const continueOnboarding = async () => {
    setBusy(true);
    try {
      await ensureBgAfterOnboarding();
    } catch {}
    router.replace('/(onboarding)/InterestsScreen');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <Text style={[styles.kicker, { color: t.colors.primary }]}>Berechtigungen</Text>
        <Text style={[styles.headline, { color: t.colors.inkHigh }]}>Nahe, Zeit und Interesse muessen zusammenpassen.</Text>
        <Text style={[styles.body, { color: t.colors.ink }]}>
          Dafuer braucht StepsMatch Standort und Push. Standort sortiert lokale Hinweise nach deiner Naehe. Hintergrundstandort hilft Heartbeat und Geofence, passende Hinweise auch dann zu erkennen, wenn die App nicht offen ist.
        </Text>
        <Text style={[styles.body, { color: t.colors.inkLow }]}>
          Ohne Standort funktionieren Naehe, Karte und Route nicht zuverlaessig. Ohne Push bleiben Hinweise nur in der App. Du kannst alle Rechte spaeter in den Systemeinstellungen widerrufen.
        </Text>
        <View style={styles.footer}>
          <Button
            title={busy ? 'Wird vorbereitet ...' : 'Verstanden, weiter'}
            size="lg"
            onPress={continueOnboarding}
            disabled={busy}
          />
          {busy ? <ActivityIndicator color={t.colors.primary} style={styles.spinner} /> : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  kicker: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', marginBottom: 8 },
  headline: { fontSize: 28, lineHeight: 34, fontWeight: '900', marginBottom: 12 },
  body: { fontSize: 15, lineHeight: 22, marginBottom: 10 },
  footer: { marginTop: 18 },
  spinner: { marginTop: 12 },
});
