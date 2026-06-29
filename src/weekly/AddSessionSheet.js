/* Shared "add a session" bottom sheet — pick an identity, a time (roll wheel),
   and a length. Used by both the manual builder and the arranged-week ("Your
   Week") editor. Calls onAdd(identity, minutesOfDay, mins); the caller inserts
   the session into its plan. */
import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useTheme } from '../store/Store';
import { Button } from '../components/primitives';
import Icon from '../components/Icon';
import TimePicker from './TimePicker';
import { serif, sans } from '../theme/fonts';

const LENGTHS = [15, 30, 45, 60, 90];

export default function AddSessionSheet({ dayLabel, identities, onAdd, onClose }) {
  const { t, colorsFor } = useTheme();
  const [id, setId] = useState(null);
  const [time, setTime] = useState(420); // 7:00 AM
  const [mins, setMins] = useState(30);

  const picked = id ? identities.find((i) => i.id === id) : null;
  const accent = picked ? colorsFor(picked).color : t.ink;

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 }}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(20,16,12,0.4)' }} onPress={onClose} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: t.surface, borderTopLeftRadius: 34, borderTopRightRadius: 34, paddingHorizontal: 22, paddingTop: 16, paddingBottom: 40 }}>
        <View style={{ width: 44, height: 5, borderRadius: 999, backgroundColor: t.line, alignSelf: 'center', marginBottom: 18 }} />
        <Text style={{ fontFamily: serif(500), fontSize: 22, color: t.ink, marginBottom: 16 }}>Add to {dayLabel}</Text>

        <Text style={{ fontSize: 12.5, fontFamily: sans(700), letterSpacing: 0.4, textTransform: 'uppercase', color: t.inkFaint, marginBottom: 8 }}>Identity</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
          {identities.map((idn) => {
            const on = id === idn.id; const c = colorsFor(idn);
            return (
              <Pressable key={idn.id} onPress={() => setId(idn.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 999, borderWidth: 1.5, borderColor: on ? c.color : t.line, backgroundColor: on ? c.soft : t.surface }}>
                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c.color }} />
                <Text style={{ fontSize: 14, fontFamily: sans(600), color: on ? c.color : t.ink }}>{idn.name}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={{ fontSize: 12.5, fontFamily: sans(700), letterSpacing: 0.4, textTransform: 'uppercase', color: t.inkFaint, marginBottom: 8 }}>Time</Text>
        <View style={{ marginBottom: 18 }}>
          <TimePicker initialHour={Math.floor(time / 60)} initialMin={time % 60} tint={accent} onChange={(h, m) => setTime(h * 60 + m)} />
        </View>

        <Text style={{ fontSize: 12.5, fontFamily: sans(700), letterSpacing: 0.4, textTransform: 'uppercase', color: t.inkFaint, marginBottom: 8 }}>Length</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 22 }}>
          {LENGTHS.map((l) => {
            const on = mins === l;
            return (
              <Pressable key={l} onPress={() => setMins(l)} style={{ flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: t.radii.sm, borderWidth: 1, borderColor: on ? accent : t.line, backgroundColor: on ? t.surface2 : t.surface }}>
                <Text style={{ fontSize: 14, fontFamily: sans(on ? 700 : 600), color: on ? accent : t.inkSoft }}>{l}m</Text>
              </Pressable>
            );
          })}
        </View>

        <Button onPress={() => picked && onAdd(picked, time, mins)} disabled={!picked} style={picked ? { backgroundColor: accent } : undefined}>
          <Icon name="check" size={18} stroke={2.4} color={t.bg} />
          <Text style={{ marginLeft: 8, color: t.bg, fontFamily: sans(600), fontSize: 16 }}>Add session</Text>
        </Button>
        <Pressable onPress={onClose} hitSlop={8} style={({ pressed }) => ({ alignSelf: 'center', marginTop: 12, opacity: pressed ? 0.6 : 1 })}>
          <Text style={{ fontSize: 14.5, fontFamily: sans(600), color: t.inkFaint }}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}
