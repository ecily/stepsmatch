import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Animated, Easing } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import axios from 'axios';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import colors from '../../theme/colors';

const API_URL = 'https://lobster-app-ie9a5.ondigitalocean.app/api';

/* ---------- Kleine Chip-Komponente mit Press-Scale ---------- */
function InterestChip({ label, selected, onToggle }) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () =>
    Animated.timing(scale, { toValue: 0.96, duration: 90, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();

  const pressOut = () =>
    Animated.timing(scale, { toValue: 1, duration: 140, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();

  const handlePress = async () => {
    try { await Haptics.selectionAsync(); } catch {}
    onToggle(label);
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPressIn={pressIn}
        onPressOut={pressOut}
        onPress={handlePress}
        activeOpacity={0.9}
        style={[styles.chip, selected && styles.chipSelected]}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={label}
        testID={`chip-${label}`}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Text style={[styles.chipText, selected && styles.chipTextSelected]} allowFontScaling>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function InterestsScreen() {
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Micro-motions (Screen-In)
  const headOpacity = useRef(new Animated.Value(0)).current;
  const headY = useRef(new Animated.Value(12)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(headOpacity, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(headY, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.timing(contentOpacity, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [headOpacity, headY, contentOpacity]);

  // Daten laden + lokale Auswahl wiederherstellen
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [res, stored] = await Promise.all([
          axios.get(`${API_URL}/categories`),
          AsyncStorage.getItem('userInterests'),
        ]);
        if (!mounted) return;
        setCategories(Array.isArray(res.data) ? res.data : []);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) setSelected(parsed);
          } catch {}
        }
        setLoadError(false);
      } catch (err) {
        if (!mounted) return;
        setCategories([]);
        setLoadError(true);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const allSubcats = useMemo(() => {
    return categories.flatMap((c) => (Array.isArray(c.subcategories) ? c.subcategories : []));
  }, [categories]);

  const toggleInterest = (interest) => {
    setSelected((curr) => {
      const has = curr.includes(interest);
      if (has) return curr.filter((x) => x !== interest);
      return [...new Set([...curr, interest])];
    });
  };

  const handleRetry = () => {
    setLoading(true);
    setLoadError(false);
    setTimeout(() => {
      (async () => {
        try {
          const res = await axios.get(`${API_URL}/categories`);
          setCategories(Array.isArray(res.data) ? res.data : []);
          setLoadError(false);
        } catch {
          setCategories([]);
          setLoadError(true);
        } finally {
          setLoading(false);
        }
      })();
    }, 50);
  };

  // Speichern → DoneScreen + hasOnboarded setzen (Logik beibehalten)
  const handleSave = async () => {
    try { await Haptics.selectionAsync(); } catch {}
    const interestsJson = JSON.stringify(selected);
    try {
      await AsyncStorage.multiSet([
        ['userInterests', interestsJson],
        ['hasOnboarded', '1'],
      ]);
    } catch {
      await AsyncStorage.setItem('userInterests', interestsJson);
      await AsyncStorage.setItem('hasOnboarded', '1');
    }
    router.replace('/(onboarding)/DoneScreen');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top','bottom']}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText} allowFontScaling>Lade Kategorien…</Text>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top','bottom']}>
        <Text style={styles.errorText} allowFontScaling>Kategorien konnten nicht geladen werden.</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRetry} activeOpacity={0.9} testID="interests-retry">
          <Text style={styles.retryText} allowFontScaling>Erneut versuchen</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveButton, { marginTop: 12, backgroundColor: selected.length ? colors.primary : '#ccc' }]}
          onPress={handleSave}
          disabled={selected.length === 0}
          activeOpacity={0.9}
          testID="interests-continue"
        >
          <Text style={styles.saveText} allowFontScaling>Trotzdem fortfahren</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <Animated.Text
          style={[styles.headline, { opacity: headOpacity, transform: [{ translateY: headY }] }]}
          accessibilityRole="header"
          allowFontScaling
        >
          Wähle deine Interessen
        </Animated.Text>

        <Animated.View style={{ flex: 1, opacity: contentOpacity }}>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {categories.map((cat, idx) => (
              <View key={cat._id || `${cat.name}-${idx}`} style={styles.categorySection}>
                <Text style={styles.categoryTitle} allowFontScaling>{cat.name}</Text>
                <View style={styles.subcatRow}>
                  {(cat.subcategories || []).map((subcat) => (
                    <InterestChip
                      key={subcat}
                      label={subcat}
                      selected={selected.includes(subcat)}
                      onToggle={toggleInterest}
                    />
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        </Animated.View>
      </View>

      {/* Sticky Footer mit Safe-Area unten */}
      <SafeAreaView edges={['bottom']} style={styles.footerSafe}>
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, selected.length === 0 && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={selected.length === 0}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel="Auswahl speichern"
            testID="interests-save"
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={styles.saveText} allowFontScaling>Auswahl speichern</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  // genug Platz, damit der Sticky-Footer nichts überdeckt
  scrollContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 120 },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, paddingHorizontal: 24 },
  loadingText: { marginTop: 12, color: colors.text },
  errorText: { color: colors.text, textAlign: 'center', marginBottom: 16, fontSize: 16 },

  headline: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
    textAlign: 'center',
    paddingTop: 8,
    paddingHorizontal: 24,
    marginBottom: 12,
    letterSpacing: 0.2,
  },

  categorySection: { marginBottom: 22 },
  categoryTitle: { fontSize: 18, fontWeight: 'bold', color: colors.accent || colors.primary, marginBottom: 8 },
  subcatRow: { flexDirection: 'row', flexWrap: 'wrap' },

  chip: {
    backgroundColor: '#f2f3f5',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 18,
    margin: 6,
    borderWidth: 2,
    borderColor: '#e6e8eb',
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 15,
    color: '#3f3f46',
  },
  chipTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },

  footerSafe: { backgroundColor: colors.background },
  footer: { paddingHorizontal: 24, paddingBottom: 18, paddingTop: 8 },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: { backgroundColor: '#ccc' },
  saveText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },

  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  retryText: { color: '#fff', fontWeight: 'bold' },
});
