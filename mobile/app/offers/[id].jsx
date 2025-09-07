// stepsmatch/mobile/app/offers/[id].tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Image, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import axios from 'axios';
import { useTheme } from '../../theme/ThemeProvider';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { isOfferActiveNow } from '../../utils/isOfferActiveNow';

const API_URL = 'https://lobster-app-ie9a5.ondigitalocean.app/api';
const api = axios.create({ baseURL: API_URL, timeout: 12000 });

const OID24 = /^[0-9a-fA-F]{24}$/;

function toNumber(val) {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
  }
  return null;
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
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
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    return null;
  } catch {
    return null;
  }
}

function pickRadiusMeters(o) {
  const candidates = [
    o?.radiusMeters, o?.radius_m, o?.radiusM, o?.radius, o?.range, o?.distanceRadius, o?.geoRadiusM,
    o?.provider?.radiusMeters, o?.provider?.radius_m, o?.provider?.radiusM, o?.provider?.radius,
  ].map(toNumber);
  for (const v of candidates) {
    if (Number.isFinite(v) && v > 0) return v;
  }
  return 150;
}

export default function OfferDetailsScreen() {
  const router = useRouter();
  const t = useTheme();
  const { id: idParam } = useLocalSearchParams();

  const id = useMemo(() => (typeof idParam === 'string' ? idParam.trim() : ''), [idParam]);
  const validId = useMemo(() => OID24.test(id), [id]);

  const [offer, setOffer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const mountedRef = useRef(true);

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
      } catch (e) {
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

  const isActive = useMemo(() => (offer ? isOfferActiveNow(offer, 'Europe/Vienna', new Date()) : false), [offer]);
  const geo = useMemo(() => (offer ? pickOfferLatLng(offer) : null), [offer]);
  const radiusM = useMemo(() => (offer ? pickRadiusMeters(offer) : null), [offer]);

  return (
    <View style={[styles.container, { backgroundColor: t.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
            <Text style={[styles.backText, { color: t.colors.primary }]}>Zurück</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: t.colors.inkHigh }]} numberOfLines={2}>
            {offer?.name ?? 'Angebot'}
          </Text>
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
              <Button title="Nochmal versuchen" variant="primary" size="md" onPress={() => router.replace(`/offers/${id}`)} />
            </View>
          </View>
        )}

        {/* Content */}
        {!loading && !err && offer && (
          <>
            {/* Bilder */}
            <View style={styles.imagesRow}>
              {(offer.images || []).slice(0, 3).map((src, i) =>
                !!src ? <Image key={i} source={{ uri: src }} style={styles.img} /> : <View key={i} style={styles.imgPlaceholder} />
              )}
            </View>

            {/* Beschreibung */}
            {!!offer.description && (
              <Text style={[styles.desc, { color: t.colors.ink }]}>{offer.description}</Text>
            )}

            {/* Geo / Distanz (statisch) */}
            {geo && (
              <View style={styles.infoBox}>
                <Text style={[styles.infoTitle, { color: t.colors.inkHigh }]}>Ort</Text>
                <Text style={[styles.infoText, { color: t.colors.ink }]}>
                  Lat {geo.lat.toFixed(5)} · Lng {geo.lng.toFixed(5)} · Radius {radiusM} m
                </Text>
              </View>
            )}

            {/* CTA */}
            <View style={styles.ctaRow}>
              <View style={{ flex: 1 }}>
                <Button
                  title="Route starten"
                  variant="primary"
                  size="lg"
                  onPress={() => {
                    // WICHTIG: mit ID zur Navigation
                    router.push({ pathname: '/(tabs)/NavigationScreen', params: { id } });
                  }}
                />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Button title="Merken" variant="secondary" size="lg" onPress={() => {}} />
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const IMG_W = 110;
const IMG_H = 86;

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 32 },
  header: { marginBottom: 12 },
  backBtn: { marginBottom: 8 },
  backText: { fontSize: 14, fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '800', lineHeight: 26 },
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

  ctaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18 },
});
