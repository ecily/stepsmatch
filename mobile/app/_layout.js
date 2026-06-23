// stepsmatch/mobile/app/_layout.js
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { Slot, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';

import ThemeProvider from '../theme/ThemeProvider';

// Startet Foreground-Location-Service, Geofencing, Channels (ohne Popups)
import PushInitializer, {
  ensureBgAfterOnboarding,
  getBgStatus,
} from '../components/PushInitializer';

// Geführtes Onboarding (Notifs → FG/BG-Location)
import PermissionGate from '../components/PermissionGate';
import { clearStopUntilRestart } from '../components/push/service-control';
import {
  BRAND_BLUE,
  NEARBY_ATTENTION_CHANNEL_CONFIG,
  NEARBY_ATTENTION_CHANNEL_ID,
  NEARBY_ATTENTION_CHANNEL_VERSION,
  STRONG_PATTERN,
} from '../components/push/push-constants';
import { API_BASE_URL } from '../lib/runtimeConfig';

const API_BASE = API_BASE_URL;

async function postNotifAction(action, data = {}, minutes) {
  try {
    const offerId = data?.offerId || data?.id || data?.offer || null;
    if (!offerId) return;
    const deviceId = data?.deviceId || null;
    const tokenId = data?.tokenId || null;
    if (!deviceId && !tokenId) return;
    await fetch(`${API_BASE}/notifications/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        offerId,
        deviceId,
        tokenId,
        minutes: minutes || undefined,
      }),
    });
  } catch {}
}

function isStrongNotificationTestData(data) {
  return (
    data?.testOnly === true ||
    data?.noNavigation === true ||
    data?.kind === 'strongNotificationTest' ||
    data?.kind === 'intent-strong-nearby-test' ||
    data?.kind === 'profile-strong-nearby-test'
  );
}

function getNavigableOfferId(data) {
  const raw = data?.offerId || data?.id || data?.offer || null;
  const id = typeof raw === 'string' ? raw.trim() : '';
  if (!id || id === ':id' || id.startsWith(':')) return null;
  return id;
}

async function runStrongNearbyIntentTest() {
  try {
    console.log('[notify] strongNearbyIntent buttonlessTrigger');

    const permissions = await Notifications.getPermissionsAsync();
    const permissionStatus = permissions?.status || (permissions?.granted ? 'granted' : 'unknown');
    console.log(`[notify] strongNearbyIntent permissionStatus=${permissionStatus}`);
    if (!permissions?.granted) {
      console.log(`[notify] strongNearbyIntent error=permission-not-granted status=${permissionStatus}`);
      return;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(NEARBY_ATTENTION_CHANNEL_ID, {
        name: 'Nearby matches',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: STRONG_PATTERN,
        enableVibrate: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        enableLights: true,
        lightColor: BRAND_BLUE,
        bypassDnd: false,
        showBadge: true,
        description: 'Starker Hinweis bei passenden Angeboten in deiner Naehe',
      });
    }

    console.log(`[notify] strongNearbyIntent scheduling channel=${NEARBY_ATTENTION_CHANNEL_ID} trigger=3s`);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'StepsMatch Nähe-Test',
        body: 'Diese Notification nutzt den starken Nearby-Channel.',
        data: {
          kind: 'strongNotificationTest',
          source: 'deep-link',
          screen: 'profile',
          testOnly: true,
          noNavigation: true,
          channelId: NEARBY_ATTENTION_CHANNEL_ID,
          channelVersion: NEARBY_ATTENTION_CHANNEL_VERSION,
          channelConfig: NEARBY_ATTENTION_CHANNEL_CONFIG,
        },
        sound: true,
        channelId: NEARBY_ATTENTION_CHANNEL_ID,
      },
      trigger: {
        type: 'timeInterval',
        seconds: 3,
        channelId: NEARBY_ATTENTION_CHANNEL_ID,
      },
    });

    console.log('[notify] strongNearbyIntent scheduled ok');
  } catch (e) {
    const message = String(e?.message || e);
    console.log(`[notify] strongNearbyIntent error=${message}`);
  }
}

function isStrongNearbyTestUrl(url) {
  return typeof url === 'string' && url.includes('test-strong-notification');
}

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);
  const gateCompletedRef = useRef(false);
  const appStateRef = useRef(AppState.currentState || 'active');
  const lastStrongIntentAtRef = useRef(0);
  const router = useRouter();

  // Falls App mit bereits erteilten Rechten startet, Gate überspringen
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await clearStopUntilRestart();
        const s = await getBgStatus();
        if (!mounted) return;
        if (s?.locPerms && s?.notifPerms) {
          try { await ensureBgAfterOnboarding(); } catch {}
          setAppReady(true);
        }
      } catch {
        // Gate übernimmt dann
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Notifications: Listener für Empfang + Interaktion
  useEffect(() => {
    const subRecv = Notifications.addNotificationReceivedListener((notif) => {
      try {
        const data = notif?.request?.content?.data || {};
        console.log('[notif] received', { id: notif?.request?.identifier, data });
      } catch {}
    });

    const subResp = Notifications.addNotificationResponseReceivedListener((resp) => {
      try {
        const action = resp?.actionIdentifier;
        const data = resp?.notification?.request?.content?.data || {};
        const offerId = getNavigableOfferId(data);
        console.log('[notif] response', { action, data });

        if (isStrongNotificationTestData(data)) {
          console.log('[notify] strongNearbyIntent testNotificationResponse ignored');
          return;
        }

        // Standardaktion oder "GO" → App in den Vordergrund + optional Navigation
        if (action === Notifications.DEFAULT_ACTION_IDENTIFIER || action === 'go') {
          postNotifAction('go', data);
          if (offerId) {
            try { router.push({ pathname: '/(tabs)/offers/[id]', params: { id: String(offerId) } }); }
            catch { router.push('/(tabs)/diagnostics'); }
          } else {
            router.push('/(tabs)/diagnostics');
          }
        } else if (action === 'later') {
          postNotifAction('later', data);
        } else if (action === 'no') {
          postNotifAction('no', data);
        }
      } catch (e) {
        console.log('[notif] response handler error', String(e?.message || e));
      }
    });

    return () => {
      try { subRecv?.remove?.(); } catch {}
      try { subResp?.remove?.(); } catch {}
    };
  }, [router]);

  // AppState → bei Rückkehr in den Vordergrund leise BG sicherstellen
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      appStateRef.current = next;
      if (next === 'active' && appReady) {
        try { await Notifications.dismissAllNotificationsAsync(); } catch {}
        try { await Notifications.setBadgeCountAsync(0); } catch {}
        try { await ensureBgAfterOnboarding(); } catch {}
      }
    });
    return () => sub?.remove?.();
  }, [appReady]);

  useEffect(() => {
    let mounted = true;

    const maybeRunStrongIntent = async (url) => {
      if (!isStrongNearbyTestUrl(url)) return;
      const now = Date.now();
      if (now - lastStrongIntentAtRef.current < 1000) return;
      lastStrongIntentAtRef.current = now;
      await runStrongNearbyIntentTest();
    };

    Linking.getInitialURL()
      .then((url) => {
        if (mounted) maybeRunStrongIntent(url);
      })
      .catch((e) => {
        console.log(`[notify] strongNearbyIntent error=${String(e?.message || e)}`);
      });

    const sub = Linking.addEventListener('url', ({ url }) => {
      maybeRunStrongIntent(url);
    });

    return () => {
      mounted = false;
      try { sub?.remove?.(); } catch {}
    };
  }, []);

  const handleGateDone = useCallback(async () => {
    if (gateCompletedRef.current) return; // Doppelklick-Schutz
    gateCompletedRef.current = true;

    try {
      // Startet BG-Location + Geofences + Token-Register OHNE Dialoge
      await ensureBgAfterOnboarding();
    } catch {
      // Logs kommen aus PushInitializer
    } finally {
      setAppReady(true);
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          {appReady ? (
            <>
              {/* Initialisierung erst NACH erfüllten Voraussetzungen */}
              <PushInitializer />
              <Slot />
              <StatusBar style="auto" />
            </>
          ) : (
            // Geführter Onboarding-Flow (2-stufig: Notifs → FG/BG-Location)
            <PermissionGate onDone={handleGateDone} />
          )}
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

