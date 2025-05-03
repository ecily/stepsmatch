// /mobile/backgroundLocationTask.js
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance from './src/api/axios';

export const BACKGROUND_LOCATION_TASK = 'background-location-task';

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
    console.log('📍 [BG] Neue Position im Hintergrund:', latitude, longitude);

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

      // Optional: lokale Notification bei Server-Antwort
      const message = response.data?.message || null;
      if (message && message.includes('Notification')) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '✨ Neue Angebote!',
            body: message,
            data: { screen: 'Home' },
          },
          trigger: null,
        });
        console.log('📲 [BG] Lokale Benachrichtigung gesendet.');
      }
    } catch (err) {
      console.error('❌ [BG] Fehler beim API-Aufruf:', err.message);
    }
  }
});
