/* Screen backdrop — approximates the layered radial "nebula" gradients from the
   .screen[data-theme] CSS using react-native-svg RadialGradients. Sits behind
   all content (absolute fill). */
import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { useTheme } from '../store/Store';

export default function Backdrop() {
  const { t } = useTheme();
  const [g0, g1, glowA, glowB] = t.nebula;
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="bgTop" cx="50%" cy="-8%" rx="120%" ry="75%">
          <Stop offset="0%" stopColor={g0} stopOpacity="1" />
          <Stop offset="50%" stopColor={g1} stopOpacity="1" />
          <Stop offset="100%" stopColor={t.bg} stopOpacity="1" />
        </RadialGradient>
        <RadialGradient id="glowA" cx="82%" cy="14%" rx="58%" ry="46%">
          <Stop offset="0%" stopColor={glowA} stopOpacity="1" />
          <Stop offset="70%" stopColor={glowA} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="glowB" cx="13%" cy="80%" rx="52%" ry="42%">
          <Stop offset="0%" stopColor={glowB} stopOpacity="1" />
          <Stop offset="72%" stopColor={glowB} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={t.bg} />
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#bgTop)" />
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#glowA)" />
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#glowB)" />
    </Svg>
  );
}
