import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance from '../src/api/axios';

const RegisterScreen = ({ navigation }) => {
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRegister = async () => {
    try {
      // ✅ KORRIGIERT: Kein doppeltes /api
      const res = await axiosInstance.post('/auth/register', formData);
      const userId = res.data?.provider?._id;
      if (!userId) throw new Error('Registrierung fehlgeschlagen');

      // 🟢 Speichere userId im AsyncStorage
      await AsyncStorage.setItem('userId', userId);

      Alert.alert('Willkommen!', 'Registrierung erfolgreich.');
      navigation.navigate('LocationAccess', { userId });
    } catch (err) {
      console.error(err);
      Alert.alert('Fehler', err.response?.data?.error || 'Registrierung fehlgeschlagen');
    }
  };

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
      <Text style={{ fontSize: 24, marginBottom: 24 }}>Registrieren</Text>

      <TextInput
        placeholder="Name"
        value={formData.name}
        onChangeText={text => handleChange('name', text)}
        style={{ borderWidth: 1, marginBottom: 16, padding: 8 }}
      />

      <TextInput
        placeholder="E-Mail"
        value={formData.email}
        onChangeText={text => handleChange('email', text)}
        style={{ borderWidth: 1, marginBottom: 16, padding: 8 }}
      />

      <TextInput
        placeholder="Passwort"
        secureTextEntry
        value={formData.password}
        onChangeText={text => handleChange('password', text)}
        style={{ borderWidth: 1, marginBottom: 16, padding: 8 }}
      />

      <TouchableOpacity onPress={handleRegister} style={{ backgroundColor: '#2563eb', padding: 12, borderRadius: 6 }}>
        <Text style={{ color: 'white', textAlign: 'center' }}>Registrieren</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Login')} style={{ marginTop: 20 }}>
        <Text style={{ color: '#2563eb', textAlign: 'center' }}>Bereits ein Konto? Jetzt einloggen</Text>
      </TouchableOpacity>
    </View>
  );
};

export default RegisterScreen;
