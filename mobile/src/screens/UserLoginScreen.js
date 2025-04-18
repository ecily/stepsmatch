// mobile/src/screens/UserLoginScreen.js
import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert, StyleSheet } from 'react-native';
import axios from '../api/axios';

const UserLoginScreen = ({ navigation }) => {
  const [form, setForm] = useState({ email: '', password: '' });

  const handleLogin = async () => {
    try {
      const res = await axios.post('/users/login', form);
      const userId = res.data.user._id;
      // ✅ Session speichern, ggf. AsyncStorage
      Alert.alert("Erfolg", "Du bist eingeloggt.");
      // hier später: Navigation zum Onboarding
    } catch (err) {
      console.log(err);
      Alert.alert("Fehler", err.response?.data?.error || "Login fehlgeschlagen");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>
      <TextInput style={styles.input} placeholder="E-Mail" value={form.email} onChangeText={(t) => setForm({ ...form, email: t })} />
      <TextInput style={styles.input} placeholder="Passwort" secureTextEntry value={form.password} onChangeText={(t) => setForm({ ...form, password: t })} />
      <Button title="Einloggen" onPress={handleLogin} />
      <Text style={styles.link} onPress={() => navigation.navigate('Register')}>Noch kein Account? Jetzt registrieren.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 24 },
  title: { fontSize: 24, marginBottom: 16, fontWeight: 'bold' },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, marginBottom: 12, borderRadius: 5 },
  link: { color: 'blue', marginTop: 16, textAlign: 'center' },
});

export default UserLoginScreen;
