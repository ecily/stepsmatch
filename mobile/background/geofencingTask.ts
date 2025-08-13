// stepsmatch/mobile/background/geofencingTask.ts
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getStoredPushTokenAsync } from '../lib/notifications';

export const GEOFENCE_TASK = 'stepsmatch-geofencing';

// Client-seitiger Cooldown (spiegelt Server: 10 Minuten)
const COOLDOWN_MS = 10 * 60 * 1000;
const KEY_PREFIX = 'lastGeofencePost:v2'; // KEY = lastGeofencePost:<offerId>

async function shouldPostNow(offerId: string): Promise<boolean> {
  try {
    const key = `${KEY_PREFIX}${offerId}`;
    const raw = await AsyncStorage.getItem(key);
    const last = raw ? parseInt(raw, 10) : 0;
    const now = Date.now();
    if (!last || now - last >= COOLDOWN_MS) {
      await AsyncStorage.setItem(key, String(now));
      return true;
    }
    return false;
  } catch {
    // Bei Storage-Fehlern lieber posten (fail-open)
    return true;
  }
}

// WICHTIG: Task-Definition muss im Modul-Top-Level stehen
TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
  try {
    if (error) {
      console.warn('[GEOFENCE_TASK] error:', error);
      return;
    }

    const event = data as any;
    const { eventType, region } = event;

    if (eventType !== Location.GeofencingEventType.Enter) return;

    const offerId = region?.identifier as string | undefined;
    if (!offerId) return;

    // Clientseitiger Cooldown -> reduziert Netzlast
    const okToPost = await shouldPostNow(offerId);
    if (!okToPost) {
      console.log('[GEOFENCE_TASK] cooldown skip -> offer=%s', offerId);
      return;
    }

    // Position: zuerst "last known" (schnell), dann Fallback zu Balanced GPS
    let lat: number | null = null;
    let lng: number | null = null;

    try {
      const last = await Location.getLastKnownPositionAsync();
      if (last) {
        lat = last.coords.latitude;
        lng = last.coords.longitude;
      }
    } catch {}

    if (lat == null || lng == null) {
      const now = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      lat = now.coords.latitude;
      lng = now.coords.longitude;
    }

    const token = await getStoredPushTokenAsync(); // kann null sein

    await axios.post(
      'https://lobster-app-ie9a5.ondigitalocean.app/api/location/geofence-enter',
      {
        offerId,
        lat,
        lng,
        eventType: 'enter',
        token: token ?? undefined
      }
    );

    console.log('[GEOFENCE_TASK] ENTER sent -> offer=%s, hasToken=%s', offerId, Boolean(token));
  } catch (e: any) {
    console.warn('[GEOFENCE_TASK] failed:', e?.message || e);
  }
});
