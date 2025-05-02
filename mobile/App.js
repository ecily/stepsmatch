import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

import 'react-native-gesture-handler';
import axios from './src/api/axios';

import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import LocationAccessScreen from './screens/LocationAccessScreen';
import InterestSelectionScreen from './screens/InterestSelectionScreen';
import HomeScreen from './screens/HomeScreen';
import OfferDetailsScreen from './screens/OfferDetailsScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [expoPushToken, setExpoPushToken] = useState('');
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    registerForPushNotificationsAsync().then(async token => {
      console.log('📟 Expo Push Token:', token);

      if (!token) {
        console.warn('❌ Kein Token zurückgegeben');
        return;
      }

      const storedToken = await SecureStore.getItemAsync('jwt');
      if (!storedToken) {
        console.warn('❌ Kein JWT gefunden');
        return;
      }

      const userId = parseJwt(storedToken)?.userId || parseJwt(storedToken)?.id;
      if (!userId) {
        console.warn('❌ User ID konnte aus JWT nicht gelesen werden');
        return;
      }

      console.log('🆔 User ID:', userId);

      try {
        const response = await axios.post(`/auth/push-token/${userId}`, { expoPushToken: token });
        console.log('✅ Push-Token erfolgreich gespeichert:', response.data);
      } catch (err) {
        console.error('❌ Fehler beim Speichern des Push Tokens:', err.message);
        if (err.response) {
          console.error('🔎 Serverantwort:', err.response.data);
        }
      }

      setExpoPushToken(token);
    });

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('📬 Notification received:', notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('📲 Notification response:', response);
    });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  return (
    <>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="LocationAccess" component={LocationAccessScreen} />
          <Stack.Screen name="InterestSelection" component={InterestSelectionScreen} />
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="OfferDetails" component={OfferDetailsScreen} />
        </Stack.Navigator>
      </NavigationContainer>

      <Toast />
    </>
  );
}

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

function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    console.warn('❌ JWT Parsing fehlgeschlagen:', e.message);
    return null;
  }
}
