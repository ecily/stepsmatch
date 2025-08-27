// mobile/components/BackgroundLocationManager.js
import React, { useEffect } from 'react';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TASK_NAME from '../tasks/bgLocationTask';

const API_URL = 'https://lobster-app-ie9a5.ondigitalocean.app/api/location/heartbeat';

async function postKickstartHeartbeat(coords, attempt = 1) {
  try {
    const expoPushToken = (await AsyncStorage.getItem('expoPushToken')) || '';
    if (!expoPushToken) {
      console.log('[BGLOC] Kickstart SKIP: no expoPushToken in storage');
      return;
    }
    const payload = {
      token: expoPushToken,
      platform: 'android',
      lat: coords?.latitude,
      lon: coords?.longitude,
      src: 'bg',
      reason: `kickstart-${attempt}`,
      ts: Date.now(),
    };
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    console.log('[BGLOC] Kickstart heartbeat HTTP', res.status, `attempt=${attempt}`);
  } catch (e) {
    console.log('[BGLOC] Kickstart failed', String(e?.message || e), `attempt=${attempt}`);
  }
}

export default function BackgroundLocationManager() {
  useEffect(() => {
    let active = true;

    (async () => {
      // 1) Permissions
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        console.log('[BGLOC] Foreground permission denied');
        return;
      }
      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus !== 'granted') {
        console.log('[BGLOC] Background permission denied (status=', bgStatus, ')');
        return;
      }

      // 2) Start Task if not started
      const already = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
      if (!already && active) {
        console.log('[BGLOC] Starting background updates…');
        await Location.startLocationUpdatesAsync(TASK_NAME, {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10,    // aggressiv fürs Testen
          timeInterval: 30_000,    // mind. alle 30s (Android)
          showsBackgroundLocationIndicator: true, // iOS-only, unter Android harmless
          foregroundService: {
            notificationTitle: 'StepsMatch läuft im Hintergrund',
            notificationBody: 'Dein Standort wird verwendet, um passende Angebote zu finden.',
          },
        });
      } else {
        console.log('[BGLOC] Task already registered =', already);
      }

      // 3) Diagnose
      const started = await Location.hasStartedLocationUpdatesAsync(TASK_NAME);
      console.log('[BGLOC] hasStartedLocationUpdatesAsync =', started);

      // 4) Kickstart #1 (ohne Bewegung)
      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          maximumAge: 5_000,
          mayShowUserSettingsDialog: false,
        });
        if (pos?.coords) {
          console.log('[BGLOC] Kickstart current position', pos.coords.latitude, pos.coords.longitude);
          await postKickstartHeartbeat(pos.coords, 1);
        } else {
          console.log('[BGLOC] Kickstart: no current position');
        }
      } catch (e) {
        console.log('[BGLOC] Kickstart getCurrentPosition failed', String(e?.message || e));
      }

      // 5) Kickstart #2 nach 5s (Fallback)
      setTimeout(async () => {
        if (!active) return;
        try {
          const last = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000 });
          if (last?.coords) {
            console.log('[BGLOC] Kickstart fallback lastKnown', last.coords.latitude, last.coords.longitude);
            await postKickstartHeartbeat(last.coords, 2);
          } else {
            console.log('[BGLOC] Kickstart fallback: no lastKnown');
          }
        } catch (e) {
          console.log('[BGLOC] Kickstart fallback failed', String(e?.message || e));
        }
      }, 5000);
    })();

    return () => {
      active = false;
    };
  }, []);

  return null;
}
