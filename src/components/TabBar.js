/* Bottom tab bar: Portfolio / Journal / [+] / Reflect / You.
   The center "+" is a floating log button. Ported from TabBar in components.jsx. */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTheme } from '../store/Store';
import Icon from './Icon';
import { sans } from '../theme/fonts';

const LEFT = [
  { id: 'home', label: 'Portfolio', icon: 'portfolio' },
  { id: 'journal', label: 'Journal', icon: 'book' },
];
const RIGHT = [
  { id: 'reflect', label: 'Reflect', icon: 'reflect' },
  { id: 'identities', label: 'You', icon: 'sparkle' },
];

function Tab({ t, tab, setTab, theme }) {
  const on = tab === t.id;
  return (
    <Pressable onPress={() => setTab(t.id)} style={{ flex: 1, alignItems: 'center', gap: 6, paddingVertical: 6 }}>
      <View style={{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={t.icon} size={24} color={on ? theme.ink : theme.inkFaint} />
      </View>
      <Text style={{ fontSize: 12, fontFamily: sans(600), color: on ? theme.ink : theme.inkFaint, letterSpacing: 0.2 }}>{t.label}</Text>
    </Pressable>
  );
}

export default function TabBar({ tab, setTab, onLog, bottomInset = 0 }) {
  const { t } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-around',
        paddingHorizontal: 30,
        paddingTop: 14,
        paddingBottom: 16 + bottomInset,
        gap: 6,
        backgroundColor: t.bg,
      }}
    >
      {LEFT.map((x) => (
        <Tab key={x.id} t={x} tab={tab} setTab={setTab} theme={t} />
      ))}
      <View style={{ marginHorizontal: 4 }}>
        <Pressable
          onPress={onLog}
          style={({ pressed }) => [
            {
              width: 62,
              height: 62,
              borderRadius: 31,
              backgroundColor: t.ink,
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ translateY: -8 }, { scale: pressed ? 0.93 : 1 }],
            },
            t.shadow.md,
          ]}
        >
          <Icon name="plus" size={28} color={t.bg} stroke={2} />
        </Pressable>
      </View>
      {RIGHT.map((x) => (
        <Tab key={x.id} t={x} tab={tab} setTab={setTab} theme={t} />
      ))}
    </View>
  );
}
