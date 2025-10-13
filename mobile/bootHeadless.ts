// stepsmatch/mobile/bootHeadless.ts
import { AppRegistry, Platform } from 'react-native';
import { headlessBootstrap } from './components/PushInitializer';

// Idempotenter Guard gegen Doppelstarts
let __inFlight = false;

async function runHeadlessBootstrap() {
  if (__inFlight) {
    try { console.log('[HEADLESS] skip (already in-flight)'); } catch {}
    return;
  }
  __inFlight = true;
  try {
    console.log('[HEADLESS] task start');
    await headlessBootstrap();
    console.log('[HEADLESS] task done');
  } catch (e: any) {
    console.log('[HEADLESS] error', String(e?.message || e));
  } finally {
    __inFlight = false;
  }
}

// Headless-Provider-Funktion (Signatur gemäß RN)
const task = async () => {
  await runHeadlessBootstrap();
};

// Nur Android: Headless-Tasks registrieren
if (Platform.OS === 'android') {
  // Custom-Bootstrap (falls ein BootReceiver/Service diesen Task startet)
  AppRegistry.registerHeadlessTask('BootHeadlessTask', () => task);

  // Expo eigener Headless-Start (z.B. durch Updates/Services im Hintergrund)
  AppRegistry.registerHeadlessTask('ExpoHeadlessApp', () => task);
}
