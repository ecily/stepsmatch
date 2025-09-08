import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import colors from '../../theme/colors';

export default function DoneScreen() {
  const router = useRouter();

  // Animations
  const ringScale = useRef(new Animated.Value(0.6)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const tickStroke = useRef(new Animated.Value(0)).current; // 0..1 Pfeillänge
  const titleY = useRef(new Animated.Value(12)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const subY = useRef(new Animated.Value(12)).current;
  const subOpacity = useRef(new Animated.Value(0)).current;
  const btnY = useRef(new Animated.Value(16)).current;
  const btnOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // kleines "Celebrate"
    (async () => {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    })();

    // Sequenz: Ring → Tick → Texte/CTA
    Animated.sequence([
      Animated.parallel([
        Animated.timing(ringOpacity, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(ringScale, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }),
      ]),
      Animated.timing(tickStroke, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.stagger(90, [
        Animated.parallel([
          Animated.timing(titleOpacity, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(titleY, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(subOpacity, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(subY, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(btnOpacity, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(btnY, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
      ]),
    ]).start();
  }, [ringOpacity, ringScale, tickStroke, titleOpacity, titleY, subOpacity, subY, btnOpacity, btnY]);

  const handleContinue = async () => {
    try {
      await AsyncStorage.setItem('hasOnboarded', '1');
      await Haptics.selectionAsync();
    } catch {}
    router.replace('/(tabs)');
  };

  // Tick „zeichnen“ via zwei Balken; proportional zur Länge einblenden
  const leftLen = tickStroke.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1] });
  const rightLen = tickStroke.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0, 1] });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <Animated.View style={[styles.ring, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]} accessibilityRole="image" accessibilityLabel="Erfolg">
          {/* Außenring */}
          <View style={styles.ringBg} />
          {/* Haken: zwei Teile, die nacheinander erscheinen */}
          <Animated.View style={[styles.tickLeft, { transform: [{ rotate: '-45deg' }, { scaleY: leftLen }] }]} />
          <Animated.View style={[styles.tickRight, { transform: [{ rotate: '45deg' }, { scaleY: rightLen }] }]} />
        </Animated.View>

        <Animated.Text
          style={[styles.title, { opacity: titleOpacity, transform: [{ translateY: titleY }] }]}
          accessibilityRole="header"
          allowFontScaling
        >
          Fertig!
        </Animated.Text>

        <Animated.Text
          style={[styles.subtitle, { opacity: subOpacity, transform: [{ translateY: subY }] }]}
          allowFontScaling
        >
          Deine Einstellungen sind gespeichert. Viel Spaß beim Entdecken in deiner Nähe.
        </Animated.Text>

        <Animated.View style={{ opacity: btnOpacity, transform: [{ translateY: btnY }], width: '100%' }}>
          <TouchableOpacity
            onPress={handleContinue}
            activeOpacity={0.9}
            style={styles.cta}
            accessibilityRole="button"
            accessibilityLabel="Los geht’s"
            testID="done-continue"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.ctaText} allowFontScaling>Los geht’s</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const SIZE = 140;
const TICK_THICK = 10;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32, // Safe-Area freundlich – kein Randkontakt
  },
  ring: {
    width: SIZE,
    height: SIZE,
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringBg: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 6,
    borderColor: colors.primary,
    backgroundColor: 'transparent',
  },
  // „✔“ aus zwei Linien; Skalierung über transform scaleY
  tickLeft: {
    position: 'absolute',
    width: TICK_THICK,
    height: SIZE * 0.26,
    backgroundColor: colors.primary,
    borderRadius: TICK_THICK / 2,
    left: SIZE * 0.34,
    top: SIZE * 0.46,
  },
  tickRight: {
    position: 'absolute',
    width: TICK_THICK,
    height: SIZE * 0.46,
    backgroundColor: colors.primary,
    borderRadius: TICK_THICK / 2,
    left: SIZE * 0.53,
    top: SIZE * 0.33,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 44,
    minHeight: 48, // ≥ 44dp Tap-Target
    shadowColor: colors.primary,
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 3,
    alignSelf: 'center',
  },
  ctaText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 18,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
});
