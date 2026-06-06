/* Small alignment ring for week cards. Ported from MiniRing in weekly.jsx. */
import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../store/Store';
import { serif } from '../theme/fonts';

export default function MiniRing({ value, size = 56, stroke = 6 }) {
  const { t } = useTheme();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const warn = value < 50;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={t.surface3} strokeWidth={stroke} />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={warn ? t.warn : t.good}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - value / 100)}
          rotation={-90}
          originX={size / 2}
          originY={size / 2}
        />
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: serif(500), fontSize: size * 0.32, color: t.ink }}>{value}</Text>
      </View>
    </View>
  );
}
