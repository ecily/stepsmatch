// RegisterScreen.js

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import axiosInstance from '../src/api/axios';

const RegisterScreen = ({ navigation }) => {
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRegister = async () => {
    try {
      const res = await axiosInstance.post('/auth/register', formData);

      const userId = res.data?.user?._id;
      const token = res.data?.token;

      if (!userId || !token) throw new Error('Fehlende Antwortdaten');

      await SecureStore.setItemAsync('jwt', token);
      await AsyncStorage.setItem('userId', userId);

      console.log('🟢 Registrierung erfolgreich:', userId);

      // 🟢 Versuche Push-Token zu registrieren
      const pushToken = await registerForPushNotificationsAsync();
      if (pushToken) {
        try {
          const response = await axiosInstance.post(`/auth/push-token/${userId}`, {
            expoPushToken: pushToken,
          });
          console.log('✅ Push-Token gespeichert:', response.data);
        } catch (err) {
          console.error('❌ Fehler beim Speichern des Push Tokens:', err.message);
        }
      } else {
        console.warn('⚠️ Kein Push-Token verfügbar');
      }

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
        keyboardType="email-address"
        autoCapitalize="none"
        style={{ borderWidth: 1, marginBottom: 16, padding: 8 }}
      />

      <TextInput
        placeholder="Passwort"
        secureTextEntry
        value={formData.password}
        onChangeText={text => handleChange('password', text)}
        style={{ borderWidth: 1, marginBottom: 16, padding: 8 }}
      />

      <TouchableOpacity
        onPress={handleRegister}
        style={{ backgroundColor: '#2563eb', padding: 12, borderRadius: 6 }}
      >
        <Text style={{ color: 'white', textAlign: 'center' }}>Registrieren</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Login')} style={{ marginTop: 20 }}>
        <Text style={{ color: '#2563eb', textAlign: 'center' }}>Bereits ein Konto? Jetzt einloggen</Text>
      </TouchableOpacity>
    </View>
  );
};

export default RegisterScreen;

// ⏬ Push-Berechtigung & Token abrufen
async function registerForPushNotificationsAsync() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('⚠️ Push notification permission not granted');
    return null;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: Constants?.expoConfig?.extra?.eas?.projectId || 'de0e17e7-05bf-4a73-a61b-1edd912bd925',
    });
    return tokenData.data;
  } catch (error) {
    console.error('❌ Fehler beim Abrufen des Push Tokens:', error);
    return null;
  }
}
