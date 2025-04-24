import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance from '../src/api/axios';

const LoginScreen = ({ navigation }) => {
  const [formData, setFormData] = useState({ email: '', password: '' });

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLogin = async () => {
    try {
      // ✅ KORRIGIERT: Kein doppeltes /api mehr
      const res = await axiosInstance.post('/auth/login', formData);
      const userId = res.data?.provider?._id;
      if (!userId) throw new Error('Kein Benutzer gefunden.');

      // 🟢 Speichere userId im AsyncStorage
      await AsyncStorage.setItem('userId', userId);

      navigation.navigate('LocationAccess', { userId });
    } catch (err) {
      console.error(err);
      Alert.alert('Fehler', err.response?.data?.error || 'Login fehlgeschlagen');
    }
  };

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
      <Text style={{ fontSize: 24, marginBottom: 24 }}>Login</Text>

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

      <TouchableOpacity onPress={handleLogin} style={{ backgroundColor: '#2563eb', padding: 12, borderRadius: 6 }}>
        <Text style={{ color: 'white', textAlign: 'center' }}>Einloggen</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Register')} style={{ marginTop: 20 }}>
        <Text style={{ color: '#2563eb', textAlign: 'center' }}>Kein Konto? Registrieren</Text>
      </TouchableOpacity>
    </View>
  );
};

export default LoginScreen;
