/* Feature tour — a swipeable intro carousel shown ONCE before the setup flow,
   teaching what Cosmo does (cosmos tap-to-log, weekly planner, rhythm streak,
   journal, reflect-with-Cosmo). Ported from the prototype's onboarding-tour to
   React Native: each slide pairs a real mini-visual (built in the app's language)
   with a short line; ends with a CTA into setup.

   Embeds inside Onboarding's existing Starfield + StatusBar shell — it renders
   only its inner content (no second bezel). Skip and the final "Set up your
   cosmos" both call onDone, which advances Onboarding to its setup steps. */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, View, Text, Pressable, ScrollView, Easing, AccessibilityInfo, useWindowDimensions } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../store/Store';
import Icon from '../components/Icon';
import { serif, sans } from '../theme/fonts';

const RHYTHM_ACCENT = '#b9aef2'; // pale purple — matches RhythmStrip

// the five identity hues from the active theme, by name
function useTC() {
  const { t } = useTheme();
  return {
    writer: t.id.writer.color,
    reader: t.id.reader.color,
    engineer: t.id.engineer.color,
    musician: t.id.musician.color,
    painter: t.id.painter.color,
  };
}

// a small surface card the feature visuals sit in
function VizCard({ children, t }) {
  return (
    <View style={{ width: '100%', maxWidth: 320, backgroundColor: t.surface, borderRadius: t.radii.lg, borderWidth: 1, borderColor: t.line, padding: 18 }}>
      {children}
    </View>
  );
}

/* 1 · welcome — a small constellation mark */
function VizMark() {
  const { t } = useTheme();
  const nodes = [
    [t.id.writer.color, 75, 34, 9],
    [t.id.reader.color, 112, 66, 7],
    [t.id.engineer.color, 98, 112, 8],
    [t.id.musician.color, 46, 106, 7],
    [t.id.painter.color, 36, 58, 7],
  ];
  return (
    <Svg width={172} height={172} viewBox="0 0 150 150">
      {nodes.map(([c, x, y, r], k) => (
        <React.Fragment key={k}>
          <Line x1={75} y1={75} x2={x} y2={y} stroke={t.ink} strokeOpacity={0.16} />
          <Circle cx={x} cy={y} r={r} fill={c} />
        </React.Fragment>
      ))}
      <Circle cx={75} cy={75} r={26} fill={t.core1} opacity={0.16} />
      <Circle cx={75} cy={75} r={7} fill={t.core1} />
    </Svg>
  );
}

/* 2 · cosmos + tap-to-log — an orbit with a tapped planet logging time */
function VizCosmos() {
  const { t } = useTheme();
  const TC = useTC();
  const size = 240;
  const at = (v) => (v / 288) * size;
  // two expanding rings, offset by half a cycle, give a continuous "sonar" pulse
  // over the tapped planet — a clear, repeating blink rather than one faint ring.
  const r1 = useRef(new Animated.Value(0)).current;
  const r2 = useRef(new Animated.Value(0)).current;
  const [reduced, setReduced] = useState(false);

  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setReduced); }, []);
  useEffect(() => {
    if (reduced) return undefined; // honor Reduce Motion (per the tour spec)
    const mk = (v) => Animated.loop(Animated.timing(v, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    const a = mk(r1);
    a.start();
    let b;
    const stagger = setTimeout(() => { b = mk(r2); b.start(); }, 800);
    return () => { a.stop(); if (b) b.stop(); clearTimeout(stagger); };
  }, [reduced, r1, r2]);

  const planets = [
    { c: TC.engineer, x: 196, y: 96, r: 13 },
    { c: TC.writer, x: 64, y: 150, r: 15, tap: true },
    { c: TC.reader, x: 226, y: 188, r: 11 },
    { c: TC.musician, x: 150, y: 236, r: 12 },
  ];

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 288 288">
        {[58, 96, 132].map((r) => (
          <Circle key={r} cx={144} cy={144} r={r} fill="none" stroke={t.ring} strokeWidth={2} strokeDasharray="2 12" />
        ))}
        {/* core sun */}
        <Circle cx={144} cy={144} r={40} fill={t.core1} opacity={0.16} />
        <Line x1={120} y1={144} x2={168} y2={144} stroke={t.core1} strokeWidth={3.5} strokeLinecap="round" opacity={0.9} />
        <Line x1={144} y1={120} x2={144} y2={168} stroke={t.core1} strokeWidth={3.5} strokeLinecap="round" opacity={0.9} />
        <Circle cx={144} cy={144} r={20} fill={t.core1} />
        <Circle cx={144} cy={144} r={20} fill="#fff" opacity={0.18} />
        {planets.map((p, i) => (
          <React.Fragment key={i}>
            <Circle cx={p.x} cy={p.y} r={p.r * 2.3} fill={p.c} opacity={0.2} />
            <Circle cx={p.x} cy={p.y} r={p.r} fill={p.c} />
          </React.Fragment>
        ))}
      </Svg>

      {/* pulsing tap rings over the writer planet */}
      {[r1, r2].map((rv, k) => (
        <Animated.View
          key={k}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: at(64) - at(16),
            top: at(150) - at(16),
            width: at(32),
            height: at(32),
            borderRadius: at(16),
            borderWidth: 2.5,
            borderColor: TC.writer,
            opacity: rv.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }),
            transform: [{ scale: rv.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2.6] }) }],
          }}
        />
      ))}
      {/* the +30m log chip */}
      <View style={{ position: 'absolute', left: at(64) + at(20), top: at(150) - at(46), flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
        <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: TC.writer }} />
        <Text style={{ fontSize: 12, fontFamily: sans(700), color: t.ink }}>Writer · +30m</Text>
      </View>
    </View>
  );
}

/* 3 · scheduler — a mini week with colored sessions */
function VizScheduler() {
  const { t } = useTheme();
  const TC = useTC();
  const days = [
    { d: 'M', dots: [TC.engineer, TC.reader] },
    { d: 'T', dots: [TC.writer, TC.musician] },
    { d: 'W', dots: [TC.engineer], today: true },
    { d: 'T', dots: [TC.writer] },
    { d: 'F', dots: [TC.engineer, TC.painter] },
    { d: 'S', dots: [TC.reader, TC.writer] },
    { d: 'S', rest: true },
  ];
  return (
    <VizCard t={t}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Text style={{ fontSize: 15, fontFamily: sans(700), color: t.ink }}>This week</Text>
        <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: t.surface2 }}>
          <Text style={{ fontSize: 11.5, fontFamily: sans(700), color: t.inkSoft }}>7 sessions</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {days.map((dy, i) => (
          <View key={i} style={{ alignItems: 'center', gap: 7, flex: 1 }}>
            <Text style={{ fontSize: 11, fontFamily: sans(700), color: dy.today ? t.ink : t.inkFaint }}>{dy.d}</Text>
            <View style={{ width: 26, height: 42, borderRadius: 8, alignItems: 'center', justifyContent: 'center', gap: 3, backgroundColor: dy.today ? t.surface3 : 'transparent' }}>
              {dy.rest ? (
                <Icon name="moon" size={12} stroke={2} color={t.inkFaint} />
              ) : (
                dy.dots.map((c, k) => <View key={k} style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: c }} />)
              )}
            </View>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: t.line2 }}>
        <Text style={{ fontSize: 12, fontFamily: sans(700), color: t.inkSoft, width: 56 }}>7:00 AM</Text>
        <View style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: TC.engineer }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontFamily: sans(700), color: t.ink }}>Coding</Text>
          <Text style={{ fontSize: 12, fontFamily: sans(600), color: t.inkSoft }}>Engineer · 45m</Text>
        </View>
      </View>
    </VizCard>
  );
}

/* 4 · rhythm — the forgiving check-in streak dots */
function VizRhythm() {
  const { t } = useTheme();
  const cur = ['in', 'in', 'out', 'in', 'today', 'future', 'future'];
  const L = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const Dot = ({ s }) => {
    if (s === 'in') return <View style={{ width: 15, height: 15, borderRadius: 8, backgroundColor: RHYTHM_ACCENT, shadowColor: RHYTHM_ACCENT, shadowOpacity: 0.7, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } }} />;
    if (s === 'today') return <View style={{ width: 15, height: 15, borderRadius: 8, borderWidth: 2.5, borderColor: RHYTHM_ACCENT }} />;
    if (s === 'future') return <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.inkFaint, opacity: 0.5 }} />;
    return <View style={{ width: 13, height: 13, borderRadius: 7, borderWidth: 2, borderColor: t.line }} />;
  };
  return (
    <VizCard t={t}>
      <Text style={{ fontSize: 15, fontFamily: serif(500), color: t.ink, marginBottom: 16 }}>6 weeks in rhythm</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {cur.map((s, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center', gap: 9 }}>
            <View style={{ height: 16, justifyContent: 'center' }}><Dot s={s} /></View>
            <Text style={{ fontSize: 11.5, fontFamily: sans(600), color: t.inkFaint }}>{L[i]}</Text>
          </View>
        ))}
      </View>
      <Text style={{ fontSize: 12.5, lineHeight: 18, fontFamily: sans(500), color: t.inkSoft, marginTop: 16 }}>
        Five of seven keeps the week — a missed night never counts against you.
      </Text>
    </VizCard>
  );
}

/* 5 · journal — a milestone entry */
function VizJournal() {
  const { t } = useTheme();
  const TC = useTC();
  return (
    <VizCard t={t}>
      <View style={{ flexDirection: 'row', gap: 14 }}>
        <View style={{ width: 22, alignItems: 'center' }}>
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: t.core1, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="sparkle" size={12} color="#1c1708" />
          </View>
          <View style={{ width: 2, flex: 1, marginTop: 6, backgroundColor: t.line }} />
        </View>
        <View style={{ flex: 1, gap: 12 }}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 5 }}>
              <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: TC.writer }} />
              <Text style={{ fontSize: 11.5, fontFamily: sans(700), color: t.inkSoft }}>Writer · milestone</Text>
            </View>
            <Text style={{ fontSize: 15.5, fontFamily: serif(500), color: t.ink, lineHeight: 21 }}>Finished the first short story.</Text>
            <Text style={{ fontSize: 11.5, fontFamily: sans(600), color: t.inkFaint, marginTop: 4 }}>Jun 14</Text>
          </View>
          <View style={{ opacity: 0.6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 5 }}>
              <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: TC.engineer }} />
              <Text style={{ fontSize: 11.5, fontFamily: sans(700), color: t.inkSoft }}>Engineer</Text>
            </View>
            <Text style={{ fontSize: 15, fontFamily: serif(400), color: t.inkSoft, lineHeight: 21 }}>Finally understood closures.</Text>
          </View>
        </View>
      </View>
    </VizCard>
  );
}

/* 6 · reflect — Cosmo's gentle note */
function VizReflect() {
  const { t } = useTheme();
  return (
    <VizCard t={t}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 14 }}>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: t.core1, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="sparkle" size={16} color="#1c1708" />
        </View>
        <Text style={{ fontSize: 13, fontFamily: sans(700), letterSpacing: 0.4, color: t.inkSoft }}>A note from Cosmo</Text>
      </View>
      <Text style={{ fontSize: 16.5, lineHeight: 25, fontFamily: serif(400, true), color: t.ink }}>
        “You gave Writer real hours this week — the most since April. The story is becoming a habit.”
      </Text>
    </VizCard>
  );
}

const SLIDES = [
  { key: 'welcome', viz: VizMark, eyebrow: 'Welcome to Cosmo', title: 'You are not one thing.', body: 'You might be a reader, a writer, a coder, a maker, a gardener. Cosmo helps you give real time to every one of your identities.' },
  { key: 'cosmos', viz: VizCosmos, eyebrow: 'Your cosmos', title: 'Tap to log your time.', body: 'Each identity lives in your cosmos. Tap one to log the time you spent tending to it.' },
  { key: 'plan', viz: VizScheduler, eyebrow: 'Plan your week', title: 'Plan your week around real life.', body: 'Let the planner arrange sessions for each identity around the time you actually have.' },
  { key: 'rhythm', viz: VizRhythm, eyebrow: 'Rhythm', title: 'It’s about showing up.', body: 'A gentle streak counts the days you tend any hobby. Five of seven keeps the week — a missed night never counts against you.' },
  { key: 'journal', viz: VizJournal, eyebrow: 'Journal', title: 'Note how you’re growing.', body: 'Jot a reflection or mark a milestone for any identity. Over time it becomes the story of you getting better.' },
  { key: 'reflect', viz: VizReflect, eyebrow: 'Reflect with Cosmo', title: 'A quiet look back.', body: 'Cosmo notices the shape of your weeks and reflects it back.' },
];

export default function TourContent({ onDone }) {
  const { t } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [i, setI] = useState(0);
  const scroller = useRef(null);
  const last = i === SLIDES.length - 1;

  const goTo = (n) => {
    const clamped = Math.max(0, Math.min(SLIDES.length - 1, n));
    scroller.current?.scrollTo({ x: clamped * width, animated: true });
    setI(clamped);
  };
  const onScrollEnd = (e) => setI(Math.round(e.nativeEvent.contentOffset.x / width));

  return (
    <View style={{ flex: 1 }}>
      {/* top bar: brand + skip */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 6, paddingBottom: 4 }}>
        <Text style={{ fontSize: 13, fontFamily: sans(700), letterSpacing: 2, textTransform: 'uppercase', color: t.inkFaint }}>Cosmo</Text>
        <Pressable onPress={onDone} hitSlop={10} style={({ pressed }) => ({ paddingVertical: 6, paddingHorizontal: 8, opacity: pressed ? 0.6 : 1 })}>
          <Text style={{ fontSize: 14.5, fontFamily: sans(700), color: t.inkSoft }}>Skip</Text>
        </Pressable>
      </View>

      {/* swipeable slides */}
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        style={{ flex: 1 }}
      >
        {SLIDES.map((s) => {
          const V = s.viz;
          return (
            <View key={s.key} style={{ width, flex: 1, paddingHorizontal: 36, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ flex: 1, maxHeight: 320, alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                <V />
              </View>
              <View style={{ alignItems: 'center', paddingBottom: 12 }}>
                <Text style={{ fontSize: 12.5, fontFamily: sans(700), letterSpacing: 1.6, textTransform: 'uppercase', color: t.core1, marginBottom: 12 }}>{s.eyebrow}</Text>
                <Text style={{ fontFamily: serif(500), fontSize: 30, lineHeight: 36, color: t.ink, textAlign: 'center', marginBottom: 14 }}>{s.title}</Text>
                <Text style={{ fontSize: 16, lineHeight: 25, color: t.inkSoft, textAlign: 'center', fontFamily: sans(500), maxWidth: 440 }}>{s.body}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* progress dots */}
      <View style={{ flexDirection: 'row', gap: 7, justifyContent: 'center', paddingTop: 8 }}>
        {SLIDES.map((s, k) => (
          <Pressable key={s.key} onPress={() => goTo(k)} hitSlop={6}>
            <View style={{ width: k === i ? 22 : 7, height: 7, borderRadius: 999, backgroundColor: k === i ? t.ink : t.line }} />
          </Pressable>
        ))}
      </View>

      {/* CTA */}
      <View style={{ paddingHorizontal: 36, paddingTop: 18, paddingBottom: 16 + insets.bottom }}>
        <Pressable
          onPress={() => (last ? onDone() : goTo(i + 1))}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: t.ink, borderRadius: 999, paddingVertical: 17, opacity: pressed ? 0.9 : 1 })}
        >
          <Text style={{ fontSize: 16.5, fontFamily: sans(600), color: t.bg }}>{last ? 'Set up your cosmos' : 'Next'}</Text>
          <Icon name={last ? 'arrow' : 'chevron'} size={last ? 19 : 18} stroke={2.2} color={t.bg} />
        </Pressable>
      </View>
    </View>
  );
}
