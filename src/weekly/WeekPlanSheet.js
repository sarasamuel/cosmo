/* Weekly planning bottom sheet, ported from WeekPlanSheet in weekly.jsx.
   Allocate this week's % per identity, seeded from current desired, with last
   week's lived value as reference. Slides up over the app with a scrim. */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, View, Text, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import Slider from '@react-native-community/slider';
import { useStore, useTheme } from '../store/Store';
import { WEEKS } from '../data/data';
import { Glyph, Button, Card, Eyebrow } from '../components/primitives';
import { serif, sans } from '../theme/fonts';

export default function WeekPlanSheet() {
  const { t, colorsFor } = useTheme();
  const { planOpen: open, week, identities, closePlan: onClose, commitWeekPlan: onCommit } = useStore();
  const { height } = useWindowDimensions();
  const lastWeek = WEEKS[0];

  const [plan, setPlan] = useState({});
  const [mounted, setMounted] = useState(false);
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (open) {
      const seed = {};
      identities.forEach((i) => {
        seed[i.id] = i.desired;
      });
      setPlan(seed);
      setMounted(true);
    }
    Animated.timing(slide, {
      toValue: open ? 1 : 0,
      duration: open ? 420 : 320,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
  }, [open, identities, slide]);

  if (!mounted) return null;

  const total = identities.reduce((s, i) => s + (plan[i.id] || 0), 0);
  const balanced = total === 100;
  const set = (id, v) => setPlan((p) => ({ ...p, [id]: v }));
  const livedLast = (id) => {
    const r = lastWeek && lastWeek.rows.find((x) => x.id === id);
    return r ? r.actual : null;
  };
  const [start, end] = week.label.split(' – ');
  const sheetMax = height * 0.92;

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
            paddingHorizontal: 40,
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

          <Card style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8 }}>
            {identities.map((i, k) => {
              const ll = livedLast(i.id);
              const c = colorsFor(i);
              return (
                <View key={i.id} style={{ paddingVertical: 15, borderTopWidth: k ? 1 : 0, borderTopColor: t.line2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 11 }}>
                    <Glyph char={i.glyph} size={34} fontSize={16} color={c.color} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 16, fontFamily: sans(600), color: t.ink }}>{i.name}</Text>
                      {ll != null && <Text style={{ fontSize: 12, color: t.inkFaint, fontFamily: sans(600) }}>last week you lived {ll}%</Text>}
                    </View>
                    <Text style={{ fontFamily: serif(500), fontSize: 21, color: t.ink }}>
                      {plan[i.id] || 0}
                      <Text style={{ fontSize: 13, color: t.inkFaint }}>%</Text>
                    </Text>
                  </View>
                  <Slider
                    minimumValue={0}
                    maximumValue={50}
                    step={5}
                    value={plan[i.id] || 0}
                    onValueChange={(v) => set(i.id, v)}
                    minimumTrackTintColor={c.color}
                    maximumTrackTintColor={t.surface3}
                    thumbTintColor={c.color}
                  />
                </View>
              );
            })}
          </Card>

          <Button onPress={() => onCommit(plan)} style={{ marginTop: 18 }} textStyle={{ color: t.bg }}>
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
