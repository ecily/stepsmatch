// BLOCK 1: Imports
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
import { navigationRef, navigate } from './navigationRef';
import axiosInstance from './src/api/axios'; // ✅ benötigt für Initial-Matching

const Stack = createNativeStackNavigator();

// BLOCK 2: Haupt-App ohne Firebase Wrapper
export default function App() {
  return <MainApp />;
}

// BLOCK 3: Haupt-Komponente mit Navigation & Push
function MainApp() {
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    // Foreground Notification Listener
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('📬 Notification received (foreground):', notification);

      Toast.show({
        type: 'info',
        text1: 'Neues Angebot',
        text2: notification.request.content.body,
      });
    });

    // Notification-Klick-Handler
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('📲 Notification response (tapped):', response);
      const screen = response?.notification?.request?.content?.data?.screen;
      const offerId = response?.notification?.request?.content?.data?.offerId;

      if (screen === 'OfferDetails' && offerId) {
        console.log('🧭 Navigiere zu OfferDetails mit ID:', offerId);
        navigate('OfferDetails', { offerId });
      }
    });

    // ⏳ Sofortiger Matching-Check beim Start
    runInitialMatchCheck();

    // Hintergrund-Standortüberwachung starten
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

// BLOCK 4: Funktion zur Registrierung für Push-Notifications
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

// BLOCK 5: Initialisierung für Hintergrundstandort
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
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 300000,
      distanceInterval: 50,
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

// BLOCK 6: Sofortige Matching-Prüfung beim App-Start
async function runInitialMatchCheck() {
  try {
    console.log('🚀 [Init] Starte Initial-Matching…');

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('⚠️ [Init] Keine Standortberechtigung');
      return;
    }

    const location = await Location.getCurrentPositionAsync({});
    const userId = await SecureStore.getItemAsync('userId');

    if (!userId || !location) {
      console.warn('⚠️ [Init] Keine Daten für Matching verfügbar');
      return;
    }

    const payload = {
      userId,
      location: {
        lat: location.coords.latitude,
        lng: location.coords.longitude
      }
    };

    const response = await axiosInstance.post('/match-check', payload);
    console.log('📬 [Init] MatchCheck Antwort:', response.data);

    const message = response.data?.message;
    const offerId = response.data?.offerId;

    if (message && message.includes('Notification')) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '✨ Neues Angebot!',
          body: message,
          data: { screen: 'OfferDetails', offerId },
        },
        trigger: null,
      });
      console.log('📲 [Init] Lokale Notification gesendet.');
    }
  } catch (err) {
    console.error('❌ [Init] Fehler beim Matching:', err.message);
  }
}
