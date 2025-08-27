// mobile/components/PushInitializer.js
import React, { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// ⚠️ PASST den Namen an, falls ihr schon einen anderen verwendet:
const GEOFENCE_TASK = 'geofencing-task';

// Neuer, expliziter Android-Channel mit Sound & Vibration
const ANDROID_CHANNEL_ID = 'stepsmatch-default-v2';

// --- Globale (module-scope) Guards: verhindern doppelte Registrierung ---
let INIT_DONE = false;
let NOTI_LISTENER_ADDED = false;
let RESPONSE_LISTENER_ADDED = false;

// Falls die Task woanders bereits definiert ist, vermeiden wir eine Exception
try {
  // defineTask ist idempotent im try/catch – wenn schon definiert, knallt’s, dann ignorieren
  TaskManager.defineTask(GEOFENCE_TASK, ({ data, error }) => {
    if (error) return;
    // hier NICHT geofences erneut registrieren! Nur Events verarbeiten.
    // console.log('[Geofencing][BG Task]', data?.eventType, data?.region);
  });
} catch {}

export default function PushInitializer() {
  const initRef = useRef(false);

  useEffect(() => {
    // Harte Einmal-Sperre für diese Komponente
    if (INIT_DONE || initRef.current) return;
    initRef.current = true;

    (async () => {
      try {
        // 1) Notification-Handler (einmalig)
        if (!NOTI_LISTENER_ADDED) {
          Notifications.setNotificationHandler({
            handleNotification: async () => ({
              shouldShowAlert: true,
              shouldPlaySound: true, // 🔊 wichtig für Foreground
              shouldSetBadge: false,
            }),
          });
          NOTI_LISTENER_ADDED = true;
        }

        // 2) Foreground/Background Response Listener (einmalig)
        if (!RESPONSE_LISTENER_ADDED) {
          Notifications.addNotificationResponseReceivedListener(() => {
            // nichts weiter hier – Navigation passiert zentral im RootLayout
          });
          RESPONSE_LISTENER_ADDED = true;
        }

        // 3) Geofencing-Setup (idempotent)
        //    - prüfe, ob bereits läuft
        let hasStarted = false;
        try {
          hasStarted = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
        } catch {
          // Manche Android-Versionen werfen hier, wenn Task noch nie versucht wurde – ignorieren
          hasStarted = false;
        }

        if (!hasStarted) {
          // a) ggf. Standort-Permissions prüfen (Foreground reicht für Geofencing)
          const perm = await Location.getForegroundPermissionsAsync();
          if (perm.status !== 'granted') {
            // versuch's leise – Onboarding fragt ohnehin aktiv
            await Location.requestForegroundPermissionsAsync().catch(() => {});
          }

          // b) Regionen besorgen (aus eurer API oder lokalem Store)
          //    ⚠️ Hier nur Beispiel: bitte durch eure echte Quelle ersetzen.
          //    Wichtig ist: KEIN erneutes Registrieren im Event-Callback!
          const regions = await loadGeofenceRegionsSafe();

          if (Array.isArray(regions) && regions.length > 0) {
            await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
            console.log(`[Geofencing] Registriert: ${regions.length} Regionen`);
          } else {
            console.log('[Geofencing] Keine Regionen zu registrieren');
          }
        } else {
          console.log('[Geofencing] Läuft bereits – kein erneutes Registrieren');
        }

        // 4) Expo-Push-Token + Android-Channel einrichten (einmalig)
        try {
          // a) Berechtigungen sicherstellen
          const perm = await Notifications.getPermissionsAsync();
          if (perm.status !== 'granted') {
            const req = await Notifications.requestPermissionsAsync();
            if (req.status !== 'granted') {
              console.log('[push] permission denied');
            }
          }

          // b) Android-Channel **neu** anlegen (mit Sound & Vibration)
          try {
            await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
              name: 'StepsMatch',
              importance: Notifications.AndroidImportance.MAX,
              sound: 'default', // 🔊 Standard-Ton
              enableVibrate: true, // 💥 Vibration an
              vibrationPattern: [0, 220, 80, 260],
              lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
              bypassDnd: false,
            });
            console.log('[push] channel ready:', ANDROID_CHANNEL_ID);
          } catch (e) {
            console.log('[push] channel error:', e?.message || String(e));
          }

          // c) Expo-Push-Token holen & PERSISTIEREN (wichtig für BG-Task!)
          //    → In Bare/Run:Android-Umgebungen ist das projectId-Argument robust.
          const projectId =
            Constants?.expoConfig?.extra?.eas?.projectId ||
            Constants?.easConfig?.projectId ||
            undefined;

          const { data: expoToken } = await Notifications.getExpoPushTokenAsync(
            projectId ? { projectId } : undefined
          );

          console.log('[push] expoToken =', expoToken);

          // Persistieren für BG-Task:
          try {
            const prev = (await AsyncStorage.getItem('expoPushToken')) || '';
            if (prev !== expoToken) {
              await AsyncStorage.setItem('expoPushToken', String(expoToken));
              console.log('[push] token stored in AsyncStorage');
            } else {
              console.log('[push] token unchanged (already in AsyncStorage)');
            }
          } catch (e) {
            console.log('[push] token store error:', e?.message || String(e));
          }
        } catch (e) {
          console.log('[push] token error:', e?.message || String(e));
        }

        // 5) Markiere Initialisierung als abgeschlossen (global)
        INIT_DONE = true;
      } catch (e) {
        console.log('[PushInitializer] Setup-Fehler:', e?.message || String(e));
        // nicht erneut versuchen – lieber im nächsten App-Start oder via explizitem Refresh
        INIT_DONE = true;
      }
    })();
  }, []);

  return null;
}

// --- Hilfsfunktion: Regionen laden (Dummy/Platzhalter) ---
async function loadGeofenceRegionsSafe() {
  // ⚠️ ERSETZEN: Holt eure echten Regionen (z. B. aus AsyncStorage oder API).
  // Struktur-Beispiel für Expo Geofencing:
  // [{ identifier: 'offer:123', latitude: 47.1, longitude: 15.4, radius: 150, notifyOnEnter: true, notifyOnExit: false }]
  try {
    // Beispiel: holt zuletzt bekannte Regionen aus AsyncStorage (falls ihr das nutzt)
    // const json = await AsyncStorage.getItem('geofenceRegions');
    // return json ? JSON.parse(json) : [];
    return []; // ← vorerst leer lassen; eure bestehende Logik befüllt das an anderer Stelle
  } catch {
    return [];
  }
}
