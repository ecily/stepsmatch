// /mobile/app/_layout.js

import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { ThemeProvider } from '@react-navigation/native';
import colors from '../theme/colors';
import fonts from '../theme/fonts';
console.log('FONTS in _layout.js:', fonts);
import { View } from 'react-native';

export default function RootLayout() {
  const [loaded] = useFonts({
    [fonts.regular]: require('../assets/fonts/Inter-Regular.ttf'),
    [fonts.medium]: require('../assets/fonts/Inter-Medium.ttf'),
    [fonts.bold]: require('../assets/fonts/Inter-Bold.ttf'),
    [fonts.logo]: require('../assets/fonts/Manrope-Bold.ttf'),
  });

  if (!loaded) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  // Theme-Objekt für ThemeProvider
  const customTheme = {
    dark: false,
    colors: {
      primary: colors.primary,
      background: colors.background,
      card: colors.white,
      text: colors.text,
      border: colors.accent,
      notification: colors.primary,
    },
  };

  return (
    <ThemeProvider value={customTheme}>
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
