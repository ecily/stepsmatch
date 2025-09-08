// stepsmatch/mobile/app/offers/[id].tsx
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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import axios from 'axios';
import { useTheme } from '../../theme/ThemeProvider';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { DistanceBadge } from '../../components/DistanceBadge';
import { isOfferActiveNow } from '../../utils/isOfferActiveNow';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Map
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
// (kein Background/Push-Impact) – einmalige Positionsabfrage für die Karte:
import * as Location from 'expo-location';

const API_URL = 'https://lobster-app-ie9a5.ondigitalocean.app/api';
const api = axios.create({ baseURL: API_URL, timeout: 12000 });

const OID24 = /^[0-9a-fA-F]{24}$/;

function toNumber(val: any) {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
  }
  return null;
}

function formatDistance(metersLike: any) {
  const meters = toNumber(metersLike);
  if (meters == null) return null;
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

function pickOfferLatLng(o: any) {
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
  } catch {
    return null;
  }
}

function pickRadiusMeters(o: any) {
  const candidates = [
    o?.radiusMeters, o?.radius_m, o?.radiusM, o?.radius, o?.range, o?.distanceRadius, o?.geoRadiusM,
    o?.provider?.radiusMeters, o?.provider?.radius_m, o?.provider?.radiusM, o?.provider?.radius,
  ].map(toNumber);
  for (const v of candidates) {
    if (v != null && Number.isFinite(v) && v > 0) return v;
  }
  return 150;
}

export default function OfferDetailsScreen() {
  const router = useRouter();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { id: idParam, distance: distanceParam } = useLocalSearchParams();

  const id = useMemo(() => (typeof idParam === 'string' ? idParam.trim() : ''), [idParam]);
  const validId = useMemo(() => OID24.test(id), [id]);

  // Distanz ggf. aus Route-Param (von der Liste übergeben)
  const distanceFromParam = useMemo(() => {
    const n = toNumber(typeof distanceParam === 'string' ? distanceParam : undefined);
    return n != null ? n : null;
  }, [distanceParam]);

  const [offer, setOffer] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const mountedRef = useRef(true);

  // Nutzer-Position (nur für die Karte; kein Eingriff in Push/Heartbeat)
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    setOffer(null);
    setErr(null);

    if (!validId) {
      setLoading(false);
      setErr('Ungültige Angebots-ID.');
      return;
    }

    const controller = new AbortController();
    (async () => {
      try {
        setLoading(true);
        const res = await api.get(`/offers/${id}`, { params: { withProvider: 1 }, signal: controller.signal });
        const data = res?.data?.offer ?? res?.data ?? null;
        if (!mountedRef.current) return;
        setOffer(data);
        setErr(null);
      } catch (e: any) {
        if (!mountedRef.current) return;
        const msg = e?.message?.includes?.('timeout') ? 'Zeitüberschreitung – bitte erneut versuchen.' : 'Fehler beim Laden des Angebots.';
        setErr(msg);
        setOffer(null);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();

    return () => controller.abort?.();
  }, [id, validId]);

  // Einmalig aktuelle Position laden (sanft, ohne Batterie-Impact)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // erst least-recently-known versuchen
        const last = await Location.getLastKnownPositionAsync();
        if (!cancelled && last?.coords) {
          setUserPos({ lat: last.coords.latitude, lng: last.coords.longitude });
          return;
        }
        // sonst sanfte Abfrage
        const cur = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          maximumAge: 30_000,
          timeout: 7_000,
        });
        if (!cancelled && cur?.coords) {
          setUserPos({ lat: cur.coords.latitude, lng: cur.coords.longitude });
        }
      } catch {
        // still: Karte funktioniert auch nur mit Offer-Marker
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const isActive = useMemo(
    () => (offer ? isOfferActiveNow(offer, 'Europe/Vienna', new Date()) : false),
    [offer]
  );
  const geo = useMemo(() => (offer ? pickOfferLatLng(offer) : null), [offer]);
  const radiusM = useMemo(() => (offer ? pickRadiusMeters(offer) : null), [offer]);

  // Distanzanzeige: Param > Offer.distance
  const distanceMeters = useMemo(() => {
    if (distanceFromParam != null) return distanceFromParam;
    const dFromOffer = toNumber((offer as any)?.distance);
    return dFromOffer != null ? dFromOffer : null;
  }, [distanceFromParam, offer]);

  // Region für Map
  const mapRegion = useMemo(() => {
    const target = geo || userPos;
    if (!target) return null;
    const latDelta = 0.01; // ~1.1km
    const lngDelta = 0.01;
    return {
      latitude: target.lat,
      longitude: target.lng,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
  }, [geo, userPos]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }}>
      <View style={[styles.container, { backgroundColor: t.colors.background }]}>
        {/* HEADER + SCROLLABLE CONTENT */}
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: 12 + insets.top, paddingBottom: 16 + insets.bottom },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
              <Text style={[styles.backText, { color: t.colors.primary }]}>Zurück</Text>
            </TouchableOpacity>

            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: t.colors.inkHigh }]} numberOfLines={2}>
                {offer?.name ?? 'Angebot'}
              </Text>
              {distanceMeters != null ? (
                <DistanceBadge meters={distanceMeters} />
              ) : null}
            </View>

            <View style={styles.badges}>
              {isActive && <Badge label="Jetzt gültig" tone="success" style={styles.badge} />}
              {!!offer?.category && (
                <Badge
                  label={offer?.subcategory ? `${offer.category} · ${offer.subcategory}` : offer.category}
                  tone="neutral"
                  style={styles.badge}
                />
              )}
            </View>
          </View>

          {/* Loading / Error */}
          {loading && (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={t.colors.primary} />
              <Text style={{ color: t.colors.inkLow, marginTop: 12 }}>Lade Angebot …</Text>
            </View>
          )}

          {!loading && err && (
            <View style={styles.center}>
              <Text style={[styles.err, { color: t.colors.danger }]}>{err}</Text>
              <View style={{ marginTop: 16, width: 200 }}>
                <Button
                  title="Nochmal versuchen"
                  variant="primary"
                  size="md"
                  onPress={() => router.replace(`/offers/${id}`)}
                />
              </View>
            </View>
          )}

          {/* Content */}
          {!loading && !err && offer && (
            <>
              {/* Bilder */}
              <View style={styles.imagesRow}>
                {(offer.images || []).slice(0, 3).map((src: string | null, i: number) =>
                  !!src ? <Image key={i} source={{ uri: src }} style={styles.img} /> : <View key={i} style={styles.imgPlaceholder} />
                )}
              </View>

              {/* Anbieter / Adresse */}
              {(offer?.provider?.name || offer?.provider?.address) && (
                <View style={styles.infoBox}>
                  <Text style={[styles.infoTitle, { color: t.colors.inkHigh }]}>Anbieter</Text>
                  {!!offer?.provider?.name && (
                    <Text style={[styles.infoText, { color: t.colors.ink }]}>{offer.provider.name}</Text>
                  )}
                  {!!offer?.provider?.address && (
                    <Text style={[styles.infoText, { color: t.colors.inkLow }]}>{offer.provider.address}</Text>
                  )}
                </View>
              )}

              {/* Beschreibung */}
              {!!offer.description && (
                <Text style={[styles.desc, { color: t.colors.ink }]}>{offer.description}</Text>
              )}

              {/* Geo / Distanz / Radius (statisch angezeigt) */}
              {geo && (
                <View style={styles.infoBox}>
                  <Text style={[styles.infoTitle, { color: t.colors.inkHigh }]}>Ort</Text>
                  <Text style={[styles.infoText, { color: t.colors.ink }]}>
                    Lat {geo.lat.toFixed(5)} · Lng {geo.lng.toFixed(5)}{radiusM ? ` · Radius ${radiusM} m` : ''}
                  </Text>
                  {distanceMeters != null && (
                    <Text style={[styles.infoText, { color: t.colors.inkLow }]}>
                      Entfernung: {formatDistance(distanceMeters)}
                    </Text>
                  )}
                </View>
              )}

              {/* 🗺️ Map-Card: aktueller Standort + Offer-Marker */}
              {(mapRegion && (geo || userPos)) && (
                <View style={styles.mapCard}>
                  <Text style={[styles.infoTitle, { color: t.colors.inkHigh, marginBottom: 8 }]}>Karte</Text>
                  <View style={styles.mapWrap}>
                    <MapView
                      provider={PROVIDER_GOOGLE}
                      style={StyleSheet.absoluteFill}
                      initialRegion={mapRegion}
                      showsUserLocation={!!userPos} // native blue dot optional
                      toolbarEnabled={false}
                      pitchEnabled={false}
                      rotateEnabled={false}
                      loadingEnabled
                    />
                    {/* Offer Marker */}
                    {geo && (
                      <Marker
                        coordinate={{ latitude: geo.lat, longitude: geo.lng }}
                        title={offer?.name || 'Ziel'}
                        description="Angebot"
                      />
                    )}
                    {/* User Marker (optional, wenn vorhanden) */}
                    {userPos && (
                      <Marker
                        coordinate={{ latitude: userPos.lat, longitude: userPos.lng }}
                        title="Du"
                        description="Aktuelle Position"
                        pinColor="#0d4ea6"
                      />
                    )}
                  </View>
                  <Text style={[styles.mapHint, { color: t.colors.inkLow }]}>
                    Hinweis: Position nur zur Orientierung; Navigation starten über „Route starten“.
                  </Text>
                </View>
              )}

              {/* Extra Bottom Padding, damit der Sticky-CTA nicht überlappt */}
              <View style={{ height: Math.max(88, 56 + insets.bottom) }} />
            </>
          )}
        </ScrollView>

        {/* STICKY CTA-FOOTER (Safe-Area unten) */}
        {!loading && !err && offer && (
          <SafeAreaView style={{ backgroundColor: t.colors.background }}>
            <View style={[styles.footer, { borderTopColor: t.colors.divider, paddingBottom: 12 + insets.bottom }]}>
              <View style={{ flex: 1 }}>
                <Button
                  title="Route starten"
                  variant="primary"
                  size="lg"
                  onPress={() => {
                    // WICHTIG: ID bleibt erhalten; keine Änderung an Push/Geo-Logik.
                    router.push({ pathname: '/(tabs)/NavigationScreen', params: { id } });
                  }}
                />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Button title="Merken" variant="secondary" size="lg" onPress={() => {}} />
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
  // Safe-Area-freundlich: oben/unten über Insets
  scroll: { paddingHorizontal: 16 },
  header: { marginBottom: 12 },
  backBtn: { marginBottom: 8, alignSelf: 'flex-start' },
  backText: { fontSize: 14, fontWeight: '700' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { flex: 1, fontSize: 22, fontWeight: '800', lineHeight: 26 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  badge: { marginRight: 6, marginBottom: 6 },

  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  err: { fontSize: 14, textAlign: 'center' },

  imagesRow: { flexDirection: 'row', marginTop: 12, marginBottom: 8 },
  img: { width: IMG_W, height: IMG_H, borderRadius: 10, backgroundColor: '#eee', marginRight: 8 },
  imgPlaceholder: { width: IMG_W, height: IMG_H, borderRadius: 10, backgroundColor: '#e9eef5', marginRight: 8 },

  desc: { marginTop: 8, fontSize: 15, lineHeight: 21 },

  infoBox: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: '#f7f8fb' },
  infoTitle: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  infoText: { fontSize: 14 },

  mapCard: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: '#f7f8fb' },
  mapWrap: {
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#e9eef5',
  },
  mapHint: { marginTop: 8, fontSize: 12 },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
