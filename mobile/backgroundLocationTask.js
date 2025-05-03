// /mobile/backgroundLocationTask.js
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance from './src/api/axios';

export const BACKGROUND_LOCATION_TASK = 'background-location-task';

// ⏱️ Konfiguration
const MOVEMENT_THRESHOLD_METERS = 50;
const STILLNESS_THRESHOLD_MS = 5 * 60 * 1000;

let lastPosition = null;
let lastCheckedTime = Date.now();

function getDistanceMeters(loc1, loc2) {
  const R = 6371e3;
  const toRad = deg => deg * Math.PI / 180;

  const dLat = toRad(loc2.latitude - loc1.latitude);
  const dLon = toRad(loc2.longitude - loc1.longitude);
  const lat1 = toRad(loc1.latitude);
  const lat2 = toRad(loc2.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('❌ Hintergrund-Standortfehler:', error.message);
    return;
  }

  if (data) {
    const { locations } = data;
    const location = locations[0];
    if (!location) return;

    const { latitude, longitude } = location.coords;
    const now = Date.now();

    const currentPos = { latitude, longitude };
    let triggerPush = false;

    if (!lastPosition) {
      triggerPush = true;
      console.log('📍 [BG] Erste Position – triggert MatchCheck.');
    } else {
      const distance = getDistanceMeters(lastPosition, currentPos);
      const timeElapsed = now - lastCheckedTime;

      if (distance >= MOVEMENT_THRESHOLD_METERS) {
        console.log(`🚶 [BG] Bewegung erkannt (${Math.round(distance)} m) – triggert MatchCheck.`);
        triggerPush = true;
      } else if (timeElapsed >= STILLNESS_THRESHOLD_MS) {
        console.log(`⏱️ [BG] Stillstand seit ${Math.round(timeElapsed / 1000)} s – triggert MatchCheck.`);
        triggerPush = true;
      } else {
        console.log(`ℹ️ [BG] Kein Trigger: ${Math.round(distance)} m Bewegung, ${Math.round(timeElapsed / 1000)} s vergangen.`);
      }
    }

    if (triggerPush) {
      try {
        const userId = await AsyncStorage.getItem('userId');
        if (!userId) {
          console.warn('⚠️ Kein User ID im AsyncStorage gespeichert');
          return;
        }

        const payload = {
          userId,
          location: {
            lat: latitude,
            lng: longitude,
          },
        };

        const response = await axiosInstance.post('/match-check', payload);
        console.log('📬 [BG] MatchCheck Antwort:', response.data);

        const message = response.data?.message || null;
        if (message && message.includes('Notification')) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: '✨ Neue Angebote!',
              body: message,
              data: { screen: 'OfferDetails', offerId: response.data.offerId }, // optional
            },
            trigger: null,
          });
          console.log('📲 [BG] Lokale Benachrichtigung gesendet.');
        }

        lastPosition = currentPos;
        lastCheckedTime = now;
      } catch (err) {
        console.error('❌ [BG] Fehler beim API-Aufruf:', err.message);
      }
    }
  }
});
