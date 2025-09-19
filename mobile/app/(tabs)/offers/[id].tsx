import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Image,
  TouchableOpacity,
  SafeAreaView,
  Animated,
  Easing,
  FlatList,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import axios from 'axios';
import { useTheme } from '../../../theme/ThemeProvider';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import { DistanceBadge } from '../../../components/DistanceBadge';
import { isOfferActiveNow } from '../../../utils/isOfferActiveNow';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';

const API_URL = 'https://lobster-app-ie9a5.ondigitalocean.app/api';
const api = axios.create({ baseURL: API_URL, timeout: 12000 });

const OID24 = /^[0-9a-fA-F]{24}$/;
const SCREEN_W = Dimensions.get('window').width;

/* ---------- Helpers ---------- */
function toNumber(val) {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
  }
  return null;
}
function formatDistance(metersLike) {
  const meters = toNumber(metersLike);
  if (meters == null) return null;
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}
function pickOfferLatLng(o) {
  try {
    if (o?.location?.coordinates && Array.isArray(o.location.coordinates) && o.location.coordinates.length === 2) {
      const [lng, lat] = o.location.coordinates;
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat: Number(lat), lng: Number(lng) };
    }
    if (o?.provider?.location?.coordinates && Array.isArray(o.provider.location.coordinates) && o.provider.location.coordinates.length === 2) {
      const [lng, lat] = o.provider.location.coordinates;
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat: Number(lat), lng: Number(lng) };
    }
    const lat = toNumber(o?.lat ?? o?.latitude ?? o?.provider?.lat ?? o?.provider?.latitude);
    const lng = toNumber(o?.lng ?? o?.lon ?? o?.longitude ?? o?.provider?.lng ?? o?.provider?.lon ?? o?.provider?.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat: Number(lat), lng: Number(lng) };
    return null;
  } catch { return null; }
}
function pickRadiusMeters(o) {
  const candidates = [
    o?.radiusMeters, o?.radius_m, o?.radiusM, o?.radius, o?.range, o?.distanceRadius, o?.geoRadiusM,
    o?.provider?.radiusMeters, o?.provider?.radius_m, o?.provider?.radiusM, o?.provider?.radius,
  ].map(toNumber);
  for (const v of candidates) { if (v != null && Number.isFinite(v) && v > 0) return v; }
  return 150;
}

/* Endzeit/Restlaufzeit robust bestimmen */
function parseDateLike(x) {
  if (!x) return null;
  const d = new Date(x);
  return isNaN(d) ? null : d;
}
function pickOfferEndDate(item) {
  const direct = [
    'activeUntil','activeEnd','validUntil','endAt',
    'validTo','dateTo','activeWindowEnd','endTime','expiresAt','until'
  ];
  for (const k of direct) {
    const d = parseDateLike(item?.[k]);
    if (d) return d;
  }
  const vd = item?.validDates || item?.dates || null;
  if (vd && typeof vd === 'object') {
    const toRaw = vd.to ?? vd.end ?? vd.toDate ?? vd.endDate;
    const d = parseDateLike(toRaw);
    if (d) return d;
  }
  return null;
}
function formatRemainingDHMS(diffMs) {
  if (diffMs == null || diffMs <= 0) return '0:00:00';
  const totalSec = Math.ceil(diffMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const rem = totalSec % 86400;
  const hh = Math.floor(rem / 3600);
  const mm = Math.floor((rem % 3600) / 60);
  const pad = (n) => String(n).padStart(2, '0');
  return `${days}:${pad(hh)}:${pad(mm)}`;
}

/* ---------- Screen ---------- */
export default function OfferDetailsScreen() {
  const router = useRouter();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { id: idParam, distance: distanceParam } = useLocalSearchParams();

  const id = useMemo(() => (typeof idParam === 'string' ? idParam.trim() : ''), [idParam]);
  const validId = useMemo(() => OID24.test(id), [id]);

  const distanceFromParam = useMemo(() => {
    const n = toNumber(typeof distanceParam === 'string' ? distanceParam : undefined);
    return n != null ? n : null;
  }, [distanceParam]);

  const [offer, setOffer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const mountedRef = useRef(true);

  // Map only
  const [userPos, setUserPos] = useState(null);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  useEffect(() => {
    setOffer(null); setErr(null);
    if (!validId) { setLoading(false); setErr('Ungültige Angebots-ID.'); return; }

    const controller = new AbortController();
    (async () => {
      try {
        setLoading(true);
        const res = await api.get(`/offers/${id}`, { params: { withProvider: 1 }, signal: controller.signal });
        const data = res?.data?.offer ?? res?.data ?? null;
        if (!mountedRef.current) return;
        setOffer(data); setErr(null);
      } catch (e) {
        if (!mountedRef.current) return;
        const msg = (e?.message || '').includes('timeout') ? 'Zeitüberschreitung – bitte erneut versuchen.' : 'Fehler beim Laden des Angebots.';
        setErr(msg); setOffer(null);
      } finally { if (mountedRef.current) setLoading(false); }
    })();

    return () => controller.abort?.();
  }, [id, validId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const last = await Location.getLastKnownPositionAsync();
        if (!cancelled && last?.coords) {
          setUserPos({ lat: last.coords.latitude, lng: last.coords.longitude });
          return;
        }
        const cur = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, maximumAge: 30000, timeout: 7000 });
        if (!cancelled && cur?.coords) setUserPos({ lat: cur.coords.latitude, lng: cur.coords.longitude });
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  const isActive = useMemo(() => (offer ? isOfferActiveNow(offer, 'Europe/Vienna', new Date()) : false), [offer]);
  const geo = useMemo(() => (offer ? pickOfferLatLng(offer) : null), [offer]);
  const radiusM = useMemo(() => (offer ? pickRadiusMeters(offer) : null), [offer]);
  const distanceMeters = useMemo(() => {
    if (distanceFromParam != null) return distanceFromParam;
    const dFromOffer = toNumber(offer?.distance);
    return dFromOffer != null ? dFromOffer : null;
  }, [distanceFromParam, offer]);

  // Restlaufzeit-Badge
  const remainingMs = useMemo(() => {
    const end = offer ? pickOfferEndDate(offer) : null;
    return end ? end.getTime() - Date.now() : null;
  }, [offer]);
  const remainingLabel = formatRemainingDHMS(remainingMs);

  // Map region
  const mapRegion = useMemo(() => {
    const target = geo || userPos;
    if (!target) return null;
    return { latitude: target.lat, longitude: target.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 };
  }, [geo, userPos]);

  // WOW-Effekt: Headline fade/slide-in
  const titleAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!loading) {
      Animated.timing(titleAnim, { toValue: 1, duration: 360, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
    }
  }, [loading, titleAnim]);

  // Bilder: wischbar
  const images = useMemo(() => (Array.isArray(offer?.images) ? offer.images.filter(Boolean) : []), [offer]);
  const heroHeight = 220;

  const handleBack = () => {
    try {
      if (router.canGoBack?.()) { router.back(); return; }
    } catch {}
    router.replace('/');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }}>
      <View style={[styles.container, { backgroundColor: t.colors.background }]}>

        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: 12 + insets.top, paddingBottom: 16 + insets.bottom + 80 },
          ]}
        >
          {/* KEIN Zurück oben mehr */}

          {/* Badges einheitlich – ÜBER dem Titel */}
          <View style={styles.badgesRow}>
            {isActive && <Badge label="Jetzt gültig" tone="info" style={styles.badgeUniform} />}
            <Badge label={`Rest: ${remainingLabel}`} tone="warning" style={styles.badgeUniform} />
            {!!offer?.category && (
              <Badge
                label={offer?.subcategory ? `${offer.category} · ${offer.subcategory}` : offer.category}
                tone="neutral"
                style={styles.badgeUniform}
              />
            )}
            {distanceMeters != null ? (
              <View style={[styles.badgeUniform, { paddingHorizontal: 0, paddingVertical: 0 }]}>
                <DistanceBadge meters={distanceMeters} />
              </View>
            ) : null}
          </View>

          {/* Titel + Beschreibung (mit WOW-Effekt) */}
          <Animated.Text
            style={[
              styles.title,
              {
                color: t.colors.inkHigh,
                opacity: titleAnim,
                transform: [{ translateY: titleAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
              },
            ]}
            numberOfLines={2}
          >
            {offer?.name ?? 'Angebot'}
          </Animated.Text>

          {!!offer?.description && (
            <Text style={[styles.desc, { color: t.colors.ink }]}>{offer.description}</Text>
          )}

          {/* Bilder – nebeneinander wischbar */}
          <View style={styles.heroCard}>
            {images.length ? (
              <FlatList
                data={images}
                keyExtractor={(uri, i) => `${offer?._id || 'off'}-img-${i}`}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                renderItem={({ item: uri }) => (
                  <Image
                    source={{ uri }}
                    style={{ width: SCREEN_W - 24, height: heroHeight - 24, borderRadius: 12, marginRight: 8, backgroundColor: '#eee' }}
                    resizeMode="cover"
                  />
                )}
                style={{ height: heroHeight - 24 }}
                contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 12 }}
                getItemLayout={(_, index) => ({ length: SCREEN_W - 24, offset: (SCREEN_W - 24) * index, index })}
              />
            ) : (
              <View style={[styles.imgPlaceholderBig, { backgroundColor: '#e9eef5' }]}>
                <Text style={{ color: '#6b7280', fontWeight: '600' }}>Keine Bilder</Text>
              </View>
            )}
          </View>

          {/* ORT: nur Provider-Name + Adresse (KEIN Lat/Lng-Text mehr) */}
          {(offer?.provider?.name || offer?.provider?.address) && (
            <View style={[styles.infoBox, { backgroundColor: '#f7f8fb' }]}>
              <Text style={[styles.infoTitle, { color: t.colors.inkHigh }]}>Ort</Text>
              {!!offer?.provider?.name && (
                <Text style={[styles.infoText, { color: t.colors.ink }]}>{offer.provider.name}</Text>
              )}
              {!!offer?.provider?.address && (
                <Text style={[styles.infoText, { color: t.colors.inkLow }]}>{offer.provider.address}</Text>
              )}
              {/* Entfernung als Zusatzzeile */}
              {distanceMeters != null && (
                <Text style={[styles.infoText, { color: t.colors.inkLow, marginTop: 4 }]}>
                  Entfernung: {formatDistance(distanceMeters)}
                </Text>
              )}
            </View>
          )}

          {/* Karte (Hinweis bleibt, aber ohne Lat/Lng-Zeile davor) */}
          {( (geo || userPos) && mapRegion ) && (
            <View style={[styles.mapCard, { backgroundColor: '#f7f8fb' }]}>
              <Text style={[styles.infoTitle, { color: t.colors.inkHigh, marginBottom: 8 }]}>Karte</Text>
              <View style={styles.mapWrap}>
                <MapView
                  provider={PROVIDER_GOOGLE}
                  style={StyleSheet.absoluteFill}
                  initialRegion={mapRegion}
                  showsUserLocation={!!userPos}
                  toolbarEnabled={false}
                  pitchEnabled={false}
                  rotateEnabled={false}
                  loadingEnabled
                >
                  {geo && (
                    <Marker
                      coordinate={{ latitude: geo.lat, longitude: geo.lng }}
                      title={offer?.name || 'Ziel'}
                      description="Angebot"
                    />
                  )}
                  {userPos && (
                    <Marker
                      coordinate={{ latitude: userPos.lat, longitude: userPos.lng }}
                      title="Du"
                      description="Aktuelle Position"
                      pinColor="#0d4ea6"
                    />
                  )}
                </MapView>
              </View>
              <Text style={[styles.mapHint, { color: t.colors.inkLow }]}>
                Hinweis: Position nur zur Orientierung; Navigation starten über „Route starten“.
              </Text>
            </View>
          )}
        </ScrollView>

        {/* CTA-Footer: Route + Zurück (Merken ersetzt) */}
        {!loading && !err && offer && (
          <SafeAreaView style={{ backgroundColor: t.colors.background }}>
            <View style={[styles.footer, { borderTopColor: t.colors.divider, paddingBottom: 10 + insets.bottom }]}>
              <View style={{ flex: 1 }}>
                <Button
                  title="Route starten"
                  variant="primary"
                  size="lg"
                  onPress={() => router.push({ pathname: '/(tabs)/NavigationScreen', params: { id } })}
                />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Button title="Zurück" variant="secondary" size="lg" onPress={handleBack} />
              </View>
            </View>
          </SafeAreaView>
        )}
      </View>
    </SafeAreaView>
  );
}

const IMG_W = 110;
const IMG_H = 86;

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 16 },
  title: { fontSize: 22, fontWeight: '800', lineHeight: 26, marginTop: 6 },
  desc: { fontSize: 14, lineHeight: 20, marginTop: 6 },

  /* Badges (einheitlich & kompakt) */
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 },
  badgeUniform: { marginRight: 6, marginBottom: 6 },

  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  err: { fontSize: 14, textAlign: 'center' },

  /* Bilder */
  heroCard: { marginTop: 10, borderRadius: 12, overflow: 'hidden' },
  imgPlaceholderBig: { height: 196, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },

  /* Info */
  infoBox: { marginTop: 12, padding: 12, borderRadius: 12 },
  infoTitle: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  infoText: { fontSize: 14 },

  /* Map */
  mapCard: { marginTop: 12, padding: 12, borderRadius: 12 },
  mapWrap: { height: 180, borderRadius: 12, overflow: 'hidden', backgroundColor: '#e9eef5' },
  mapHint: { marginTop: 8, fontSize: 12 },

  /* Footer CTA */
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
