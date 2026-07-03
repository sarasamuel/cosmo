/* End-of-day review — opened when the user taps the nightly reminder. Tap an
   identity to log its "usual" minutes (adjustable with a stepper), then Save
   today applies them all at once via the store's commitReview. Mounted
   full-screen by AppShell. */
import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore, useTheme } from '../store/Store';
import { Glyph } from '../components/primitives';
import Icon from '../components/Icon';
import { usualMins, noteSuggestions } from '../data/data';
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

function Stepper({ mins, onAdjust }) {
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

function ReviewItem({ idn, colorsFor, selected, entry, onToggle, onAdjust, onNote, onMilestone }) {
  const { t } = useTheme();
  const c = colorsFor(idn);
  const { width } = useWindowDimensions();
  const twoCol = width >= BREAKPOINT.twoCol;
  const mins = entry ? entry.mins : usualMins(idn);
  const note = entry ? entry.note : '';
  const milestone = !!(entry && entry.milestone);
  const hasNote = !!note.trim();

  return (
    <View
      style={{
        width: twoCol ? '48%' : '100%',
        flexGrow: 1,
        borderRadius: t.radii.md,
        borderWidth: 1.5,
        borderColor: selected ? c.color : t.line,
        backgroundColor: selected ? c.soft : t.surface,
        paddingVertical: 16,
        paddingHorizontal: 16,
      }}
    >
      {/* header taps to select/deselect (kept separate so editing the note below
          never toggles the card) */}
      <Pressable onPress={onToggle} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.85 : 1 })}>
        <Glyph char={idn.glyph} size={40} fontSize={18} color={c.color} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: 16, fontFamily: sans(600), color: t.ink }}>{idn.name}</Text>
          <Text numberOfLines={1} style={{ fontSize: 12.5, fontFamily: sans(600), color: selected ? c.color : t.inkFaint, marginTop: 1 }}>
            {selected ? `+${mins}m today` : `usually ${usualMins(idn)}m`}
          </Text>
        </View>
        {selected && (
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.color, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={13} stroke={2.6} color="#fff" />
          </View>
        )}
      </Pressable>

      {selected && (
        <View style={{ marginTop: 14, gap: 12 }}>
          <Stepper mins={mins} onAdjust={onAdjust} />

          {/* optional note — saved to your Journal, exactly like the log sheet */}
          <TextInput
            value={note}
            onChangeText={onNote}
            placeholder={`Note · e.g. ${noteSuggestions(idn)[0]}…`}
            placeholderTextColor={t.inkFaint}
            maxLength={140}
            returnKeyType="done"
            style={{ borderWidth: 1.5, borderColor: t.line, borderRadius: t.radii.md, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, fontFamily: sans(500), color: t.ink, backgroundColor: t.surface }}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {noteSuggestions(idn).map((s) => {
              const on = note.trim() === s;
              return (
                <Pressable key={s} onPress={() => onNote(s)} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: on ? c.color : t.line, backgroundColor: on ? c.soft : t.surface2 }}>
                  <Text style={{ fontSize: 12.5, fontFamily: sans(600), color: on ? c.color : t.inkSoft }}>{s}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* mark this note as a milestone — only meaningful with a note */}
          <Pressable
            onPress={() => onMilestone(!milestone)}
            disabled={!hasNote}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5, borderColor: milestone ? '#f6bf5c' : t.line, backgroundColor: milestone ? 'rgba(246,191,92,0.14)' : t.surface2, opacity: hasNote ? 1 : 0.5 }}
          >
            <Icon name="star" size={14} color={milestone ? '#f6bf5c' : t.inkFaint} />
            <Text style={{ fontSize: 13, fontFamily: sans(700), color: milestone ? t.ink : t.inkSoft }}>Mark as milestone</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default function EndOfDayReview({ onClose }) {
  const { t, colorsFor } = useTheme();
  const { logTargets, commitReview } = useStore();
  const insets = useSafeAreaInsets();
  const pad = useScreenPad();

  const [picks, setPicks] = useState({}); // id -> { mins, note, milestone } (present === selected)

  const weekday = WEEKDAYS[new Date().getDay()];
  const total = Object.values(picks).reduce((s, v) => s + v.mins, 0);
  const count = Object.keys(picks).length;

  const toggle = (idn) =>
    setPicks((p) => {
      const next = { ...p };
      if (next[idn.id] != null) delete next[idn.id];
      else next[idn.id] = { mins: usualMins(idn), note: '', milestone: false };
      return next;
    });
  const patch = (id, changes) => setPicks((p) => (p[id] ? { ...p, [id]: { ...p[id], ...changes } } : p));
  const adjust = (idn, delta) =>
    setPicks((p) => (p[idn.id] ? { ...p, [idn.id]: { ...p[idn.id], mins: Math.max(MIN, Math.min(MAX, p[idn.id].mins + delta)) } } : p));

  const save = () => commitReview(Object.entries(picks).map(([id, v]) => ({ id, mins: v.mins, note: v.note, milestone: v.milestone && !!v.note.trim() })));

  return (
    <KeyboardAvoidingView style={{ flex: 1, paddingHorizontal: pad }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 8, paddingBottom: 20 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
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

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 18 }}>
          {logTargets.map((idn) => (
            <ReviewItem
              key={idn.id}
              idn={idn}
              colorsFor={colorsFor}
              selected={picks[idn.id] != null}
              entry={picks[idn.id]}
              onToggle={() => toggle(idn)}
              onAdjust={(d) => adjust(idn, d)}
              onNote={(text) => patch(idn.id, { note: text })}
              onMilestone={(v) => patch(idn.id, { milestone: v })}
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
    </KeyboardAvoidingView>
  );
}
