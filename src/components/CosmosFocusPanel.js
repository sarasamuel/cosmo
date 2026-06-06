/* Floating "Log time" detail panel for the focused cosmos star/planet.
   Rendered at the app root (not inside the cosmos card) so it floats just above
   the tab bar regardless of how tall the card has grown or how far it's scrolled.
   Entrance is transform-only — an opacity entrance would be safe here, but we
   keep it transform-only to match the in-card panel's constraint. */
import React, { useEffect, useRef } from 'react';
import { Animated, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore, useTheme } from '../store/Store';
import { Glyph, Pill } from './primitives';
import Icon from './Icon';
import { serif, sans } from '../theme/fonts';

export default function CosmosFocusPanel() {
  const { t, colorsFor } = useTheme();
  const { cosmosFocus, clearCosmos, openLog } = useStore();
  const insets = useSafeAreaInsets();
  const ty = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    if (cosmosFocus) {
      ty.setValue(8);
      Animated.timing(ty, { toValue: 0, duration: 320, useNativeDriver: true }).start();
    }
  }, [cosmosFocus, ty]);

  if (!cosmosFocus) return null;
  const idn = cosmosFocus;
  const c = colorsFor(idn);
  const logIt = () => {
    clearCosmos();
    openLog(idn);
  };

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: 22,
          right: 22,
          bottom: 120 + insets.bottom,
          zIndex: 30,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          paddingVertical: 10,
          paddingLeft: 10,
          paddingRight: 12,
          borderRadius: 18,
          backgroundColor: t.surface2,
          borderWidth: 1,
          borderColor: t.line,
          transform: [{ translateY: ty }],
        },
        t.shadow.md,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Glyph char={idn.glyph} size={38} fontSize={18} color={c.color} />
        <View>
          <Text style={{ fontFamily: serif(500), fontSize: 20, color: t.ink }}>{idn.name}</Text>
          <Text style={{ fontSize: 12.5, fontFamily: sans(600), color: t.inkFaint }}>
            {idn.actual}% lived · {idn.desired}% intended
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pill bg={c.color} onPress={logIt}>
          <Icon name="plus" size={14} color="#fff" />
          <Text style={{ color: '#fff', fontFamily: sans(700), fontSize: 13 }}>Log time</Text>
        </Pill>
        <Pill bg={t.surface3} onPress={clearCosmos} style={{ width: 34, height: 34, paddingHorizontal: 0, justifyContent: 'center' }}>
          <Text style={{ color: t.inkSoft, fontSize: 13, fontFamily: sans(600) }}>✕</Text>
        </Pill>
      </View>
    </Animated.View>
  );
}
