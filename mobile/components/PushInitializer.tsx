import React, { useEffect } from 'react';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';

import '../background/geofencingTask';
import { refreshGeofencesAsync } from '../lib/geofencing';
import { getAndStoreExpoPushTokenAsync } from '../lib/notifications';
import axios from 'axios';
import { Platform } from 'react-native';

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
        const token = await getAndStoreExpoPushTokenAsync();
        if (token) {
          await axios.post('https://lobster-app-ie9a5.ondigitalocean.app/api/push/register', {
            token,
            platform: Platform.OS === 'ios' ? 'ios' : 'android',
          });
        }
        await refreshGeofencesAsync();

        const last = await Notifications.getLastNotificationResponseAsync();
        if (last) handleTap(last);
      } catch (e: any) {
        console.warn('[PushInitializer] init failed:', e?.message || e);
      }
    })();

    const sub = Notifications.addNotificationResponseReceivedListener(handleTap);
    return () => sub.remove();
  }, []);

  return null;
}

function handleTap(resp: Notifications.NotificationResponse) {
  const data = resp?.notification?.request?.content?.data ?? {};
  const url = typeof (data as any)?.url === 'string' ? (data as any).url : undefined;
  const offerId = (data as any)?.offerId as string | undefined;

  if (url) {
    // Server liefert jetzt /offers/<id> → direkt navigieren
    router.push(url as any);
    return;
  }
  if (offerId) {
    router.push({ pathname: '/offers/[id]', params: { id: offerId } });
  }
}
