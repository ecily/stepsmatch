import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import Constants from 'expo-constants';

import 'react-native-gesture-handler';

import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import LocationAccessScreen from './screens/LocationAccessScreen';
import InterestSelectionScreen from './screens/InterestSelectionScreen';
import HomeScreen from './screens/HomeScreen';
import OfferDetailsScreen from './screens/OfferDetailsScreen';

import { BACKGROUND_LOCATION_TASK } from './backgroundLocationTask';
import { navigationRef, navigate } from './navigationRef'; // ✅ Neu

const Stack = createNativeStackNavigator();

export default function App() {
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('📬 Notification received:', notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('📲 Notification response:', response);
      const offerId = response?.notification?.request?.content?.data?.offerId;
      if (offerId) {
        console.log('🧭 Navigation zu OfferDetails mit ID:', offerId);
        navigate('OfferDetails', { offerId });
      }
    });

    initBackgroundLocationTask();

    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  return (
    <>
      <NavigationContainer ref={navigationRef}>
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

// 🔁 Exportierte Token-Funktion mit maximalem Logging
export async function registerForPushNotificationsAsync() {
  try {
    console.log('🔍 [Push] Starte Abfrage nach vorhandener Berechtigung…');
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    console.log('🔍 [Push] Vorheriger Berechtigungsstatus:', existingStatus);

    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      console.log('🔐 [Push] Erfrage Berechtigung vom Nutzer…');
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      console.log('🔐 [Push] Neuer Berechtigungsstatus:', finalStatus);
    }

    if (finalStatus !== 'granted') {
      console.warn('⚠️ [Push] Keine Berechtigung für Push-Nachrichten');
      return null;
    }

    console.log('✅ [Push] Berechtigung erteilt. Hole Expo Push Token…');

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: Constants?.expoConfig?.extra?.eas?.projectId || '❌ FEHLT',
    });

    console.log('📦 [Push] Rohdaten vom Token:', tokenData);
    console.log('📲 [Push] Erfolgreich erhalten:', tokenData.data);

    return tokenData.data;
  } catch (error) {
    console.error('❌ [Push] Fehler beim Abrufen des Expo Push Tokens:');
    console.error(error);
    return null;
  }
}

// 🚀 Initialisiert den Hintergrund-Standorttask
async function initBackgroundLocationTask() {
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);

  if (!hasStarted) {
    console.log('⏳ [BG] Starte Hintergrund-Standort-Task…');

    const { status } = await Location.requestBackgroundPermissionsAsync();

    if (status !== 'granted') {
      console.warn('⚠️ [BG] Hintergrund-Standortberechtigung nicht erteilt');
      return;
    }

    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 900000, // 15 Minuten
      distanceInterval: 50, // nur bei Bewegung über 50m
      showsBackgroundLocationIndicator: false,
      foregroundService: {
        notificationTitle: 'StepsMatch läuft',
        notificationBody: 'Suche passende Angebote in deiner Nähe',
      },
    });

    console.log('✅ [BG] Hintergrund-Standort-Task gestartet.');
  } else {
    console.log('🔁 [BG] Task läuft bereits.');
  }
}
