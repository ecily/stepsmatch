// stepsmatch/mobile/background/geofencingTask.ts
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import axios from 'axios';

export const GEOFENCE_TASK = 'stepsmatch-geofencing';

// Wichtig: Task-Definition MUSS im Modul-Top-Level stehen (nicht in React Components)
TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
  try {
    if (error) {
      console.warn('[GEOFENCE_TASK] error:', error);
      return;
    }
    const event = data as Location.GeofencingEventType | any;
    const { eventType, region } = event;

    // Wir interessieren uns primär für ENTER
    if (eventType === Location.GeofencingEventType.Enter) {
      const offerId = region?.identifier as string | undefined;

      // Aktuelle Position grob/balanced, um das Backend mit Kontext zu versorgen
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });

      // TODO: Auth-Header ergänzen, sobald verfügbar (z. B. Bearer <token>)
      // Schritt 4 wird diesen Endpoint auf Server-Seite implementieren
      await axios.post(
        'https://lobster-app-ie9a5.ondigitalocean.app/api/location/geofence-enter',
        {
          offerId,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          eventType: 'enter'
        }
      );

      console.log('[GEOFENCE_TASK] ENTER -> posted to backend for offer', offerId);
    }
  } catch (e: any) {
    console.warn('[GEOFENCE_TASK] failed:', e?.message || e);
  }
});
