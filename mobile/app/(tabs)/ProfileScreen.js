// /mobile/app/(tabs)/ProfileScreen.js

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import colors from '../../theme/colors';
import fonts from '../../theme/fonts';

export default function ProfileScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.headline}>Profil</Text>
      <Text style={styles.subheadline}>
        Hier kannst du deine persönlichen Einstellungen anpassen.
      </Text>
      {/* Erweiterung: Login, Einstellungen, Interessen-Reset etc. */}
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
  headline: {
    fontFamily: fonts.bold,
    fontSize: 23,
    color: colors.primary,
    marginBottom: 14,
  },
  subheadline: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 14,
  },
});
