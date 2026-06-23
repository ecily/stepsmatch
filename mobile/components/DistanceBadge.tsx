import React, { useMemo } from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

type DistanceBadgeProps = {
  meters?: number | null;
  distanceM?: number | null;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
  size?: 'sm' | 'md';
  compact?: boolean;
};

function formatDistance(m: number | null | undefined) {
  if (m == null || Number.isNaN(m)) return '-';
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

export function DistanceBadge({
  meters,
  distanceM,
  style,
  testID,
  accessibilityLabel,
  size = 'sm',
  compact = false,
}: DistanceBadgeProps) {
  const t = useTheme();
  const value = typeof meters === 'number' ? meters : distanceM;
  const label = useMemo(() => formatDistance(value), [value]);
  const effectiveSize = compact ? 'sm' : size;

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: t.mode === 'dark' ? 'rgba(31,111,235,0.24)' : 'rgba(31,111,235,0.12)',
          borderColor: t.mode === 'dark' ? 'rgba(31,111,235,0.4)' : 'rgba(31,111,235,0.24)',
          paddingHorizontal: effectiveSize === 'md' ? 10 : 8,
          paddingVertical: effectiveSize === 'md' ? 5 : 3,
        },
        style,
      ]}
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? `Entfernung ${label}`}
    >
      <Text style={[styles.text, { color: t.colors.primary, fontSize: effectiveSize === 'md' ? 13 : 12 }]} allowFontScaling>
        {label}
      </Text>
    </View>
  );
}

export default DistanceBadge;

const styles = StyleSheet.create({
  base: {
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: '700',
  },
});
