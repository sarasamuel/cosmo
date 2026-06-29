/* Draggable circular minute dial, ported from MinuteDial in components.jsx.
   Drag uses PanResponder; touch position -> angle -> value (snapped to 5).
   Sizes itself to the available width (capped at 240) so it never overflows on
   narrow screens. */
import React, { useRef, useState } from 'react';
import { View, Text, PanResponder } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useTheme } from '../store/Store';
import { serif, sans } from '../theme/fonts';

const START = -220;
const SWEEP = 260;
const MAX_SIZE = 240;

export default function MinuteDial({ value, max = 180, onChange, color, onActiveChange }) {
  const { t } = useTheme();
  const [boxW, setBoxW] = useState(0);

  const size = boxW > 0 ? Math.min(MAX_SIZE, boxW) : MAX_SIZE;
  const k = size / MAX_SIZE; // scale factor for strokes / fonts
  const R = size * 0.4;
  const cx = size / 2;
  const cy = size / 2;

  const polar = (a) => [cx + R * Math.cos((a * Math.PI) / 180), cy + R * Math.sin((a * Math.PI) / 180)];
  const arcPath = (a0, a1) => {
    const [x0, y0] = polar(a0);
    const [x1, y1] = polar(a1);
    const large = a1 - a0 > 180 ? 1 : 0;
    return `M${x0} ${y0} A${R} ${R} 0 ${large} 1 ${x1} ${y1}`;
  };

  const frac = Math.max(0, Math.min(1, value / max));
  const ang = START + frac * SWEEP;
  const [kx, ky] = polar(ang);

  // pan handlers are created once; route through a ref so they always read the
  // current geometry/onChange (both depend on the measured size).
  const fnRef = useRef(null);
  const activeRef = useRef(null);
  activeRef.current = onActiveChange || (() => {});
  fnRef.current = (x, y) => {
    const px = x - cx;
    const py = y - cy;
    let a = (Math.atan2(py, px) * 180) / Math.PI;
    let rel = a - START;
    while (rel < 0) rel += 360;
    while (rel > 360) rel -= 360;
    if (rel > SWEEP) {
      rel = rel - SWEEP > (360 - SWEEP) / 2 ? 0 : SWEEP;
    }
    const v = Math.round(((rel / SWEEP) * max) / 5) * 5;
    onChange(Math.max(0, Math.min(max, v)));
  };

  const pan = useRef(
    PanResponder.create({
      // capture the gesture before the enclosing ScrollView (so a rotating drag
      // turns the dial instead of scrolling the sheet) and never yield it mid-drag.
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => { activeRef.current(true); fnRef.current(e.nativeEvent.locationX, e.nativeEvent.locationY); },
      onPanResponderMove: (e) => fnRef.current(e.nativeEvent.locationX, e.nativeEvent.locationY),
      onPanResponderRelease: () => activeRef.current(false),
      onPanResponderTerminate: () => activeRef.current(false),
    })
  ).current;

  return (
    <View style={{ width: '100%', alignItems: 'center' }} onLayout={(e) => setBoxW(e.nativeEvent.layout.width)}>
      <View style={{ width: size, height: size }} {...pan.panHandlers}>
        <Svg width={size} height={size}>
          <Path d={arcPath(START, START + SWEEP)} fill="none" stroke={t.surface3} strokeWidth={16 * k} strokeLinecap="round" />
          <Path d={arcPath(START, ang)} fill="none" stroke={color} strokeWidth={16 * k} strokeLinecap="round" />
          <Circle cx={kx} cy={ky} r={15 * k} fill={t.surface} stroke={color} strokeWidth={4 * k} />
        </Svg>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
          <Text style={{ fontFamily: serif(500), fontSize: 58 * k, lineHeight: 60 * k, color: t.ink }}>{value}</Text>
          <Text style={{ fontSize: Math.max(12, 14 * k), fontFamily: sans(600), color: t.inkFaint, letterSpacing: 0.5 }}>minutes</Text>
        </View>
      </View>
    </View>
  );
}
