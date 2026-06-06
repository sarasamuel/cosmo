/* Home-screen prompt to plan the week. Ported from WeekPlanBanner in weekly.jsx.
   The unplanned state uses a soft writer→musician gradient; the planned state is
   a plain surface with a green check orb. */
import React from 'react';
import { Pressable, View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, LinearGradient as SvgGrad, Stop, Circle } from 'react-native-svg';
import { useTheme } from '../store/Store';
import Icon from '../components/Icon';
import { sans } from '../theme/fonts';

function ConicOrb({ size = 38 }) {
  const { t } = useTheme();
  const i = t.id;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgGrad id="wbOrb" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={i.musician.color} />
            <Stop offset="30%" stopColor={i.reader.color} />
            <Stop offset="55%" stopColor={i.painter.color} />
            <Stop offset="78%" stopColor={i.engineer.color} />
            <Stop offset="100%" stopColor={i.writer.color} />
          </SvgGrad>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#wbOrb)" />
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="sparkle" size={17} color="#fff" />
      </View>
    </View>
  );
}

export default function WeekPlanBanner({ week, planned, onPlan }) {
  const { t } = useTheme();

  if (planned) {
    return (
      <Pressable
        onPress={onPlan}
        style={({ pressed }) => [
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            padding: 16,
            paddingHorizontal: 18,
            borderRadius: t.radii.md,
            backgroundColor: t.surface,
            borderWidth: 1,
            borderColor: t.line,
            transform: [{ scale: pressed ? 0.99 : 1 }],
          },
          t.shadow.sm,
        ]}
      >
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: t.good, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="check" size={16} stroke={2.6} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14.5, fontFamily: sans(700), color: t.ink }}>This week is planned</Text>
          <Text style={{ fontSize: 12.5, fontFamily: sans(600), color: t.inkFaint }}>{week.label} · tap to retune</Text>
        </View>
        <Icon name="chevron" size={16} color={t.inkFaint} />
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPlan} style={({ pressed }) => [{ borderRadius: t.radii.md, transform: [{ scale: pressed ? 0.99 : 1 }] }, t.shadow.sm]}>
      <LinearGradient
        colors={[t.id.writer.soft, t.id.musician.soft]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.6 }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, paddingHorizontal: 18, borderRadius: t.radii.md, borderWidth: 1, borderColor: t.line }}
      >
        <ConicOrb />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontFamily: sans(700), color: t.ink }}>A new week begins</Text>
          <Text style={{ fontSize: 13, fontFamily: sans(600), color: t.inkSoft }}>Set your intentions for {week.label}</Text>
        </View>
        <View style={{ backgroundColor: t.ink, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 }}>
          <Text style={{ color: t.bg, fontFamily: sans(700), fontSize: 13 }}>Plan</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}
