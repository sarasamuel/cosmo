/* Past-week plan-vs-lived breakdown. Ported from PastWeeks + WeekCard in
   weekly.jsx. Shows the most recent completed week as an expandable card, then
   an "Earlier weeks" month-grouped calendar picker that expands a week inline. */
import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useStore, useTheme } from '../store/Store';
import { Card, Glyph } from '../components/primitives';
import Icon from '../components/Icon';
import DualBar from '../components/DualBar';
import MiniRing from './MiniRing';
import { serif, sans } from '../theme/fonts';

const MONTH_NAME = { Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April', May: 'May', Jun: 'June' };

function Breakdown({ w, find, colorsFor, t, hideHead }) {
  return (
    <View style={{ paddingHorizontal: hideHead ? 4 : 22, paddingTop: 2, paddingBottom: hideHead ? 6 : 22 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text style={{ fontSize: 11.5, fontFamily: sans(700), letterSpacing: 0.5, textTransform: 'uppercase', color: t.inkFaint }}>Identity</Text>
        <Text style={{ fontSize: 11.5, fontFamily: sans(700), letterSpacing: 0.5, textTransform: 'uppercase', color: t.inkFaint }}>planned → lived</Text>
      </View>
      <View style={{ gap: 14 }}>
        {w.rows.map((r) => {
          const idn = find(r.id);
          if (!idn) return null; // identity retired — skip its historical row
          const c = colorsFor(idn);
          const hit = Math.min(1, r.actual / (r.plan || 1));
          return (
            <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Glyph char={idn.glyph} size={26} fontSize={12} color={c.color} />
              <Text style={{ width: 78, fontSize: 13.5, fontFamily: sans(600), color: t.ink }}>{idn.name}</Text>
              <View style={{ flex: 1 }}>
                <DualBar actual={r.actual} desired={r.plan} color={c.color} height={8} fillOpacity={0.85} />
              </View>
              <Text style={{ width: 64, textAlign: 'right', fontSize: 12.5, fontFamily: sans(700), color: hit >= 0.85 ? t.good : t.inkSoft }}>
                {r.plan}→{r.actual}%
              </Text>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 }}>
        <View style={{ width: 14, height: 2.5, backgroundColor: t.ink, opacity: 0.55, borderRadius: 2 }} />
        <Text style={{ fontSize: 12.5, color: t.inkFaint, fontFamily: sans(600) }}>tick = your plan · bar = what you lived</Text>
      </View>
    </View>
  );
}

function WeekCard({ w, delta, isOpen, onToggle, find, colorsFor }) {
  const { t } = useTheme();
  return (
    <Card style={{ overflow: 'hidden' }}>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 16,
          padding: 18,
          paddingHorizontal: 20,
          backgroundColor: pressed ? t.surface2 : 'transparent',
        })}
      >
        <MiniRing value={w.aligned} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontFamily: sans(700), color: t.ink }}>{w.label}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 3 }}>
            {delta == null ? (
              <Text style={{ fontSize: 13, fontFamily: sans(600), color: t.inkFaint }}>first tracked week</Text>
            ) : (
              <>
                <Text style={{ fontSize: 13, fontFamily: sans(700), color: delta >= 0 ? t.good : t.warn }}>
                  {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)} pts
                </Text>
                <Text style={{ fontSize: 13, fontFamily: sans(600), color: t.inkFaint }}>vs week before</Text>
              </>
            )}
          </View>
        </View>
        <View style={{ transform: [{ rotate: isOpen ? '-90deg' : '90deg' }] }}>
          <Icon name="chevron" size={18} color={t.inkFaint} />
        </View>
      </Pressable>
      {isOpen && <Breakdown w={w} find={find} colorsFor={colorsFor} t={t} />}
    </Card>
  );
}

export default function PastWeeks({ weeks, year }) {
  const { t, colorsFor } = useTheme();
  const { identities, retired } = useStore();

  if (!weeks || weeks.length === 0) {
    return (
      <Card style={{ paddingVertical: 22, paddingHorizontal: 22 }}>
        <Text style={{ fontSize: 14.5, fontFamily: sans(500), color: t.inkFaint, textAlign: 'center', lineHeight: 22 }}>
          No completed weeks yet — once you’ve lived a full week, it’ll appear here with your plan against what you actually lived.
        </Text>
      </Card>
    );
  }

  const RECENT = 1;
  const recent = weeks.slice(0, RECENT);
  const older = weeks.slice(RECENT);
  const find = (id) => identities.find((i) => i.id === id) || retired.find((i) => i.id === id);

  const [open, setOpen] = useState(0);
  const [calOpen, setCalOpen] = useState(false);
  const [picked, setPicked] = useState(null);
  const [monthWin, setMonthWin] = useState(0); // first visible month in the window

  const deltaFor = (k) => (weeks[k + 1] ? weeks[k].aligned - weeks[k + 1].aligned : null);
  const monthLabel = (m) => `${MONTH_NAME[m] || m}${year ? ' ' + year : ''}`;

  const groups = [];
  older.forEach((w, i) => {
    const k = RECENT + i;
    const month = w.label.split(' ')[0];
    let g = groups.find((x) => x.month === month);
    if (!g) {
      g = { month, items: [] };
      groups.push(g);
    }
    g.items.push({ w, k });
  });

  // show only one month at a time; arrows page to earlier / later months
  const WIN = 1;
  const maxWin = Math.max(0, groups.length - WIN);
  const winStart = Math.min(monthWin, maxWin);
  const visible = groups.slice(winStart, winStart + WIN);
  const canNewer = winStart > 0; // later (more recent) months
  const canOlder = winStart + WIN < groups.length; // earlier months

  return (
    <View style={{ gap: 12 }}>
      {recent.map((w, k) => (
        <WeekCard key={w.label} w={w} delta={deltaFor(k)} isOpen={open === k} onToggle={() => setOpen(open === k ? -1 : k)} find={find} colorsFor={colorsFor} />
      ))}

      {older.length > 0 && (
        <>
          <Pressable
            onPress={() => setCalOpen((o) => !o)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 15,
              paddingHorizontal: 18,
              borderRadius: t.radii.md,
              backgroundColor: pressed ? t.surface2 : t.surface,
              borderWidth: 1,
              borderColor: t.line,
            })}
          >
            <Icon name="calendar" size={17} color={t.inkSoft} />
            <Text style={{ flex: 1, fontSize: 14.5, fontFamily: sans(700), color: t.ink }}>Earlier weeks</Text>
            <Text style={{ fontSize: 12.5, color: t.inkFaint, fontFamily: sans(700) }}>{older.length} more</Text>
            <View style={{ transform: [{ rotate: calOpen ? '-90deg' : '90deg' }] }}>
              <Icon name="chevron" size={16} color={t.inkFaint} />
            </View>
          </Pressable>

          {calOpen && (
            <View style={{ padding: 16, paddingBottom: 10, borderRadius: t.radii.md, backgroundColor: t.surface2, borderWidth: 1, borderColor: t.line }}>
              {groups.length > WIN && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    marginHorizontal: 2,
                    marginBottom: 12,
                    paddingBottom: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: t.line2,
                  }}
                >
                  <Pressable
                    disabled={!canNewer}
                    onPress={() => setMonthWin((w) => Math.max(0, Math.min(w, maxWin) - 1))}
                    style={{ width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surface3, borderWidth: 1, borderColor: t.line, opacity: canNewer ? 1 : 0.32 }}
                  >
                    <View style={{ transform: [{ rotate: '180deg' }] }}>
                      <Icon name="chevron" size={16} color={t.inkSoft} />
                    </View>
                  </Pressable>
                  <Text style={{ flex: 1, textAlign: 'center', fontSize: 13, fontFamily: sans(700), color: t.inkSoft }}>
                    {monthLabel(visible[0].month)}
                  </Text>
                  <Pressable
                    disabled={!canOlder}
                    onPress={() => setMonthWin((w) => Math.min(maxWin, Math.min(w, maxWin) + 1))}
                    style={{ width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surface3, borderWidth: 1, borderColor: t.line, opacity: canOlder ? 1 : 0.32 }}
                  >
                    <Icon name="chevron" size={16} color={t.inkSoft} />
                  </Pressable>
                </View>
              )}
              {visible.map((g) => (
                <View key={g.month} style={{ marginBottom: 6 }}>
                  <Text style={{ fontSize: 11.5, fontFamily: sans(700), letterSpacing: 0.7, textTransform: 'uppercase', color: t.inkFaint, marginHorizontal: 4, marginBottom: 8 }}>
                    {monthLabel(g.month)}
                  </Text>
                  <View style={{ gap: 6 }}>
                    {g.items.map(({ w, k }) => (
                      <View key={w.label}>
                        <Pressable
                          onPress={() => setPicked(picked === k ? null : k)}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 12,
                            paddingVertical: 12,
                            paddingHorizontal: 14,
                            borderRadius: t.radii.sm,
                            backgroundColor: t.surface,
                            borderWidth: 1,
                            borderColor: picked === k ? t.ink : t.line2,
                          }}
                        >
                          <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: w.aligned < 50 ? t.warn : t.good }} />
                          <Text style={{ flex: 1, fontSize: 14, fontFamily: sans(600), color: t.ink }}>{w.label}</Text>
                          <Text style={{ fontFamily: serif(500), fontSize: 16, color: t.inkSoft }}>{w.aligned}</Text>
                          <View style={{ transform: [{ rotate: picked === k ? '-90deg' : '90deg' }] }}>
                            <Icon name="chevron" size={15} color={t.inkFaint} />
                          </View>
                        </Pressable>
                        {picked === k && (
                          <View style={{ backgroundColor: t.surface, borderWidth: 1, borderColor: t.line2, borderRadius: t.radii.sm, paddingHorizontal: 14, paddingVertical: 12, marginTop: 6 }}>
                            <Breakdown w={weeks[k]} find={find} colorsFor={colorsFor} t={t} hideHead />
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}
