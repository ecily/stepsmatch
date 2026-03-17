import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import Button from '../../components/ui/Button';

const API_URL = 'https://lobster-app-ie9a5.ondigitalocean.app/api';

export default function RegisterScreen() {
  const router = useRouter();
  const t = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    setError('');
    if (!name || !email || !password || !password2) {
      setError('Bitte alle Felder ausfuellen.');
      return;
    }
    if (password !== password2) {
      setError('Die Passwoerter stimmen nicht ueberein.');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/users/register`, { name, email, password });
      const interests = Array.isArray(res?.data?.user?.interests) ? res.data.user.interests : [];
      await AsyncStorage.setItem('token', res.data.token);
      await AsyncStorage.setItem('userId', res.data.user._id);
      await AsyncStorage.setItem('userInterests', JSON.stringify(interests));
      await AsyncStorage.setItem('userInterests.csv', interests.map((s) => String(s || '').trim()).filter(Boolean).join(','));
      router.replace('/(onboarding)/WelcomeScreen');
    } catch (err) {
      setError(err?.response?.data?.message || 'Registrierung fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.wrap}>
        <Text style={[styles.title, { color: t.colors.inkHigh }]}>Konto erstellen</Text>
        <Text style={[styles.subtitle, { color: t.colors.inkLow }]}>In weniger als einer Minute startklar.</Text>

        <View style={[styles.card, { backgroundColor: t.colors.card, borderColor: t.colors.divider }]}> 
          <TextInput placeholder="Name" placeholderTextColor={t.colors.inkLow} style={[styles.input, { backgroundColor: t.colors.surface, borderColor: t.colors.divider, color: t.colors.inkHigh }]} value={name} onChangeText={setName} />
          <TextInput placeholder="E-Mail" placeholderTextColor={t.colors.inkLow} style={[styles.input, { backgroundColor: t.colors.surface, borderColor: t.colors.divider, color: t.colors.inkHigh }]} autoCapitalize="none" value={email} onChangeText={setEmail} keyboardType="email-address" />
          <TextInput placeholder="Passwort" placeholderTextColor={t.colors.inkLow} style={[styles.input, { backgroundColor: t.colors.surface, borderColor: t.colors.divider, color: t.colors.inkHigh }]} secureTextEntry value={password} onChangeText={setPassword} />
          <TextInput placeholder="Passwort wiederholen" placeholderTextColor={t.colors.inkLow} style={[styles.input, { backgroundColor: t.colors.surface, borderColor: t.colors.divider, color: t.colors.inkHigh }]} secureTextEntry value={password2} onChangeText={setPassword2} />

          {error ? <Text style={[styles.error, { color: t.colors.danger }]}>{error}</Text> : null}

          {loading ? <ActivityIndicator color={t.colors.primary} /> : <Button title="Registrieren" variant="primary" size="lg" onPress={handleRegister} />}

          <TouchableOpacity onPress={() => router.replace('/(auth)/LoginScreen')}>
            <Text style={[styles.link, { color: t.colors.primary }]}>Bereits ein Konto? Jetzt anmelden</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  wrap: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 30, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 15, lineHeight: 21, marginBottom: 20 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
  },
  error: { fontSize: 13 },
  link: { marginTop: 8, textAlign: 'center', fontWeight: '600' },
});
