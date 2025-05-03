// /mobile/backgroundLocationTask.js
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';

export const BACKGROUND_LOCATION_TASK = 'background-location-task';

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('❌ Hintergrund-Standortfehler:', error.message);
    return;
  }

  if (data) {
    const { locations } = data;
    const location = locations[0];

    if (location) {
      console.log('📍 [BG] Neue Position im Hintergrund:', location.coords);
      // ⏳ Hier folgt in Schritt 2 der API-Call ans Backend
    }
  }
});
