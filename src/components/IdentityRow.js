/* A single identity row with glyph, name, actual/desired %, and dual bar.
   Ported from IdentityRow in components.jsx. */
import React from 'react';
import { Pressable, View, Text } from 'react-native';
import { useTheme } from '../store/Store';
import { Glyph } from './primitives';
import DualBar from './DualBar';
import { sans } from '../theme/fonts';

export default function IdentityRow({ idn, onTap, topBorder }) {
  const { t, colorsFor } = useTheme();
  const c = colorsFor(idn);
  return (
    <Pressable
      onPress={() => onTap && onTap(idn)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        paddingVertical: 14,
        paddingHorizontal: 4,
        borderRadius: 14,
        borderTopWidth: topBorder ? 1 : 0,
        borderTopColor: t.line2,
        backgroundColor: pressed ? t.surface2 : 'transparent',
      })}
    >
      <Glyph char={idn.glyph} size={38} fontSize={18} color={c.color} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 9 }}>
          <Text style={{ fontSize: 16.5, fontFamily: sans(600), color: t.ink }}>{idn.name}</Text>
          <Text style={{ fontSize: 14, fontFamily: sans(600), color: t.inkSoft }}>
            {idn.actual}
            <Text style={{ color: t.inkFaint }}> / {idn.desired}%</Text>
          </Text>
        </View>
        <DualBar actual={idn.actual} desired={idn.desired} color={c.color} />
      </View>
    </Pressable>
  );
}
