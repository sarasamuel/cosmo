/* Rhythm check-in STREAK — the Reflect headline: "are you showing up at all?".
   A tolerant 5-of-7 weekly streak of days you tended ANY hobby. Missed days are
   neutral (never red, never "behind"). Derived from real sessions. This is NOT a
   per-hobby time chart — the cosmos already shows where time leans. */
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useStore, useTheme } from '../store/Store';
import { Card } from './primitives';
import Icon from './Icon';
import { rhythmStreak } from '../data/data';
import { serif, sans } from '../theme/fonts';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']; // week starts Sunday (WEEK_STARTS_ON = 0)
const ACCENT = '#b9aef2'; // pale purple — the "showing up" tone (distinct from gold milestones)
const ACCENT_SOFT = 'rgba(185, 174, 242, 0.16)';

function Dot({ state, accent, t }) {
  if (state === 'in') {
    // filled, with a soft glow around it
    return (
      <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: accent, shadowColor: accent, shadowOpacity: 0.7, shadowRadius: 6, shadowOffset: { width: 0, height: 0 }, elevation: 4 }} />
    );
  }
  if (state === 'today') {
    return <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 2.5, borderColor: accent }} />;
  }
  if (state === 'future') {
    return <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: t.inkFaint, opacity: 0.5 }} />;
  }
  // 'out' — a missed night: neutral hollow ring, never alarming
  return <View style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: t.line }} />;
}

function WeekDots({ days, accent, t, labels }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {days.map((s, i) => (
        <View key={i} style={{ flex: 1, alignItems: 'center', gap: 9 }}>
          <View style={{ height: 16, justifyContent: 'center' }}><Dot state={s} accent={accent} t={t} /></View>
          {labels && <Text style={{ fontSize: 12, fontFamily: sans(600), color: t.inkFaint }}>{DOW[i]}</Text>}
        </View>
      ))}
    </View>
  );
}

export default function RhythmStrip() {
  const { t } = useTheme();
  const { sessions } = useStore();
  const accent = ACCENT;
  // `todayKey` keeps the today/future dots + caption honest across a midnight
  // boundary while the screen stays mounted (recomputes when the date changes).
  const todayKey = new Date().toDateString();
  const r = useMemo(() => rhythmStreak(sessions), [sessions, todayKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const [open, setOpen] = useState(false);

  const inNow = r.current.filter((d) => d === 'in').length;
  const need = Math.max(0, r.threshold - inNow);
  const remaining = r.current.filter((d) => d === 'today' || d === 'future').length;
  const inCount = (days) => days.filter((x) => x === 'in').length;

  const caption = need === 0
    ? 'Rhythm kept for the week — five of seven. Anything more is just for you.'
    : remaining >= need
    ? `${need} more ${need === 1 ? 'night' : 'nights'} keeps this week's rhythm. A missed night never counts against you.`
    : 'A gentle week — five of seven keeps the rhythm, and there’s always next week. A missed night never counts against you.';

  return (
    <Card style={{ marginTop: 26, paddingHorizontal: 22, paddingVertical: 20 }}>
      {/* header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="moon" size={24} stroke={2} color="#fff" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          {r.weeks > 0 ? (
            <Text style={{ fontFamily: serif(400), fontSize: 26, color: t.ink, letterSpacing: -0.3 }}>
              <Text style={{ fontFamily: serif(500) }}>{r.weeks} {r.weeks === 1 ? 'week' : 'weeks'}</Text> in rhythm
            </Text>
          ) : (
            <Text style={{ fontFamily: serif(500), fontSize: 24, color: t.ink }}>Finding your rhythm</Text>
          )}
          <Text style={{ fontSize: 14, color: t.inkSoft, fontFamily: sans(500), marginTop: 3 }}>
            {r.weeks > 0 && r.since ? `Checking in, most nights, since ${r.since}` : 'Check in most nights to build a rhythm.'}
          </Text>
        </View>
        <Pressable onPress={() => setOpen((o) => !o)} hitSlop={8} style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: t.line, backgroundColor: t.surface2, opacity: pressed ? 0.6 : 1 })}>
          <View style={{ transform: [{ rotate: open ? '270deg' : '90deg' }] }}><Icon name="chevron" size={18} color={t.inkSoft} /></View>
        </Pressable>
      </View>

      {/* this week */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 22 }}>
        <Text style={{ width: 56, fontSize: 11.5, fontFamily: sans(700), letterSpacing: 1, textTransform: 'uppercase', color: accent, lineHeight: 15 }}>This week</Text>
        <View style={{ flex: 1, minWidth: 0 }}><WeekDots days={r.current} accent={accent} t={t} labels /></View>
      </View>

      <Text style={{ fontSize: 14.5, lineHeight: 22, color: t.inkSoft, fontFamily: sans(500), marginTop: 20 }}>{caption}</Text>

      {open && (
        <View>
          <View style={{ height: 1, backgroundColor: t.line2, marginVertical: 20 }} />

          {/* forgiveness note */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: ACCENT_SOFT, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="sparkle" size={15} color={accent} />
            </View>
            <Text style={{ flex: 1, fontSize: 14, lineHeight: 21, color: t.inkSoft, fontFamily: sans(500) }}>
              <Text style={{ fontFamily: sans(700), color: t.ink }}>Five of seven keeps the week.</Text> Miss a night, miss two — a quiet evening or an early sleep never breaks anything. The rhythm bends so it doesn’t snap.
            </Text>
          </View>

          {/* weeks kept */}
          <Text style={{ fontSize: 11.5, fontFamily: sans(700), letterSpacing: 1, textTransform: 'uppercase', color: t.inkFaint, marginTop: 26, marginBottom: 10 }}>Weeks kept</Text>

          <View>
            {r.history.map((w, k) => {
              const n = inCount(w.days);
              return (
                <View key={w.start} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 14, borderTopWidth: k === 0 ? 0 : 1, borderTopColor: t.line2 }}>
                  <Text style={{ width: 96, fontSize: 13.5, fontFamily: sans(600), color: t.inkSoft }}>{w.label}</Text>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <WeekDots days={w.days} accent={accent} t={t} />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: t.surface2, borderWidth: 1, borderColor: t.line }}>
                    <Icon name="check" size={12} stroke={2.6} color={n >= r.threshold ? t.good : t.inkFaint} />
                    <Text style={{ fontSize: 13, fontFamily: sans(700), color: t.inkSoft }}>{n}/7</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </Card>
  );
}
