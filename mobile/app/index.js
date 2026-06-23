// stepsmatch/mobile/app/index.js
import React, { useEffect, useState, useCallback } from 'react';
import { View, ActivityIndicator, Text, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

function isStrongNotificationTestUrl(url) {
  return typeof url === 'string' && url.includes('test-strong-notification');
}

function isTestNotificationData(data) {
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

export default function IndexGate() {
  const router = useRouter();
  const [bootstrapping, setBootstrapping] = useState(true);
  const [needsPerms, setNeedsPerms] = useState(false);
  const [permState, setPermState] = useState({ location: 'unknown', push: 'unknown' });

  const openSettings = useCallback(async () => {
    try {
      await Linking.openSettings();
    } catch {}
  }, []);

  const checkPermissions = useCallback(async () => {
    // ---- Standort (erforderlich, hier nur pruefen) ----
    let loc = await Location.getForegroundPermissionsAsync();

    // ---- Push (optional, hier nur pruefen) ----
    let push = await Notifications.getPermissionsAsync();

    setPermState({
      location: loc.granted ? 'granted' : (loc.canAskAgain ? 'denied' : 'blocked'),
      push: push.granted ? 'granted' : (push.canAskAgain ? 'denied' : 'blocked'),
    });

    // Standort ist Pflicht → Gate nur öffnen, wenn granted
    const locationOk = !!loc.granted;
    return locationOk;
  }, []);

  const requestMissingPermissions = useCallback(async () => {
    let loc = await Location.getForegroundPermissionsAsync();
    if (!loc.granted && loc.canAskAgain) {
      loc = await Location.requestForegroundPermissionsAsync();
    }

    let push = await Notifications.getPermissionsAsync();
    if (!push.granted && push.canAskAgain) {
      try {
        push = await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: true, allowSound: true, allowAnnouncements: false },
        });
      } catch {}
    }

    setPermState({
      location: loc.granted ? 'granted' : (loc.canAskAgain ? 'denied' : 'blocked'),
      push: push.granted ? 'granted' : (push.canAskAgain ? 'denied' : 'blocked'),
    });

    return !!loc.granted;
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // 1) Deep-Link respektieren (z. B. Push-Open zu /offers/:id)
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          if (isStrongNotificationTestUrl(initialUrl)) {
            router.replace('/(tabs)/ProfileScreen');
            return;
          }
          if (!mounted) return;
          router.replace(initialUrl);
          return;
        }

        const lastNotifResp = await Notifications.getLastNotificationResponseAsync();
        const lastNotifData = lastNotifResp?.notification?.request?.content?.data || {};
        if (isTestNotificationData(lastNotifData)) {
          console.log('[notify] strongNearbyIntent testNotificationResponse ignored');
          if (!mounted) return;
          router.replace('/(tabs)/ProfileScreen');
          return;
        }
        const lastOfferId = getNavigableOfferId(lastNotifData);
        if (lastOfferId) {
          if (!mounted) return;
          router.replace({ pathname: '/(tabs)/offers/[id]', params: { id: String(lastOfferId) } });
          return;
        }


        // 2) Auth + Onboarding-Gate
        const [has, token, emailVerified, userEmail] = await Promise.all([
          AsyncStorage.getItem('hasOnboarded'),
          AsyncStorage.getItem('token'),
          AsyncStorage.getItem('userEmailVerified'),
          AsyncStorage.getItem('userEmail'),
        ]);
        if (!mounted) return;

        // 3) Permissions-Gate
        const ok = await checkPermissions();
        if (!mounted) return;

        if (!ok) {
          // Standort fehlt → UI mit Hinweis & „Zu den Einstellungen“
          setNeedsPerms(true);
          return;
        }

        // 4) Routing
        if (!token) {
          router.replace('/(auth)/LoginScreen');
        } else if (emailVerified === '0') {
          router.replace({
            pathname: '/(auth)/VerifyEmailScreen',
            params: { email: userEmail || '', next: has === '1' ? 'tabs' : 'onboarding' },
          });
        } else if (has === '1') {
          router.replace('/(tabs)');
        } else {
          router.replace('/(onboarding)/WelcomeScreen');
        }
      } catch {
        if (!mounted) return;
        // defensiver Fallback
        router.replace('/(onboarding)/WelcomeScreen');
      } finally {
        if (mounted) setBootstrapping(false);
      }
    })();

    return () => { mounted = false; };
  }, [router, checkPermissions]);

  const retry = useCallback(async () => {
    setBootstrapping(true);
    const ok = await requestMissingPermissions();
    setBootstrapping(false);
    if (ok) {
      // Wenn Permissions jetzt ok sind, erneut Onboarding-Gate prüfen und weiter
      const [has, token, emailVerified, userEmail] = await Promise.all([
        AsyncStorage.getItem('hasOnboarded'),
        AsyncStorage.getItem('token'),
        AsyncStorage.getItem('userEmailVerified'),
        AsyncStorage.getItem('userEmail'),
      ]);
      if (!token) {
        router.replace('/(auth)/LoginScreen');
      } else if (emailVerified === '0') {
        router.replace({
          pathname: '/(auth)/VerifyEmailScreen',
          params: { email: userEmail || '', next: has === '1' ? 'tabs' : 'onboarding' },
        });
      } else if (has === '1') {
        router.replace('/(tabs)');
      } else {
        router.replace('/(onboarding)/WelcomeScreen');
      }
    } else {
      setNeedsPerms(true);
    }
  }, [requestMissingPermissions, router]);

  if (bootstrapping && !needsPerms) {
    // Kleiner Loader, falls der Redirect einen Tick dauert
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (needsPerms) {
    const locBlocked = permState.location === 'blocked';
    const locDenied = permState.location === 'denied';
    const pushDenied = permState.push === 'denied' || permState.push === 'blocked';

    return (
      <View style={{ flex: 1, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 20, fontWeight: '800', marginBottom: 8, textAlign: 'center' }}>
          Standort und Push fuer StepsMatch
        </Text>
        <Text style={{ color: '#4b5563', textAlign: 'center', marginBottom: 16, lineHeight: 20 }}>
          StepsMatch funktioniert nur, wenn Naehe, Zeit und Interesse zusammenpassen. Dafuer braucht die App Standort; Push hilft, passende Hinweise nicht zu verpassen.
        </Text>

        {pushDenied && (
          <Text style={{ color: '#6b7280', textAlign: 'center', marginBottom: 10, fontSize: 12 }}>
            Ohne Push bleiben Hinweise in der App. Du kannst Rechte spaeter in den Systemeinstellungen widerrufen.
          </Text>
        )}

        <View style={{ flexDirection: 'column', width: '100%', maxWidth: 320 }}>
          <TouchableOpacity
            onPress={locBlocked ? openSettings : retry}
            activeOpacity={0.9}
            style={{
              backgroundColor: '#3b82f6',
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: 'center',
              marginBottom: 10,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>
              {locBlocked ? (Platform.OS === 'ios' ? 'Zu den iOS-Einstellungen' : 'Zu den App-Einstellungen') : 'Berechtigungen anfragen'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={retry}
            activeOpacity={0.9}
            style={{
              backgroundColor: '#eef2ff',
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#111827', fontWeight: '700' }}>Erneut prüfen</Text>
          </TouchableOpacity>
        </View>

        {(locDenied || locBlocked) && (
          <Text style={{ color: '#9ca3af', marginTop: 12, fontSize: 12, textAlign: 'center' }}>
            Falls die Abfrage nicht erscheint, öffne die Einstellungen und erlaube „Standortzugriff“.
          </Text>
        )}
      </View>
    );
  }

  // Fallback-Loader
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}
