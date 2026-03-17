import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import mapStyleStepsmatchLight from '../../theme/mapStyleDark';
import { isOfferActiveNow } from '../../utils/isOfferActiveNow';
import Constants from 'expo-constants';

const API_BASE_URL = (Constants.expoConfig?.extra?.apiBase || 'https://lobster-app-ie9a5.ondigitalocean.app/api').replace(/\/$/, '');
const FALLBACK_CENTER = { latitude: 47.0707, longitude: 15.4395 };
const VISIBLE_RADIUS_M = 2000;
const WALKING_SPEED_MPS = 1.33;

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

const fmtDistance = (m) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);
const etaMin = (m) => Math.max(1, Math.ceil(m / (WALKING_SPEED_MPS * 60)));

function regionForRadius(center, radiusM) {
  const lat = center.latitude;
  const deltaLat = (radiusM * 2) / 111000;
  const cosLat = Math.max(0.1, Math.cos(toRad(lat)));
  const deltaLng = deltaLat / cosLat;
  return {
    latitude: center.latitude,
    longitude: center.longitude,
    latitudeDelta: Math.min(0.2, Math.max(0.003, deltaLat * 1.2)),
    longitudeDelta: Math.min(0.2, Math.max(0.003, deltaLng * 1.2)),
  };
}

function pickOfferLocation(offer) {
  const coords = offer?.location?.coordinates || offer?.provider?.location?.coordinates;
  if (Array.isArray(coords) && coords.length >= 2) {
    const [lng, lat] = coords;
    const latN = Number(lat);
    const lngN = Number(lng);
    if (Number.isFinite(latN) && Number.isFinite(lngN)) {
      return { latitude: latN, longitude: lngN };
    }
  }
  return null;
}

export default function NavigationMap() {
  const router = useRouter();
  const t = useTheme();
  const insets = useSafeAreaInsets();

  const [userPos, setUserPos] = useState(null);
  const [loadingPos, setLoadingPos] = useState(true);
  const [rawOffers, setRawOffers] = useState([]);
  const [loadingOffers, setLoadingOffers] = useState(true);
  const [selectedRow, setSelectedRow] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const mapRef = useRef(null);
  const posSubRef = useRef(null);
  const hasCenteredRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (mounted) setPermissionDenied(true);
          return;
        }

        const current = await Location.getCurrentPositionAsync({});
        if (!mounted) return;

        const p = { latitude: current.coords.latitude, longitude: current.coords.longitude };
        setUserPos(p);

        posSubRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 10 },
          (l) => {
            const next = { latitude: l.coords.latitude, longitude: l.coords.longitude };
            setUserPos(next);
          }
        );
      } finally {
        if (mounted) setLoadingPos(false);
      }
    })();

    return () => {
      mounted = false;
      try {
        posSubRef.current?.remove?.();
      } catch {}
      posSubRef.current = null;
    };
  }, []);

  const loadOffers = useCallback(async () => {
    const url = `${API_BASE_URL}/offers?withProvider=1&page=1&limit=300`;
    try {
      setLoadingOffers(true);
      let token = null;
      for (const k of ['authToken', 'token', 'jwt', 'accessToken']) {
        const val = await AsyncStorage.getItem(k);
        if (val && String(val).trim()) {
          token = String(val).trim();
          break;
        }
      }
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const text = await res.text();
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {}

      const rows =
        (Array.isArray(json?.offers) && json.offers) ||
        (Array.isArray(json?.data?.offers) && json.data.offers) ||
        (Array.isArray(json?.data) && json.data) ||
        (Array.isArray(json) && json) ||
        [];

      setRawOffers(rows);
    } catch {
      setRawOffers([]);
    } finally {
      setLoadingOffers(false);
    }
  }, []);

  useEffect(() => {
    loadOffers();
  }, [loadOffers]);


  useEffect(() => {
    if (!userPos || hasCenteredRef.current) return;
    hasCenteredRef.current = true;
    try {
      mapRef.current?.animateToRegion(regionForRadius(userPos, VISIBLE_RADIUS_M), 450);
    } catch {}
  }, [userPos]);
  const { rows, activeCount } = useMemo(() => {
    const prepared = (rawOffers || [])
      .map((offer) => {
        const loc = pickOfferLocation(offer);
        const distanceM = userPos && loc ? haversineM(userPos, loc) : Number.POSITIVE_INFINITY;
        const isActive = !!loc && isOfferActiveNow(offer, 'Europe/Vienna');
        return { offer, loc, distanceM, isActive };
      })
      .filter((r) => !!r.loc && r.distanceM <= VISIBLE_RADIUS_M)
      .sort((a, b) => a.distanceM - b.distanceM);

    const activeRows = prepared.filter((r) => r.isActive);
    return {
      rows: activeRows.length > 0 ? activeRows : prepared,
      activeCount: activeRows.length,
    };
  }, [rawOffers, userPos]);

  const recenter = () => {
    const c = userPos || FALLBACK_CENTER;
    try {
      mapRef.current?.animateToRegion(regionForRadius(c, VISIBLE_RADIUS_M), 350);
    } catch {}
  };

  const onGoNavigateOffer = useCallback(
    (row) => {
      const id = row?.offer?._id || row?.offer?.id;
      if (!id) return;
      router.push(`/NavigationScreen?id=${id}`);
    },
    [router]
  );

  const loadingAny = loadingPos || loadingOffers;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.colors.background }]} edges={['top', 'bottom']}>
      <View style={{ flex: 1 }}>
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          provider={PROVIDER_GOOGLE}
          initialRegion={regionForRadius(userPos || FALLBACK_CENTER, VISIBLE_RADIUS_M)}
          customMapStyle={mapStyleStepsmatchLight}
          showsUserLocation
          showsMyLocationButton={false}
          zoomControlEnabled={false}
          toolbarEnabled={false}
        >
          {userPos ? (
            <>
              <Circle center={userPos} radius={VISIBLE_RADIUS_M} strokeColor="rgba(31,111,235,0.5)" fillColor="rgba(31,111,235,0.08)" />
              <Circle center={userPos} radius={70} strokeColor="rgba(34,197,94,0.7)" fillColor="rgba(34,197,94,0.18)" />
            </>
          ) : null}

          {rows.map((row) => (
            <Marker
              key={row.offer?._id || `${row.loc.latitude}-${row.loc.longitude}`}
              coordinate={row.loc}
              pinColor={row.isActive ? t.colors.primary : '#9ca3af'}
              onPress={() => setSelectedRow(row)}
              title={row.offer?.name || 'Angebot'}
              description={`${row.offer?.category || '-'} � ${fmtDistance(row.distanceM)}`}
            />
          ))}
        </MapView>

        <View style={[styles.topCard, { top: insets.top + 8, backgroundColor: t.colors.card, borderColor: t.colors.divider }]}>
          <Text style={[styles.topTitle, { color: t.colors.inkHigh }]}>Map Preview</Text>
          <Text style={[styles.topSub, { color: t.colors.inkLow }]}>
            {activeCount > 0 ? `${activeCount} gueltige Angebote im Radius von 2 km` : `${rows.length} Angebote im Radius von 2 km (aktuell nicht aktiv)`}
          </Text>
        </View>

        {loadingAny ? (
          <View style={[styles.loading, { top: insets.top + 70, backgroundColor: t.colors.card, borderColor: t.colors.divider }]}> 
            <ActivityIndicator size="small" color={t.colors.primary} />
            <Text style={[styles.loadingText, { color: t.colors.ink }]}>{loadingPos ? 'Position' : 'Angebote'} werden geladen ...</Text>
          </View>
        ) : null}

        {permissionDenied ? (
          <View style={[styles.notice, { top: insets.top + 110, backgroundColor: t.colors.card, borderColor: t.colors.warning }]}> 
            <Text style={[styles.noticeText, { color: t.colors.ink }]}>Standort ist deaktiviert. Bitte Berechtigung aktivieren.</Text>
          </View>
        ) : null}

        {selectedRow ? (
          <View style={[styles.sheet, { paddingBottom: 12 + insets.bottom, backgroundColor: t.colors.card, borderColor: t.colors.divider }]}>
            <Text style={[styles.sheetTitle, { color: t.colors.inkHigh }]} numberOfLines={2}>
              {selectedRow.offer?.name || 'Angebot'}
            </Text>
            <Text style={[styles.sheetMeta, { color: t.colors.inkLow }]}> 
              {selectedRow.offer?.category || 'Kategorie'} � {fmtDistance(selectedRow.distanceM)} � ca. {etaMin(selectedRow.distanceM)} min � {selectedRow.isActive ? 'aktiv' : 'inaktiv'}
            </Text>
            <Text style={[styles.sheetDesc, { color: t.colors.ink }]} numberOfLines={3}>
              {selectedRow.offer?.description || 'Keine Beschreibung verfuegbar.'}
            </Text>

            <View style={styles.sheetActions}>
              <TouchableOpacity onPress={() => onGoNavigateOffer(selectedRow)} style={[styles.btn, { backgroundColor: t.colors.primary }]}>
                <Text style={styles.btnPrimaryText}>Route starten</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSelectedRow(null)} style={[styles.btnGhost, { borderColor: t.colors.divider }]}>
                <Text style={[styles.btnGhostText, { color: t.colors.ink }]}>Schliessen</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <TouchableOpacity
          onPress={recenter}
          style={[styles.fab, { bottom: 20 + insets.bottom, backgroundColor: t.colors.card, borderColor: t.colors.divider }]}
          activeOpacity={0.9}
        >
          <Text style={[styles.fabText, { color: t.colors.primary }]}>?</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  topCard: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  topTitle: { fontSize: 15, fontWeight: '800' },
  topSub: { marginTop: 2, fontSize: 12 },

  loading: {
    position: 'absolute',
    right: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: { fontSize: 12 },

  notice: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noticeText: { fontSize: 13 },

  sheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 0,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  sheetTitle: { fontSize: 18, fontWeight: '900' },
  sheetMeta: { marginTop: 4, fontSize: 12 },
  sheetDesc: { marginTop: 10, fontSize: 13, lineHeight: 18 },

  sheetActions: { marginTop: 12, flexDirection: 'row', alignItems: 'center' },
  btn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#fff', fontWeight: '800' },
  btnGhost: {
    marginLeft: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  btnGhostText: { fontWeight: '700' },

  fab: {
    position: 'absolute',
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  fabText: { fontSize: 22, fontWeight: '800' },
});

