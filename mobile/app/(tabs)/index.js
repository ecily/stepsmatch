import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import colors from '../../theme/colors';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.headline}>Willkommen bei Stepsmatch</Text>
      <Text style={styles.subheadline}>
        Deine persönlichen Angebote werden hier angezeigt, sobald du die Standortfreigabe und deine Interessen abgeschlossen hast.
      </Text>
    </View>
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
    width: 85,
    height: 85,
    marginBottom: 30,
  },
  headline: {
    fontWeight: 'bold',
    fontSize: 23,
    color: colors.primary,
    marginBottom: 14,
  },
  subheadline: {
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 14,
  },
});
