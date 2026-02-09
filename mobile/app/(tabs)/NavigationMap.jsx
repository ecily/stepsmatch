// stepsmatch/mobile/app/(tabs)/NavigationMap.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '../../theme/colors';
import mapStyleStepsmatchLight from '../../theme/mapStyleDark';
import { isOfferActiveNow } from '../../utils/isOfferActiveNow';
import Constants from 'expo-constants';

const API_BASE_URL = (Constants.expoConfig?.extra?.apiBase || 'https://lobster-app-ie9a5.ondigitalocean.app/api').replace(/\/$/, '');
const FALLBACK_CENTER = { latitude: 47.0707, longitude: 15.4395 };
const VISIBLE_RADIUS_M = 2000; // 2 km (Offer-Radius wird ignoriert)
const WALKING_SPEED_MPS = 1.33;

/* Geo helpers */
const toRad = (deg) => (deg * Math.PI) / 180;
const haversineM = (a, b) => {
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const aa = s1 * s1 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * s2 * s2;
  return 2 * R * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
};
const fmtDistance = (m) => (m < 995 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);
const etaMin = (m) => Math.max(1, Math.ceil(m / (WALKING_SPEED_MPS * 60)));

function regionForRadius(center, radiusM) {
  const lat = center.latitude;
  const deltaLat = (radiusM * 2) / 111_000;
  const cosLat = Math.max(0.1, Math.cos(toRad(lat)));
  const deltaLng = deltaLat / cosLat;
  return {
    latitude: center.latitude,
    longitude: center.longitude,
    latitudeDelta: Math.min(0.2, Math.max(0.003, deltaLat * 1.2)),
    longitudeDelta: Math.min(0.2, Math.max(0.003, deltaLng * 1.2)),
  };
}

/* Offer helpers */
function pickOfferLocation(offer) {
  const coords = offer?.location?.coordinates || offer?.provider?.location?.coordinates || null;
  if (Array.isArray(coords) && coords.length >= 2) {
    const [lng, lat] = coords;
    const latN = Number(lat), lngN = Number(lng);
    if (Number.isFinite(latN) && Number.isFinite(lngN)) return { latitude: latN, longitude: lngN };
  }
  return null;
}

function getRemainingMs(offer) {
  const keys = ['activeUntil','activeEnd','validUntil','endAt','validTo','dateTo','activeWindowEnd','endTime'];
  const vd = offer?.validDates;
  if (vd && typeof vd === 'object') {
    const toRaw = vd.to ?? vd.end ?? vd.toDate ?? vd.endDate;
    if (toRaw) {
      const d = new Date(toRaw); if (!isNaN(d)) { const diff = d.getTime() - Date.now(); if (diff > 0) return diff; }
    }
  }
  for (const k of keys) {
    const v = offer?.[k]; if (!v) continue;
    const d = new Date(v); if (!isNaN(d)) { const diff = d.getTime() - Date.now(); if (diff > 0) return diff; }
  }
  return null;
}
function formatRemaining(diffMs) {
  if (diffMs == null) return '—';
  const totalMin = Math.ceil(diffMs / 60000);
  if (totalMin <= 0) return '—';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}\u00A0min`;
  if (m === 0) return `${h}\u00A0h`;
  return `${h}\u00A0h ${m}\u00A0min`;
}

function isInDateWindow(offer) {
  const vd = offer?.validDates;
  if (!vd) return false;
  const now = Date.now();
  const from = vd.from ?? vd.start ?? vd.dateFrom ?? vd.startDate;
  const to   = vd.to   ?? vd.end   ?? vd.dateTo   ?? vd.endDate;
  const f = from ? new Date(from).getTime() : -Infinity;
  const t = to   ? new Date(to).getTime()   : +Infinity;
  return now >= f && now <= t;
}

/* Sichtbarkeit: kein Zeitfenster → immer; sonst isOfferActiveNow ODER Datumsfenster */
function isOfferVisibleByValidity(offer) {
  const hasDates = !!offer?.validDates;
  const hasTimes = !!offer?.validTimes;
  if (!hasDates && !hasTimes) return true;
  return isOfferActiveNow(offer, 'Europe/Vienna') || isInDateWindow(offer);
}

function formatValidity(offer) {
  const vd = offer?.validDates || {};
  const vt = offer?.validTimes || {};
  const from = vd.from ?? vd.start ?? vd.dateFrom ?? vd.startDate;
  const to   = vd.to   ?? vd.end   ?? vd.dateTo   ?? vd.endDate;
  const dFmt = (v) => { try { return v ? new Date(v).toLocaleDateString('de-AT') : null; } catch { return null; } };
  const timeFrom = vt.from || vt.start || null;
  const timeTo   = vt.to   || vt.end   || null;
  const parts = [];
  const df = dFmt(from), dt = dFmt(to);
  if (df || dt) parts.push([df || '—', dt || '—'].join(' – '));
  if (timeFrom || timeTo) parts.push([timeFrom || '00:00', timeTo || '23:59'].join('–'));
  return parts.length ? parts.join(', ') : '—';
}

export default function NavigationMap() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [userPos, setUserPos] = useState(null);
  const [loadingPos, setLoadingPos] = useState(true);

  const [rawOffers, setRawOffers] = useState([]);
  const [loadingOffers, setLoadingOffers] = useState(true);

  const [selectedRow, setSelectedRow] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const mapRef = useRef(null);
  const posSubRef = useRef(null);
  const firstFixDoneRef = useRef(false);

  /* Standort laden + live verfolgen */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingPos(true);
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { setUserPos(null); setPermissionDenied(true); return; }

        const loc = await Location.getCurrentPositionAsync({});
        if (!mounted) return;
        const first = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setUserPos(first);

        try {
          mapRef.current?.animateToRegion(regionForRadius(first, VISIBLE_RADIUS_M), 500);
          firstFixDoneRef.current = true;
        } catch {}

        posSubRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 5 },
          (l) => {
            const p = { latitude: l.coords.latitude, longitude: l.coords.longitude };
            setUserPos(p);
            try { mapRef.current?.animateToRegion(regionForRadius(p, VISIBLE_RADIUS_M), 350); } catch {}
            if (!firstFixDoneRef.current) firstFixDoneRef.current = true;
          }
        );
      } finally {
        if (mounted) setLoadingPos(false);
      }
    })();
    return () => { mounted = false; try { posSubRef.current?.remove?.(); } catch {}; posSubRef.current = null; };
  }, []);

  // Offers laden
  const loadOffers = useCallback(async () => {
    const url = `${API_BASE_URL}/offers?withProvider=1&page=1&limit=300`;
    try {
      setLoadingOffers(true);
      const tokenKeys = ['authToken', 'token', 'jwt', 'accessToken'];
      let token = null;
      for (const tk of tokenKeys) {
        const t = await AsyncStorage.getItem(tk);
        if (t && String(t).trim()) { token = t.trim(); break; }
      }
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const text = await res.text();
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch {}
      const rows =
        (json?.offers && Array.isArray(json.offers) && json.offers) ||
        (json?.data?.offers && Array.isArray(json.data.offers) && json.data.offers) ||
        (Array.isArray(json?.data) && json.data) ||
        (Array.isArray(json?.rows) && json.rows) ||
        (Array.isArray(json) && json) ||
        [];
      setRawOffers(rows || []);
      console.log('[NAVMAP] offers.loaded', rows?.length || 0);
    } catch (e) {
      console.log('[NAVMAP] offers.error', String(e));
      setRawOffers([]);
    } finally {
      setLoadingOffers(false);
    }
  }, []);
  useEffect(() => { loadOffers(); }, [loadOffers]);

  // Rows berechnen (Offer-Radius ignoriert)
  const computedRows = useMemo(() => {
    const user = userPos;
    return (rawOffers || []).map((offer) => {
      const loc = pickOfferLocation(offer);
      const distanceM = (user && loc) ? haversineM(user, loc) : Number.POSITIVE_INFINITY;
      const include = !!loc && isOfferVisibleByValidity(offer);
      const remainingMs = getRemainingMs(offer);
      return { offer, loc, distanceM, include, remainingMs, eta: Number.isFinite(distanceM) ? etaMin(distanceM) : null };
    });
  }, [rawOffers, userPos]);

  // innerhalb 2 km um den User
  const visibleRows = useMemo(
    () => computedRows.filter((r) => r.include && r.distanceM <= VISIBLE_RADIUS_M).sort((a, b) => a.distanceM - b.distanceM),
    [computedRows]
  );

  // Fit auf User + Marker sobald Position/Offers da
  const inViewFitAll = useCallback(() => {
    if (!mapRef.current) return;
    const coords = [...visibleRows.map(r => r.loc).filter(Boolean), ...(userPos ? [userPos] : [])];
    if (!coords.length) return;
    try {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 80 + insets.top, right: 40, bottom: 200 + insets.bottom, left: 40 },
        animated: true,
      });
    } catch {}
  }, [visibleRows, userPos, insets]);
  useEffect(() => { if (firstFixDoneRef.current) inViewFitAll(); }, [inViewFitAll, firstFixDoneRef.current]);

  const onMarkerPress = (row) => setSelectedRow(row);

  const onGoNavigateOffer = useCallback((row) => {
    const id = row?.offer?._id || row?.offer?.id;
    if (!id) return;
    router.push(`/NavigationScreen?id=${id}`);
  }, [router]);

  const recenter = () => {
    const c = userPos || FALLBACK_CENTER;
    try { mapRef.current?.animateToRegion(regionForRadius(c, VISIBLE_RADIUS_M), 350); } catch {}
  };

  /* ---------- RENDER ---------- */
  const showEmpty = !loadingOffers && visibleRows.length === 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          provider={PROVIDER_GOOGLE}
          initialRegion={regionForRadius(userPos ?? FALLBACK_CENTER, VISIBLE_RADIUS_M)}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass={false}
          toolbarEnabled={false}
          zoomControlEnabled={false}
          showsIndoorLevelPicker={false}
          customMapStyle={mapStyleStepsmatchLight}
          accessibilityRole="image"
          accessibilityLabel="Karte mit Angeboten in deiner Nähe"
          testID="navmap-map"
        >
          {userPos && (
            <>
              <Circle
                center={userPos}
                radius={VISIBLE_RADIUS_M}
                strokeColor="rgba(15,227,169,0.45)"
                fillColor="rgba(15,227,169,0.07)"
              />
              <Circle
                center={userPos}
                radius={80}
                strokeColor="rgba(15,227,169,0.9)"
                fillColor="rgba(15,227,169,0.18)"
              />
            </>
          )}

          {/* Standard-Pins (keine Custom-Views) → sichtbar/performant auf Android */}
          {visibleRows.map((r) => {
            const o = r.offer;
            const key = o?._id || o?.id || `${r.loc.latitude},${r.loc.longitude}-${o?.name}`;
            return (
              <Marker
                key={key}
                coordinate={r.loc}
                pinColor={colors.primary}
                tracksViewChanges={true}
                onPress={() => onMarkerPress(r)}
                title={o?.name || 'Angebot'}
                description={`${o?.category || '—'} • ${o?.subcategory || '—'}`}
              />
            );
          })}
        </MapView>

        {(loadingPos || loadingOffers) && (
          <View style={[styles.loading, { top: insets.top + 12 }]}>
            <ActivityIndicator size="small" />
            <Text style={styles.loadingText}>
              {loadingPos ? 'Position… ' : ''}{loadingOffers ? 'Angebote…' : ''}
            </Text>
          </View>
        )}

        {/* Standort abgelehnt */}
        {permissionDenied && !loadingPos && (
          <View style={[styles.denied, { top: insets.top + 56 }]}>
            <Text style={styles.deniedText}>
              Standort ist deaktiviert. Bitte in den Einstellungen erlauben.
            </Text>
            <TouchableOpacity
              onPress={() => Location.enableNetworkProviderAsync?.()}
              style={styles.deniedBtn}
              accessibilityRole="button"
              accessibilityLabel="Einstellungen öffnen"
              testID="navmap-open-settings"
            >
              <Text style={styles.deniedBtnText}>Einstellungen öffnen</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Bottom-Sheet – Offer-Details */}
        {selectedRow && (
          <View style={[styles.cardWrap, { paddingBottom: 12 + insets.bottom }]} pointerEvents="box-none">
            <View style={styles.card}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {selectedRow.offer?.name || 'Angebot'}
              </Text>

              <View style={{ height: 8 }} />

              <View style={styles.row}>
                <Text style={styles.label}>Kategorie</Text>
                <Text style={styles.value}>{selectedRow.offer?.category || '—'}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Subkategorie</Text>
                <Text style={styles.value}>{selectedRow.offer?.subcategory || '—'}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Entfernung</Text>
                <Text style={styles.value}>
                  {Number.isFinite(selectedRow.distanceM) ? fmtDistance(selectedRow.distanceM) : '—'}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Gehzeit</Text>
                <Text style={styles.value}>
                  {Number.isFinite(selectedRow.distanceM) ? `${etaMin(selectedRow.distanceM)} min` : '—'}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Gültigkeit</Text>
                <Text style={[styles.value, { flexShrink: 1 }]} numberOfLines={1}>
                  {formatValidity(selectedRow.offer)}
                </Text>
              </View>

              <View style={{ height: 10 }} />
              <Text style={styles.sectionTitle}>Beschreibung</Text>
              <View style={{ height: 6 }} />
              <Text style={{ color: '#cfe0ff', fontSize: 13 }}>
                {selectedRow.offer?.description || '—'}
              </Text>

              <View style={{ height: 12 }} />
              <View style={styles.actions}>
                <TouchableOpacity
                  onPress={() => onGoNavigateOffer(selectedRow)}
                  style={[styles.btn, styles.btnPrimary]}
                  accessibilityRole="button"
                  accessibilityLabel="Route in App starten"
                >
                  <Text style={styles.btnPrimaryText}>Route</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setSelectedRow(null)}
                  style={[styles.btn, styles.btnGhost]}
                  accessibilityRole="button"
                  accessibilityLabel="Schließen"
                >
                  <Text style={styles.btnGhostText}>Schließen</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Floating Recenter */}
        <TouchableOpacity
          onPress={recenter}
          style={[styles.fab, { bottom: 16 + insets.bottom }]}
          accessibilityRole="button"
          accessibilityLabel="Karte auf meinen Standort zentrieren"
          testID="navmap-recenter"
          activeOpacity={0.9}
        >
          <Text style={styles.fabText}>•</Text>
        </TouchableOpacity>

        {/* Leerzustand */}
        {showEmpty && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Keine gültigen Angebote im 2 km-Umkreis.</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

/* Styles */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  loading: {
    position: 'absolute',
    right: 12,
    backgroundColor: 'rgba(16,18,22,0.75)',
    borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  loadingText: { color: '#cfd7e6', fontSize: 12 },

  denied: {
    position: 'absolute',
    left: 12, right: 12,
    backgroundColor: 'rgba(255,107,107,0.16)',
    borderColor: 'rgba(255,255,255,0.35)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  deniedText: { color: '#ffd7d7', fontSize: 13, marginBottom: 6 },
  deniedBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  deniedBtnText: { color: '#fff', fontWeight: '700' },

  /* Bottom Sheet */
  cardWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12 },
  card: {
    backgroundColor: 'rgba(16,18,22,0.96)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  cardTitle: { color: '#fff', fontSize: 18, fontWeight: '900' },
  sectionTitle: { color: '#E9F1FF', fontSize: 13, fontWeight: '800' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  label: { color: '#9fb0c6', fontSize: 12 },
  value: { color: '#0FE3A9', fontSize: 13, fontWeight: '800', marginLeft: 8 },

  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  btn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  btnGhost: { borderColor: 'rgba(255,255,255,0.18)' },
  btnPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  btnPrimaryText: { color: '#0b1220', fontWeight: '800', textAlign: 'center' },
  btnGhostText: { color: '#fff', fontWeight: '800', textAlign: 'center' },

  /* Floating Action (Recenter) */
  fab: {
    position: 'absolute',
    right: 16,
    width: 48, height: 48,
    borderRadius: 24,
    backgroundColor: colors.background,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)',
    elevation: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  fabText: { color: colors.primary, fontSize: 24, lineHeight: 24, fontWeight: '800' },

  /* Empty */
  empty: {
    position: 'absolute', left: 0, right: 0, bottom: 130,
    alignItems: 'center',
  },
  emptyText: { color: '#9fb0c6', fontWeight: '700' },
});
