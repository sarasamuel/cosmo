/* Faux iOS status bar (9:41, signal dots, battery) — part of the design
   language. The real OS status bar is hidden in App so this stands in. */
import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../store/Store';
import { sans } from '../theme/fonts';

export default function StatusBar() {
  const { t } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 32,
        paddingTop: 6,
        paddingBottom: 4,
      }}
    >
      <Text style={{ fontSize: 17, fontFamily: sans(600), color: t.ink, letterSpacing: 0.2 }}>9:41</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.ink, opacity: 0.85 }} />
        ))}
        <View
          style={{
            width: 26,
            height: 13,
            borderRadius: 3,
            borderWidth: 1.5,
            borderColor: t.ink,
            opacity: 0.85,
            padding: 2,
            paddingRight: 8,
            justifyContent: 'center',
          }}
        >
          <View style={{ flex: 1, backgroundColor: t.ink, borderRadius: 1 }} />
        </View>
      </View>
    </View>
  );
}
