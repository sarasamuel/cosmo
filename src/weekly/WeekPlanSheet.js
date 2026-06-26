/* Weekly planning bottom sheet, ported from WeekPlanSheet in weekly.jsx.
   Allocate this week's % per identity, seeded from current desired, with last
   week's lived value as reference. Slides up over the app with a scrim. */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, View, Text, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import Slider from '@react-native-community/slider';
import { useStore, useTheme } from '../store/Store';
import { FREE_HOURS_WEEK, fmtMins, lastWeekStartMs, weekPoints } from '../data/data';
import { Glyph, Button, Card, Eyebrow, Pill } from '../components/primitives';
import Icon from '../components/Icon';
import { SPACING } from '../lib/layout';
import { serif, sans } from '../theme/fonts';

export default function WeekPlanSheet() {
  const { t, colorsFor } = useTheme();
  const { planOpen: open, week, identities, relax, sessions, freeHours, setFreeHours, setRelaxAllowance, closePlan: onClose, commitWeekPlan: onCommit } = useStore();
  const { height } = useWindowDimensions();
  const lastWeekRef = lastWeekStartMs();

  const [plan, setPlan] = useState({});
  const [resting, setResting] = useState({}); // id -> paused for this week (excluded from the total)
  const [hours, setHours] = useState(freeHours); // local until "Lock in" (avoids per-drag persistence)
  const [relaxPlan, setRelaxPlan] = useState(0); // Relaxation's share — part of the same 100% pie as identities
  const [unit, setUnit] = useState('percent'); // 'percent' | 'hours' — view/edit units; plan is always stored as %
  const [mounted, setMounted] = useState(false);
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (open) {
      const seed = {};
      const restSeed = {};
      identities.forEach((i) => {
        seed[i.id] = i.desired;
        restSeed[i.id] = i.desired === 0; // a 0% intention (paused last time) reopens as resting
      });
      setPlan(seed);
      setResting(restSeed);
      setHours(freeHours);
      setRelaxPlan(relax.desired);
      setMounted(true);
    }
    Animated.timing(slide, {
      toValue: open ? 1 : 0,
      duration: open ? 420 : 320,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
  }, [open, identities, relax, freeHours, slide]);

  if (!mounted) return null;

  // resting identities don't claim any of the week, so they're left out of the
  // total; Relaxation shares the same 100% pie.
  const total = identities.reduce((s, i) => s + (resting[i.id] ? 0 : plan[i.id] || 0), 0) + (relaxPlan || 0);
  const balanced = total === 100;
  const set = (id, v) => setPlan((p) => ({ ...p, [id]: v }));
  // last calendar week's lived points for this identity, from real sessions —
  // null when nothing was logged (so we don't show "you lived 0%").
  const livedLast = (id) => {
    const v = Math.min(60, weekPoints(sessions, id, lastWeekRef));
    return v > 0 ? v : null;
  };
  const rest = (id) => setResting((r) => ({ ...r, [id]: true }));
  const bringBack = (id) => {
    setResting((r) => ({ ...r, [id]: false }));
    // restore a sensible commitment so it doesn't return at a bare 0%
    setPlan((p) => ({ ...p, [id]: p[id] > 0 ? p[id] : livedLast(id) || 15 }));
  };
  // a % of the week's free hours, formatted ("35h" pool, 20% → "7h")
  const hoursFor = (pct) => fmtMins(Math.round((hours * (pct || 0)) / 100) * 60);
  // plan stays canonically a %; Hours mode just edits the same value in hour
  // units, converting against this week's free-hours pool.
  const hoursMode = unit === 'hours';
  const MAX_PCT = 50; // a single identity can't take more than half via the slider
  const pctToHoursNum = (pct) => (hours * (pct || 0)) / 100;
  const hoursToPct = (h) => (hours > 0 ? (h / hours) * 100 : 0);
  const hourStep = hours <= 10 ? 0.5 : hours <= 60 ? 1 : 5;
  // rested identities commit as 0% (paused for the week); the rest keep their value
  const commit = () => {
    const next = {};
    identities.forEach((i) => {
      next[i.id] = resting[i.id] ? 0 : plan[i.id] || 0;
    });
    if (hours !== freeHours) setFreeHours(hours); // persist the adjusted free hours
    setRelaxAllowance(relaxPlan); // Relaxation's share is committed alongside the identities
    onCommit(next);
  };
  const [start, end] = week.label.split(' – ');
  // cap around two-thirds so the sheet rises to ~midway and leaves a comfortable
  // strip of scrim above it to tap-to-close (content scrolls inside if needed)
  const sheetMax = height * 0.66;

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 42 }}>
      <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,16,12,0.4)', opacity: slide }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            maxHeight: sheetMax,
            backgroundColor: t.surface,
            borderTopLeftRadius: 34,
            borderTopRightRadius: 34,
            paddingHorizontal: SPACING.sheetPad,
            paddingTop: 16,
            paddingBottom: 44,
            transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [sheetMax + 60, 0] }) }],
          },
          t.shadow.lg,
        ]}
      >
        <View style={{ width: 44, height: 5, borderRadius: 999, backgroundColor: t.line, alignSelf: 'center', marginBottom: 22 }} />

        <ScrollView showsVerticalScrollIndicator={false}>
          <Eyebrow style={{ marginBottom: 6 }}>{week.label}</Eyebrow>
          <Text style={{ fontFamily: serif(500), fontSize: 27, color: t.ink, marginBottom: 4 }}>Plan this week</Text>
          <Text style={{ fontSize: 15, color: t.inkSoft, lineHeight: 22, marginBottom: 16 }}>
            Decide how much of <Text style={{ fontFamily: serif(400, true) }}>this week</Text> each identity deserves. Next week you’ll choose again — your intentions can shift with your life.
          </Text>

          {/* free hours this week — the pool the percentages below scale into */}
          <Card style={{ paddingVertical: 16, paddingHorizontal: 18, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 2 }}>
              <Text style={{ fontSize: 14, fontFamily: sans(700), color: t.ink }}>Free time this week</Text>
              <Text style={{ fontFamily: serif(500), fontSize: 26, color: t.ink }}>{fmtMins(hours * 60)}</Text>
            </View>
            <Text style={{ fontSize: 12.5, color: t.inkFaint, fontFamily: sans(500), marginBottom: 8 }}>
              The hours that are truly yours.
            </Text>
            <Slider
              minimumValue={FREE_HOURS_WEEK.min}
              maximumValue={FREE_HOURS_WEEK.max}
              step={FREE_HOURS_WEEK.step}
              value={hours}
              onValueChange={setHours}
              minimumTrackTintColor={t.ink}
              maximumTrackTintColor={t.surface3}
              thumbTintColor={t.ink}
            />
          </Card>

          <Card style={{ paddingVertical: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <Text style={{ fontFamily: serif(500), fontSize: 30, color: balanced ? t.good : t.warn }}>{total}%</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontFamily: sans(700), color: t.ink }}>
                {balanced ? 'Balanced · a whole week' : total > 100 ? 'Over-committed' : 'Room left to give'}
              </Text>
              <Text style={{ fontSize: 12.5, color: t.inkSoft, fontFamily: sans(600) }}>
                {balanced ? 'Every hour has a home this week.' : `${Math.abs(100 - total)}% ${total > 100 ? 'over a full week' : 'still unassigned'}`}
              </Text>
            </View>
          </Card>

          {/* Percent / Hours unit toggle */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontSize: 13, fontFamily: sans(700), color: t.inkFaint }}>Allocate in</Text>
            <View style={{ flexDirection: 'row', backgroundColor: t.surface2, borderWidth: 1, borderColor: t.line, borderRadius: 999, padding: 4 }}>
              {[['percent', 'Percent'], ['hours', 'Hours']].map(([key, label]) => {
                const on = unit === key;
                return (
                  <Pressable key={key} onPress={() => setUnit(key)} style={[{ paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999, backgroundColor: on ? t.surface : 'transparent' }, on ? t.shadow.sm : null]}>
                    <Text style={{ fontSize: 13, fontFamily: sans(700), color: on ? t.ink : t.inkFaint }}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Card style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8 }}>
            {identities.map((i, k) => {
              const ll = livedLast(i.id);
              const c = colorsFor(i);
              const isResting = !!resting[i.id];
              return (
                <View key={i.id} style={{ paddingVertical: 15, borderTopWidth: k ? 1 : 0, borderTopColor: t.line2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: isResting ? 0 : 11 }}>
                    <Glyph char={i.glyph} size={34} fontSize={16} color={c.color} opacity={isResting ? 0.4 : 1} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 16, fontFamily: sans(600), color: isResting ? t.inkSoft : t.ink }}>{i.name}</Text>
                      {isResting ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 }}>
                          <Icon name="moon" size={13} stroke={2} color={t.inkFaint} />
                          <Text style={{ fontSize: 12.5, color: t.inkFaint, fontFamily: sans(600) }}>Resting this week — no pressure</Text>
                        </View>
                      ) : (
                        ll != null && <Text style={{ fontSize: 12, color: t.inkFaint, fontFamily: sans(600) }}>last week you lived {ll}%</Text>
                      )}
                    </View>
                    {isResting ? (
                      <Pill bg={t.surface3} onPress={() => bringBack(i.id)} style={{ paddingHorizontal: 16, paddingVertical: 9 }}>
                        <Text style={{ color: t.inkSoft, fontFamily: sans(700), fontSize: 13 }}>Bring back</Text>
                      </Pill>
                    ) : (
                      <>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ fontFamily: serif(500), fontSize: 21, color: t.ink }}>
                            {hoursMode ? (
                              hoursFor(plan[i.id])
                            ) : (
                              <>
                                {plan[i.id] || 0}
                                <Text style={{ fontSize: 13, color: t.inkFaint }}>%</Text>
                              </>
                            )}
                          </Text>
                          <Text style={{ fontSize: 11.5, fontFamily: sans(600), color: t.inkFaint, marginTop: 1 }}>
                            {hoursMode ? `${Math.round(plan[i.id] || 0)}%` : `${hoursFor(plan[i.id])}/wk`}
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => rest(i.id)}
                          hitSlop={6}
                          style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 10, backgroundColor: t.surface3, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
                        >
                          <Icon name="moon" size={17} stroke={2} color={t.inkFaint} />
                        </Pressable>
                      </>
                    )}
                  </View>
                  {!isResting && (
                    <Slider
                      minimumValue={0}
                      maximumValue={hoursMode ? pctToHoursNum(MAX_PCT) : 50}
                      step={hoursMode ? hourStep : 5}
                      value={hoursMode ? pctToHoursNum(plan[i.id] || 0) : plan[i.id] || 0}
                      onValueChange={(v) => set(i.id, hoursMode ? Math.round(Math.min(MAX_PCT, hoursToPct(v))) : v)}
                      minimumTrackTintColor={c.color}
                      maximumTrackTintColor={t.surface3}
                      thumbTintColor={c.color}
                    />
                  )}
                </View>
              );
            })}

            {/* Relaxation — part of the same 100% pie, but never "rested" (it is the rest) */}
            <View style={{ paddingVertical: 15, borderTopWidth: 1, borderTopColor: t.line2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 11 }}>
                <Glyph char="♾" size={34} fontSize={18} color={t.id.relax.color} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 16, fontFamily: sans(600), color: t.ink }}>Relaxation</Text>
                  <Text style={{ fontSize: 12, color: t.inkFaint, fontFamily: sans(600) }}>guilt-free time to recharge</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontFamily: serif(500), fontSize: 21, color: t.ink }}>
                    {hoursMode ? (
                      hoursFor(relaxPlan)
                    ) : (
                      <>
                        {relaxPlan || 0}
                        <Text style={{ fontSize: 13, color: t.inkFaint }}>%</Text>
                      </>
                    )}
                  </Text>
                  <Text style={{ fontSize: 11.5, fontFamily: sans(600), color: t.inkFaint, marginTop: 1 }}>
                    {hoursMode ? `${Math.round(relaxPlan || 0)}%` : `${hoursFor(relaxPlan)}/wk`}
                  </Text>
                </View>
              </View>
              <Slider
                minimumValue={0}
                maximumValue={hoursMode ? pctToHoursNum(MAX_PCT) : 50}
                step={hoursMode ? hourStep : 5}
                value={hoursMode ? pctToHoursNum(relaxPlan || 0) : relaxPlan || 0}
                onValueChange={(v) => setRelaxPlan(hoursMode ? Math.round(Math.min(MAX_PCT, hoursToPct(v))) : v)}
                minimumTrackTintColor={t.id.relax.color}
                maximumTrackTintColor={t.surface3}
                thumbTintColor={t.id.relax.color}
              />
            </View>
          </Card>

          <Button onPress={commit} style={{ marginTop: 18 }} textStyle={{ color: t.bg }}>
            Lock in {start}–{end}
          </Button>
          <Button variant="ghost" onPress={onClose} style={{ marginTop: 6 }}>
            Not now
          </Button>
        </ScrollView>
      </Animated.View>
    </View>
  );
}
