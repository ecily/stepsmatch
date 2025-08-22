import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

import '../background/geofencingTask';
import { refreshGeofencesAsync } from '../lib/geofencing';
import { getAndStoreExpoPushTokenAsync } from '../lib/notifications';

// ─────────────────────────────────────────────────────────────
// Konfiguration
// ─────────────────────────────────────────────────────────────
const API_URL = 'https://lobster-app-ie9a5.ondigitalocean.app/api';
const CATEGORY_ID = 'offers-actions'; // muss mit Backend-Daten übereinstimmen
const CHANNEL_ID = 'offers';          // dein bestehender Channel-Name

// Globale Notification-Handhabung (Anzeige)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function extractOfferIdFromUrl(url) {
  if (typeof url !== 'string') return null;
  // Erwartet /offers/<id>[?...]
  const m = url.match(/\/offers\/([a-f0-9]{24})/i);
  return m ? m[1] : null;
}

async function ensureNotificationInfraAsync() {
  // Android: Channel sicherstellen (Name muss zum Backend passen)
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Offers',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [200, 100, 200],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    } catch (e) {
      console.warn('[PushInitializer] setNotificationChannelAsync failed:', e?.message || e);
    }
  }

  // Kategorien (Buttons) registrieren
  try {
    await Notifications.setNotificationCategoryAsync(CATEGORY_ID, [
      {
        identifier: 'go',
        buttonTitle: 'Los',
        options: { opensAppToForeground: true },
      },
      {
        identifier: 'dismiss',
        buttonTitle: 'Interessiert mich nicht',
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'snooze-60',
        buttonTitle: 'Später erinnern (60m)',
        options: { opensAppToForeground: false },
      },
    ]);
  } catch (e) {
    console.warn('[PushInitializer] setNotificationCategoryAsync failed:', e?.message || e);
  }
}

async function postActionToBackend({ action, offerId, minutes }) {
  try {
    const token = await AsyncStorage.getItem('expoPushToken'); // wird von getAndStoreExpoPushTokenAsync gespeichert
    const payload = { action, offerId, token };
    if (action === 'snooze' && Number.isFinite(minutes)) {
      payload.minutes = minutes;
    }
    await axios.post(`${API_URL}/push/action`, payload, { timeout: 8000 });
  } catch (e) {
    console.warn('[PushInitializer] action post failed:', e?.message || e);
  }
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
export default function PushInitializer() {
  useEffect(() => {
    (async () => {
      try {
        await ensureNotificationInfraAsync();

        // Token holen/speichern + beim Backend registrieren
        const token = await getAndStoreExpoPushTokenAsync();
        if (token) {
          try {
            await axios.post(`${API_URL}/push/register`, {
              token,
              platform: Platform.OS === 'ios' ? 'ios' : 'android',
            });
          } catch (e) {
            console.warn('[PushInitializer] register failed:', e?.message || e);
          }
        }

        // Geofences initial aktualisieren
        await refreshGeofencesAsync();

        // Falls App kalt gestartet wurde und eine Notification der Einstieg war
        const last = await Notifications.getLastNotificationResponseAsync();
        if (last) handleTap(last);
      } catch (e) {
        console.warn('[PushInitializer] init failed:', e?.message || e);
      }
    })();

    const sub = Notifications.addNotificationResponseReceivedListener(handleTap);
    return () => sub.remove();
  }, []);

  return null;
}

// ─────────────────────────────────────────────────────────────
// Tap-/Action-Handler
// ─────────────────────────────────────────────────────────────
async function handleTap(resp /*: Notifications.NotificationResponse */) {
  try {
    const data = resp?.notification?.request?.content?.data ?? {};
    const url = typeof data?.url === 'string' ? data.url : undefined;
    const offerId =
      (typeof data?.offerId === 'string' && data.offerId) ||
      (url ? extractOfferIdFromUrl(url) : null);

    // Action Identifier auslesen (Buttons); Default‑Tap = systemweiter Identifier
    const act = resp?.actionIdentifier;
    const isDefaultTap = act === Notifications.DEFAULT_ACTION_IDENTIFIER;

    // „Los“ (Default‑Tap oder Button "go"):
    if (isDefaultTap || act === 'go') {
      // Navigation zuerst (snappy UX), Backend‑Call asynchron
      if (url) router.push(url);
      else if (offerId) router.push({ pathname: '/offers/[id]', params: { id: offerId } });

      if (offerId) {
        // Fire‑and‑forget: markiere „go“ im Backend (blockiert weitere Pushes)
        postActionToBackend({ action: 'go', offerId });
      }
      return;
    }

    // „Interessiert mich nicht“
    if (act === 'dismiss') {
      if (offerId) {
        await postActionToBackend({ action: 'dismiss', offerId });
      }
      return;
    }

    // „Später erinnern (60m)“
    if (act && act.startsWith('snooze')) {
      // Identifier-Format: "snooze-<minutes>"
      let minutes = 60;
      const m = act.match(/^snooze-(\d{1,4})$/);
      if (m) {
        const parsed = Number(m[1]);
        if (Number.isFinite(parsed)) minutes = parsed;
      }
      if (offerId) {
        await postActionToBackend({ action: 'snooze', offerId, minutes });
      }
      return;
    }

    // Fallback: kein bekannter Action‑Identifier → nur navigieren, wenn möglich
    if (url) {
      router.push(url);
      return;
    }
    if (offerId) {
      router.push({ pathname: '/offers/[id]', params: { id: offerId } });
    }
  } catch (e) {
    console.warn('[PushInitializer] handleTap error:', e?.message || e);
  }
}
