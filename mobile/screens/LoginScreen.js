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
import axiosInstance from '../src/api/axios';
import { registerForPushNotificationsAsync } from '../App'; // ✅ zentrale Funktion importiert

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
      console.log('🟦 [Login] Start – E-Mail:', formData.email);

      // 🔧 Route korrigiert von /auth/login auf /users/login
      const res = await axiosInstance.post('/users/login', formData);
      const userId = res.data?.user?._id || res.data?.provider?._id;
      const token = res.data?.token;

      console.log('🟩 [Login] Erfolgreich. User ID:', userId);
      console.log('🔐 [Login] JWT vorhanden:', !!token);

      if (!userId || !token) throw new Error('Fehlende Anmeldedaten');

      await SecureStore.setItemAsync('jwt', token);
      await AsyncStorage.setItem('userId', userId);

      // 🔁 Push-Token holen
      const pushToken = await registerForPushNotificationsAsync();
      console.log('📲 [Login] Expo Push-Token erhalten:', pushToken);

      if (pushToken) {
        try {
          const response = await axiosInstance.post(`/users/push-token/${userId}`, {
            expoPushToken: pushToken,
          });
          console.log('✅ [Login] Push-Token gespeichert:', response.data);
        } catch (err) {
          console.error('❌ [Login] Fehler beim Speichern des Push-Tokens');
          console.error('→ Message:', err.message);
          if (err.response?.data) {
            console.error('→ Serverantwort:', err.response.data);
          }
        }
      } else {
        console.warn('⚠️ [Login] Kein Push-Token verfügbar');
      }

      navigation.navigate('LocationAccess', { userId });
    } catch (err) {
      console.error('❌ [Login] Fehler:', err.message);
      if (err.response?.data) {
        console.error('→ Serverantwort:', err.response.data);
      }
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
