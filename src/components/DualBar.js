/* The dual progress bar: a track, an "actual" fill, and an optional "desired"
   intention tick. Ported from .dualbar CSS. */
import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../store/Store';

export default function DualBar({ actual, desired, color, height = 10, fillOpacity = 1 }) {
  const { t } = useTheme();
  return (
    <View style={{ height, borderRadius: 999, backgroundColor: t.surface3, overflow: 'visible' }}>
      <View style={{ height, borderRadius: 999, overflow: 'hidden' }}>
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${Math.min(100, actual)}%`,
            backgroundColor: color,
            opacity: fillOpacity,
            borderRadius: 999,
          }}
        />
      </View>
      {desired != null && (
        <View
          style={{
            position: 'absolute',
            top: -3,
            bottom: -3,
            left: `${Math.min(100, desired)}%`,
            width: 2.5,
            borderRadius: 2,
            backgroundColor: t.ink,
            opacity: 0.55,
          }}
        />
      )}
    </View>
  );
}
