/* Tiny area+line sparkline, ported from Sparkline in components.jsx. */
import React from 'react';
import Svg, { Defs, LinearGradient, Stop, Path, Circle } from 'react-native-svg';

export default function Sparkline({ data, color, w = 96, h = 30, gid }) {
  const max = Math.max(...data, 0.01);
  const pts = data.map((d, i) => [(i / (data.length - 1)) * w, h - (d / max) * (h - 4) - 2]);
  const path = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = path + ` L${w} ${h} L0 ${h} Z`;
  const id = gid || 'sg-' + Math.round(w * 131 + h);
  const last = pts[pts.length - 1];
  return (
    <Svg width={w} height={h}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Path d={area} fill={`url(#${id})`} />
      <Path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={last[0]} cy={last[1]} r="2.6" fill={color} />
    </Svg>
  );
}
