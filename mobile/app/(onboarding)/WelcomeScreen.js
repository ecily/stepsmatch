import React, { useRef, useEffect } from 'react';
import { Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import colors from '../../theme/colors';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

export default function WelcomeScreen() {
  const router = useRouter();

  // Animations
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const headlineY = useRef(new Animated.Value(12)).current;
  const headlineOpacity = useRef(new Animated.Value(0)).current;
  const textY = useRef(new Animated.Value(12)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const buttonY = useRef(new Animated.Value(16)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // sanfter „pop-in“ fürs Logo, danach Stagger für Text & Button
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 7,
          tension: 80,
          useNativeDriver: true,
        }),
      ]),
      Animated.stagger(90, [
        Animated.parallel([
          Animated.timing(headlineOpacity, {
            toValue: 1,
            duration: 320,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(headlineY, {
            toValue: 0,
            duration: 320,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(textOpacity, {
            toValue: 1,
            duration: 320,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(textY, {
            toValue: 0,
            duration: 320,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(buttonOpacity, {
            toValue: 1,
            duration: 320,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(buttonY, {
            toValue: 0,
            duration: 320,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
  }, [logoOpacity, logoScale, headlineOpacity, headlineY, textOpacity, textY, buttonOpacity, buttonY]);

  const handleStart = async () => {
    try { await Haptics.selectionAsync(); } catch {}
    router.replace('/(onboarding)/LocationScreen');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Animated.Image
        source={require('../../assets/logo.png')}
        style={[
          styles.logo,
          { opacity: logoOpacity, transform: [{ scale: logoScale }] },
        ]}
        resizeMode="contain"
        accessibilityRole="image"
        accessibilityIgnoresInvertColors
        accessible
        accessibilityLabel="StepsMatch Logo"
      />

      <Animated.Text
        style={[
          styles.headline,
          { opacity: headlineOpacity, transform: [{ translateY: headlineY }] },
        ]}
        accessibilityRole="header"
        allowFontScaling
      >
        finden. nicht suchen.
      </Animated.Text>

      <Animated.Text
        style={[
          styles.subheadline,
          { opacity: textOpacity, transform: [{ translateY: textY }] },
        ]}
        allowFontScaling
      >
        Willkommen bei StepsMatch! Finde Angebote in deiner Nähe, die wirklich zu dir passen.
      </Animated.Text>

      <Animated.View
        style={{
          opacity: buttonOpacity,
          transform: [{ translateY: buttonY }],
          width: '100%',
        }}
      >
        <TouchableOpacity
          style={styles.button}
          onPress={handleStart}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel="Jetzt starten"
          testID="welcome-start"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.buttonText} allowFontScaling>Jetzt starten</Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32, // Safe-Area-freundlich – kein Randkontakt
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 28,
  },
  headline: {
    fontWeight: 'bold',
    fontSize: 30,
    color: colors.primary, // Brand-Blau #0d4ea6
    marginBottom: 12,
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  subheadline: {
    fontSize: 17,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 24,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 44,
    minHeight: 48, // ≥ 44dp Tap-Target
    shadowColor: colors.primary,
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 3,
    alignSelf: 'center',
  },
  buttonText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 18,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
});
