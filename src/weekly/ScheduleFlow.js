/* "Arrange your week" — a supplemental, DETERMINISTIC scheduler. It reads the
   user's committed % plan (each identity's desired) and lays out concrete
   sessions to help hit it. No free-text anywhere; all constraints are structured
   chips/sliders/segments. Cosmo "arranges" / "lays out" — never "generates". */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View, Text, Pressable, Animated, Easing } from 'react-native';
import Slider from '@react-native-community/slider';
import { useStore, useTheme } from '../store/Store';
import { Glyph, Button } from '../components/primitives';
import Icon from '../components/Icon';
import { useScreenPad } from '../lib/layout';
import { fmtMins, FREE_HOURS_WEEK } from '../data/data';
import { scheduleWeek, retimeSession, scheduleSummary } from '../lib/schedule';
import { serif, sans } from '../theme/fonts';

const FULLNESS = [
  { v: 'light', label: 'Light' },
  { v: 'balanced', label: 'Balanced' },
  { v: 'ambitious', label: 'Ambitious' },
];
const WINDOWS = [
  { v: 'mornings', label: 'Mornings' },
  { v: 'daytime', label: 'Daytime' },
  { v: 'evenings', label: 'Evenings' },
  { v: 'weekends', label: 'Weekends' },
];
const SHAPES = [
  { v: 'short', label: 'Short & frequent' },
  { v: 'deep', label: 'Deep & focused' },
  { v: 'mix', label: 'A mix' },
];
const PROTECT = [
  { v: 'rest-day', label: 'A rest day' },
  { v: 'calm-mornings', label: 'Calm mornings' },
  { v: 'no-back-to-back', label: 'No back-to-back' },
  { v: 'family-evenings', label: 'Family evenings' },
];
const MOVE = [
  { v: 'mornings', label: 'Early morning' },
  { v: 'daytime', label: 'Daytime' },
  { v: 'evenings', label: 'Evening' },
];

function Section({ t, label, children }) {
  return (
    <View style={{ marginTop: 24 }}>
      <Text style={{ fontSize: 12.5, fontFamily: sans(700), letterSpacing: 0.5, textTransform: 'uppercase', color: t.inkFaint, marginBottom: 12, marginLeft: 2 }}>{label}</Text>
      {children}
    </View>
  );
}

function ChipRow({ items, value, onToggle, t, multi, colorOf }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
      {items.map((it) => {
        const on = multi ? value.includes(it.v) : value === it.v;
        const tint = (colorOf && colorOf(it)) || t.ink;
        return (
          <Pressable
            key={it.v}
            onPress={() => onToggle(it.v)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 15, paddingVertical: 11, borderRadius: 999, borderWidth: 1.5, borderColor: on ? tint : t.line, backgroundColor: on ? (colorOf ? it.soft || t.surface2 : t.ink) : t.surface }}
          >
            {it.dot && <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: it.dot }} />}
            <Text style={{ fontSize: 14.5, fontFamily: sans(600), color: on ? (colorOf ? tint : t.bg) : t.ink }}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function ScheduleFlow() {
  const { t, colorsFor } = useTheme();
  const { identities, sessions, freeHours, schedule, closeSchedule, commitSchedule } = useStore();
  const pad = useScreenPad();

  const planned = useMemo(() => identities.filter((i) => i.desired > 0), [identities]);
  const pool = planned.length ? planned : identities;
  const byId = useMemo(() => Object.fromEntries(identities.map((i) => [i.id, i])), [identities]);

  // constraint state (identities + hours default from the committed % plan)
  const [picked, setPicked] = useState(() => pool.map((i) => i.id));
  const [fullness, setFullness] = useState('balanced');
  const [hours, setHours] = useState(freeHours || FREE_HOURS_WEEK.def);
  const [windows, setWindows] = useState(['mornings', 'evenings', 'weekends']);
  const [shape, setShape] = useState('mix');
  const [protect, setProtect] = useState(['rest-day']);

  // 'form' | 'loading' | 'result'
  const [mode, setMode] = useState('form');
  const [plan, setPlan] = useState(null);
  const [committedConstraints, setCommittedConstraints] = useState(null);
  const [retiming, setRetiming] = useState(null); // `${dayIdx}:${sessIdx}` being retimed

  // if a schedule already exists, open straight to its result (View full week)
  useEffect(() => {
    if (schedule && schedule.plan) {
      setPlan(schedule.plan);
      setCommittedConstraints(schedule.constraints || null);
      setMode('result');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const constraints = () => ({ identities: picked, fullness, hoursPerWeek: hours, windows, shape, protect });
  const valid = picked.length > 0 && windows.length > 0;

  const spin = useRef(new Animated.Value(0)).current;
  const arrange = () => {
    const con = constraints();
    setCommittedConstraints(con);
    setMode('loading');
    spin.setValue(0);
    Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true })).start();
    // a brief, scheduling-framed beat, then lay out the week deterministically
    setTimeout(() => {
      setPlan(scheduleWeek(con, { identities, sessions, freeHours: hours }));
      setMode('result');
    }, 1100);
  };

  const toggle = (arr, set) => (v) => set((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));

  // ---------- LOADING ----------
  if (mode === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: pad }}>
        <Animated.View style={{ transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#f6bf5c', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="calendar" size={26} color="#1c1708" />
          </View>
        </Animated.View>
        <Text style={{ fontFamily: serif(500), fontSize: 22, color: t.ink, marginTop: 24 }}>Laying out your week…</Text>
        <Text style={{ fontSize: 14.5, color: t.inkSoft, marginTop: 8 }}>Fitting your free time around your intentions.</Text>
      </View>
    );
  }

  // ---------- RESULT ----------
  if (mode === 'result' && plan) {
    const sum = scheduleSummary(plan);
    const restNote = sum.restDay ? `, with ${sum.restDay} kept clear` : '';
    return (
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: pad, paddingTop: 6, paddingBottom: 10 }}>
          <Pressable onPress={closeSchedule} hitSlop={10} style={({ pressed }) => ({ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surface2, borderWidth: 1, borderColor: t.line, opacity: pressed ? 0.6 : 1 })}>
            <View style={{ transform: [{ rotate: '180deg' }] }}><Icon name="chevron" size={20} stroke={2.2} color={t.inkSoft} /></View>
          </Pressable>
          <Text style={{ flex: 1, textAlign: 'center', fontSize: 17, fontFamily: sans(700), color: t.ink, marginRight: 42 }}>Your week</Text>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: pad, paddingTop: 4, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <Text style={{ fontFamily: serif(400, true), fontSize: 18, lineHeight: 26, color: t.inkSoft }}>
            Cosmo arranged <Text style={{ fontFamily: serif(500), color: t.ink }}>{sum.sessionCount} sessions · ~{Math.round(sum.totalMins / 60)}h</Text> this week{restNote}.
          </Text>

          {/* per-identity balance chips */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
            {Object.keys(sum.perIdentity).map((id) => {
              const idn = byId[id]; if (!idn) return null;
              const c = colorsFor(idn);
              return (
                <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: c.soft }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.color }} />
                  <Text style={{ fontSize: 12.5, fontFamily: sans(700), color: c.color }}>{idn.name} · {fmtMins(sum.perIdentity[id])}</Text>
                </View>
              );
            })}
          </View>

          {/* the week agenda */}
          <View style={{ marginTop: 22, gap: 10 }}>
            {plan.map((d, dayIdx) => (
              <View key={dayIdx} style={{ flexDirection: 'row', gap: 14 }}>
                <View style={{ width: 44, paddingTop: 2 }}>
                  <Text style={{ fontSize: 13, fontFamily: sans(700), color: d.today ? t.ink : t.inkSoft }}>{d.day}</Text>
                  <Text style={{ fontSize: 11.5, fontFamily: sans(600), color: t.inkFaint }}>{d.date.split(' ')[1]}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
                  {d.rest ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: t.radii.md, borderWidth: 1, borderStyle: 'dashed', borderColor: t.line }}>
                      <Icon name="moon" size={16} stroke={2} color={t.inkFaint} />
                      <Text style={{ fontSize: 14, fontFamily: sans(600), color: t.inkFaint }}>Rest — kept clear</Text>
                    </View>
                  ) : d.sessions.length === 0 ? (
                    <Text style={{ fontSize: 13.5, fontFamily: sans(500), color: t.inkFaint, paddingVertical: 12 }}>—</Text>
                  ) : (
                    d.sessions.map((s, sessIdx) => {
                      const idn = byId[s.identityId]; const c = idn ? colorsFor(idn) : { color: t.ink, soft: t.surface2 };
                      const key = `${dayIdx}:${sessIdx}`;
                      const open = retiming === key;
                      return (
                        <View key={sessIdx}>
                          <Pressable
                            onPress={() => setRetiming(open ? null : key)}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: t.radii.md, backgroundColor: c.soft, borderWidth: 1, borderColor: open ? c.color : 'transparent' }}
                          >
                            {idn && <Glyph char={idn.glyph} size={30} fontSize={14} color={c.color} />}
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text numberOfLines={1} style={{ fontSize: 14.5, fontFamily: sans(700), color: t.ink }}>{s.label}</Text>
                              <Text style={{ fontSize: 12, fontFamily: sans(600), color: t.inkSoft }}>{s.time} · {fmtMins(s.mins)}</Text>
                            </View>
                            <Icon name="clock" size={15} stroke={2} color={c.color} />
                          </Pressable>
                          {open && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginLeft: 4 }}>
                              <Text style={{ fontSize: 12.5, fontFamily: sans(700), color: t.inkFaint, alignSelf: 'center' }}>Move to</Text>
                              {MOVE.map((m) => (
                                <Pressable
                                  key={m.v}
                                  onPress={() => { setPlan((p) => retimeSession(p, dayIdx, sessIdx, m.v, committedConstraints)); setRetiming(null); }}
                                  style={{ paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface2 }}
                                >
                                  <Text style={{ fontSize: 12.5, fontFamily: sans(600), color: t.inkSoft }}>{m.label}</Text>
                                </Pressable>
                              ))}
                            </View>
                          )}
                        </View>
                      );
                    })
                  )}
                </View>
              </View>
            ))}
          </View>

          <Button onPress={() => commitSchedule(plan, committedConstraints)} style={{ marginTop: 26 }}>
            <Icon name="check" size={18} stroke={2.4} color={t.bg} />
            <Text style={{ marginLeft: 8, color: t.bg, fontFamily: sans(600), fontSize: 17 }}>Add to my week</Text>
          </Button>
          <Button variant="ghost" onPress={() => { setMode('form'); setRetiming(null); }} style={{ marginTop: 6 }}>
            <Text style={{ fontSize: 16, fontFamily: sans(600), color: t.inkSoft }}>Rearrange with changes</Text>
          </Button>
        </ScrollView>
      </View>
    );
  }

  // ---------- FORM ----------
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: pad, paddingTop: 6, paddingBottom: 10 }}>
        <Pressable onPress={closeSchedule} hitSlop={10} style={({ pressed }) => ({ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surface2, borderWidth: 1, borderColor: t.line, opacity: pressed ? 0.6 : 1 })}>
          <View style={{ transform: [{ rotate: '180deg' }] }}><Icon name="chevron" size={20} stroke={2.2} color={t.inkSoft} /></View>
        </Pressable>
        <Text style={{ flex: 1, textAlign: 'center', fontSize: 17, fontFamily: sans(700), color: t.ink, marginRight: 42 }}>Arrange your week</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: pad, paddingTop: 4, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontSize: 15.5, lineHeight: 23, color: t.inkSoft }}>
          Cosmo will lay out sessions across your free time to help you hit this week’s intentions. Set the dials, then arrange.
        </Text>

        <Section t={t} label="Which identities">
          <ChipRow
            multi
            t={t}
            items={pool.map((i) => ({ v: i.id, label: i.name, dot: colorsFor(i).color, soft: colorsFor(i).soft }))}
            value={picked}
            onToggle={toggle(picked, setPicked)}
            colorOf={(it) => { const i = byId[it.v]; return i ? colorsFor(i).color : t.ink; }}
          />
        </Section>

        <Section t={t} label="How full a week">
          <ChipRow t={t} items={FULLNESS} value={fullness} onToggle={setFullness} />
        </Section>

        <Section t={t} label={`Free time · ${fmtMins(hours * 60)} / week`}>
          <Slider
            minimumValue={FREE_HOURS_WEEK.min}
            maximumValue={FREE_HOURS_WEEK.max}
            step={1}
            value={hours}
            onValueChange={(v) => setHours(Math.round(v))}
            minimumTrackTintColor={t.ink}
            maximumTrackTintColor={t.surface3}
            thumbTintColor={t.ink}
          />
        </Section>

        <Section t={t} label="When you’re free">
          <ChipRow multi t={t} items={WINDOWS} value={windows} onToggle={toggle(windows, setWindows)} />
        </Section>

        <Section t={t} label="Session style">
          <ChipRow t={t} items={SHAPES} value={shape} onToggle={setShape} />
        </Section>

        <Section t={t} label="Protect (optional)">
          <ChipRow multi t={t} items={PROTECT} value={protect} onToggle={toggle(protect, setProtect)} />
        </Section>

        <Button onPress={arrange} disabled={!valid} style={{ marginTop: 28 }}>
          <Icon name="calendar" size={18} color={t.bg} />
          <Text style={{ marginLeft: 8, color: t.bg, fontFamily: sans(600), fontSize: 17 }}>Arrange my week</Text>
        </Button>
        {!valid && (
          <Text style={{ fontSize: 13, color: t.inkFaint, fontFamily: sans(500), textAlign: 'center', marginTop: 10 }}>
            Pick at least one identity and one time you’re free.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}
