/* Compact in-app time picker for re-timing a scheduled session. No native
   dependency: vertical scroll wheels for hour (1–12) and minute (5-min steps).
   Each wheel's viewport is exactly one row tall, so only the selected value is
   visible — scroll up/down to advance. "Set" hands back a 24h hour + minute; the
   caller drops the session at that time and re-sorts the day. */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useTheme } from '../store/Store';
import { sans, serif } from '../theme/fonts';

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINS = Array.from({ length: 12 }, (_, i) => i * 5); // 00, 05, … 55
const ROW = 40; // height of one wheel row = the visible viewport

// a vertical wheel: the viewport is one row tall and clips everything else, so
// only the centered value shows. Scroll to spin; it snaps to the nearest value.
function Wheel({ data, value, onChange, format, tint }) {
  const { t } = useTheme();
  const ref = useRef(null);
  const idx = Math.max(0, data.indexOf(value));

  // center the current value on mount (no animation)
  useEffect(() => {
    if (ref.current) ref.current.scrollTo({ y: idx * ROW, animated: false });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const settle = (e) => {
    const i = Math.max(0, Math.min(data.length - 1, Math.round(e.nativeEvent.contentOffset.y / ROW)));
    if (data[i] !== value) onChange(data[i]);
  };

  return (
    <View style={{ width: 58, height: ROW, overflow: 'hidden', borderRadius: 10, borderWidth: 1.5, borderColor: tint, backgroundColor: t.surface2 }}>
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW}
        decelerationRate="fast"
        nestedScrollEnabled
        onMomentumScrollEnd={settle}
      >
        {data.map((d) => (
          <View key={d} style={{ height: ROW, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 20, fontFamily: serif(500), color: t.ink }}>{format ? format(d) : d}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export default function TimePicker({ initialHour = 8, initialMin = 0, tint, onChange }) {
  const { t } = useTheme();
  const accent = tint || t.ink;
  const [hour12, setHour12] = useState((initialHour % 12) || 12);
  const [min, setMin] = useState(Math.round((initialMin || 0) / 5) * 5 % 60);
  const [ampm, setAmpm] = useState(initialHour < 12 ? 'AM' : 'PM');
  const pad2 = (m) => String(m).padStart(2, '0');

  // report the live selection up; the parent's "Enter" button commits it
  useEffect(() => {
    const hour24 = ampm === 'PM' ? (hour12 % 12) + 12 : hour12 % 12;
    onChange(hour24, min);
  }, [hour12, min, ampm]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text style={{ width: 34, fontSize: 12, fontFamily: sans(700), color: t.inkFaint }}>Time</Text>
      <Wheel data={HOURS} value={hour12} onChange={setHour12} tint={accent} />
      <Text style={{ fontSize: 20, fontFamily: serif(500), color: t.inkSoft }}>:</Text>
      <Wheel data={MINS} value={min} onChange={setMin} tint={accent} format={pad2} />
      <View style={{ flexDirection: 'row', gap: 6, marginLeft: 4 }}>
        {['AM', 'PM'].map((p) => {
          const on = p === ampm;
          return (
            <Pressable
              key={p}
              onPress={() => setAmpm(p)}
              style={{ paddingHorizontal: 13, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: on ? accent : t.line, backgroundColor: on ? t.surface2 : t.surface }}
            >
              <Text style={{ fontSize: 13.5, fontFamily: sans(on ? 700 : 600), color: on ? accent : t.inkSoft }}>{p}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
