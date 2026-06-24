import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import Button from '../../components/ui/Button';
import { API_BASE_URL } from '../../lib/runtimeConfig';
import { syncPushTokenUserContext } from '../../components/PushInitializer';

export default function InterestsScreen() {
  const router = useRouter();
  const t = useTheme();
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [res, rawProfile, stored] = await Promise.all([
          axios.get(`${API_BASE_URL}/categories`),
          AsyncStorage.getItem('userProfile'),
          AsyncStorage.getItem('userInterests'),
        ]);
        if (!mounted) return;
        setCategories(Array.isArray(res.data) ? res.data : []);
        if (rawProfile) {
          try {
            const profile = JSON.parse(rawProfile);
            if (Array.isArray(profile?.interests)) {
              setSelected(profile.interests);
              return;
            }
          } catch {}
        }
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) setSelected(parsed);
          } catch {}
        }
      } catch {
        if (!mounted) return;
        setCategories([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const allSubcats = useMemo(() => categories.flatMap((c) => (Array.isArray(c.subcategories) ? c.subcategories : [])), [categories]);

  const toggleInterest = (interest) => {
    setSelected((curr) => (curr.includes(interest) ? curr.filter((x) => x !== interest) : [...new Set([...curr, interest])]));
  };

  const handleSave = async () => {
    const nextInterests = (selected || []).map((s) => String(s || '').trim()).filter(Boolean);
    const csv = nextInterests.join(',');
    setSaving(true);
    setError('');

    try {
      const [token, storedUserId, rawProfile] = await Promise.all([
        AsyncStorage.getItem('token'),
        AsyncStorage.getItem('userId'),
        AsyncStorage.getItem('userProfile'),
      ]);

      let profile = null;
      try {
        profile = rawProfile ? JSON.parse(rawProfile) : null;
      } catch {
        profile = null;
      }

      const userId = String(storedUserId || profile?._id || '').trim();
      const preferredRadiusRaw = Number(profile?.preferredRadius);
      const preferredRadius = Number.isFinite(preferredRadiusRaw) && preferredRadiusRaw > 0 ? preferredRadiusRaw : 500;

      if (token && userId) {
        const res = await axios.put(
          `${API_BASE_URL}/users/preferences/${userId}`,
          { preferredRadius, interests: nextInterests },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const backendUser = res?.data?.user;
        profile = backendUser && typeof backendUser === 'object'
          ? { ...(profile || {}), ...backendUser, interests: Array.isArray(backendUser.interests) ? backendUser.interests : nextInterests }
          : { ...(profile || {}), _id: userId, preferredRadius, interests: nextInterests };
      } else if (profile && typeof profile === 'object') {
        profile = { ...profile, interests: nextInterests };
      }

      const pairs = [
        ['userInterests', JSON.stringify(nextInterests)],
        ['userInterests.csv', csv],
        ['hasOnboarded', '1'],
      ];
      if (profile && typeof profile === 'object') {
        pairs.push(['userProfile', JSON.stringify(profile)]);
      }

      await AsyncStorage.multiSet(pairs);
      await syncPushTokenUserContext('interests');
      router.replace('/(onboarding)/DoneScreen');
    } catch {
      setError('Interessen konnten nicht gespeichert werden. Bitte erneut versuchen.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: t.colors.background }]}>
        <ActivityIndicator color={t.colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <Text style={[styles.headline, { color: t.colors.inkHigh }]}>Was interessiert dich?</Text>
        <Text style={[styles.sub, { color: t.colors.inkLow }]}>Damit wir nur relevante Angebote senden, waehle deine Themen.</Text>
        {error ? <Text style={[styles.error, { color: t.colors.danger }]}>{error}</Text> : null}

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {categories.map((cat, idx) => (
            <View key={cat._id || `${cat.name}-${idx}`} style={styles.section}>
              <Text style={[styles.sectionTitle, { color: t.colors.inkHigh }]}>{cat.name}</Text>
              <View style={styles.row}>
                {(cat.subcategories || []).map((subcat) => {
                  const active = selected.includes(subcat);
                  return (
                    <TouchableOpacity
                      key={subcat}
                      onPress={() => toggleInterest(subcat)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: active ? t.colors.primary : t.colors.surface,
                          borderColor: active ? t.colors.primary : t.colors.divider,
                        },
                      ]}
                    >
                      <Text style={{ color: active ? '#fff' : t.colors.ink, fontWeight: '600' }}>{subcat}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          {saving ? (
            <ActivityIndicator color={t.colors.primary} />
          ) : (
            <Button title="Auswahl speichern" size="lg" onPress={handleSave} disabled={selected.length === 0 && allSubcats.length > 0} />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
  headline: { fontSize: 28, fontWeight: '800' },
  sub: { fontSize: 14, lineHeight: 20, marginTop: 6, marginBottom: 14 },
  error: { fontSize: 13, fontWeight: '700', marginBottom: 10 },
  scrollContent: { paddingBottom: 20 },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  footer: { paddingVertical: 12 },
});
