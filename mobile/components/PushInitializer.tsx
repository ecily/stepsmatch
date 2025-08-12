import React, { useEffect } from 'react';

// Side-Effect: definiert den Geofencing-Task beim App-Start
import '../background/geofencingTask';

import { refreshGeofencesAsync } from '../lib/geofencing';
import { getAndStoreExpoPushTokenAsync } from '../lib/notifications';
import axios from 'axios';
import { Platform } from 'react-native';

export default function PushInitializer() {
  useEffect(() => {
    (async () => {
      try {
        // 1) Expo Push Token holen & lokal speichern (fragt Permission im FG ab)
        const token = await getAndStoreExpoPushTokenAsync();

        // 2) Token im Backend registrieren (wenn vorhanden)
        if (token) {
          await axios.post(
            'https://lobster-app-ie9a5.ondigitalocean.app/api/push/register',
            {
              token,
              platform: Platform.OS === 'ios' ? 'ios' : 'android',
              // optional: userId / deviceId ergänzen, sobald vorhanden
            }
          );
        }

        // 3) Top-Geofences laden & beim OS registrieren
        await refreshGeofencesAsync();
      } catch (e: any) {
        console.warn('[PushInitializer] init failed:', e?.message || e);
      }
    })();
  }, []);

  return null;
}
