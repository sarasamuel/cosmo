/* Decorative twinkling starfield. Stars are generated once from a seeded RNG
   (stable across renders). Twinkle is driven by a few looping Animated values
   (grouped) rather than one-per-star, to stay cheap. */
import React, { useRef, useEffect, useMemo } from 'react';
import { Animated, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../store/Store';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const GROUPS = 4;

function makeStars(n, w, h, seed) {
  let s = seed || 7;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  return Array.from({ length: n }, (_, i) => ({
    x: rnd() * w,
    y: rnd() * h,
    r: 0.4 + rnd() * 1.4,
    o: 0.18 + rnd() * 0.6,
    g: i % GROUPS,
  }));
}

export default function Starfield({ count = 72, color }) {
  const { t } = useTheme();
  const star = color || t.star; // override lets a deep-space overlay keep light stars in light mode
  const { width, height } = useWindowDimensions();
  const stars = useMemo(() => makeStars(count, width, height, 99), [count, width, height]);

  const vals = useRef(Array.from({ length: GROUPS }, () => new Animated.Value(0))).current;
  useEffect(() => {
    const loops = vals.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 420),
          Animated.timing(v, { toValue: 1, duration: 1700, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 1700, useNativeDriver: true }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [vals]);

  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none" width={width} height={height}>
      {stars.map((st, i) => (
        <AnimatedCircle
          key={i}
          cx={st.x}
          cy={st.y}
          r={st.r}
          fill={star}
          opacity={vals[st.g].interpolate({ inputRange: [0, 1], outputRange: [0.25 * st.o + 0.05, st.o] })}
        />
      ))}
    </Svg>
  );
}
