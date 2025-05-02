// LoginScreen.js

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Animated,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import axiosInstance from '../src/api/axios';

const LoginScreen = ({ navigation }) => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLogin = async () => {
    try {
      const res = await axiosInstance.post('/auth/login', formData);

      const userId = res.data?.user?._id || res.data?.provider?._id;
      const token = res.data?.token;

      if (!userId || !token) throw new Error('Fehlende Anmeldedaten');

      await SecureStore.setItemAsync('jwt', token);
      await AsyncStorage.setItem('userId', userId);

      // 🔁 Versuche auch beim Login den Push-Token zu speichern
      const pushToken = await registerForPushNotificationsAsync();
      if (pushToken) {
        try {
          const response = await axiosInstance.post(`/auth/push-token/${userId}`, {
            expoPushToken: pushToken,
          });
          console.log('✅ Push-Token gespeichert beim Login:', response.data);
        } catch (err) {
          console.error('❌ Fehler beim Speichern des Push Tokens beim Login:', err.message);
        }
      } else {
        console.warn('⚠️ Kein Push-Token beim Login verfügbar');
      }

      navigation.navigate('LocationAccess', { userId });
    } catch (err) {
      console.error(err);
      Alert.alert('Fehler', err.response?.data?.error || 'Login fehlgeschlagen');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <Animated.View style={{ flex: 1, padding: 24, justifyContent: 'center', opacity: fadeAnim }}>
        <View style={{ alignItems: 'center', marginBottom: 40 }}>
          <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#2563eb', marginBottom: 4 }}>stepsmatch</Text>
          <Text style={{ fontSize: 16, color: '#6b7280', marginBottom: 16 }}>Find. Not seek.</Text>

          <TouchableOpacity onPress={() => Linking.openURL('https://www.ecily.com')}>
            <Text style={{ fontSize: 12, color: '#9ca3af', textDecorationLine: 'underline' }}>
              ein Projekt von ecily/webdevelopment
            </Text>
          </TouchableOpacity>

          <Text style={{ fontSize: 12, color: '#d1d5db', marginTop: 4 }}>(c) 2025</Text>
        </View>

        <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 24, textAlign: 'center', color: '#111827' }}>
          Login
        </Text>

        <TextInput
          placeholder="E-Mail"
          value={formData.email}
          onChangeText={text => handleChange('email', text)}
          style={{
            borderWidth: 1,
            borderColor: '#d1d5db',
            marginBottom: 16,
            padding: 12,
            borderRadius: 8,
            backgroundColor: '#f9fafb'
          }}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          placeholder="Passwort"
          secureTextEntry
          value={formData.password}
          onChangeText={text => handleChange('password', text)}
          style={{
            borderWidth: 1,
            borderColor: '#d1d5db',
            marginBottom: 24,
            padding: 12,
            borderRadius: 8,
            backgroundColor: '#f9fafb'
          }}
        />

        <TouchableOpacity
          onPress={handleLogin}
          style={{
            backgroundColor: '#2563eb',
            paddingVertical: 14,
            borderRadius: 8,
            marginBottom: 20,
          }}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontSize: 16, fontWeight: 'bold' }}>Einloggen</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
          <Text style={{ color: '#2563eb', textAlign: 'center', fontWeight: '600' }}>
            Kein Konto? Registrieren
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

export default LoginScreen;

// 🔁 Push-Berechtigung & Token abrufen
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
