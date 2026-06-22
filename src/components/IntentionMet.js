/* Celebration overlay shown when an identity newly reaches its weekly intention.
   Sequence: the scrim dims, the core disc pops in, the intention ring *draws*
   itself around it, and once the ring closes a spark burst fires + the text
   fades up. Tap anywhere (or "Keep it up") to dismiss.

   Driver note: the ring uses strokeDashoffset, which react-native-svg can't run
   on the native driver, so that one value is JS-driven; everything else
   (opacity/transform) stays on the native driver. */
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, View, Text, Pressable, Easing } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../store/Store';
import { serif, sans } from '../theme/fonts';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 240;
const C = SIZE / 2; // center
const RING_R = 64;
const CORE_R = 50;
const CIRC = 2 * Math.PI * RING_R;
const SPARKS = 12;

export default function IntentionMet({ idn, onClose }) {
  const { t, colorsFor } = useTheme();
  const c = idn ? colorsFor(idn) : null;

  const dim = useRef(new Animated.Value(0)).current; // scrim
  const pop = useRef(new Animated.Value(0)).current; // core disc in
  const ring = useRef(new Animated.Value(0)).current; // ring draw (JS-driven)
  const spark = useRef(new Animated.Value(0)).current; // burst
  const textIn = useRef(new Animated.Value(0)).current;

  // fixed radial directions for the spark dots
  const dirs = useMemo(
    () => Array.from({ length: SPARKS }, (_, i) => {
      const a = (i / SPARKS) * Math.PI * 2;
      return { dx: Math.cos(a), dy: Math.sin(a) };
    }),
    []
  );

  useEffect(() => {
    if (!idn) return;
    dim.setValue(0); pop.setValue(0); ring.setValue(0); spark.setValue(0); textIn.setValue(0);
    Animated.parallel([
      Animated.timing(dim, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.spring(pop, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }),
    ]).start();
    // draw the ring, then fire the spark + reveal the text
    Animated.timing(ring, { toValue: 1, duration: 720, delay: 240, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(({ finished }) => {
      if (!finished) return;
      Animated.parallel([
        Animated.timing(spark, { toValue: 1, duration: 620, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(textIn, { toValue: 1, duration: 420, useNativeDriver: true }),
      ]).start();
    });
  }, [idn, dim, pop, ring, spark, textIn]);

  if (!idn) return null;

  const dashoffset = ring.interpolate({ inputRange: [0, 1], outputRange: [CIRC, 0] });
  const flashScale = spark.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] });
  const flashOp = spark.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.55, 0] });

  return (
    <Pressable onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 60, alignItems: 'center', justifyContent: 'center' }}>
      {/* dimmed scrim — light wash in light mode, near-black in dark */}
      <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.name === 'light' ? '#eceaf4' : '#05050c', opacity: dim.interpolate({ inputRange: [0, 1], outputRange: [0, t.name === 'light' ? 0.9 : 0.92] }) }} />

      <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
        {/* the forming intention ring */}
        <Svg width={SIZE} height={SIZE} style={{ position: 'absolute' }}>
          <Circle cx={C} cy={C} r={RING_R} fill="none" stroke={c.color} strokeWidth={2.5} strokeOpacity={0.12} />
          <AnimatedCircle
            cx={C}
            cy={C}
            r={RING_R}
            fill="none"
            stroke={c.color}
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={`${CIRC} ${CIRC}`}
            strokeDashoffset={dashoffset}
            transform={`rotate(-90 ${C} ${C})`}
          />
        </Svg>

        {/* spark: a quick expanding flash ring */}
        <Animated.View
          pointerEvents="none"
          style={{ position: 'absolute', width: RING_R * 2, height: RING_R * 2, borderRadius: RING_R, borderWidth: 2, borderColor: c.color, opacity: flashOp, transform: [{ scale: flashScale }] }}
        />

        {/* spark: radial dots bursting outward */}
        {dirs.map(({ dx, dy }, i) => {
          const tx = spark.interpolate({ inputRange: [0, 1], outputRange: [RING_R * 0.85 * dx, RING_R * 1.75 * dx] });
          const ty = spark.interpolate({ inputRange: [0, 1], outputRange: [RING_R * 0.85 * dy, RING_R * 1.75 * dy] });
          const op = spark.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] });
          const sc = spark.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.3, 1, 0.2] });
          return (
            <Animated.View
              key={i}
              pointerEvents="none"
              style={{ position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: c.color, opacity: op, transform: [{ translateX: tx }, { translateY: ty }, { scale: sc }] }}
            />
          );
        })}

        {/* core disc with the identity glyph */}
        <Animated.View style={{ alignItems: 'center', justifyContent: 'center', opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }}>
          <View style={{ position: 'absolute', width: CORE_R * 2.5, height: CORE_R * 2.5, borderRadius: CORE_R * 1.25, backgroundColor: c.color, opacity: 0.22 }} />
          <View style={{ width: CORE_R * 2, height: CORE_R * 2, borderRadius: CORE_R, backgroundColor: c.color, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ position: 'absolute', top: CORE_R * 0.35, left: CORE_R * 0.4, width: CORE_R * 0.9, height: CORE_R * 0.9, borderRadius: CORE_R * 0.45, backgroundColor: '#fff', opacity: 0.12 }} />
            <Text style={{ fontFamily: serif(500), fontSize: CORE_R * 0.86, color: '#fff' }}>{idn.glyph}</Text>
          </View>
        </Animated.View>
      </View>

      {/* copy + dismiss — fades up after the ring closes */}
      <Animated.View style={{ alignItems: 'center', paddingHorizontal: 40, marginTop: 28, opacity: textIn, transform: [{ translateY: textIn.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <View style={{ width: 22, height: 1, backgroundColor: c.color, opacity: 0.5 }} />
          <Text style={{ fontSize: 12.5, fontFamily: sans(700), letterSpacing: 2.4, textTransform: 'uppercase', color: c.color }}>Intention met</Text>
          <View style={{ width: 22, height: 1, backgroundColor: c.color, opacity: 0.5 }} />
        </View>
        <Text style={{ fontFamily: serif(500), fontSize: 30, lineHeight: 38, color: t.ink, textAlign: 'center' }}>
          You met your{'\n'}
          <Text style={{ fontFamily: serif(500, true), color: c.color }}>{idn.name}</Text> intention!
        </Text>
        <Text style={{ fontSize: 15.5, fontFamily: sans(500), color: t.inkSoft, textAlign: 'center', marginTop: 12 }}>
          <Text style={{ fontFamily: sans(700), color: t.ink }}>{idn.desired}%</Text> of your week, tended in full.
        </Text>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => ({ marginTop: 26, backgroundColor: c.color, borderRadius: 999, paddingVertical: 15, paddingHorizontal: 46, opacity: pressed ? 0.9 : 1 })}
        >
          <Text style={{ fontFamily: sans(700), fontSize: 16, color: '#0a0a15' }}>Keep it up!</Text>
        </Pressable>
      </Animated.View>
    </Pressable>
  );
}
