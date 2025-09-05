// stepsmatch/mobile/app/(tabs)/diagnostics.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Clipboard from 'expo-clipboard';
import { sendRoundtripTest } from '../../components/PushInitializer'; // falls vorhanden; ansonsten no-op

// =========================
// Lightweight Log Capture
// =========================
const MAX_LOG_LINES = 1500;
const TAG_RE = /\[(push|BGLOC|GEOFENCE|RECONCILE|LOCAL_PUSH_SHOWN)\]/i;

function formatArg(a) {
  if (a == null) return String(a);
  if (typeof a === 'string') return a;
  try {
    return JSON.stringify(a);
  } catch {
    return String(a);
  }
}

function ts() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * Installiert globales Console-Wrapping EINMALIG.
 * Speichert Zeilen im globalen Puffer `__SM_LOGS__`.
 */
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
    // Immer auch original ausgeben (nützlich im Dev)
    try { orig(...args); } catch {}
  };

  console.log  = wrap(console.log.bind(console),  'LOG');
  console.warn = wrap(console.warn?.bind(console) || console.log.bind(console), 'WARN');
  console.error= wrap(console.error?.bind(console)|| console.log.bind(console), 'ERROR');

  globalThis.__SM_LOG_WRAP__ = true;
}

/** Abfrage aktueller Logs (Array von Strings). */
function getLogs() {
  return Array.isArray(globalThis.__SM_LOGS__) ? globalThis.__SM_LOGS__ : [];
}

/** Löschen des Puffers. */
function clearLogs() {
  if (Array.isArray(globalThis.__SM_LOGS__)) globalThis.__SM_LOGS__.length = 0;
}

// =========================
// Diagnostics Screen
// =========================
export default function Diagnostics() {
  const [logs, setLogs] = useState(() => getLogs());
  const [onlyTagged, setOnlyTagged] = useState(true);
  const scrollerRef = useRef(null);

  useEffect(() => {
    ensureGlobalLogWrap();

    // Poll-basiert updaten (low-tech, genügt für Sichtbarkeit in APK)
    const iv = setInterval(() => {
      const buf = getLogs();
      setLogs(buf.slice(-MAX_LOG_LINES)); // shallow copy
    }, 500);

    return () => clearInterval(iv);
  }, []);

  const filtered = useMemo(() => {
    if (!onlyTagged) return logs;
    return logs.filter((l) => TAG_RE.test(l));
  }, [logs, onlyTagged]);

  const onCopy = async () => {
    try {
      const text = filtered.join('\n');
      await Clipboard.setStringAsync(text || '(keine Logs)');
    } catch {}
  };

  const onClear = () => {
    clearLogs();
    setLogs([]);
  };

  const localNow = async () => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'StepsMatch – Local Test',
        body: 'Sofortige Local-Notification',
        data: { offerId: 'LOCAL_TEST' },
        channelId: 'offers',
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

  const atBottom = () => {
    requestAnimationFrame(() => {
      try {
        scrollerRef.current?.scrollToEnd?.({ animated: false });
      } catch {}
    });
  };

  useEffect(() => {
    atBottom();
  }, [filtered.length]);

  return (
    <View style={s.root}>
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

      <View style={s.actions}>
        <TouchableOpacity style={[s.btnFull, s.bBlue]} onPress={localNow}>
          <Text style={s.bt}>Local Notification (sofort)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btnFull, s.bBlue]} onPress={roundtrip}>
          <Text style={s.bt}>Roundtrip an Backend</Text>
        </TouchableOpacity>
      </View>

      <ScrollView ref={scrollerRef} style={s.logBox} contentContainerStyle={s.logContent}>
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

      <Text style={s.hint}>
        Gefilterte Tags: [push], [BGLOC], [GEOFENCE], [RECONCILE], [LOCAL_PUSH_SHOWN]. Umschalten über „Nur Tags/Alle Logs“.
      </Text>
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

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0f17' },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, backgroundColor: '#0b0f17' },
  h: { fontSize: 20, fontWeight: '800', color: 'white' },
  row: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actions: { padding: 16, gap: 10, backgroundColor: '#0b0f17' },
  btn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 },
  btnFull: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, alignItems: 'center' },
  bBlue: { backgroundColor: '#2c6bed' },
  bGray: { backgroundColor: '#1b2433' },
  bt: { color: 'white', fontWeight: '700' },
  logBox: { flex: 1, backgroundColor: '#0e1421', borderTopWidth: 1, borderTopColor: '#13203a' },
  logContent: { padding: 12 },
  log: { color: '#c9d1d9', fontFamily: 'monospace', marginBottom: 4 },
  logInfo: { color: '#8ab4f8', fontFamily: 'monospace', marginBottom: 4 },
  logHot: { color: '#9ae6b4', fontFamily: 'monospace', marginBottom: 4 },
  logWarn: { color: '#ffd580', fontFamily: 'monospace', marginBottom: 4 },
  logErr: { color: '#ff8b8b', fontFamily: 'monospace', marginBottom: 4 },
  logEmpty: { color: '#7f8ea3', fontStyle: 'italic' },
  hint: { color: '#7f8ea3', padding: 12, fontSize: 12 },
});
