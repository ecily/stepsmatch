// mobile/components/BackgroundLocationManager.js
import React from 'react';
import * as Location from 'expo-location';
import { sendHeartbeat, getStoredOrFetchExpoToken } from './PushInitializer';

// Hinweis in den Logs, damit klar ist, dass hier nichts mehr doppelt startet
console.log('[BGLOC] BackgroundLocationManager: delegating to PushInitializer (no own task/start)');

/**
 * Optionaler, sicherer Kickstart – falls irgendwo im Code noch gebraucht.
 * Keine eigenen fetch()-Calls, kein doppelter Task-Start.
 */
export async function kickstartOnce() {
  try {
    await getStoredOrFetchExpoToken(); // verhindert 400er
    let pos = await Location.getLastKnownPositionAsync();
    if (!pos) {
      pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        mayShowUserSettingsDialog: false,
      });
    }
    if (pos?.coords) {
      await sendHeartbeat(pos.coords, 'Kickstart(BackgroundManager)');
    } else {
      console.log('[BGLOC] Kickstart: no position available');
    }
  } catch (e) {
    console.log('[BGLOC] Kickstart wrapper error', e?.message || e);
  }
}

/** Keine Side-Effects mehr – PushInitializer übernimmt alles. */
export default function BackgroundLocationManager() {
  return null;
}
