/* End-of-day review — opened when the user taps the nightly reminder. Tap an
   identity to log its "usual" minutes (adjustable with a stepper), then Save
   today applies them all at once via the store's commitReview. Cards vs List is
   just a density toggle over the same set. Mounted full-screen by AppShell. */
import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore, useTheme } from '../store/Store';
import { Glyph } from '../components/primitives';
import Icon from '../components/Icon';
import { usualMins } from '../data/data';
import { useScreenPad, BREAKPOINT } from '../lib/layout';
import { serif, sans } from '../theme/fonts';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const STEP = 5;
const MIN = 5;
const MAX = 600;

/* Square +/- button. No `minus` glyph in the shared Icon set, so it's a bar. */
function StepBtn({ dir, onPress }) {
  const { t } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: t.surface2,
        borderWidth: 1,
        borderColor: t.line,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      {dir === 'plus' ? (
        <Icon name="plus" size={16} stroke={2.4} color={t.ink} />
      ) : (
        <View style={{ width: 12, height: 2, borderRadius: 2, backgroundColor: t.ink }} />
      )}
    </Pressable>
  );
}

function Stepper({ mins, color, onAdjust }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <StepBtn dir="minus" onPress={() => onAdjust(-STEP)} />
      <View style={{ minWidth: 60, alignItems: 'center', paddingVertical: 5, paddingHorizontal: 12, borderRadius: 10, backgroundColor: t.surface3 }}>
        <Text style={{ fontFamily: serif(500), fontSize: 19, lineHeight: 21, color: t.ink }}>{mins}</Text>
        <Text style={{ fontSize: 10, fontFamily: sans(600), color: t.inkFaint, letterSpacing: 0.3 }}>min</Text>
      </View>
      <StepBtn dir="plus" onPress={() => onAdjust(STEP)} />
    </View>
  );
}

function ReviewItem({ idn, colorsFor, view, selected, mins, onToggle, onAdjust }) {
  const { t } = useTheme();
  const c = colorsFor(idn);
  const list = view === 'list';
  const { width } = useWindowDimensions();
  const twoCol = width >= BREAKPOINT.twoCol;

  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => ({
        width: list ? '100%' : twoCol ? '48%' : '100%',
        flexGrow: list ? 0 : 1,
        borderRadius: t.radii.md,
        borderWidth: 1.5,
        borderColor: selected ? c.color : t.line,
        backgroundColor: selected ? c.soft : t.surface,
        paddingVertical: list ? 14 : 16,
        paddingHorizontal: 16,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Glyph char={idn.glyph} size={list ? 36 : 40} fontSize={list ? 16 : 18} color={c.color} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: 16, fontFamily: sans(600), color: t.ink }}>{idn.name}</Text>
          <Text numberOfLines={1} style={{ fontSize: 12.5, fontFamily: sans(600), color: selected ? c.color : t.inkFaint, marginTop: 1 }}>
            {selected ? `+${mins}m today` : `usually ${usualMins(idn)}m`}
          </Text>
        </View>
        {/* list view keeps the stepper inline on the right; cards drop it below */}
        {list && selected && <Stepper mins={mins} color={c.color} onAdjust={onAdjust} />}
        {selected && (
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.color, alignItems: 'center', justifyContent: 'center', marginLeft: list ? 10 : 0 }}>
            <Icon name="check" size={13} stroke={2.6} color="#fff" />
          </View>
        )}
      </View>

      {!list && selected && (
        <View style={{ marginTop: 14 }}>
          <Stepper mins={mins} color={c.color} onAdjust={onAdjust} />
        </View>
      )}
    </Pressable>
  );
}

export default function EndOfDayReview({ onClose }) {
  const { t, colorsFor } = useTheme();
  const { logTargets, commitReview } = useStore();
  const insets = useSafeAreaInsets();
  const pad = useScreenPad();

  const [view, setView] = useState('cards');
  const [picks, setPicks] = useState({}); // id -> minutes (present === selected)

  const weekday = WEEKDAYS[new Date().getDay()];
  const total = Object.values(picks).reduce((s, m) => s + m, 0);
  const count = Object.keys(picks).length;

  const toggle = (idn) =>
    setPicks((p) => {
      const next = { ...p };
      if (next[idn.id] != null) delete next[idn.id];
      else next[idn.id] = usualMins(idn);
      return next;
    });
  const adjust = (idn, delta) =>
    setPicks((p) => ({ ...p, [idn.id]: Math.max(MIN, Math.min(MAX, (p[idn.id] || usualMins(idn)) + delta)) }));

  const save = () => commitReview(Object.entries(picks).map(([id, mins]) => ({ id, mins })));

  return (
    <View style={{ flex: 1, paddingHorizontal: pad }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 8, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        {/* header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ fontSize: 13, fontFamily: sans(600), letterSpacing: 2.1, textTransform: 'uppercase', color: t.inkFaint }}>
            End of day · {weekday}
          </Text>
          <Pressable onPress={onClose} hitSlop={10} style={({ pressed }) => ({ width: 30, height: 30, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
            <Text style={{ color: t.inkSoft, fontSize: 16, fontFamily: sans(600) }}>✕</Text>
          </Pressable>
        </View>
        <Text style={{ fontFamily: serif(500), fontSize: 34, color: t.ink, marginBottom: 6, letterSpacing: -0.4 }}>How did today go?</Text>
        <Text style={{ fontSize: 15, color: t.inkSoft, lineHeight: 22, marginBottom: 18 }}>
          Tap whoever you gave time to. We’ll assume your usual — adjust only if you like.
        </Text>

        {/* Cards / List density toggle */}
        <View style={{ flexDirection: 'row', alignSelf: 'flex-end', backgroundColor: t.surface2, borderWidth: 1, borderColor: t.line, borderRadius: 999, padding: 4, marginBottom: 18 }}>
          {['cards', 'list'].map((v) => {
            const on = view === v;
            return (
              <Pressable key={v} onPress={() => setView(v)} style={[{ paddingVertical: 7, paddingHorizontal: 16, borderRadius: 999, backgroundColor: on ? t.surface : 'transparent' }, on ? t.shadow.sm : null]}>
                <Text style={{ fontSize: 13.5, fontFamily: sans(700), color: on ? t.ink : t.inkFaint, textTransform: 'capitalize' }}>{v}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {logTargets.map((idn) => (
            <ReviewItem
              key={idn.id}
              idn={idn}
              colorsFor={colorsFor}
              view={view}
              selected={picks[idn.id] != null}
              mins={picks[idn.id]}
              onToggle={() => toggle(idn)}
              onAdjust={(d) => adjust(idn, d)}
            />
          ))}
        </View>
      </ScrollView>

      {/* pinned footer — running total + Save */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 12, paddingBottom: insets.bottom + 14 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontFamily: sans(700), fontSize: 15, color: t.ink }}>
            {total}m · {count} {count === 1 ? 'identity' : 'identities'}
          </Text>
          <Text style={{ fontFamily: sans(600), fontSize: 12.5, color: t.good, marginTop: 2 }}>time given to becoming you</Text>
        </View>
        <Pressable
          onPress={save}
          disabled={count === 0}
          style={({ pressed }) => ({
            backgroundColor: count ? t.ink : t.surface3,
            borderRadius: 999,
            paddingVertical: 16,
            paddingHorizontal: 30,
            opacity: count ? (pressed ? 0.9 : 1) : 0.55,
          })}
        >
          <Text style={{ fontFamily: sans(700), fontSize: 16, color: count ? t.bg : t.inkFaint }}>Save today</Text>
        </Pressable>
      </View>
    </View>
  );
}
