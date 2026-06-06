/* Confirmation toast shown after logging a session. Slides/fades in, ported
   from the .toast CSS + App toast state. */
import React, { useEffect, useRef } from 'react';
import { Animated, View, Text } from 'react-native';
import { useTheme } from '../store/Store';
import { Glyph } from './primitives';
import Icon from './Icon';
import { sans } from '../theme/fonts';

export default function Toast({ toast, bottom = 130 }) {
  const { t, colorsFor } = useTheme();
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(v, {
      toValue: toast ? 1 : 0,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [toast, v]);

  const isPlan = toast && toast.kind === 'plan';
  const c = toast && toast.idn ? colorsFor(toast.idn) : null;
  const label = !toast
    ? ''
    : isPlan
    ? 'This week is set'
    : toast.spill > 0
    ? `${toast.mins}m logged · over your allowance → Drift`
    : `${toast.mins}m of ${toast.name} logged`;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom,
          alignItems: 'center',
          opacity: v,
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        },
      ]}
    >
      {toast && (
        <View
          style={[
            {
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              backgroundColor: t.ink,
              paddingVertical: 16,
              paddingHorizontal: 24,
              borderRadius: 999,
            },
            t.shadow.lg,
          ]}
        >
          {isPlan ? (
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: t.good, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="check" size={13} stroke={2.6} color="#fff" />
            </View>
          ) : (
            <Glyph char={toast.idn.glyph} size={24} fontSize={12} color={c.color} />
          )}
          <Text style={{ color: t.bg, fontSize: 15, fontFamily: sans(600) }}>{label}</Text>
        </View>
      )}
    </Animated.View>
  );
}
