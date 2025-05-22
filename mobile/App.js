// BLOCK 1: Imports
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import 'react-native-gesture-handler';

import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import LocationAccessScreen from './screens/LocationAccessScreen';
import InterestSelectionScreen from './screens/InterestSelectionScreen';
import HomeScreen from './screens/HomeScreen';
import OfferDetailsScreen from './screens/OfferDetailsScreen';

import { navigationRef } from './navigationRef';

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

const Stack = createNativeStackNavigator();

// BLOCK 2: Haupt-App ohne Firebase Wrapper
export default function App() {
  return <MainApp />;
}

// BLOCK 3: Haupt-Komponente mit Navigation
function MainApp() {
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
    if (!Device.isDevice) {
      console.warn('❌ Push-Benachrichtigungen funktionieren nur auf echten Geräten');
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('⚠️ Keine Berechtigung für Push-Nachrichten');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: Constants?.expoConfig?.extra?.eas?.projectId || 'MISSING_PROJECT_ID',
    });

    console.log('📲 Push-Token:', tokenData.data);
    return tokenData.data;
  } catch (error) {
    console.error('❌ Fehler beim Push-Token:', error);
    return null;
  }
}
