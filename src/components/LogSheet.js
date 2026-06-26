/* Log-session bottom sheet, ported from logsheet.jsx. Step 1 picks an identity,
   step 2 sets minutes (dial + presets). Slides up over the app with a scrim. */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, View, Text, TextInput, Pressable, ScrollView, PanResponder, Keyboard, useWindowDimensions } from 'react-native';
import { useStore, useTheme } from '../store/Store';
import { Glyph, Button, Chip } from './primitives';
import Icon from './Icon';
import MinuteDial from './MinuteDial';
import { noteSuggestions } from '../data/data';
import { BREAKPOINT, SPACING } from '../lib/layout';
import { useKeyboardHeight } from '../lib/useKeyboard';
import { serif, sans } from '../theme/fonts';

const PRESETS = [15, 30, 45, 60, 90];

export default function LogSheet() {
  const { t, colorsFor } = useTheme();
  const { logOpen: open, logPreset: preset, closeLog: onClose, commitLog: onCommit, logTargets: identities } = useStore();
  const { width, height } = useWindowDimensions();
  const twoCol = width >= BREAKPOINT.twoCol; // phones: one card per row so names never wrap

  const [step, setStep] = useState(1);
  const [sel, setSel] = useState(null);
  const [mins, setMins] = useState(30);
  const [note, setNote] = useState(''); // optional session note → becomes a journal entry
  const [milestone, setMilestone] = useState(false); // mark the note as a milestone
  const [mounted, setMounted] = useState(false);

  const slide = useRef(new Animated.Value(0)).current; // 0 hidden, 1 shown
  const dragY = useRef(new Animated.Value(0)).current; // finger-follow offset while swiping the handle
  const kb = useKeyboardHeight(); // lift the sheet so the note input clears the keyboard

  // swipe the top handle down to dismiss; release past a threshold (or with a
  // flick) closes, otherwise the sheet springs back into place.
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderGrant: () => Keyboard.dismiss(),
      onPanResponderMove: (_, g) => { if (g.dy > 0) dragY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 90 || g.vy > 0.8) onClose();
        else Animated.spring(dragY, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
      },
      onPanResponderTerminate: () => Animated.spring(dragY, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start(),
    })
  ).current;

  useEffect(() => {
    if (open) {
      dragY.setValue(0);
      if (preset) {
        setSel(preset);
        setStep(2);
      } else {
        setSel(null);
        setStep(1);
      }
      setMins(30);
      setNote('');
      setMilestone(false);
      setMounted(true);
    }
    Animated.timing(slide, {
      toValue: open ? 1 : 0,
      duration: open ? 420 : 320,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
  }, [open, preset, slide]);

  if (!mounted) return null;

  const btnBg = (idn) => (idn ? colorsFor(idn).deep || colorsFor(idn).color : t.ink);
  const sheetMax = height * 0.92;

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40 }}>
      <Animated.View
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,16,12,0.4)', opacity: slide }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            marginBottom: kb,
            maxHeight: sheetMax,
            backgroundColor: t.surface,
            borderTopLeftRadius: 34,
            borderTopRightRadius: 34,
            paddingHorizontal: SPACING.sheetPad,
            paddingTop: 16,
            paddingBottom: 44,
            transform: [{ translateY: Animated.add(slide.interpolate({ inputRange: [0, 1], outputRange: [sheetMax + 60, 0] }), dragY) }],
          },
          t.shadow.lg,
        ]}
      >
        <View {...pan.panHandlers} style={{ alignSelf: 'stretch', alignItems: 'center', paddingTop: 2, paddingBottom: 16, marginTop: -6 }}>
          <View style={{ width: 44, height: 5, borderRadius: 999, backgroundColor: t.line }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {step === 1 && (
            <View>
              <Text style={{ fontFamily: serif(500), fontSize: 27, color: t.ink, marginBottom: 4 }}>What did you tend to?</Text>
              <Text style={{ fontSize: 15, color: t.inkSoft, marginBottom: 24 }}>Choose the identity you gave time to.</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                {identities.map((i) => {
                  const on = sel && sel.id === i.id;
                  const c = colorsFor(i);
                  return (
                    <Pressable
                      key={i.id}
                      onPress={() => setSel(on ? null : i)}
                      style={[
                        {
                          width: twoCol ? '47%' : '100%',
                          flexGrow: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 14,
                          padding: 18,
                          borderRadius: t.radii.md,
                          borderWidth: 1.5,
                          borderColor: on ? c.color : t.line,
                          backgroundColor: on ? c.soft : t.surface,
                          // only "pop" in the 2-col layout; a full-width card scaled
                          // up would bulge past the sheet's side padding
                          transform: [{ scale: on && twoCol ? 1.03 : 1 }],
                        },
                        t.shadow.sm,
                      ]}
                    >
                      <Glyph char={i.glyph} size={on ? 52 : 44} fontSize={on ? 25 : 21} color={c.color} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={{ fontSize: 17, fontFamily: sans(600), color: t.ink }}>
                          {i.name}
                        </Text>
                        <Text numberOfLines={1} style={{ fontSize: 12.5, fontFamily: sans(600), color: on ? c.color : t.inkFaint }}>
                          {i.lastActiveDays >= 99 ? 'not logged yet' : i.lastActiveDays === 0 ? 'active today' : `${i.lastActiveDays}d since last`}
                        </Text>
                      </View>
                      {on && (
                        <View style={{ position: 'absolute', top: 12, right: 12, width: 24, height: 24, borderRadius: 12, backgroundColor: c.color, alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name="check" size={14} stroke={2.6} color="#fff" />
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
              <Button
                onPress={() => sel && setStep(2)}
                disabled={!sel}
                style={{ marginTop: 20, backgroundColor: sel ? btnBg(sel) : t.ink }}
                textStyle={{ color: '#fff' }}
              >
                {sel ? `Continue with ${sel.name}` : 'Select an identity'}
              </Button>
              <Button variant="ghost" onPress={onClose} style={{ marginTop: 6 }}>
                Cancel
              </Button>
            </View>
          )}

          {step === 2 && sel && (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 }}>
                <Glyph char={sel.glyph} size={48} fontSize={23} color={colorsFor(sel).color} />
                <View>
                  <Text style={{ fontFamily: serif(500), fontSize: 25, color: t.ink }}>{sel.name}</Text>
                  <Pressable onPress={() => setStep(1)}>
                    <Text style={{ fontSize: 13.5, fontFamily: sans(600), color: t.inkFaint }}>change identity</Text>
                  </Pressable>
                </View>
              </View>

              <MinuteDial value={mins} max={180} onChange={setMins} color={colorsFor(sel).color} />

              <View style={{ flexDirection: 'row', gap: 9, justifyContent: 'center', flexWrap: 'wrap', marginTop: 20, marginBottom: 26 }}>
                {PRESETS.map((p) => {
                  const on = mins === p;
                  return (
                    <Chip
                      key={p}
                      onPress={() => setMins(p)}
                      bg={on ? btnBg(sel) : t.surface}
                      selected={false}
                      style={{ paddingHorizontal: 18, paddingVertical: 10, borderColor: on ? 'transparent' : t.line }}
                    >
                      <Text style={{ fontSize: 16, fontFamily: sans(600), color: on ? '#fff' : t.ink }}>{p}m</Text>
                    </Chip>
                  );
                })}
              </View>

              {/* optional note — saved to your Journal (and the session's title) */}
              <Text style={{ fontSize: 12, fontFamily: sans(700), letterSpacing: 1.2, textTransform: 'uppercase', color: t.inkFaint, marginBottom: 10 }}>
                Note · <Text style={{ fontFamily: sans(600) }}>optional</Text>
              </Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder={`e.g. ${noteSuggestions(sel)[0]}…`}
                placeholderTextColor={t.inkFaint}
                maxLength={140}
                returnKeyType="done"
                style={{
                  borderWidth: 1.5,
                  borderColor: t.line,
                  borderRadius: t.radii.md,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  fontSize: 15.5,
                  fontFamily: sans(500),
                  color: t.ink,
                  backgroundColor: t.surface,
                  marginBottom: 12,
                }}
              />

              {/* per-hobby starter lines — one tap to fill, still fully editable */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
                {noteSuggestions(sel).map((s) => {
                  const on = note.trim() === s;
                  return (
                    <Pressable
                      key={s}
                      onPress={() => setNote(s)}
                      style={{ paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: on ? colorsFor(sel).color : t.line, backgroundColor: on ? colorsFor(sel).soft : t.surface2 }}
                    >
                      <Text style={{ fontSize: 13, fontFamily: sans(600), color: on ? colorsFor(sel).color : t.inkSoft }}>{s}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* mark this note as a milestone — only meaningful with a note */}
              <Pressable
                onPress={() => setMilestone((m) => !m)}
                disabled={!note.trim()}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 9, alignSelf: 'flex-start', paddingHorizontal: 15, paddingVertical: 9, borderRadius: 999, borderWidth: 1.5, borderColor: milestone ? '#f6bf5c' : t.line, backgroundColor: milestone ? 'rgba(246,191,92,0.14)' : t.surface2, opacity: note.trim() ? 1 : 0.5, marginBottom: 24 }}
              >
                <Icon name="star" size={15} color={milestone ? '#f6bf5c' : t.inkFaint} />
                <Text style={{ fontSize: 13.5, fontFamily: sans(700), color: milestone ? t.ink : t.inkSoft }}>Mark as milestone</Text>
              </Pressable>

              <Button onPress={() => onCommit(sel, mins, note, { milestone: milestone && !!note.trim() })} style={{ backgroundColor: btnBg(sel) }} textStyle={{ color: '#fff' }}>
                Log {mins} minutes
              </Button>
              <Button variant="ghost" onPress={onClose} style={{ marginTop: 8 }}>
                Cancel
              </Button>
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
