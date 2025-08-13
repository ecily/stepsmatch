import React, { useEffect } from 'react';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';

// Side-Effect: Geofencing-Task registrieren
import '../background/geofencingTask';

import { refreshGeofencesAsync } from '../lib/geofencing';
import { getAndStoreExpoPushTokenAsync } from '../lib/notifications';
import axios from 'axios';
import { Platform } from 'react-native';

// === 🔧 Deep-Link Helper ===
// Passe diesen Pfad an deine echte Detail-Route an (z. B. "/(tabs)/offer/[id]" oder "/offers/[id]").
const OFFER_DETAILS_PATH = '/(tabs)/offers/[id]';

// Extrahiert eine Offer-ID aus gängigen URL-Varianten ("/offers/<id>", "/offer/<id>")
function extractOfferId(input?: unknown): string | null {
  const url = typeof input === 'string' ? input : '';
  // match: /offers/<id> oder /offer/<id>
  const m = url.match(/\/offer[s]?\/([^/?#]+)/i);
  return m?.[1] ?? null;
}

// Navigiert sicher zum Offer-Detailscreen, unabhängig davon, was in data.url steht
function navigateToOffer(id: string) {
  // Objekt-Form verhindert Tippfehler in Strings und setzt Query-Params korrekt
  router.push({ pathname: OFFER_DETAILS_PATH as any, params: { id } });
}

// === Notifications im Vordergrund anzeigen ===
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function PushInitializer() {
  useEffect(() => {
    (async () => {
      try {
        // 1) Expo Push Token holen & lokal speichern
        const token = await getAndStoreExpoPushTokenAsync();

        // 2) Token im Backend registrieren
        if (token) {
          await axios.post(
            'https://lobster-app-ie9a5.ondigitalocean.app/api/push/register',
            { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' }
          );
        }

        // 3) Geofences laden & registrieren
        await refreshGeofencesAsync();

        // 4) Falls App via Notification gestartet wurde → initialen Tap verarbeiten
        const last = await Notifications.getLastNotificationResponseAsync();
        if (last) handleNotificationTap(last);
      } catch (e: any) {
        console.warn('[PushInitializer] init failed:', e?.message || e);
      }
    })();

    // 5) Listener für künftige Taps
    const sub = Notifications.addNotificationResponseReceivedListener(handleNotificationTap);
    return () => sub.remove();
  }, []);

  return null;
}

// === Tap-Handler ===
function handleNotificationTap(resp: Notifications.NotificationResponse) {
  const data = resp?.notification?.request?.content?.data ?? {};
  const url = (data as any)?.url as string | undefined;
  const idFromData = (data as any)?.offerId as string | undefined;
  const id = idFromData || extractOfferId(url);

  if (id) {
    navigateToOffer(id);
  } else if (url) {
    // Fallback: wenn keine ID ermittelbar, versuch es direkt
    router.push(url);
  } else {
    // Kein Ziel vorhanden → optional: Offers-Tab öffnen
    // router.push('/(tabs)/offers');
  }
}
