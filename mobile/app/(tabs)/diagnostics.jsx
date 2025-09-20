// stepsmatch/mobile/app/(tabs)/diagnostics.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { sendHeartbeat, kickstartBackgroundLocation } from '../../components/PushInitializer';
import { getPersistentDeviceId, resolveExpoTokenAuthoritative } from '../../components/push/push-state';
import { API_BASE, RESOLVED_PROJECT_ID, BG_LOCATION_TASK, GEOFENCE_TASK } from '../../components/push/push-constants';

// ────────────────────────────────────────────────────────────
// Minimal Diagnostics – fokussiert auf Canary + Identity + Kernaktionen
// Zusätzlich: „Export/Share“ → erzeugt ein JSON mit allen relevanten Parametern
// und (optional) POST an ein Backend-Endpoint, falls vorhanden.
// ────────────────────────────────────────────────────────────

// Lightweight Log Capture (nur relevante Tags)
const MAX_LOG_LINES = 600;
const TAG_RE = /\[(push|BGLOC|GEOFENCE|LOCAL_PUSH_SHOWN)\]/i;

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
  if (globalThis.__SM_LOG_WRAP_MIN__) return;
  const ensureBuffer = () => {
    if (!globalThis.__SM_LOGS_MIN__) globalThis.__SM_LOGS_MIN__ = [];
    return globalThis.__SM_LOGS_MIN__;
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
  globalThis.__SM_LOG_WRAP_MIN__ = true;
}
function getLogs() { return Array.isArray(globalThis.__SM_LOGS_MIN__) ? globalThis.__SM_LOGS_MIN__ : []; }
function clearLogs() { if (Array.isArray(globalThis.__SM_LOGS_MIN__)) globalThis.__SM_LOGS_MIN__.length = 0; }

const take = (s, n = 28) => (s ? String(s).slice(0, n) + (String(s).length > n ? '…' : '') : '–');
const fmtAgo = (t) => {
  if (!t) return '–';
  const age = Date.now() - Number(t);
  const s = Math.floor(age / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h`;
};

// Canary Persistenz (wie PushInitializer)
const CANARY_KEY = 'push.canary.lastAt';
const CANARY_STATUS_KEY = 'push.canary.lastStatus'; // 'ok' | 'fail' | 'skipped'
const CANARY_ERR_KEY = 'push.canary.lastError';     // optionaler Fehlerstring

// Global State (Heartbeat/Geofence-Sync Timestamps)
const GLOBAL_STATE_KEY = 'offerPushState.__global'; // { lastAnyPushAt, lastHeartbeatAt, lastGeofenceSyncAt? }

export default function Diagnostics() {
  // Logs
  const [logs, setLogs] = useState(() => getLogs());
  const [onlyTagged, setOnlyTagged] = useState(true);
  const logScrollerRef = useRef(null);

  // Identity
  const [token, setToken] = useState(null);
  const [deviceId, setDeviceId] = useState(null);

  // Canary
  const [lastAt, setLastAt] = useState(0);
  const [lastStatus, setLastStatus] = useState(null); // 'ok'|'fail'|'skipped'|null
  const [lastError, setLastError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Export JSON Preview
  const [jsonPreview, setJsonPreview] = useState('');

  // Init
  useEffect(() => {
    ensureGlobalLogWrap();
    const iv = setInterval(() => setLogs(getLogs().slice(-MAX_LOG_LINES)), 500);
    return () => clearInterval(iv);
  }, []);

  // Snapshot Identity + Canary
  const snapshot = async () => {
    try {
      const did = await getPersistentDeviceId();
      setDeviceId(did || null);
    } catch {}
    try {
      const tk = await resolveExpoTokenAuthoritative();
      setToken(tk || null);
    } catch {}
    try {
      const la = Number((await AsyncStorage.getItem(CANARY_KEY)) || 0);
      setLastAt(la);
      const st = await AsyncStorage.getItem(CANARY_STATUS_KEY);
      setLastStatus(st || null);
      const err = await AsyncStorage.getItem(CANARY_ERR_KEY);
      setLastError(err || null);
    } catch {}
  };

  useEffect(() => { snapshot(); }, []);

  // Canary Button
  const runCanary = async () => {
    setBusy(true);
    let status = 'fail';
    let errMsg = null;
    try {
      const did = deviceId || (await getPersistentDeviceId());
      const tk = token || (await resolveExpoTokenAuthoritative());

      console.log('[diag.canary] POST /push/canary …');
      const res = await fetch(`${API_BASE}/push/canary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tk, deviceId: did, projectId: RESOLVED_PROJECT_ID }),
      });
      const json = await res.json().catch(() => ({}));
      console.log('[diag.canary] result =>', res.status, JSON.stringify(json));

      status = res.ok && json?.ok === true ? 'ok' : 'fail';
      errMsg = status === 'ok' ? null : (json?.error || `HTTP ${res.status}`);
    } catch (e) {
      errMsg = String(e);
    }

    const now = Date.now();
    setLastAt(now);
    setLastStatus(status);
    setLastError(errMsg);

    try {
      await AsyncStorage.multiSet([
        [CANARY_KEY, String(now)],
        [CANARY_STATUS_KEY, String(status)],
        [CANARY_ERR_KEY, errMsg || ''],
      ]);
    } catch {}

    setBusy(false);
  };

  // Actions
  const heartbeatNow = async () => {
    try {
      if (typeof sendHeartbeat === 'function') {
        await sendHeartbeat('manual');
        console.log('[diag] manual heartbeat sent (→ Geofence-Refresh)');
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
        Linking.openSettings().catch(() => {});
      }
    }
  };

  const openAppNotificationSettings = async () => {
    if (Platform.OS !== 'android') return;
    try {
      await IntentLauncher.startActivityAsync('android.settings.APP_NOTIFICATION_SETTINGS', {
        data: undefined,
        flags: 0,
        extra: {
          'android.provider.extra.APP_PACKAGE': 'com.ecily.mobile',
          'app_package': 'com.ecily.mobile',
          'app_uid': 0,
        },
      });
    } catch {
      Linking.openSettings().catch(() => {});
    }
  };

  // Build a compact diagnostics payload you can copy-paste to me (or into Mongo)
  const buildDiagPayload = async () => {
    const now = new Date().toISOString();

    // read global heartbeats/geofence timestamps
    let gs = {};
    try { gs = JSON.parse((await AsyncStorage.getItem(GLOBAL_STATE_KEY)) || '{}'); } catch {}

    // ask runtime service state lazily (no import costs in UI)
    let bgStarted = false, gfStarted = false;
    try {
      const Location = (await import('expo-location'));
      bgStarted = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK);
      gfStarted = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
    } catch {}

    // identity
    const did = deviceId || (await getPersistentDeviceId());
    const tk = token || (await resolveExpoTokenAuthoritative());

    // logs (tagged only)
    const taggedLogs = (onlyTagged ? logs.filter((l) => TAG_RE.test(l)) : logs).slice(-400);

    return {
      _schema: 'stepsmatch.diagnostics.v1',
      createdAt: now,
      env: {
        platform: Platform.OS,
        projectId: RESOLVED_PROJECT_ID,
        apiBase: API_BASE,
      },
      identity: {
        deviceId: did || null,
        expoToken: tk || null, // wenn gewünscht, vor dem Teilen lokal kürzen
      },
      canary: {
        lastAt: lastAt || 0,
        lastStatus: lastStatus || null,
        lastError: lastError || null,
      },
      runtime: {
        bgLocationStarted: !!bgStarted,
        geofencingStarted: !!gfStarted,
      },
      storage: {
        lastAnyPushAt: Number(gs?.lastAnyPushAt || 0),
        lastHeartbeatAt: Number(gs?.lastHeartbeatAt || 0),
        lastGeofenceSyncAt: Number(gs?.lastGeofenceSyncAt || 0),
      },
      logs: taggedLogs,
    };
  };

  const exportJSON = async () => {
    try {
      const payload = await buildDiagPayload();
      const str = JSON.stringify(payload, null, 2);
      setJsonPreview(str);
      await Clipboard.setStringAsync(str);
      console.log('[diag] JSON payload copied to clipboard');
    } catch (e) {
      console.log('[diag] exportJSON error', String(e));
    }
  };

  // Optional: send to backend for Mongo insertion (if you add a route)
  // Expected backend route: POST /api/diag/ingest { payload }
  const postToBackend = async () => {
    try {
      const payload = await buildDiagPayload();
      const res = await fetch(`${API_BASE}/diag/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload }),
      });
      const json = await res.json().catch(() => ({}));
      console.log('[diag] ingest =>', res.status, JSON.stringify(json));
      if (!res.ok) {
        console.warn('[diag] ingest failed');
      }
    } catch (e) {
      console.log('[diag] ingest error', String(e));
    }
  };

  // Helper: show a ready-to-run cURL you can paste in a shell (if POST endpoint exists)
  const logCurl = async () => {
    try {
      const p = await buildDiagPayload();
      const body = JSON.stringify({ payload: p }).replace(/"/g, '\\"');
      const curl = `curl -X POST "${API_BASE}/diag/ingest" -H "Content-Type: application/json" -d "${body}"`;
      console.log('[diag] curl:\n', curl);
      await Clipboard.setStringAsync(curl);
    } catch {}
  };

  const filtered = useMemo(() => (onlyTagged ? logs.filter((l) => TAG_RE.test(l)) : logs), [logs, onlyTagged]);
  const atBottom = () => { requestAnimationFrame(() => logScrollerRef.current?.scrollToEnd?.({ animated: false })); };
  useEffect(() => { atBottom(); }, [filtered.length]);

  return (
    <View style={s.root}>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.h}>Diagnostics (Minimal)</Text>
          <View style={s.row}>
            <TouchableOpacity style={[s.btn, s.bGray]} onPress={() => setOnlyTagged((v) => !v)}>
              <Text style={s.bt}>{onlyTagged ? 'Alle Logs' : 'Nur Tags'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, s.bGray]} onPress={() => { clearLogs(); setLogs([]); }}>
              <Text style={s.bt}>Logs leeren</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Identity */}
        <Card title="Identity">
          <KV k="DeviceId" v={take(deviceId)} />
          <KV k="Expo Token" v={take(token)} />
          <TouchableOpacity style={[s.btnFull, s.bGray]} onPress={snapshot}>
            <Text style={s.bt}>Aktualisieren</Text>
          </TouchableOpacity>
        </Card>

        {/* Canary */}
        <Card title="Canary Push (End-to-End)">
          <Row verdict={lastStatus === 'ok'} label="Zuletzt" value={lastStatus ? `${lastStatus.toUpperCase()} • ${fmtAgo(lastAt)}` : '–'} />
          {lastStatus === 'fail' && !!lastError && <KV k="Fehler" v={take(lastError, 64)} />}
          <TouchableOpacity style={[s.btnFull, s.bBlue, busy && s.bDisabled]} onPress={busy ? undefined : runCanary}>
            <Text style={s.bt}>{busy ? 'Test läuft…' : 'Canary testen'}</Text>
          </TouchableOpacity>
        </Card>

        {/* Actions */}
        <Card title="Aktionen">
          <TouchableOpacity style={[s.btnFull, s.bBlue]} onPress={heartbeatNow}>
            <Text style={s.bt}>Heartbeat jetzt (→ Geofence-Refresh)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btnFull, s.bGray]} onPress={restartBg}>
            <Text style={s.bt}>BG Location (re)starten</Text>
          </TouchableOpacity>

          {Platform.OS === 'android' && (
            <View style={{ gap: 8 }}>
              <TouchableOpacity style={[s.btnFull, s.bGray]} onPress={openAppNotificationSettings}>
                <Text style={s.bt}>App-Benachrichtigungen öffnen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btnFull, s.bGray]} onPress={openIgnoreBatteryOptimizations}>
                <Text style={s.bt}>Akku-Optimierung öffnen</Text>
              </TouchableOpacity>
            </View>
          )}
        </Card>

        {/* Export / Share */}
        <Card title="Export / Share (JSON)">
          <TouchableOpacity style={[s.btnFull, s.bBlue]} onPress={exportJSON}>
            <Text style={s.bt}>JSON kopieren & Vorschau aktualisieren</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btnFull, s.bGray]} onPress={logCurl}>
            <Text style={s.bt}>cURL in Zwischenablage (optional /diag/ingest)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btnFull, s.bGray]} onPress={postToBackend}>
            <Text style={s.bt}>An Backend senden (optional)</Text>
          </TouchableOpacity>

          {/* Kompakte JSON-Vorschau, komplett selektierbar */}
          {jsonPreview ? (
            <View style={s.jsonBox}>
              <Text selectable style={s.jsonText}>{jsonPreview}</Text>
            </View>
          ) : (
            <Text style={s.hint}>Drücke „JSON kopieren“, um eine teilbare Diagnose zu erzeugen.</Text>
          )}

          <Text style={s.hintSmall}>
            Tipp: Dieses JSON kannst du mir hier per Copy/Paste schicken – oder in MongoDB (Compass) als Dokument einfügen.
          </Text>
        </Card>

        {/* Logs – kompakt */}
        <View style={s.logWrapper}>
          <Text style={s.cardTitle}>Logs</Text>
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
          <Text style={s.hint}>
            Gefilterte Tags: [push], [BGLOC], [GEOFENCE], [LOCAL_PUSH_SHOWN].
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ────────────────────────────────────────────────────────────
// UI Bits
// ────────────────────────────────────────────────────────────
function Row({ verdict, label, value }) {
  return (
    <View style={s.kvRow}>
      <Text style={s.kvK}>{label}</Text>
      <Text style={[s.kvV, verdict ? s.good : s.bad]}>{String(value)}</Text>
    </View>
  );
}
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
      <View style={{ marginTop: 8, gap: 8 }}>{children}</View>
    </View>
  );
}
function lineStyle(line) {
  if (/\[ERROR\]/.test(line)) return s.logErr;
  if (/\[WARN\]/.test(line)) return s.logWarn;
  if (/\[(GEOFENCE|LOCAL_PUSH_SHOWN)\]/i.test(line)) return s.logHot;
  if (/\[(push|BGLOC)\]/i.test(line)) return s.logInfo;
  return s.log;
}

// ────────────────────────────────────────────────────────────
/** Styles */
// ────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0f17' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },

  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, backgroundColor: '#0b0f17' },
  h: { fontSize: 20, fontWeight: '800', color: 'white' },
  row: { flexDirection: 'row', gap: 8, marginTop: 10 },

  btn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 },
  btnFull: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, alignItems: 'center' },
  bBlue: { backgroundColor: '#2c6bed' },
  bGray: { backgroundColor: '#1b2433' },
  bDisabled: { opacity: 0.6 },

  bt: { color: 'white', fontWeight: '700' },

  card: { backgroundColor: '#101827', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#13203a', marginHorizontal: 16, marginTop: 12 },
  cardTitle: { color: 'white', fontWeight: '800', fontSize: 14, marginHorizontal: 16, marginTop: 16 },

  kvRow: { flexDirection: 'row', justifyContent: 'space-between' },
  kvK: { color: '#93a4bd' },
  kvV: { color: '#e4ecf7', fontWeight: '700' },
  good: { color: '#9ae6b4' },
  bad: { color: '#ff8b8b' },

  jsonBox: {
    backgroundColor: '#0e1421',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#13203a',
    padding: 12,
    maxHeight: 260,
  },
  jsonText: { color: '#c9d1d9', fontFamily: 'monospace' },

  logWrapper: { paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  logBox: {
    backgroundColor: '#0e1421',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#13203a',
    maxHeight: 320,
  },
  logContent: { padding: 12 },
  log: { color: '#c9d1d9', fontFamily: 'monospace', marginBottom: 4 },
  logInfo: { color: '#8ab4f8', fontFamily: 'monospace', marginBottom: 4 },
  logHot: { color: '#9ae6b4', fontFamily: 'monospace', marginBottom: 4 },
  logWarn: { color: '#ffd580', fontFamily: 'monospace', marginBottom: 4 },
  logErr: { color: '#ff8b8b', fontFamily: 'monospace', marginBottom: 4 },
  logEmpty: { color: '#7f8ea3', fontStyle: 'italic', padding: 12 },

  hint: { color: '#7f8ea3', paddingTop: 6, fontSize: 12 },
  hintSmall: { color: '#7f8ea3', paddingTop: 6, fontSize: 11 },
});
