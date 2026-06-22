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
  const isReview = toast && toast.kind === 'review';
  const isRetire = toast && toast.kind === 'retire';
  const isNotice = toast && toast.kind === 'notice'; // free-text message (e.g. schedule reminders)
  const showCheck = isPlan || isReview || isRetire; // these use the check badge, not an identity glyph
  const c = toast && toast.idn ? colorsFor(toast.idn) : null;
  const label = !toast
    ? ''
    : isNotice
    ? toast.message
    : isPlan
    ? 'This week is set'
    : isReview
    ? `Today saved · ${toast.mins}m across ${toast.count} ${toast.count === 1 ? 'identity' : 'identities'}`
    : isRetire
    ? `${toast.name} retired · kept in your history`
    : toast.full
    ? `${toast.mins}m of rest · allowance full`
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
          {isNotice ? (
            <Icon name="bell" size={18} stroke={2} color={t.bg} />
          ) : showCheck ? (
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: t.good, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="check" size={13} stroke={2.6} color="#fff" />
            </View>
          ) : (
            <Glyph char={toast.idn.glyph} size={24} fontSize={12} color={c.color} />
          )}
          <Text style={{ color: t.bg, fontSize: 15, fontFamily: sans(600), flexShrink: 1 }}>{label}</Text>
        </View>
      )}
    </Animated.View>
  );
}
