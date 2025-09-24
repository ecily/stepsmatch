// stepsmatch/mobile/app/(tabs)/NavigationMap.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import colors from '../../theme/colors';
import mapStyleStepsmatchLight from '../../theme/mapStyleDark';
import { isOfferActiveNow } from '../../utils/isOfferActiveNow';
import Constants from 'expo-constants';

const API_BASE_URL = (Constants.expoConfig?.extra?.apiBase || 'https://lobster-app-ie9a5.ondigitalocean.app/api').replace(/\/$/, '');
const FALLBACK_CENTER = { latitude: 47.0707, longitude: 15.4395 };

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

/* Location/Radius */
function pickOfferLocation(offer) {
  const coords = offer?.location?.coordinates || offer?.provider?.location?.coordinates || null;
  if (Array.isArray(coords) && coords.length >= 2) {
    const [lng, lat] = coords;
    const latN = Number(lat), lngN = Number(lng);
    if (Number.isFinite(latN) && Number.isFinite(lngN)) return { latitude: latN, longitude: lngN };
  }
  return null;
}
const pickRadiusMeters = (offer) => {
  const r1 = Number(offer?.radius);
  if (Number.isFinite(r1) && r1 >= 0) return r1;
  const r2 = Number(offer?.provider?.radius);
  if (Number.isFinite(r2) && r2 >= 0) return r2;
  return null;
};

/* „gültig bis“ & Restlaufzeit (kompakt) */
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

/* Relaxter Aktiv-Check: gültig, wenn Zeitfenster-Datum passt (auch wenn validTimes edge cases hat) */
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

export default function NavigationMap() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [userPos, setUserPos] = useState(null);
  const [loadingPos, setLoadingPos] = useState(true);

  const [rawOffers, setRawOffers] = useState([]);
  const [loadingOffers, setLoadingOffers] = useState(true);

  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  const mapRef = useRef(null);
  const posSubRef = useRef(null);
  const firstFixDoneRef = useRef(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

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
          mapRef.current?.animateToRegion(
            { latitude: first.latitude, longitude: first.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 },
            500
          );
          firstFixDoneRef.current = true;
        } catch {}

        posSubRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 5 },
          (l) => {
            const p = { latitude: l.coords.latitude, longitude: l.coords.longitude };
            setUserPos(p);
            if (!firstFixDoneRef.current) {
              try {
                mapRef.current?.animateToRegion(
                  { latitude: p.latitude, longitude: p.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 },
                  400
                );
                firstFixDoneRef.current = true;
              } catch {}
            }
          }
        );
      } finally {
        if (mounted) setLoadingPos(false);
      }
    })();
    return () => { mounted = false; try { posSubRef.current?.remove?.(); } catch {}; posSubRef.current = null; };
  }, []);

  const loadOffers = useCallback(async () => {
    const url = `${API_BASE_URL}/offers?withProvider=1&page=1&limit=200`;
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
    } catch {
      setRawOffers([]);
    } finally {
      setLoadingOffers(false);
    }
  }, []);

  useEffect(() => { loadOffers(); }, [loadOffers]);

  // Zeilen mit Geometrie/Entfernung/Status
  const computedRows = useMemo(() => {
    const user = userPos;
    return (rawOffers || []).map((offer) => {
      const loc = pickOfferLocation(offer);
      const radiusM = pickRadiusMeters(offer);
      const distanceM = (user && loc) ? haversineM(user, loc) : Number.POSITIVE_INFINITY;

      // <<< WICHTIG >>> Sichtbar, wenn:
      // - Geokoordinate vorhanden, UND
      // - ENTWEDER isOfferActiveNow(...) true ODER Date Window enthält "jetzt"
      const activeNow = isOfferActiveNow(offer, 'Europe/Vienna');
      const include = !!loc && (activeNow || isInDateWindow(offer));

      const remainingMs = getRemainingMs(offer);
      return { offer, loc, radiusM, distanceM, activeNow, include, remainingMs };
    });
  }, [rawOffers, userPos]);

  const visibleRows = useMemo(
    () => computedRows.filter((r) => r.include).sort((a, b) => a.distanceM - b.distanceM),
    [computedRows]
  );

  // Angebote pro Anbieter bündeln (→ eigener Marker pro Provider!)
  const providerGroups = useMemo(() => {
    const map = new Map();
    for (const row of visibleRows) {
      const prov = row?.offer?.provider || {};
      const provId = prov?._id || prov?.id;
      const key = provId || `${row.loc?.latitude?.toFixed(6)},${row.loc?.longitude?.toFixed(6)}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          provider: prov,
          loc: row.loc,
          rows: [],
          minDistanceM: row.distanceM,
          soonestEndMs: row.remainingMs ?? Infinity,
        });
      }
      const g = map.get(key);
      g.rows.push(row);
      if (row.distanceM < g.minDistanceM) g.minDistanceM = row.distanceM;
      if (row.remainingMs != null && row.remainingMs < g.soonestEndMs) g.soonestEndMs = row.remainingMs;
    }
    return Array.from(map.values()).sort((a, b) => a.minDistanceM - b.minDistanceM);
  }, [visibleRows]);

  // Kamera: zeige Benutzer + alle Provider
  const inViewFitAll = useCallback(() => {
    if (!mapRef.current) return;
    const coords = [
      ...(providerGroups.map(g => g.loc).filter(Boolean)),
      ...(userPos ? [userPos] : []),
    ];
    if (coords.length === 0) return;
    try {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 80 + insets.top, right: 40, bottom: 220 + insets.bottom, left: 40 },
        animated: true,
      });
    } catch {}
  }, [providerGroups, userPos, insets]);

  useEffect(() => {
    if (firstFixDoneRef.current) inViewFitAll();
  }, [inViewFitAll, firstFixDoneRef.current]);

  const onMarkerPress = (group) => {
    setSelectedGroup(group);
    setShowDetails(false);
  };

  const onGoNavigateOffer = useCallback((row) => {
    const id = row?.offer?._id || row?.offer?.id;
    if (!id) return;
    router.push(`/NavigationScreen?id=${id}`);
  }, [router]);

  const openExternalRoute = useCallback((coords) => {
    if (!coords) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${coords.latitude},${coords.longitude}&travelmode=walking`;
    Linking.openURL(url).catch(() => {});
  }, []);

  const recenter = () => {
    const c = userPos || FALLBACK_CENTER;
    try {
      mapRef.current?.animateToRegion(
        { latitude: c.latitude, longitude: c.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 },
        350
      );
    } catch {}
  };

  /* ---------- RENDER ---------- */
  const showEmpty = !loadingOffers && providerGroups.length === 0;

  // DEV-HUD: zeigt sofort, ob z.B. "Hotel Moder" drin ist
  const hud = useMemo(() => {
    const names = providerGroups.map(g => g.provider?.name || g.rows?.[0]?.offer?.provider?.name).filter(Boolean);
    return {
      raw: rawOffers?.length || 0,
      sichtbar: providerGroups.reduce((acc, g) => acc + g.rows.length, 0),
      firstProviders: names.slice(0, 6),
    };
  }, [rawOffers, providerGroups]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: (userPos?.latitude ?? FALLBACK_CENTER.latitude),
            longitude: (userPos?.longitude ?? FALLBACK_CENTER.longitude),
            latitudeDelta: 0.035,
            longitudeDelta: 0.035,
          }}
          showsUserLocation
          showsMyLocationButton={false}
          customMapStyle={mapStyleStepsmatchLight}
          accessibilityRole="image"
          accessibilityLabel="Karte mit Angeboten in deiner Nähe"
          testID="navmap-map"
        >
          {userPos && (
            <Circle
              center={userPos}
              radius={120}
              strokeColor="rgba(15,227,169,0.6)"
              fillColor="rgba(15,227,169,0.08)"
            />
          )}

          {providerGroups.map((g) => {
            const count = g.rows.length;
            return (
              <Marker
                key={g.key}
                coordinate={g.loc}
                onPress={() => onMarkerPress(g)}
                anchor={{ x: 0.5, y: 1.0 }}
                tracksViewChanges={false}
                accessibilityLabel={`${count} Angebot${count>1?'e':''} an diesem Ort, tippen für Details`}
              >
                <View style={{ alignItems: 'center' }}>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{count}</Text>
                  </View>
                  <Text style={styles.miniName} numberOfLines={1}>
                    {g.provider?.name || g.rows?.[0]?.offer?.name || 'Ort'}
                  </Text>
                </View>
              </Marker>
            );
          })}
        </MapView>

        {/* DEV-HUD */}
        <View style={[styles.hud, { top: insets.top + 8 }]}>
          <Text style={styles.hudTitle}>Offers sichtbar</Text>
          <Text style={styles.hudLine}>raw: {hud.raw} · sichtbar: {hud.sichtbar}</Text>
          {hud.firstProviders.map((n, i) => (
            <Text key={i} style={styles.hudItem}>• {n}</Text>
          ))}
          <View style={{ height: 6 }} />
          <TouchableOpacity onPress={inViewFitAll} style={styles.hudBtn}>
            <Text style={styles.hudBtnText}>Fit</Text>
          </TouchableOpacity>
        </View>

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
              onPress={() => Linking.openSettings()}
              style={styles.deniedBtn}
              accessibilityRole="button"
              accessibilityLabel="Einstellungen öffnen"
              testID="navmap-open-settings"
            >
              <Text style={styles.deniedBtnText}>Einstellungen öffnen</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Bottom-Sheet – kompakt */}
        {selectedGroup && !showDetails && (
          <View style={[styles.cardWrap, { paddingBottom: 12 + insets.bottom }]} pointerEvents="box-none">
            <View style={styles.card}>
              <View style={styles.peekHeader}>
                <Text style={styles.peekTitle} numberOfLines={2}>
                  {selectedGroup.provider?.name || selectedGroup.rows?.[0]?.offer?.provider?.name || 'Anbieter'}
                </Text>
                <Text style={styles.peekDistance}>
                  {Number.isFinite(selectedGroup.minDistanceM) ? fmtDistance(selectedGroup.minDistanceM) : '—'}
                </Text>
              </View>

              <Text style={styles.peekSubtitle}>
                {selectedGroup.rows.length} aktive Angebot{selectedGroup.rows.length > 1 ? 'e' : ''}
              </Text>

              <View style={{ height: 10 }} />

              <View style={styles.peekActions}>
                <TouchableOpacity
                  onPress={() => setShowDetails(true)}
                  style={[styles.btn, styles.btnPrimaryWide]}
                  accessibilityRole="button"
                  accessibilityLabel="Anzeigen"
                >
                  <Text style={styles.btnPrimaryText}>Anzeigen</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => openExternalRoute(selectedGroup.loc)}
                  style={[styles.btn, styles.btnGhostWide]}
                  accessibilityRole="button"
                  accessibilityLabel="Route öffnen"
                >
                  <Text style={styles.btnGhostText}>Route</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => { setSelectedGroup(null); setShowDetails(false); }}
                  style={[styles.btn, styles.btnGhostWide]}
                  accessibilityRole="button"
                  accessibilityLabel="Schließen"
                >
                  <Text style={styles.btnGhostText}>Schließen</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Bottom-Sheet – Details */}
        {selectedGroup && showDetails && (
          <View style={[styles.cardWrap, { paddingBottom: 12 + insets.bottom }]} pointerEvents="box-none">
            <View style={styles.card}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {selectedGroup.provider?.name || selectedGroup.rows?.[0]?.offer?.provider?.name || 'Anbieter'}
              </Text>

              <View style={{ height: 8 }} />

              <View style={styles.row}>
                <Text style={styles.label}>Entfernung</Text>
                <Text style={styles.value}>
                  {Number.isFinite(selectedGroup.minDistanceM) ? fmtDistance(selectedGroup.minDistanceM) : '—'}
                </Text>
              </View>

              <View style={{ height: 12 }} />

              <Text style={styles.sectionTitle}>
                {selectedGroup.rows.length} aktive Angebot{selectedGroup.rows.length > 1 ? 'e' : ''}
              </Text>

              <View style={{ height: 6 }} />

              <ScrollView style={{ maxHeight: 220 }}>
                {selectedGroup.rows.map((r) => {
                  const o = r.offer;
                  const remain = formatRemaining(r.remainingMs);
                  return (
                    <View key={o?._id || o?.id} style={styles.offerRow}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={styles.offerTitle} numberOfLines={1}>{o?.name || 'Angebot'}</Text>
                        <Text style={styles.offerMeta}>läuft noch {remain}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => onGoNavigateOffer(r)}
                        style={[styles.btn, styles.btnPrimary]}
                        accessibilityRole="button"
                        accessibilityLabel="Route starten"
                      >
                        <Text style={styles.btnPrimaryText}>GO</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>

              <View style={{ height: 12 }} />

              <View style={styles.actions}>
                <TouchableOpacity
                  onPress={() => setShowDetails(false)}
                  style={[styles.btn, styles.btnGhost]}
                  accessibilityRole="button"
                  accessibilityLabel="Zurück"
                >
                  <Text style={styles.btnGhostText}>Zurück</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setSelectedGroup(null); setShowDetails(false); }}
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
            <Text style={styles.emptyText}>Zurzeit keine passenden Orte in deiner Nähe.</Text>
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
    borderColor: 'rgba(255,107,107,0.35)',
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

  /* Marker – runde Zahl (Badge) */
  countBadge: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#0F1117',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    elevation: 3,
  },
  countBadgeText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  miniName: { color: '#cfe0ff', fontSize: 11, marginTop: 4, maxWidth: 140, textAlign: 'center' },

  /* DEV-HUD */
  hud: {
    position: 'absolute',
    left: 12,
    paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: 'rgba(16,18,22,0.92)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    minWidth: 180,
  },
  hudTitle: { color: '#fff', fontWeight: '900', fontSize: 12, marginBottom: 4 },
  hudLine: { color: '#cfe0ff', fontSize: 11 },
  hudItem: { color: '#b8c8e6', fontSize: 11 },

  /* Kompaktes / Detail-Sheet */
  cardWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12 },
  card: {
    backgroundColor: 'rgba(16,18,22,0.96)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  peekHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  peekTitle: { color: '#fff', fontSize: 18, fontWeight: '900', flex: 1, paddingRight: 8 },
  peekDistance: { color: '#0FE3A9', fontSize: 14, fontWeight: '800' },
  peekSubtitle: { color: '#cfe0ff', marginTop: 6, fontSize: 13, fontWeight: '700' },

  btn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  btnGhostWide: { flex: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'transparent' },
  btnPrimaryWide: { flex: 1, borderColor: colors.primary, backgroundColor: colors.primary },
  btnPrimaryText: { color: '#0b1220', fontWeight: '800', textAlign: 'center' },
  btnGhostText: { color: '#fff', fontWeight: '800', textAlign: 'center' },

  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  sectionTitle: { color: '#E9F1FF', fontSize: 13, fontWeight: '800' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  label: { color: '#9fb0c6', fontSize: 12 },
  value: { color: '#0FE3A9', fontSize: 13, fontWeight: '800', marginLeft: 8 },
  offerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  offerTitle: { color: '#fff', fontSize: 14, fontWeight: '800' },
  offerMeta: { color: '#cfe0ff', fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  btnGhost: { borderColor: 'rgba(255,255,255,0.18)' },
  btnPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },

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
