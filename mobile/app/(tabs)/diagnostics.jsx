import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Battery from 'expo-battery';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Application from 'expo-application';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import colors from '../../theme/colors';

/** ────────────────────────────────────────────────────────────────────────────
 *  CONFIG
 *  ───────────────────────────────────────────────────────────────────────── */
const TASK_NAME = 'stepsmatch-bg-location-task';
const ALT_TASKS = [
  'BG_LOCATION_TASK',
  'stepsmatch-background-location',
  'background-location-task',
];

const API_URL = 'https://lobster-app-ie9a5.ondigitalocean.app/api';
const HEARTBEAT_KEYS = [
  'lastHeartbeatAt',
  'sm:lastHeartbeatAt',
  'heartbeat:last',
  'lastHeartbeat',
];

const LOG_FILTER = /(BGLOC|heartbeat|push|nav-offer|push-tap|foreground|TaskManager|Location)/i;
const RING_SIZE = 120;

/** ────────────────────────────────────────────────────────────────────────────
 *  In-Memory Log-Ring
 *  ───────────────────────────────────────────────────────────────────────── */
const _ring = [];
let _hooked = false;
const _subs = new Set();

function pushLog(line) {
  const stamp = new Date().toISOString().replace('T', ' ').replace('Z', '');
  const row = `${stamp}  ${line}`;
  if (_ring.length >= RING_SIZE) _ring.shift();
  _ring.push(row);
  _subs.forEach((fn) => fn([..._ring].reverse()));
}

function useDiagLogs() {
  const [logs, setLogs] = useState([..._ring].reverse());
  useEffect(() => {
    if (!_hooked) {
      _hooked = true;
      const orig = console.log;
      console.log = (...args) => {
        try {
          const line = args.map((v) => (typeof v === 'string' ? v : JSON.stringify(v))).join(' ');
          if (LOG_FILTER.test(line)) pushLog(line);
        } catch {}
        orig(...args);
      };
    }
    _subs.add(setLogs);
    return () => {
      _subs.delete(setLogs);
    };
  }, []);
  return logs;
}

/** ────────────────────────────────────────────────────────────────────────────
 *  Helpers
 *  ───────────────────────────────────────────────────────────────────────── */
const yesNo = (v) => (v ? 'JA' : 'NEIN');
const fmt = (d) => (d ? new Date(d).toLocaleString() : '—');

async function readAny(keys) {
  for (const k of keys) {
    try {
      const v = await AsyncStorage.getItem(k);
      if (v) return v;
    } catch {}
  }
  return null;
}

async function getChannelsAndroid() {
  if (Platform.OS !== 'android') return [];
  try {
    const ch = await Notifications.getNotificationChannelsAsync();
    return ch || [];
  } catch {
    return [];
  }
}

async function ensureNotifSetup() {
  // Android-Kanal „offers“
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('offers', {
        name: 'Offers',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [200, 120, 200],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        sound: 'default',
      });
      console.log('[push] channel ready: offers');
    } catch (e) {
      console.log('[push] channel error', String(e));
    }
  }

  // Kategorie „offers-actions“ (Identifier klein, passend zum App-Listener)
  try {
    await Notifications.setNotificationCategoryAsync('offers-actions', [
      { identifier: 'go',     buttonTitle: 'Öffnen', options: { isDestructive: false, isAuthenticationRequired: false } },
      { identifier: 'snooze', buttonTitle: 'Später', options: { isDestructive: false } },
      { identifier: 'dismiss',buttonTitle: 'Schließen', options: { isDestructive: true } },
    ]);
    console.log('[push] category ready: offers-actions');
  } catch (e) {
    console.log('[push] category error', String(e));
  }
}

async function getPermSummary() {
  const fg = await Location.getForegroundPermissionsAsync();
  const bg =
    (await Location.getBackgroundPermissionsAsync().catch(() => ({
      status: 'undetermined',
    }))) || {};
  return {
    fg: fg?.status || 'unknown',
    bg: bg?.status || 'unknown',
    can: {
      whenInUse: fg?.granted === true,
      always: bg?.granted === true,
    },
  };
}

async function getBatterySummary() {
  let lowPower = null;
  try {
    const ps = await Battery.getPowerStateAsync();
    lowPower = !!ps?.lowPowerMode;
  } catch {}
  return { lowPowerMode: lowPower };
}

async function isBgTaskActive() {
  try {
    if (await TaskManager.isTaskRegisteredAsync(TASK_NAME))
      return { registered: true, name: TASK_NAME };
    for (const t of ALT_TASKS) {
      if (await TaskManager.isTaskRegisteredAsync(t))
        return { registered: true, name: t };
    }
  } catch {}
  return { registered: false, name: null };
}

async function hasLocationUpdatesRunning() {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TASK_NAME))
      return { running: true, name: TASK_NAME };
    for (const t of ALT_TASKS) {
      if (await Location.hasStartedLocationUpdatesAsync(t))
        return { running: true, name: t };
    }
  } catch {}
  return { running: false, name: null };
}

/** ────────────────────────────────────────────────────────────────────────────
 *  Screen
 *  ───────────────────────────────────────────────────────────────────────── */
export default function DiagnosticsScreen() {
  const logs = useDiagLogs();

  const [perm, setPerm] = useState({
    fg: 'unknown',
    bg: 'unknown',
    can: { whenInUse: false, always: false },
  });
  const [battery, setBattery] = useState({ lowPowerMode: null });
  const [channelInfo, setChannelInfo] = useState([]);
  const [taskReg, setTaskReg] = useState({ registered: false, name: null });
  const [updates, setUpdates] = useState({ running: false, name: null });
  const [lastHeartbeat, setLastHeartbeat] = useState(null);
  const [expoToken, setExpoToken] = useState(null);

  const refresh = async () => {
    console.log('[diag] refresh…');
    const [p, b, ch, tr, up, hb, token] = await Promise.all([
      getPermSummary(),
      getBatterySummary(),
      getChannelsAndroid(),
      isBgTaskActive(),
      hasLocationUpdatesRunning(),
      readAny(HEARTBEAT_KEYS),
      AsyncStorage.getItem('expoPushToken').catch(() => null),
    ]);
    setPerm(p);
    setBattery(b);
    setChannelInfo(ch);
    setTaskReg(tr);
    setUpdates(up);
    setLastHeartbeat(hb);
    setExpoToken(token);
  };

  useEffect(() => {
    refresh();
  }, []);

  const onRequestPerms = async () => {
    try {
      await Location.requestForegroundPermissionsAsync();
      if (Platform.OS === 'android') {
        await Location.requestBackgroundPermissionsAsync();
      }
    } catch {}
    refresh();
  };

  const openBatteryOptimizationSettings = async () => {
    if (Platform.OS !== 'android') {
      Linking.openSettings();
      return;
    }
    try {
      // Hauptpfad: Systemliste der nicht-optimierten Apps
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS
      );
    } catch {
      try {
        // Fallback: Direkte Anfrage zur Ausnahme (erfordert Nutzerbestätigung)
        await IntentLauncher.startActivityAsync(
          'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS'
        );
      } catch {
        try {
          // Letzter Fallback: App-Detailseite öffnen
          await IntentLauncher.startActivityAsync(
            IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
            { data: 'package:' + (Application.applicationId || '') }
          );
        } catch {
          Linking.openSettings();
        }
      }
    }
  };

  const openAppSettings = () => Linking.openSettings();

  const registerNotifStuff = async () => {
    await ensureNotifSetup();
    const ch = await getChannelsAndroid();
    setChannelInfo(ch);
    Alert.alert('Fertig', 'Notification-Kategorie & -Kanal registriert.');
  };

  const showTestPushPayload = () => {
    const payload = {
      to: expoToken || 'ExponentPushToken[DEIN_TOKEN]',
      title: 'Neues Angebot',
      body: 'Tippe ➡️ für Details',
      categoryId: 'offers-actions',
      channelId: 'offers',
      sound: 'default',
      data: { offerId: '68ab50d48c32f32b06d5f766' },
    };
    Alert.alert('Test-Payload (Expo Push)', JSON.stringify(payload, null, 2));
  };

  const heartbeatGPSOnly = async () => {
    try {
      const fix = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        mayShowUserSettingsDialog: true,
      });
      console.log(
        '[heartbeat] local-gps lat=',
        fix.coords.latitude,
        'lng=',
        fix.coords.longitude
      );
      const now = new Date().toISOString();
      setLastHeartbeat(now);
      await AsyncStorage.setItem(HEARTBEAT_KEYS[0], now);
      Alert.alert('Heartbeat (lokal)', `GPS OK @ ${fmt(now)}`);
    } catch (e) {
      Alert.alert('Fehler', 'Konnte Standort nicht abrufen.');
    }
  };

  const heartbeatAPIPing = async () => {
    try {
      const token = await AsyncStorage.getItem('expoPushToken');
      if (!token || !String(token).trim()) {
        Alert.alert(
          'Kein Token',
          'Kein Expo Push-Token gefunden. Öffne die App neu, damit PushInitializer den Token speichert.'
        );
        return;
      }

      const fix = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const body = {
        token: String(token).trim(),
        platform: Platform.OS === 'android' ? 'android' : Platform.OS,
        lat: fix.coords.latitude,
        lng: fix.coords.longitude,
        accuracy:
          typeof fix.coords.accuracy === 'number'
            ? fix.coords.accuracy
            : undefined,
        at: new Date().toISOString(),
      };

      const res = await fetch(`${API_URL}/location/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      console.log('[heartbeat] api status=', res.status);
      const now = new Date().toISOString();
      setLastHeartbeat(now);
      await AsyncStorage.setItem(HEARTBEAT_KEYS[0], now);

      let msg = `Request gesendet (HTTP ${res.status}) @ ${fmt(now)}`;
      try {
        const j = await res.json();
        if (j && typeof j === 'object') {
          msg = `${msg}\n\nAntwort:\n${JSON.stringify(j, null, 2)}`;
        }
      } catch {
        /* ignore parse errors */
      }

      Alert.alert('Heartbeat (API)', msg);
    } catch (e) {
      Alert.alert('Heartbeat (API)', 'Fehler beim Senden – Log prüfen.');
    }
  };

  /** ────────────────────────────────────────────────────────────────────────
   *  Export
   *  ───────────────────────────────────────────────────────────────────── */
  const buildDiagnosticsPayload = () => {
    return {
      timestamp: new Date().toISOString(),
      app: {
        applicationId: Application.applicationId || null,
        nativeVersion: Application.nativeApplicationVersion || null,
        nativeBuild: Application.nativeBuildVersion || null,
        expoVersion: Constants?.expoConfig?.version ?? null,
        executionEnv: Constants?.executionEnvironment ?? null,
      },
      device: {
        platform: Platform.OS,
        osVersion: Platform.Version,
        isDevice: Constants?.isDevice ?? null,
      },
      notifications: {
        expoToken: expoToken || null,
        channels: channelInfo,
      },
      permissions: perm,
      battery,
      background: {
        taskRegistered: taskReg,
        updates,
      },
      heartbeat: {
        lastHeartbeat,
        storageKeys: HEARTBEAT_KEYS,
      },
      config: {
        TASK_NAME,
        ALT_TASKS,
        API_URL,
        LOG_FILTER: String(LOG_FILTER),
        RING_SIZE,
      },
      logs: logs.slice(0, 200),
    };
  };

  const copyAllDiagnostics = async () => {
    try {
      const payload = buildDiagnosticsPayload();
      const text = JSON.stringify(payload, null, 2);
      await Clipboard.setStringAsync(text);
      Alert.alert('Kopiert', 'Diagnostics wurden in die Zwischenablage kopiert.');
    } catch (e) {
      Alert.alert('Fehler', 'Kopieren fehlgeschlagen: ' + (e?.message ?? e));
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 36 }}>
      {/* Export / Support */}
      <Section title="Export & Support">
        <Buttons>
          <Btn text="Alles in Zwischenablage kopieren" onPress={copyAllDiagnostics} />
        </Buttons>
        <Text style={styles.note}>
          Kopiert eine kompakte JSON-Zusammenfassung (App, Gerät, Berechtigungen, Kanäle, Heartbeat, Logs).
        </Text>
      </Section>

      <Section title="Status • Gerät & App">
        <Row label="Plattform" value={Platform.OS === 'android' ? 'Android' : Platform.OS} />
        <Row
          label="Low-Power-Modus"
          value={
            battery.lowPowerMode === null
              ? 'unbekannt'
              : battery.lowPowerMode
              ? 'AKTIV'
              : 'inaktiv'
          }
        />
        <Row
          label="BG-Task registriert"
          value={`${yesNo(taskReg.registered)} ${
            taskReg.name ? `(${taskReg.name})` : ''
          }`}
        />
        <Row
          label="Location Updates laufen"
          value={`${yesNo(updates.running)} ${
            updates.name ? `(${updates.name})` : ''
          }`}
        />
        <Row label="Letzter Heartbeat" value={fmt(lastHeartbeat)} />
      </Section>

      <Section title="Berechtigungen">
        <Row label="Location (WhileInUse)" value={perm.fg} />
        <Row label="Location (Always)" value={perm.bg} />
        <Buttons>
          <Btn text="Berechtigungen anfragen" onPress={onRequestPerms} />
          <Btn text="App-Einstellungen" onPress={openAppSettings} />
        </Buttons>
      </Section>

      <Section title="Akku-Optimierung (Android)">
        <Text style={styles.note}>
          Android kann Background-Location trotz Foreground-Service begrenzen.{'\n'}
          Öffne die Akku-Einstellungen und setze die App auf „Nicht optimieren“.
        </Text>
        <Buttons>
          <Btn text="Akku-Einstellungen öffnen" onPress={openBatteryOptimizationSettings} />
        </Buttons>
      </Section>

      <Section title="Push • Kategorien & Kanäle">
        <Row label="Expo Token" value={expoToken ? 'vorhanden' : '—'} />
        {Platform.OS === 'android' && (
          <View style={{ marginTop: 6 }}>
            <Text style={styles.subhead}>Android-Kanäle:</Text>
            {channelInfo.length === 0 ? (
              <Text style={styles.kv}>—</Text>
            ) : (
              channelInfo.map((c) => (
                <Text key={c.id} style={styles.kv}>
                  • {c.id}  (importance: {c.importance})
                </Text>
              ))
            )}
          </View>
        )}
        <Buttons>
          <Btn text="Kategorie/Kanal registrieren" onPress={registerNotifStuff} />
          <Btn text="Test-Push-Payload" onPress={showTestPushPayload} />
        </Buttons>
      </Section>

      <Section title="Heartbeat">
        <Buttons>
          <Btn text="Heartbeat: nur GPS" onPress={heartbeatGPSOnly} />
          <Btn text="Heartbeat: API-Ping" onPress={heartbeatAPIPing} />
        </Buttons>
      </Section>

      <Section title="Mini-Logs (live)">
        <Text style={styles.note}>
          Gefiltert auf: BGLOC • heartbeat • push • nav-offer • Location • TaskManager
        </Text>
        <View style={styles.logBox}>
          {logs.length === 0 ? (
            <Text style={styles.logLineEmpty}>— keine Einträge —</Text>
          ) : (
            logs.slice(0, 50).map((l, i) => (
              <Text key={i} style={styles.logLine}>
                {l}
              </Text>
            ))
          )}
        </View>
      </Section>
    </ScrollView>
  );
}

/** ────────────────────────────────────────────────────────────────────────────
 *  UI Bits
 *  ───────────────────────────────────────────────────────────────────────── */
function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={{ gap: 8 }}>{children}</View>
    </View>
  );
}

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.k}>{label}</Text>
      <Text style={styles.v}>{value}</Text>
    </View>
  );
}

function Buttons({ children }) {
  return <View style={styles.buttons}>{children}</View>;
}

function Btn({ text, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.btn}>
      <Text style={styles.btnText}>{text}</Text>
    </TouchableOpacity>
  );
}

/** ────────────────────────────────────────────────────────────────────────────
 *  Styles
 *  ───────────────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  section: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  sectionTitle: { color: colors.primary, fontSize: 15, fontWeight: '800', marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  k: { color: '#94a3b8', fontSize: 13 },
  v: { color: '#e5e7eb', fontSize: 13, fontWeight: '700' },
  subhead: { color: '#a5b4fc', fontWeight: '700', marginTop: 8, marginBottom: 4 },
  kv: { color: '#cbd5e1', fontSize: 12 },
  note: { color: '#94a3b8', fontSize: 12, lineHeight: 16 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#334155',
  },
  btnText: { color: '#e5e7eb', fontWeight: '700', fontSize: 12 },
  logBox: {
    marginTop: 8,
    backgroundColor: '#0b1220',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#263041',
    padding: 10,
    maxHeight: 360,
  },
  logLine: { color: '#cbd5e1', fontSize: 11, marginBottom: 6 },
  logLineEmpty: { color: '#64748b', fontSize: 12, fontStyle: 'italic' },
});
