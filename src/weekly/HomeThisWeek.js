/* Home "This week" module — the supplemental scheduler's surface on the Home
   screen (never a tab). Two states:
   - no arranged schedule yet (but the % week is planned) → an "Arrange your week"
     prompt that opens the flow;
   - a schedule committed → a week-at-a-glance strip + today's sessions + a way
     into the full agenda. Tapping a today-session opens the log sheet for it. */
import React, { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useStore, useTheme } from '../store/Store';
import { Card, Glyph, SectionTitle, Pill } from '../components/primitives';
import Icon from '../components/Icon';
import { fmtMins } from '../data/data';
import { sans } from '../theme/fonts';

export default function HomeThisWeek() {
  const { t, colorsFor } = useTheme();
  const { schedule, openSchedule, weekPlanned, identities, openLog } = useStore();
  const byId = useMemo(() => Object.fromEntries(identities.map((i) => [i.id, i])), [identities]);

  // ---- committed schedule → the "This week" surface ----
  if (schedule && Array.isArray(schedule.plan)) {
    const plan = schedule.plan;
    // "today" is computed LIVE from the system clock (by day-of-week), not the
    // flag frozen into the plan when it was arranged — so it stays correct as the
    // days pass within the week.
    const todayDow = new Date().getDay();
    const isToday = (d) => d.dowIndex === todayDow;
    const today = plan.find(isToday);
    return (
      <Card style={{ marginTop: 18, paddingHorizontal: 22, paddingVertical: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <SectionTitle>This week</SectionTitle>
          <Pressable onPress={openSchedule} hitSlop={8} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: pressed ? 0.6 : 1 })}>
            <Text style={{ fontSize: 13, fontFamily: sans(700), color: t.inkSoft }}>Full week</Text>
            <Icon name="chevron" size={15} color={t.inkFaint} />
          </Pressable>
        </View>

        {/* week-at-a-glance strip */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {plan.map((d, i) => (
            <View key={i} style={{ alignItems: 'center', gap: 7, flex: 1 }}>
              <Text style={{ fontSize: 11.5, fontFamily: sans(700), color: isToday(d) ? t.ink : t.inkFaint }}>{d.day[0]}</Text>
              <View style={{ width: 30, height: 46, borderRadius: 9, alignItems: 'center', justifyContent: 'center', gap: 3, backgroundColor: isToday(d) ? t.surface3 : 'transparent' }}>
                {d.rest ? (
                  <Icon name="moon" size={14} stroke={2} color={t.inkFaint} />
                ) : (
                  d.sessions.slice(0, 4).map((s, k) => {
                    const idn = byId[s.identityId];
                    return <View key={k} style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: idn ? colorsFor(idn).color : t.inkFaint }} />;
                  })
                )}
              </View>
            </View>
          ))}
        </View>

        {/* today's sessions */}
        <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: t.line2 }}>
          <Text style={{ fontSize: 12.5, fontFamily: sans(700), letterSpacing: 0.4, textTransform: 'uppercase', color: t.inkFaint, marginBottom: 12 }}>Today</Text>
          {today && today.sessions.length ? (
            <View style={{ gap: 9 }}>
              {today.sessions.map((s, k) => {
                const idn = byId[s.identityId];
                const c = idn ? colorsFor(idn) : { color: t.ink, soft: t.surface2 };
                return (
                  <Pressable key={k} onPress={() => idn && openLog(idn)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.6 : 1 })}>
                    {idn && <Glyph char={idn.glyph} size={30} fontSize={14} color={c.color} />}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ fontSize: 14.5, fontFamily: sans(700), color: t.ink }}>{s.label}</Text>
                      <Text style={{ fontSize: 12, fontFamily: sans(600), color: t.inkSoft }}>{s.time} · {fmtMins(s.mins)}</Text>
                    </View>
                    <Pill bg={c.soft} onPress={() => idn && openLog(idn)} style={{ paddingHorizontal: 13, paddingVertical: 8 }}>
                      <Icon name="plus" size={13} color={c.color} />
                      <Text style={{ fontSize: 12.5, fontFamily: sans(700), color: c.color }}>Log</Text>
                    </Pill>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={{ fontSize: 14, fontFamily: sans(500), color: t.inkFaint }}>
              {today && today.rest ? 'A rest day — nothing scheduled. Enjoy it.' : 'Nothing scheduled today.'}
            </Text>
          )}
        </View>
      </Card>
    );
  }

  // ---- no schedule yet → supplemental prompt (only once the % week is planned) ----
  if (!weekPlanned) return null;
  return (
    <Pressable
      onPress={openSchedule}
      style={({ pressed }) => ({ marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: t.radii.md, backgroundColor: t.surface, borderWidth: 1, borderStyle: 'dashed', borderColor: t.line, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: '#f6bf5c', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="calendar" size={20} color="#1c1708" />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15.5, fontFamily: sans(700), color: t.ink }}>Arrange your week</Text>
        <Text style={{ fontSize: 13, color: t.inkSoft, fontFamily: sans(600), marginTop: 2 }}>Fit your intentions into real sessions across your free time.</Text>
      </View>
      <Icon name="chevron" size={18} color={t.inkFaint} />
    </Pressable>
  );
}
