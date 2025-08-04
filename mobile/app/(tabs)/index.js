import React, { useEffect, useRef } from 'react';
import { Text, StyleSheet, Image, Animated, View, Dimensions } from 'react-native';
import colors from '../../theme/colors';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  // Animation Refs
  const logoAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const textAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Sequenzielles Animieren
    Animated.sequence([
      Animated.timing(logoAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(cardAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(textAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.outer}>
      <Animated.Image
        source={require('../../assets/logo.png')}
        style={[
          styles.logo,
          { opacity: logoAnim, transform: [{ scale: logoAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }
        ]}
        resizeMode="contain"
      />
      <Animated.View
        style={[
          styles.card,
          { opacity: cardAnim, transform: [{ translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }] }
        ]}
      >
        <Text style={styles.headline}>Willkommen bei Stepsmatch</Text>
        <Text style={styles.subheadline}>
          Deine persönlichen Angebote werden hier angezeigt, sobald du die Standortfreigabe und deine Interessen abgeschlossen hast.
        </Text>
      </Animated.View>
      <Animated.Text
        style={[
          styles.claim,
          { opacity: textAnim, transform: [{ translateY: textAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }
        ]}
      >
        finden. nicht suchen.
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  logo: {
    width: 110,
    height: 110,
    marginBottom: 18,
    marginTop: -24,
    alignSelf: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 15,
  },
  card: {
    width: width * 0.90,
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#003366',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
    elevation: 5,
    marginBottom: 32,
  },
  headline: {
    fontWeight: 'bold',
    fontSize: 26,
    color: colors.primary,
    marginBottom: 18,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  subheadline: {
    fontSize: 17,
    color: colors.text,
    textAlign: 'center',
    opacity: 0.88,
    marginBottom: 4,
  },
  claim: {
    fontSize: 18,
    color: colors.primary,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 10,
    letterSpacing: 0.5,
  },
});
