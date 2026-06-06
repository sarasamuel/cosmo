/* Circular progress ring with an animated count-up number, ported from
   AlignmentRing in components.jsx. */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../store/Store';
import { serif, sans } from '../theme/fonts';

export default function AlignmentRing({ value, size = 132, stroke = 11, label = 'aligned' }) {
  const { t } = useTheme();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [shown, setShown] = useState(0);
  const raf = useRef(null);

  useEffect(() => {
    let start;
    const from = 0;
    const step = (ts) => {
      try {
        if (!start) start = ts;
        const k = Math.min(1, (ts - start) / 1100);
        setShown(Math.round(from + (value - from) * (1 - Math.pow(1 - k, 3))));
        if (k < 1) raf.current = requestAnimationFrame(step);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('AlignmentRing animation error:', e);
      }
    };
    raf.current = requestAnimationFrame(step);
    return () => raf.current && cancelAnimationFrame(raf.current);
  }, [value]);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={t.surface3} strokeWidth={stroke} />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={t.ink}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - shown / 100)}
          rotation={-90}
          originX={size / 2}
          originY={size / 2}
        />
      </Svg>
      <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: serif(500), fontSize: 40, lineHeight: 42, color: t.ink }}>
          {shown}
          <Text style={{ fontSize: 20 }}>%</Text>
        </Text>
        <Text style={{ fontSize: 12.5, fontFamily: sans(600), color: t.inkFaint, marginTop: 4, letterSpacing: 0.5 }}>{label}</Text>
      </View>
    </View>
  );
}
