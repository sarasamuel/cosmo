/* "Alignment over time" bar trend. Ported from WeekScoreTrend in screens2.jsx.
   Oldest → newest, capped to 8 bars for legibility. */
import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../store/Store';
import { sans } from '../theme/fonts';

export default function WeekScoreTrend({ weeks }) {
  const { t } = useTheme();
  const ordered = [...weeks].slice(0, 8).reverse();
  const max = 100;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 86 }}>
      {ordered.map((w, k) => (
        <View key={w.label} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 12, fontFamily: sans(700), color: t.inkSoft }}>{w.aligned}</Text>
          <View style={{ width: '100%', height: 56, justifyContent: 'flex-end', alignItems: 'center' }}>
            <View
              style={{
                width: 22,
                height: (w.aligned / max) * 56,
                borderRadius: 6,
                backgroundColor: w.aligned < 50 ? t.warn : t.good,
                opacity: 0.4 + 0.6 * (k / (ordered.length - 1 || 1)),
              }}
            />
          </View>
          <Text style={{ fontSize: 10.5, fontFamily: sans(600), color: t.inkFaint }}>{w.label.split(' – ')[0]}</Text>
        </View>
      ))}
    </View>
  );
}
