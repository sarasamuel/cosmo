/* "A note from Cosmo" coach card. The original uses a conic-gradient orb of all
   identity hues; RN has no conic gradient, so we approximate with a multi-stop
   linear gradient SVG disc. */
import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { useTheme } from '../store/Store';
import { Card } from './primitives';
import Icon from './Icon';
import { serif, sans } from '../theme/fonts';

function Orb({ size = 32 }) {
  const { t } = useTheme();
  const i = t.id;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="coachOrb" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={i.musician.color} />
            <Stop offset="30%" stopColor={i.reader.color} />
            <Stop offset="55%" stopColor={i.painter.color} />
            <Stop offset="78%" stopColor={i.engineer.color} />
            <Stop offset="100%" stopColor={i.writer.color} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#coachOrb)" />
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="sparkle" size={16} color="#fff" />
      </View>
    </View>
  );
}

export default function CoachNote({ coach, compact }) {
  const { t } = useTheme();
  return (
    <Card style={{ padding: compact ? 24 : 30, backgroundColor: t.surface }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Orb />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 13.5, fontFamily: sans(700), color: t.ink }}>A note from Cosmo</Text>
          <Text style={{ fontSize: 12.5, fontFamily: sans(600), color: t.inkFaint }}>{coach.date}</Text>
        </View>
      </View>
      <Text style={{ fontFamily: serif(400), fontSize: compact ? 19 : 21, lineHeight: compact ? 28.5 : 31.5, color: t.ink }}>
        {coach.note}
      </Text>
    </Card>
  );
}
