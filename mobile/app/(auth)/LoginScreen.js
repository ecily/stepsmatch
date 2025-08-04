import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, InteractionManager } from 'react-native';
import { useRouter } from 'expo-router';
import colors from '../../theme/colors';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ✅ KORREKTE URL für dein Backend!
const API_URL = 'https://lobster-app-ie9a5.ondigitalocean.app/api';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      // ✅ KORREKTE ROUTE!
      const res = await axios.post(`${API_URL}/users/login`, { email, password });
      await AsyncStorage.setItem('token', res.data.token);
      await AsyncStorage.setItem('userId', res.data.user._id);
      if (res.data.user.interests) {
        await AsyncStorage.setItem('userInterests', JSON.stringify(res.data.user.interests));
      }
      // 👉 Saubere Weiterleitung nach Login!
      InteractionManager.runAfterInteractions(() => {
        router.replace('/(tabs)');

      });
    } catch (err) {
      setError(err?.response?.data?.message || 'Login fehlgeschlagen. Bitte prüfe deine Daten.');
      console.log('Login error:', err?.response?.data);
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headline}>Login</Text>
      <TextInput
        placeholder="E-Mail"
        style={styles.input}
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
      />
      <TextInput
        placeholder="Passwort"
        style={styles.input}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Anmelden</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push('/(auth)/RegisterScreen')}>
        <Text style={styles.link}>Noch kein Konto? Jetzt registrieren</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 32, backgroundColor: colors.background },
  headline: { fontSize: 24, fontWeight: 'bold', color: colors.primary, marginBottom: 20, textAlign: 'center' },
  input: { backgroundColor: '#f5f5f5', borderRadius: 10, padding: 16, marginBottom: 16, fontSize: 16 },
  button: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 17 },
  error: { color: 'red', marginBottom: 12, textAlign: 'center' },
  link: { color: colors.accent || colors.primary, marginTop: 24, textAlign: 'center', textDecorationLine: 'underline' },
});
