// components/DistanceBadge.tsx
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';

type Props = {
  meters: number | null | undefined;
  style?: ViewStyle;
  testID?: string;
  accessibilityLabel?: string;
  size?: 'sm' | 'md'; // visueller Scale
};

const BRAND_BLUE = '#0d4ea6';

function formatDistance(m?: number | null) {
  if (m == null || Number.isNaN(m)) return '—';
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

export const DistanceBadge: React.FC<Props> = ({
  meters,
  style,
  testID,
  accessibilityLabel,
  size = 'sm',
}) => {
  const label = useMemo(() => formatDistance(meters), [meters]);
  const s = size === 'md' ? styles.md : styles.sm;

  return (
    <View
      style={[styles.base, s.wrap, style]}
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? `Entfernung ${label}`}
    >
      <Text style={[styles.text, s.text]} allowFontScaling>
        {label}
      </Text>
    </View>
  );
};

const R = { s1: 4, s2: 8, radius: 10 };

const styles = StyleSheet.create({
  base: {
    backgroundColor: `${BRAND_BLUE}1A`, // ~10% Alpha
    borderRadius: R.radius,
    alignSelf: 'flex-start',
  },
  text: {
    color: BRAND_BLUE,
    fontWeight: '600',
  },
  sm: {
    wrap: {
      paddingHorizontal: R.s2,
      paddingVertical: 2,
    },
    text: {
      fontSize: 12,
      lineHeight: 16,
    },
  },
  md: {
    wrap: {
      paddingHorizontal: R.s2 + 2,
      paddingVertical: 4,
    },
    text: {
      fontSize: 14,
      lineHeight: 18,
    },
  },
});
