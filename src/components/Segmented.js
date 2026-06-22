/* Segmented control with an animated sliding thumb. Ported from the .segmented
   CSS component. Segments are equal-width; the thumb animates to the active
   index. */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import { useTheme } from '../store/Store';
import { sans } from '../theme/fonts';

export default function Segmented({ options, value, onChange, style }) {
  const { t } = useTheme();
  const [w, setW] = useState(0);
  const pad = 5;
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const segW = w ? (w - pad * 2) / options.length : 0;
  const left = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(left, {
      toValue: pad + idx * segW,
      useNativeDriver: false,
      bounciness: 6,
      speed: 14,
    }).start();
  }, [idx, segW, left]);

  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={[
        {
          flexDirection: 'row',
          backgroundColor: t.surface2,
          borderWidth: 1,
          borderColor: t.line,
          borderRadius: 999,
          padding: pad,
        },
        style,
      ]}
    >
      {w > 0 && (
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: pad,
              bottom: pad,
              left,
              width: segW,
              backgroundColor: t.surface,
              borderRadius: 999,
            },
            t.shadow.sm,
          ]}
        />
      )}
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={{ flex: 1, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 }}
          >
            {o.icon}
            <Text style={{ color: on ? t.ink : t.inkSoft, fontFamily: sans(600), fontSize: 15 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
