/* "Arrange your week" — a supplemental, DETERMINISTIC scheduler. It reads the
   user's committed % plan (each identity's desired) and lays out concrete
   sessions to help hit it. No free-text anywhere; all constraints are structured
   chips/sliders/segments. Cosmo "arranges" / "lays out" — never "generates". */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View, Text, Pressable, Animated, Easing, Alert } from 'react-native';
import Slider from '@react-native-community/slider';
import { useStore, useTheme } from '../store/Store';
import { Glyph, Button } from '../components/primitives';
import Icon from '../components/Icon';
import { useScreenPad } from '../lib/layout';
import { fmtMins, FREE_HOURS_WEEK, weekStartMs } from '../data/data';
import { scheduleWeek, placeSession, removeSession, scheduleSummary, clockLabelHM, makeSession, sortDay } from '../lib/schedule';
import { exportPlanToCalendar } from '../lib/calendar';
import TimePicker from './TimePicker';
import ManualBuilder from './ManualBuilder';
import AddSessionSheet from './AddSessionSheet';
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
  const { identities, sessions, freeHours, schedule, closeSchedule, commitSchedule, setIdentityPrefTimes } = useStore();
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
  // preferred clock times (minutes from midnight), seeded from each identity's
  // saved prefTime — a soft nudge the arrange step honors. {} = all "any time".
  const [prefs, setPrefs] = useState(() => {
    const m = {}; identities.forEach((i) => { if (typeof i.prefTime === 'number') m[i.id] = i.prefTime; });
    return m;
  });
  const setPref = (id, mins) => setPrefs((p) => { const n = { ...p }; if (mins == null) delete n[id]; else n[id] = mins; return n; });

  // 'fork' | 'manual' | 'form' | 'pref' | 'loading' | 'result'
  const [mode, setMode] = useState('fork');
  const [plan, setPlan] = useState(null);
  const [committedConstraints, setCommittedConstraints] = useState(null);
  const [retiming, setRetiming] = useState(null); // `${dayIdx}:${sessIdx}` being retimed
  const [pending, setPending] = useState(null); // { toDay, hour, min } staged until "Enter"
  const openRetime = (key, dayIdx, s) => { setRetiming(key); setPending({ toDay: dayIdx, hour: s.hour, min: s.min || 0 }); };
  const closeRetime = () => { setRetiming(null); setPending(null); };
  const [addDay, setAddDay] = useState(null); // day index a new session is being added to (result view)
  const addToPlan = (di, idn, time, mins) => setPlan((p) => p.map((d, i) => (i !== di ? d : { ...d, rest: false, sessions: sortDay([...d.sessions, makeSession(idn, time, mins)]) })));
  const [exporting, setExporting] = useState(false);
  const exportToCalendar = async () => {
    if (exporting) return;
    setExporting(true);
    const res = await exportPlanToCalendar(plan, weekStartMs());
    setExporting(false);
    if (res.ok && res.count > 0) {
      const title = res.replaced ? 'Calendar updated' : 'Added to calendar';
      const body = res.replaced
        ? `Your calendar now matches this week — ${res.count} session${res.count === 1 ? '' : 's'}.`
        : `${res.count} session${res.count === 1 ? '' : 's'} added to your calendar.`;
      Alert.alert(title, body);
    } else if (res.ok) Alert.alert('Nothing to add', 'This week has no sessions yet.');
    else if (res.error === 'permission') Alert.alert('Calendar access needed', 'Turn on calendar access for Cosmo in Settings to add your week.');
    else Alert.alert("Couldn't add to calendar", 'No writable calendar was found on this device.');
  };

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
    // limit prefs to the picked identities, then persist them on the identities so
    // they pre-fill next week, and feed them in as this arrangement's soft nudge.
    const livePrefs = {}; picked.forEach((id) => { if (typeof prefs[id] === 'number') livePrefs[id] = prefs[id]; });
    setIdentityPrefTimes(Object.fromEntries(picked.map((id) => [id, livePrefs[id] ?? null])));
    const con = constraints();
    setCommittedConstraints(con);
    setMode('loading');
    spin.setValue(0);
    Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true })).start();
    // a brief, scheduling-framed beat, then lay out the week deterministically
    setTimeout(() => {
      setPlan(scheduleWeek(con, { identities, sessions, freeHours: hours, prefs: livePrefs }));
      setMode('result');
    }, 1100);
  };

  // the identities the preferred-times step lists — only the ones being scheduled
  const pickedIdentities = useMemo(() => picked.map((id) => byId[id]).filter(Boolean), [picked, byId]);
  const prefClock = (mins) => {
    const h24 = Math.floor(mins / 60); const m = mins % 60; const ap = h24 >= 12 ? 'PM' : 'AM';
    let h = h24 % 12; if (h === 0) h = 12; return `${h}:${String(m).padStart(2, '0')} ${ap}`;
  };

  const toggle = (arr, set) => (v) => set((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));

  // small shared back button for the fork-flow headers
  const BackButton = ({ onPress }) => (
    <Pressable onPress={onPress} hitSlop={10} style={({ pressed }) => ({ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surface2, borderWidth: 1, borderColor: t.line, opacity: pressed ? 0.6 : 1 })}>
      <View style={{ transform: [{ rotate: '180deg' }] }}><Icon name="chevron" size={20} stroke={2.2} color={t.inkSoft} /></View>
    </Pressable>
  );

  // ---------- MANUAL BUILDER (the "build it myself" fork) ----------
  if (mode === 'manual') return <ManualBuilder onBack={() => setMode('fork')} />;

  // ---------- FORK (entry: arrange vs build) ----------
  if (mode === 'fork') {
    const Card = ({ icon, gold, title, sub, onPress }) => (
      <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: t.radii.md, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface, opacity: pressed ? 0.7 : 1 })}>
        <View style={{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: gold ? '#f6bf5c' : t.surface2 }}>
          <Icon name={icon} size={22} stroke={2} color={gold ? '#1c1708' : t.inkSoft} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 16.5, fontFamily: sans(700), color: t.ink, marginBottom: 3 }}>{title}</Text>
          <Text style={{ fontSize: 13.5, fontFamily: sans(500), color: t.inkSoft, lineHeight: 19 }}>{sub}</Text>
        </View>
        <Icon name="chevron" size={20} stroke={2} color={t.inkFaint} />
      </Pressable>
    );
    return (
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: pad, paddingTop: 6, paddingBottom: 10 }}>
          <BackButton onPress={closeSchedule} />
          <Text style={{ flex: 1, textAlign: 'center', fontSize: 17, fontFamily: sans(700), color: t.ink, marginRight: 42 }}>Plan your week</Text>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: pad, paddingTop: 10, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <Text style={{ fontFamily: serif(500), fontSize: 30, lineHeight: 36, color: t.ink, marginBottom: 10 }}>
            How do you want to <Text style={{ fontFamily: serif(500, true) }}>plan this week?</Text>
          </Text>
          <Text style={{ fontSize: 15.5, lineHeight: 23, color: t.inkSoft, marginBottom: 24 }}>
            Let Cosmo lay out a balanced week from a few answers — or start from a blank week and place every session yourself.
          </Text>
          <View style={{ gap: 12 }}>
            <Card icon="sparkle" gold title="Let Cosmo arrange it" sub="A few questions — including the times you love — and Cosmo lays out a week you can edit." onPress={() => setMode('form')} />
            <Card icon="plus" title="Build it myself" sub="Start from a blank week and add each session by hand — full control, no auto-arrange." onPress={() => setMode('manual')} />
          </View>
        </ScrollView>
      </View>
    );
  }

  // ---------- PREFERRED TIMES (soft nudge, after the questions) ----------
  if (mode === 'pref') {
    return (
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: pad, paddingTop: 6, paddingBottom: 10 }}>
          <BackButton onPress={() => setMode('form')} />
          <Text style={{ flex: 1, textAlign: 'center', fontSize: 17, fontFamily: sans(700), color: t.ink, marginRight: 42 }}>Preferred times</Text>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: pad, paddingTop: 4, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <Text style={{ fontFamily: serif(500), fontSize: 28, color: t.ink, marginBottom: 8 }}>When do these <Text style={{ fontFamily: serif(500, true) }}>feel right?</Text></Text>
          <Text style={{ fontSize: 15.5, lineHeight: 23, color: t.inkSoft, marginBottom: 20 }}>
            Pin a time you love for any identity and Cosmo will aim for it. Leave the rest open.
          </Text>
          <View style={{ gap: 12 }}>
            {pickedIdentities.map((idn) => {
              const c = colorsFor(idn); const val = prefs[idn.id];
              return (
                <View key={idn.id} style={{ borderRadius: t.radii.md, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface, padding: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: c.color }} />
                    <Text style={{ flex: 1, fontSize: 16, fontFamily: sans(600), color: t.ink }}>{idn.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: val != null ? c.soft : t.surface2 }}>
                      {val != null && <Icon name="clock" size={13} stroke={2.2} color={c.color} />}
                      <Text style={{ fontSize: 13, fontFamily: sans(700), color: val != null ? c.color : t.inkFaint }}>{val != null ? prefClock(val) : 'Any time'}</Text>
                    </View>
                  </View>
                  {val != null ? (
                    <>
                      <TimePicker initialHour={Math.floor(val / 60)} initialMin={val % 60} tint={c.color} onChange={(h, m) => setPref(idn.id, h * 60 + m)} />
                      <Pressable onPress={() => setPref(idn.id, null)} hitSlop={6} style={({ pressed }) => ({ alignSelf: 'flex-start', marginTop: 10, opacity: pressed ? 0.6 : 1 })}>
                        <Text style={{ fontSize: 12.5, fontFamily: sans(600), color: t.inkFaint }}>Clear — any time is fine</Text>
                      </Pressable>
                    </>
                  ) : (
                    <Pressable onPress={() => setPref(idn.id, 720)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', paddingHorizontal: 13, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: t.line, opacity: pressed ? 0.6 : 1 })}>
                      <Icon name="clock" size={14} stroke={2.2} color={t.inkSoft} />
                      <Text style={{ fontSize: 13, fontFamily: sans(700), color: t.inkSoft }}>Pin a time</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 18, alignItems: 'flex-start', padding: 14, borderRadius: t.radii.sm, backgroundColor: t.surface2 }}>
            <Icon name="sparkle" size={16} color={t.inkSoft} />
            <Text style={{ flex: 1, fontSize: 13, lineHeight: 19, color: t.inkSoft }}>
              <Text style={{ fontFamily: sans(700), color: t.ink }}>Soft by design.</Text> Cosmo aims for your times and only shifts a session when the week is too full to honor it — never silently.
            </Text>
          </View>
        </ScrollView>
        <View style={{ paddingHorizontal: pad, paddingTop: 12, paddingBottom: 24 }}>
          <Button onPress={arrange}>
            <Icon name="calendar" size={18} color={t.bg} />
            <Text style={{ marginLeft: 8, color: t.bg, fontFamily: sans(600), fontSize: 17 }}>Arrange my week</Text>
          </Button>
        </View>
      </View>
    );
  }

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
    const todayDow = new Date().getDay(); // live "today", not a flag frozen at arrange time
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
            {(() => {
              const pinnedNames = [...new Set(plan.flatMap((d) => d.sessions).filter((s) => s.pinned).map((s) => byId[s.identityId]?.name).filter(Boolean))];
              return pinnedNames.length ? <Text> {pinnedNames.join(' & ')} sits right where you asked.</Text> : null;
            })()}
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
                  <Text style={{ fontSize: 13, fontFamily: sans(700), color: d.dowIndex === todayDow ? t.ink : t.inkSoft }}>{d.day}</Text>
                  <Text style={{ fontSize: 11.5, fontFamily: sans(600), color: t.inkFaint }}>{d.date.split(' ')[1]}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
                  {d.rest ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: t.radii.md, borderWidth: 1, borderStyle: 'dashed', borderColor: t.line }}>
                      <Icon name="moon" size={16} stroke={2} color={t.inkFaint} />
                      <Text style={{ fontSize: 14, fontFamily: sans(600), color: t.inkFaint }}>Rest — kept clear</Text>
                    </View>
                  ) : (
                    <>
                    {d.sessions.map((s, sessIdx) => {
                      const idn = byId[s.identityId]; const c = idn ? colorsFor(idn) : { color: t.ink, soft: t.surface2 };
                      const key = `${dayIdx}:${sessIdx}`;
                      const open = retiming === key;
                      return (
                        <View key={sessIdx}>
                          <Pressable
                            onPress={() => (open ? closeRetime() : openRetime(key, dayIdx, s))}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: t.radii.md, backgroundColor: c.soft, borderWidth: 1, borderColor: open ? c.color : 'transparent' }}
                          >
                            {idn && <Glyph char={idn.glyph} size={30} fontSize={14} color={c.color} />}
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text numberOfLines={1} style={{ fontSize: 14.5, fontFamily: sans(700), color: t.ink }}>{s.label}</Text>
                                {s.pinned && (
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: c.soft, borderWidth: 1, borderColor: c.color }}>
                                    <Icon name="clock" size={10} stroke={2.4} color={c.color} />
                                    <Text style={{ fontSize: 10.5, fontFamily: sans(700), color: c.color }}>your time</Text>
                                  </View>
                                )}
                              </View>
                              <Text style={{ fontSize: 12, fontFamily: sans(600), color: t.inkSoft }}>{s.time} · {fmtMins(s.mins)}</Text>
                            </View>
                            <Icon name="clock" size={15} stroke={2} color={c.color} />
                          </Pressable>
                          {open && (
                            <View style={{ marginTop: 10, marginLeft: 4, gap: 10 }}>
                              {/* stage a different day — applied together with the time on Enter */}
                              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                                <Text style={{ width: 34, fontSize: 12, fontFamily: sans(700), color: t.inkFaint }}>Day</Text>
                                {plan.map((dd, di) => {
                                  const sel = pending && pending.toDay === di;
                                  const disabled = dd.rest;
                                  return (
                                    <Pressable
                                      key={di}
                                      disabled={disabled}
                                      onPress={() => setPending((p) => ({ ...p, toDay: di }))}
                                      style={{ width: 34, paddingVertical: 8, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: sel ? c.color : t.line, backgroundColor: sel ? c.soft : t.surface2, opacity: disabled ? 0.35 : 1 }}
                                    >
                                      <Text style={{ fontSize: 12, fontFamily: sans(700), color: sel ? c.color : t.inkSoft }}>{dd.day.slice(0, 2)}</Text>
                                    </Pressable>
                                  );
                                })}
                              </View>
                              {/* stage an exact time */}
                              <TimePicker
                                initialHour={s.hour}
                                initialMin={s.min || 0}
                                tint={c.color}
                                onChange={(hour24, minute) => setPending((p) => ({ ...p, hour: hour24, min: minute }))}
                              />
                              {/* commit day + time together */}
                              {pending && (
                                <Pressable
                                  onPress={() => { setPlan((p) => placeSession(p, dayIdx, sessIdx, pending.toDay, pending.hour, pending.min, committedConstraints)); closeRetime(); }}
                                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 999, backgroundColor: c.color, opacity: pressed ? 0.85 : 1 })}
                                >
                                  <Icon name="check" size={15} stroke={2.4} color={t.bg} />
                                  <Text style={{ fontSize: 13.5, fontFamily: sans(700), color: t.bg }}>Enter</Text>
                                  <Text style={{ fontSize: 13.5, fontFamily: serif(500), color: t.bg }}>{plan[pending.toDay].day.slice(0, 3)} · {clockLabelHM(pending.hour, pending.min)}</Text>
                                </Pressable>
                              )}
                              {/* remove from the week */}
                              <Pressable
                                onPress={() => { setPlan((p) => removeSession(p, dayIdx, sessIdx)); closeRetime(); }}
                                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: t.line, opacity: pressed ? 0.6 : 1 })}
                              >
                                <Icon name="archive" size={14} stroke={1.8} color={t.warn} />
                                <Text style={{ fontSize: 12.5, fontFamily: sans(700), color: t.warn }}>Remove from week</Text>
                              </Pressable>
                            </View>
                          )}
                        </View>
                      );
                    })}
                    <Pressable onPress={() => setAddDay(dayIdx)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 10, borderRadius: t.radii.md, borderWidth: 1, borderStyle: 'dashed', borderColor: t.line, opacity: pressed ? 0.6 : 1 })}>
                      <Icon name="plus" size={15} stroke={2.2} color={t.inkSoft} />
                      <Text style={{ fontSize: 13, fontFamily: sans(700), color: t.inkSoft }}>Add session</Text>
                    </Pressable>
                    </>
                  )}
                </View>
              </View>
            ))}
          </View>

          <Button onPress={() => commitSchedule(plan, committedConstraints)} style={{ marginTop: 26 }}>
            <Icon name="check" size={18} stroke={2.4} color={t.bg} />
            <Text style={{ marginLeft: 8, color: t.bg, fontFamily: sans(600), fontSize: 17 }}>Add to my week</Text>
          </Button>
          <Button variant="soft" onPress={exportToCalendar} disabled={exporting} style={{ marginTop: 8 }}>
            <Icon name="calendar" size={17} stroke={2} color={t.ink} />
            <Text style={{ marginLeft: 8, fontFamily: sans(600), fontSize: 16, color: t.ink }}>{exporting ? 'Adding…' : 'Add to calendar'}</Text>
          </Button>
          <Button variant="ghost" onPress={() => { setMode('fork'); closeRetime(); }} style={{ marginTop: 6 }}>
            <Text style={{ fontSize: 16, fontFamily: sans(600), color: t.inkSoft }}>Plan a different way</Text>
          </Button>
        </ScrollView>
        {addDay != null && (
          <AddSessionSheet
            dayLabel={`${plan[addDay].day} ${plan[addDay].date.split(' ')[1]}`}
            identities={identities}
            onAdd={(idn, time, mins) => { addToPlan(addDay, idn, time, mins); setAddDay(null); }}
            onClose={() => setAddDay(null)}
          />
        )}
      </View>
    );
  }

  // ---------- FORM ----------
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: pad, paddingTop: 6, paddingBottom: 10 }}>
        <BackButton onPress={() => setMode('fork')} />
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

        <Button onPress={() => setMode('pref')} disabled={!valid} style={{ marginTop: 28 }}>
          <Icon name="arrow" size={18} color={t.bg} />
          <Text style={{ marginLeft: 8, color: t.bg, fontFamily: sans(600), fontSize: 17 }}>Next: preferred times</Text>
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
