/* Draggable circular minute dial, ported from MinuteDial in components.jsx.
   Drag uses PanResponder; touch position -> angle -> value (snapped to 5). */
import React, { useRef } from 'react';
import { View, Text, PanResponder } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useTheme } from '../store/Store';
import { serif, sans } from '../theme/fonts';

const START = -220;
const SWEEP = 260;
const SIZE = 240;
const R = 96;
const CX = SIZE / 2;
const CY = SIZE / 2;

const polar = (a) => [CX + R * Math.cos((a * Math.PI) / 180), CY + R * Math.sin((a * Math.PI) / 180)];

function arcPath(a0, a1) {
  const [x0, y0] = polar(a0);
  const [x1, y1] = polar(a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${x0} ${y0} A${R} ${R} 0 ${large} 1 ${x1} ${y1}`;
}

export default function MinuteDial({ value, max = 180, onChange, color }) {
  const { t } = useTheme();
  const frac = Math.max(0, Math.min(1, value / max));
  const ang = START + frac * SWEEP;
  const [kx, ky] = polar(ang);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const setFromXY = (x, y) => {
    const px = x - CX;
    const py = y - CY;
    let a = (Math.atan2(py, px) * 180) / Math.PI;
    let rel = a - START;
    while (rel < 0) rel += 360;
    while (rel > 360) rel -= 360;
    if (rel > SWEEP) {
      rel = rel - SWEEP > (360 - SWEEP) / 2 ? 0 : SWEEP;
    }
    const v = Math.round(((rel / SWEEP) * max) / 5) * 5;
    onChangeRef.current(Math.max(0, Math.min(max, v)));
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => setFromXY(e.nativeEvent.locationX, e.nativeEvent.locationY),
      onPanResponderMove: (e) => setFromXY(e.nativeEvent.locationX, e.nativeEvent.locationY),
    })
  ).current;

  return (
    <View style={{ width: SIZE, height: SIZE, alignSelf: 'center' }} {...pan.panHandlers}>
      <Svg width={SIZE} height={SIZE}>
        <Path d={arcPath(START, START + SWEEP)} fill="none" stroke={t.surface3} strokeWidth="16" strokeLinecap="round" />
        <Path d={arcPath(START, ang)} fill="none" stroke={color} strokeWidth="16" strokeLinecap="round" />
        <Circle cx={kx} cy={ky} r="15" fill={t.surface} stroke={color} strokeWidth="4" />
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
        <Text style={{ fontFamily: serif(500), fontSize: 58, lineHeight: 60, color: t.ink }}>{value}</Text>
        <Text style={{ fontSize: 14, fontFamily: sans(600), color: t.inkFaint, letterSpacing: 0.5 }}>minutes</Text>
      </View>
    </View>
  );
}
