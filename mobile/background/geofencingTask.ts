// stepsmatch/mobile/background/geofencingTask.ts
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import axios from 'axios';

// Holt (falls vorhanden) den lokal gespeicherten Expo Push Token
import { getStoredPushTokenAsync } from '../lib/notifications';

export const GEOFENCE_TASK = 'stepsmatch-geofencing';

// WICHTIG: Task-Definition muss im Modul-Top-Level stehen (nicht in React Components)
TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
  try {
    if (error) {
      console.warn('[GEOFENCE_TASK] error:', error);
      return;
    }
    const event = data as any;
    const { eventType, region } = event;

    // Wir reagieren vorerst nur auf ENTER
    if (eventType === Location.GeofencingEventType.Enter) {
      const offerId = region?.identifier as string | undefined;

      // Aktuelle Position (battery-friendly)
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // Versuche gespeicherten Expo Push Token zu laden (keine Permissions im Hintergrund anfragen!)
      const token = await getStoredPushTokenAsync(); // kann null sein

      // Backend informieren – token mitschicken, wenn vorhanden
      await axios.post(
        'https://lobster-app-ie9a5.ondigitalocean.app/api/location/geofence-enter',
        {
          offerId,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          eventType: 'enter',
          token: token ?? undefined,
        }
      );

      console.log(
        '[GEOFENCE_TASK] ENTER sent -> offer=%s, hasToken=%s',
        offerId,
        Boolean(token)
      );
    }
  } catch (e: any) {
    console.warn('[GEOFENCE_TASK] failed:', e?.message || e);
  }
});
