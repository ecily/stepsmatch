// mobile/src/screens/UserRegisterScreen.js
import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert, StyleSheet } from 'react-native';
import axios from '../api/axios';

const UserRegisterScreen = ({ navigation }) => {
  const [form, setForm] = useState({ name: '', email: '', password: '' });

  const handleChange = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleRegister = async () => {
    try {
      const res = await axios.post('/users/register', form);
      const userId = res.data.user._id;
      // Speichern für spätere Auth
      Alert.alert("Erfolgreich!", "Du wurdest registriert.");
      navigation.navigate('Login');
    } catch (err) {
      console.log(err);
      Alert.alert("Fehler", err.response?.data?.error || "Registrierung fehlgeschlagen");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Registrieren</Text>
      <TextInput style={styles.input} placeholder="Name" value={form.name} onChangeText={(t) => handleChange('name', t)} />
      <TextInput style={styles.input} placeholder="E-Mail" value={form.email} onChangeText={(t) => handleChange('email', t)} />
      <TextInput style={styles.input} placeholder="Passwort" secureTextEntry value={form.password} onChangeText={(t) => handleChange('password', t)} />
      <Button title="Jetzt registrieren" onPress={handleRegister} />
      <Text style={styles.link} onPress={() => navigation.navigate('Login')}>Schon registriert? Login hier.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 24 },
  title: { fontSize: 24, marginBottom: 16, fontWeight: 'bold' },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, marginBottom: 12, borderRadius: 5 },
  link: { color: 'blue', marginTop: 16, textAlign: 'center' },
});

export default UserRegisterScreen;
