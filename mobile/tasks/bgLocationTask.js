// mobile/tasks/bgLocationTask.js
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TASK_NAME = 'BG_LOCATION';
const API_URL = 'https://lobster-app-ie9a5.ondigitalocean.app/api/location/heartbeat';

async function getToken() {
  try {
    const t = await AsyncStorage.getItem('expoPushToken');
    return t || '';
  } catch {
    return '';
  }
}

async function postHeartbeat({ latitude, longitude, reason = 'event' }) {
  const token = await getToken();
  if (!token) {
    console.log('[BGLOC] SKIP heartbeat: no expoPushToken in storage');
    return;
  }
  const payload = {
    token,
    platform: 'android',
    lat: latitude,
    lon: longitude,
    src: 'bg',
    reason,
    ts: Date.now(),
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.log('[BGLOC] Heartbeat HTTP', res.status, txt.slice(0, 120));
      return;
    }
    console.log('[BGLOC] Heartbeat sent OK', latitude, longitude, reason);
  } catch (e) {
    console.log('[BGLOC] Heartbeat failed', String(e?.message || e));
  }
}

TaskManager.defineTask(TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.log('[BGLOC] Task error', String(error?.message || error));
    return;
  }
  try {
    const locations = data?.locations || [];
    if (locations.length > 0) {
      const { latitude, longitude } = locations[0].coords;
      console.log('[BGLOC] New location', latitude, longitude);
      await postHeartbeat({ latitude, longitude, reason: 'location-event' });
      return;
    }
    // Fallback: kein Location-Payload → letzte bekannte Position verwenden
    const last = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000 }); // bis 10 min alt ok
    if (last?.coords) {
      const { latitude, longitude } = last.coords;
      console.log('[BGLOC] Fallback lastKnown', latitude, longitude);
      await postHeartbeat({ latitude, longitude, reason: 'last-known' });
    } else {
      console.log('[BGLOC] No locations & no lastKnown');
    }
  } catch (e) {
    console.log('[BGLOC] Handler failed', String(e?.message || e));
  }
});

export default TASK_NAME;
