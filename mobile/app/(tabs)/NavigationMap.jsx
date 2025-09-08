import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
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
function toRad(deg) { return (deg * Math.PI) / 180; }
function haversineM(a, b) {
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const aa = s1 * s1 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * s2 * s2;
  return 2 * R * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}
function fmtDistance(m) { return m < 995 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`; }

/* Location/Radius wie im OffersScreen */
function pickOfferLocation(offer) {
  const coords = offer?.location?.coordinates || offer?.provider?.location?.coordinates || null;
  if (Array.isArray(coords) && coords.length >= 2) {
    const [lng, lat] = coords;
    const latN = Number(lat), lngN = Number(lng);
    if (Number.isFinite(latN) && Number.isFinite(lngN)) return { latitude: latN, longitude: lngN };
  }
  return null;
}
function pickRadiusMeters(offer) {
  const r1 = Number(offer?.radius);
  if (Number.isFinite(r1) && r1 >= 0) return r1;
  const r2 = Number(offer?.provider?.radius);
  if (Number.isFinite(r2) && r2 >= 0) return r2;
  return null;
}

/* „gültig bis“ & Restlaufzeit */
function validUntilText(o) {
  const keys = ['activeUntil','activeEnd','validUntil','endAt','validTo','dateTo','activeWindowEnd','endTime'];
  const vd = o?.validDates;
  if (vd && typeof vd === 'object') {
    const toRaw = vd.to ?? vd.end ?? vd.toDate ?? vd.endDate;
    if (toRaw) {
      const d = new Date(toRaw);
      if (!isNaN(d)) {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const mi = String(d.getMinutes()).padStart(2, '0');
        return `${dd}.${mm}. ${hh}:${mi} Uhr`;
      }
    }
  }
  for (const k of keys) {
    const v = o?.[k]; if (!v) continue;
    const d = new Date(v); if (!isNaN(d)) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mi = String(d.getMinutes()).padStart(2, '0');
      return `${dd}.${mm}. ${hh}:${mi} Uhr`;
    }
  }
  return '—';
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

export default function NavigationMap() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [userPos, setUserPos] = useState(null);
  const [loadingPos, setLoadingPos] = useState(true);

  const [rawOffers, setRawOffers] = useState([]);
  const [loadingOffers, setLoadingOffers] = useState(true);

  const [selected, setSelected] = useState(null);

  const mapRef = useRef(null);
  const posSubRef = useRef(null);
  const firstFixDoneRef = useRef(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  /* Standort laden + live verfolgen (Logik beibehalten) */
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
      // optional: Token mitsenden, falls vorhanden
      const tokenKeys = ['authToken', 'token', 'jwt', 'accessToken'];
      let token = null;
      for (const tk of tokenKeys) {
        const t = await AsyncStorage.getItem(tk);
        if (t && String(t).trim()) { token = t.trim(); break; }
      }
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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

  // Rechenbasis
  const computedRows = useMemo(() => {
    const user = userPos;
    return (rawOffers || []).map((offer) => {
      const loc = pickOfferLocation(offer);
      const radiusM = pickRadiusMeters(offer);
      const distanceM = (user && loc) ? haversineM(user, loc) : Number.POSITIVE_INFINITY;
      const activeNow = isOfferActiveNow(offer, 'Europe/Vienna');
      const include = !!loc && Number.isFinite(radiusM) && distanceM <= radiusM && activeNow;
      const remainingMs = getRemainingMs(offer);
      return { offer, loc, radiusM, distanceM, activeNow, include, remainingMs };
    });
  }, [rawOffers, userPos]);

  const markerRows = useMemo(
    () => computedRows.filter((r) => r.include).sort((a, b) => a.distanceM - b.distanceM),
    [computedRows]
  );

  const onGoNavigate = useCallback((row) => {
    const id = row?.offer?._id || row?.offer?.id;
    if (!id) return;
    router.push(`/NavigationScreen?id=${id}`);
  }, [router]);

  const onMarkerPress = (row) => setSelected(row);

  function categoryText(o) {
    const cat = o?.category || o?.provider?.category || '—';
    const sub = o?.subcategory || o?.subCategory || '—';
    return { cat, sub };
  }

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
  const showEmpty = !loadingOffers && markerRows.length === 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Freundliche Meldung oben (Safe-Area) */}
        <View style={[styles.banner, { top: insets.top + 8 }]}>
          <Text style={styles.bannerText}>
            {showEmpty ? 'Zurzeit keine passenden Orte in deiner Nähe.' : 'Schau, was wir für dich gefunden haben.'}
          </Text>
        </View>

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
          {markerRows.map((row) => {
            const { offer, loc, remainingMs, distanceM } = row;
            if (!loc) return null;
            const id = offer?._id || offer?.id || String(Math.random());
            const { cat, sub } = categoryText(offer);
            const accLabel = `${offer?.name || 'Angebot'} – ${cat}${sub ? `, ${sub}` : ''}${Number.isFinite(distanceM) ? `, in ${fmtDistance(distanceM)}` : ''}`;
            return (
              <Marker
                key={id}
                coordinate={loc}
                onPress={() => onMarkerPress(row)}
                title={offer?.name || 'Angebot'}
                description={offer?.provider?.name || ''}
                anchor={{ x: 0.5, y: 1.0 }}
                accessibilityLabel={accLabel}
              >
                {/* Custom Marker: Pin + immer sichtbare Mini-Badges */}
                <View style={{ alignItems: 'center' }}>
                  {/* Badge-Bubble */}
                  <View style={styles.badgeBubble}>
                    <Text style={styles.badgeText} numberOfLines={1}>{cat || '—'}</Text>
                    {!!sub && <Text style={[styles.badgeText, styles.dotMid]}>•</Text>}
                    {!!sub && <Text style={styles.badgeText} numberOfLines={1}>{sub}</Text>}
                    <Text style={[styles.badgeText, styles.dotMid]}>•</Text>
                    <Text style={[styles.badgeText, styles.remain]} numberOfLines={1}>
                      {formatRemaining(remainingMs)}
                    </Text>
                  </View>
                  {/* Simple Pin */}
                  <View style={styles.pin} />
                </View>
              </Marker>
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

        {/* Hinweis: Standort abgelehnt */}
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

        {/* Bottom-Card bei Auswahl (Safe-Area unten respektieren) */}
        {selected && (
          <View style={[styles.cardWrap, { paddingBottom: 12 + insets.bottom }]} pointerEvents="box-none">
            <View style={styles.card} accessibilityRole="summary">
              <Text style={styles.cardTitle} numberOfLines={1}>
                {selected.offer?.name || 'Angebot'}
              </Text>

              <View style={{ height: 8 }} />

              <View style={styles.row}>
                <Text style={styles.label}>Kategorie</Text>
                <Text style={styles.value}>
                  {categoryText(selected.offer).cat} • {categoryText(selected.offer).sub}
                </Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>Entfernung</Text>
                <Text style={styles.value}>
                  {Number.isFinite(selected.distanceM) ? fmtDistance(selected.distanceM) : '—'}
                </Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>Gültig bis</Text>
                <Text style={styles.value}>{validUntilText(selected.offer)}</Text>
              </View>

              {!!selected.offer?.description && (
                <>
                  <View style={{ height: 8 }} />
                  <ScrollView style={{ maxHeight: 84 }}>
                    <Text style={styles.desc} numberOfLines={4}>
                      {selected.offer.description}
                    </Text>
                  </ScrollView>
                </>
              )}

              <View style={{ height: 12 }} />

              <View style={styles.actions}>
                <TouchableOpacity
                  onPress={() => setSelected(null)}
                  style={[styles.btn, styles.btnGhost]}
                  accessibilityRole="button"
                  accessibilityLabel="Schließen"
                  testID="navmap-close-card"
                >
                  <Text style={styles.btnGhostText}>Schließen</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onGoNavigate(selected)}
                  style={[styles.btn, styles.btnPrimary]}
                  accessibilityRole="button"
                  accessibilityLabel="Route starten"
                  testID="navmap-go"
                >
                  <Text style={styles.btnPrimaryText}>GO</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Floating Recenter (über Tab-Bar) */}
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
      </View>
    </SafeAreaView>
  );
}

/* Styles */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  banner: {
    position: 'absolute',
    left: 12, right: 12, zIndex: 10,
    backgroundColor: 'rgba(16,18,22,0.80)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  bannerText: { color: '#E9F1FF', fontWeight: '700' },

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

  /* Marker UI */
  badgeBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16,18,22,0.92)',
    borderColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 6,
  },
  badgeText: { color: '#E9F1FF', fontSize: 11, fontWeight: '700' },
  dotMid: { opacity: 0.7 },
  remain: { color: '#9FE870', fontWeight: '800' },
  pin: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#0d8bff',
    borderWidth: 2, borderColor: '#fff',
    shadowColor: '#0d8bff',
    shadowOpacity: 0.45, shadowRadius: 6, shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },

  /* Bottom sheet */
  cardWrap: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    paddingHorizontal: 12,
  },
  card: {
    backgroundColor: 'rgba(16,18,22,0.96)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  label: { color: '#9fb0c6', fontSize: 12 },
  value: { color: '#e8f0ff', fontSize: 13, fontWeight: '600', marginLeft: 8 },
  desc: { color: '#e8f0ff', fontSize: 13, lineHeight: 18 },

  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  btn: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1,
  },
  btnGhost: { borderColor: 'rgba(255,255,255,0.18)' },
  btnGhostText: { color: '#e8f0ff', fontWeight: '700' },
  btnPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  btnPrimaryText: { color: '#0b1220', fontWeight: '800' },

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
});
