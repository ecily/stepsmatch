import React, { useEffect } from 'react';
import { router } from 'expo-router';

// Side-Effect-Import: definiert den Geofencing-Task beim App-Start
import '../background/geofencingTask';

import { refreshGeofencesAsync } from '../lib/geofencing';

export default function PushInitializer() {
  useEffect(() => {
    (async () => {
      try {
        // Top-Geofences laden & registrieren
        await refreshGeofencesAsync();
      } catch (e: any) {
        console.warn('[PushInitializer] refreshGeofencesAsync failed:', e?.message || e);
      }
    })();
  }, []);

  return null;
}
