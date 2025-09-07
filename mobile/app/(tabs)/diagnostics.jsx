// stepsmatch/mobile/app/(tabs)/diagnostics.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Clipboard from 'expo-clipboard';
import * as Location from 'expo-location';
import * as IntentLauncher from 'expo-intent-launcher';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { sendRoundtripTest, sendHeartbeat, kickstartBackgroundLocation } from '../../components/PushInitializer';

// =========================
// Lightweight Log Capture
// =========================
const MAX_LOG_LINES = 1500;
const TAG_RE = /\[(push|BGLOC|GEOFENCE|RECONCILE|LOCAL_PUSH_SHOWN)\]/i;

function formatArg(a) {
  if (a == null) return String(a);
  if (typeof a === 'string') return a;
  try { return JSON.stringify(a); } catch { return String(a); }
}
function ts() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
/** Install once */
function ensureGlobalLogWrap() {
  if (globalThis.__SM_LOG_WRAP__) return;
  const ensureBuffer = () => {
    if (!globalThis.__SM_LOGS__) globalThis.__SM_LOGS__ = [];
    return globalThis.__SM_LOGS__;
  };
  const wrap = (orig, level) => (...args) => {
    try {
      const line = `[${level}] ${ts()} ${args.map(formatArg).join(' ')}`;
      const buf = ensureBuffer();
      buf.push(line);
      if (buf.length > MAX_LOG_LINES) buf.splice(0, buf.length - MAX_LOG_LINES);
    } catch {}
    try { orig(...args); } catch {}
  };
  console.log   = wrap(console.log.bind(console),   'LOG');
  console.warn  = wrap(console.warn?.bind(console)  || console.log.bind(console), 'WARN');
  console.error = wrap(console.error?.bind(console) || console.log.bind(console), 'ERROR');
  globalThis.__SM_LOG_WRAP__ = true;
}
function getLogs() { return Array.isArray(globalThis.__SM_LOGS__) ? globalThis.__SM_LOGS__ : []; }
function clearLogs() { if (Array.isArray(globalThis.__SM_LOGS__)) globalThis.__SM_LOGS__.length = 0; }

// =========================
// Helpers (Diagnostics Data)
// =========================
const TOKEN_KEY = 'expoPushToken.v2';
const DEVICE_ID_SECURE_KEY = 'deviceId.v1';
const GLOBAL_STATE_KEY = 'offerPushState.__global'; // { lastAnyPushAt, lastHeartbeatAt }

const BG_CHANNEL_ID = 'com.ecily.mobile:stepsmatch-bg-location-task';
const DEFAULT_CHANNEL_ID = 'stepsmatch-default-v2';
const OFFERS_CHANNEL_ID = 'offers';

const fmtMsAge = (t) => {
  if (!t) return '–';
  const age = Date.now() - Number(t);
  const s = Math.floor(age / 1000);
  return `${s}s ago`;
};

const take = (s, n=8) => (s ? String(s).slice(0, n) + (String(s).length>n ? '…' : '') : '–');

// =========================
// Diagnostics Screen
// =========================
export default function Diagnostics() {
  const [logs, setLogs] = useState(() => getLogs());
  const [onlyTagged, setOnlyTagged] = useState(true);
  const logScrollerRef = useRef(null);

  const [notifPerm, setNotifPerm] = useState('unknown');
  const [locPerm, setLocPerm] = useState({ fg: 'unknown', bg: 'unknown' });

  const [bgStarted, setBgStarted] = useState(false);
  const [gfStarted, setGfStarted] = useState(false);

  const [lastFixAt, setLastFixAt] = useState(0);
  const [lastHeartbeatAt, setLastHeartbeatAt] = useState(0);

  const [lastKnown, setLastKnown] = useState(null);
  const [token, setToken] = useState(null);
  const [deviceId, setDeviceId] = useState(null);

  const [channels, setChannels] = useState([]);

  // ---- poll logs every 500ms
  useEffect(() => {
    ensureGlobalLogWrap();
    const iv = setInterval(() => setLogs(getLogs().slice(-MAX_LOG_LINES)), 500);
    return () => clearInterval(iv);
  }, []);

  const filtered = useMemo(() => (onlyTagged ? logs.filter((l) => TAG_RE.test(l)) : logs), [logs, onlyTagged]);

  const onCopy = async () => {
    try { await Clipboard.setStringAsync((filtered || []).join('\n') || '(keine Logs)'); } catch {}
  };
  const onClear = () => { clearLogs(); setLogs([]); };

  // ---- refresh diagnostics snapshot
  const snapshot = async () => {
    try {
      const pre = await Notifications.getPermissionsAsync();
      setNotifPerm(pre?.status || 'unknown');
    } catch {}

    try {
      const fg = await Location.getForegroundPermissionsAsync();
      const bg = await Location.getBackgroundPermissionsAsync();
      setLocPerm({ fg: fg?.status || 'unknown', bg: bg?.status || 'unknown' });
    } catch {}

    try {
      setBgStarted(await Location.hasStartedLocationUpdatesAsync('stepsmatch-bg-location-task'));
    } catch { setBgStarted(false); }
    try {
      setGfStarted(await Location.hasStartedGeofencingAsync('stepsmatch-geofence-task'));
    } catch { setGfStarted(false); }

    try {
      const lf = Number(await AsyncStorage.getItem('lastFixAt') || 0);
      setLastFixAt(lf);
    } catch { setLastFixAt(0); }
    try {
      const g = JSON.parse((await AsyncStorage.getItem(GLOBAL_STATE_KEY)) || '{}');
      setLastHeartbeatAt(Number(g?.lastHeartbeatAt || 0));
    } catch { setLastHeartbeatAt(0); }

    try {
      const pos = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000, requiredAccuracy: 400 });
      setLastKnown(pos || null);
    } catch { setLastKnown(null); }

    try {
      const cached = await AsyncStorage.getItem(TOKEN_KEY);
      setToken(cached || null);
    } catch {}

    try {
      const did = await SecureStore.getItemAsync(DEVICE_ID_SECURE_KEY);
      setDeviceId(did || null);
    } catch {}

    if (Platform.OS === 'android') {
      try {
        const list = await Notifications.getNotificationChannelsAsync();
        setChannels(Array.isArray(list) ? list : []);
      } catch { setChannels([]); }
    }
  };

  useEffect(() => {
    snapshot();
    const iv = setInterval(snapshot, 3000);
    return () => clearInterval(iv);
  }, []);

  const localNow = async () => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'StepsMatch – Local Test',
        body: 'Sofortige Local-Notification',
        data: { offerId: 'LOCAL_TEST' },
        android: { channelId: OFFERS_CHANNEL_ID },
        categoryIdentifier: 'offer-go',
      },
      trigger: null,
    });
    console.log('[diag] scheduled local notification');
  };

  const roundtrip = async () => {
    try {
      if (typeof sendRoundtripTest === 'function') {
        await sendRoundtripTest({ offerId: 'ROUNDTRIP_TEST' });
      } else {
        console.log('[diag] sendRoundtripTest not available (no-op)');
      }
    } catch (e) {
      console.log('[diag] roundtrip error', String(e));
    }
  };

  const heartbeatNow = async () => {
    try {
      if (typeof sendHeartbeat === 'function') {
        await sendHeartbeat('manual');
        console.log('[diag] manual heartbeat sent (also triggers geofence refresh)');
        await snapshot();
      } else {
        console.log('[diag] sendHeartbeat not available');
      }
    } catch (e) {
      console.log('[diag] heartbeat error', String(e));
    }
  };

  const restartBg = async () => {
    try {
      if (typeof kickstartBackgroundLocation === 'function') {
        await kickstartBackgroundLocation();
        console.log('[diag] kickstartBackgroundLocation invoked');
        await snapshot();
      } else {
        console.log('[diag] kickstartBackgroundLocation not available');
      }
    } catch (e) {
      console.log('[diag] restartBg error', String(e));
    }
  };

  const openIgnoreBatteryOptimizations = async () => {
    if (Platform.OS !== 'android') return;
    try {
      await IntentLauncher.startActivityAsync('android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS');
    } catch {
      try {
        await IntentLauncher.startActivityAsync('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS');
      } catch {
        Linking.openSettings().catch(()=>{});
      }
    }
  };

  const atBottom = () => { requestAnimationFrame(() => logScrollerRef.current?.scrollToEnd?.({ animated: false })); };
  useEffect(() => { atBottom(); }, [filtered.length]);

  // ===== Render =====
  return (
    <View style={s.root}>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.h}>Diagnostics</Text>
          <View style={s.row}>
            <TouchableOpacity style={[s.btn, s.bGray]} onPress={() => setOnlyTagged((v) => !v)}>
              <Text style={s.bt}>{onlyTagged ? 'Alle Logs' : 'Nur Tags'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, s.bGray]} onPress={onClear}>
              <Text style={s.bt}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, s.bBlue]} onPress={onCopy}>
              <Text style={s.bt}>Copy</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Actions – nach oben gezogen, sofort sichtbar */}
        <View style={s.actions}>
          <TouchableOpacity style={[s.btnFull, s.bBlue]} onPress={heartbeatNow}>
            <Text style={s.bt}>Heartbeat jetzt (→ Geofence-Refresh)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btnFull, s.bGray]} onPress={restartBg}>
            <Text style={s.bt}>BG Location (re)starten</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btnFull, s.bBlue]} onPress={localNow}>
            <Text style={s.bt}>Lokale Notification (sofort)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btnFull, s.bBlue]} onPress={roundtrip}>
            <Text style={s.bt}>Roundtrip an Backend</Text>
          </TouchableOpacity>
          {Platform.OS === 'android' && (
            <TouchableOpacity style={[s.btnFull, s.bGray]} onPress={openIgnoreBatteryOptimizations}>
              <Text style={s.bt}>Akku-Optimierung ausschalten</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Status Cards */}
        <View style={s.cards}>
          <Card title="Permissions">
            <KV k="Notifications" v={notifPerm} />
            <KV k="Location FG" v={locPerm.fg} />
            <KV k="Location BG" v={locPerm.bg} />
          </Card>

          <Card title="Background Services">
            <KV k="BG Location started" v={String(bgStarted)} />
            <KV k="Geofencing started" v={String(gfStarted)} />
            <KV k="lastFixAt" v={fmtMsAge(lastFixAt)} />
            <KV k="lastHeartbeatAt" v={fmtMsAge(lastHeartbeatAt)} />
          </Card>

          <Card title="Position (lastKnown)">
            <KV k="lat" v={lastKnown?.coords?.latitude?.toFixed?.(5) ?? '–'} />
            <KV k="lng" v={lastKnown?.coords?.longitude?.toFixed?.(5) ?? '–'} />
            <KV k="acc" v={lastKnown?.coords?.accuracy != null ? `${Math.round(lastKnown.coords.accuracy)} m` : '–'} />
            <KV k="age" v={lastKnown?.timestamp ? fmtMsAge(lastKnown.timestamp) : '–'} />
          </Card>

          <Card title="Identity">
            <KV k="Expo Token" v={take(token, 28)} />
            <KV k="DeviceId" v={take(deviceId, 28)} />
          </Card>

          {Platform.OS === 'android' && (
            <Card title="Android Channels">
              {channels.length === 0 ? (
                <Text style={s.kvV}>–</Text>
              ) : (
                channels.map((c) => (
                  <Text key={c.id} style={s.kvV}>
                    {c.id}{'  '}
                    <Text style={s.kvDim}>
                      importance={c.importance} sound={c.sound || 'none'} bypassDnd={String(c.bypassDnd || false)}
                    </Text>
                  </Text>
                ))
              )}
              {/* Quick sanity hints */}
              <Text style={s.hintSmall}>
                Erwartet: {BG_CHANNEL_ID} importance ≥ DEFAULT, {OFFERS_CHANNEL_ID} importance MAX
              </Text>
            </Card>
          )}
        </View>

        {/* Logs – eigene Scroll-Area mit begrenzter Höhe */}
        <View style={s.logWrapper}>
          <ScrollView
            ref={logScrollerRef}
            style={s.logBox}
            contentContainerStyle={s.logContent}
            nestedScrollEnabled
          >
            {filtered.length === 0 ? (
              <Text style={s.logEmpty}>Keine Logs vorhanden.</Text>
            ) : (
              filtered.map((line, i) => (
                <Text key={i} style={lineStyle(line)} selectable>
                  {line}
                </Text>
              ))
            )}
          </ScrollView>
        </View>

        <Text style={s.hint}>
          Gefilterte Tags: [push], [BGLOC], [GEOFENCE], [RECONCILE], [LOCAL_PUSH_SHOWN]. Umschalten über „Nur Tags/Alle Logs“.
        </Text>
      </ScrollView>
    </View>
  );
}

// ===== UI Bits
function KV({ k, v }) {
  return (
    <View style={s.kvRow}>
      <Text style={s.kvK}>{k}</Text>
      <Text style={s.kvV}>{String(v)}</Text>
    </View>
  );
}
function Card({ title, children }) {
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>{title}</Text>
      <View style={{ marginTop: 8, gap: 4 }}>{children}</View>
    </View>
  );
}
function lineStyle(line) {
  if (/\[ERROR\]/.test(line)) return s.logErr;
  if (/\[WARN\]/.test(line)) return s.logWarn;
  if (/\[(GEOFENCE|RECONCILE|LOCAL_PUSH_SHOWN)\]/i.test(line)) return s.logHot;
  if (/\[(push|BGLOC)\]/i.test(line)) return s.logInfo;
  return s.log;
}

// ===== Styles
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0f17' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },

  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, backgroundColor: '#0b0f17' },
  h: { fontSize: 20, fontWeight: '800', color: 'white' },
  row: { flexDirection: 'row', gap: 8, marginTop: 10 },

  actions: { padding: 16, gap: 10, backgroundColor: '#0b0f17' },

  btn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 },
  btnFull: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, alignItems: 'center' },

  bBlue: { backgroundColor: '#2c6bed' },
  bGray: { backgroundColor: '#1b2433' },

  bt: { color: 'white', fontWeight: '700' },

  cards: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  card: { backgroundColor: '#101827', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#13203a' },
  cardTitle: { color: 'white', fontWeight: '800', fontSize: 14, marginBottom: 2 },

  kvRow: { flexDirection: 'row', justifyContent: 'space-between' },
  kvK: { color: '#93a4bd' },
  kvV: { color: '#e4ecf7', fontWeight: '700' },
  kvDim: { color: '#93a4bd' },

  logWrapper: { paddingHorizontal: 16, paddingTop: 8 },
  logBox: {
    backgroundColor: '#0e1421',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#13203a',
    maxHeight: 360,
  },
  logContent: { padding: 12 },
  log: { color: '#c9d1d9', fontFamily: 'monospace', marginBottom: 4 },
  logInfo: { color: '#8ab4f8', fontFamily: 'monospace', marginBottom: 4 },
  logHot: { color: '#9ae6b4', fontFamily: 'monospace', marginBottom: 4 },
  logWarn: { color: '#ffd580', fontFamily: 'monospace', marginBottom: 4 },
  logErr: { color: '#ff8b8b', fontFamily: 'monospace', marginBottom: 4 },
  logEmpty: { color: '#7f8ea3', fontStyle: 'italic' },

  hint: { color: '#7f8ea3', padding: 12, fontSize: 12 },
  hintSmall: { color: '#7f8ea3', paddingTop: 8, fontSize: 11 },
});
