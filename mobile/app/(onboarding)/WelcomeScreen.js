import React, { useRef, useEffect } from 'react';
import { Text, StyleSheet, Image, TouchableOpacity, Animated } from 'react-native';
import colors from '../../theme/colors';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Animation Refs
  const logoAnim = useRef(new Animated.Value(0)).current;
  const headlineAnim = useRef(new Animated.Value(0)).current;
  const textAnim = useRef(new Animated.Value(0)).current;
  const buttonAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(logoAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(headlineAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(textAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(buttonAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={[styles.container, { paddingBottom: insets.bottom || 24 }]}>
      <Animated.Image
        source={require('../../assets/logo.png')}
        style={[
          styles.logo,
          {
            opacity: logoAnim,
            transform: [{ scale: logoAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
          },
        ]}
        resizeMode="contain"
      />
      <Animated.Text
        style={[
          styles.headline,
          {
            opacity: headlineAnim,
            transform: [{ translateY: headlineAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
          },
        ]}
      >
        finden. nicht suchen.
      </Animated.Text>
      <Animated.Text
        style={[
          styles.subheadline,
          {
            opacity: textAnim,
            transform: [{ translateY: textAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
          },
        ]}
      >
        Willkommen bei Stepsmatch! Finde Angebote in deiner Nähe, die wirklich zu dir passen.
      </Animated.Text>
      <Animated.View
        style={{
          opacity: buttonAnim,
          transform: [{ translateY: buttonAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
          width: '100%',
        }}
      >
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.replace('/(onboarding)/LocationScreen')}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>Jetzt starten</Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logo: {
    width: 110,
    height: 110,
    marginBottom: 32,
  },
  headline: {
    fontWeight: 'bold',
    fontSize: 30,
    color: colors.primary,
    marginBottom: 14,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  subheadline: {
    fontSize: 17,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 32,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 44,
    shadowColor: colors.primary,
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
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
