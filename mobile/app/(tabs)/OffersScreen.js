import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import colors from '../../theme/colors';

export default function OffersScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.headline}>Angebote</Text>
      <Text style={styles.subheadline}>
        Hier findest du alle Angebote, die zu deinen Interessen und deinem Standort passen.
      </Text>
      {/* Angebotsliste folgt im weiteren Ausbau */}
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
    // fontFamily: fonts.bold,
    fontWeight: 'bold',
    fontSize: 23,
    color: colors.primary,
    marginBottom: 14,
  },
  subheadline: {
    // fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 14,
  },
});
