/* Monthly activity grid: one row per persona, days across the top, a dot on each
   day they logged a session. Ported from ActivityTracker in weekly.jsx. The CSS
   grid (overflow-x auto) becomes a horizontal ScrollView with fixed-width day
   columns. */
import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useStore, useTheme } from '../store/Store';
import { monthDone } from '../data/data';
import { Card, SectionTitle } from '../components/primitives';
import { serif, sans } from '../theme/fonts';

// May 1 2026 is a Friday → weekends fall on these dates
const WEEKEND = new Set([2, 3, 9, 10, 16, 17, 23, 24, 30, 31]);
const LABEL_W = 70;
const DAY_W = 24;

export default function ActivityTracker({ month }) {
  const { t, colorsFor } = useTheme();
  const { identities } = useStore();
  const days = Array.from({ length: month.days }, (_, i) => i + 1);

  return (
    <Card style={{ paddingHorizontal: 18, paddingTop: 20, paddingBottom: 18, overflow: 'hidden' }}>
      <View style={{ marginBottom: 16, paddingHorizontal: 4 }}>
        <SectionTitle>Activity tracker</SectionTitle>
        <Text style={{ fontSize: 12.5, color: t.inkFaint, fontFamily: sans(600), marginTop: 2 }}>
          {month.name} {month.year} · a dot for every day you showed up
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {/* header row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', height: 26 }}>
            <View style={{ width: LABEL_W }} />
            {days.map((d) => (
              <View key={d} style={{ width: DAY_W, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: t.line2, height: 26 }}>
                <Text style={{ fontSize: 10.5, fontFamily: sans(700), color: WEEKEND.has(d) ? t.inkSoft : t.inkFaint }}>{d}</Text>
              </View>
            ))}
          </View>

          {/* persona rows */}
          {identities.map((i) => {
            const c = colorsFor(i);
            return (
              <View key={i.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text numberOfLines={1} style={{ width: LABEL_W, paddingRight: 8, fontSize: 15, fontFamily: serif(500, true), color: c.color }}>
                  {i.name}
                </Text>
                {days.map((d) => {
                  const on = monthDone(i.id, d);
                  return (
                    <View
                      key={d}
                      style={{
                        width: DAY_W,
                        height: 34,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderLeftWidth: 1,
                        borderLeftColor: t.line2,
                        backgroundColor: WEEKEND.has(d) ? t.surface2 : 'transparent',
                      }}
                    >
                      <View
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 6,
                          backgroundColor: on ? c.color : 'transparent',
                          borderWidth: on ? 0 : 1.5,
                          borderColor: t.line,
                        }}
                      />
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* legend */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 16, paddingHorizontal: 4 }}>
        {identities.map((i) => {
          const c = colorsFor(i);
          const count = (month.done[i.id] || []).length;
          return (
            <View key={i.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c.color }} />
              <Text style={{ fontSize: 12.5, fontFamily: sans(700), color: t.inkSoft }}>{i.name}</Text>
              <Text style={{ fontSize: 12.5, fontFamily: sans(600), color: t.inkFaint }}>{count}d</Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}
