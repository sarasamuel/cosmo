/* "The Cosmo Method" — the app's philosophy reading view. A full-screen overlay
   that slides up over the app and follows the app's light/dark theme. Ported from
   the prototype's methodology.jsx; copy is verbatim, only the medium changes
   (CSS → RN).

   Kept mounted and driven by `open` so the slide + reveal cascade replay cleanly;
   unmounts only after the close animation finishes (the app's sheet convention). */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, View, Text, Pressable, ScrollView, Easing, AccessibilityInfo } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore, useTheme } from '../store/Store';
import Starfield from '../components/Starfield';
import Icon from '../components/Icon';
import { serif, sans } from '../theme/fonts';

const idcOf = (t) => ({
  reader: t.id.reader.color,
  musician: t.id.musician.color,
  writer: t.id.writer.color,
  engineer: t.id.engineer.color,
  painter: t.id.painter.color,
  relax: t.id.relax.color,
});

// a content block that rises/fades in as the shared `reveal` value sweeps 0→1
function Rise({ reveal, index = 0, style, children }) {
  const start = Math.min(0.62, index * 0.07);
  const end = Math.min(1, start + 0.4);
  const opacity = reveal.interpolate({ inputRange: [start, end], outputRange: [0, 1], extrapolate: 'clamp' });
  const translateY = reveal.interpolate({ inputRange: [start, end], outputRange: [18, 0], extrapolate: 'clamp' });
  return <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>{children}</Animated.View>;
}

function Body({ children, style }) {
  const { t } = useTheme();
  return <Text style={[{ fontSize: 16.5, lineHeight: 27, color: t.inkSoft, fontFamily: serif(400), marginTop: 18 }, style]}>{children}</Text>;
}
function B({ children }) {
  const { t } = useTheme();
  return <Text style={{ fontFamily: sans(700), color: t.ink }}>{children}</Text>;
}
function Rule() {
  const { t } = useTheme();
  return <View style={{ height: 1, backgroundColor: t.line, marginVertical: 26 }} />;
}

function Section({ num, kicker, title, children }) {
  const { t } = useTheme();
  return (
    <View style={{ marginTop: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <Text style={{ fontFamily: serif(500), fontSize: 22, color: t.core1 }}>{num}</Text>
        <Text style={{ fontSize: 12, fontFamily: sans(700), letterSpacing: 1.6, textTransform: 'uppercase', color: t.inkFaint }}>{kicker}</Text>
      </View>
      <Text style={{ fontFamily: serif(500), fontSize: 27, lineHeight: 33, color: t.ink }}>{title}</Text>
      {children}
    </View>
  );
}

function Quote({ children, gold }) {
  const { t } = useTheme();
  return (
    <View style={{ alignItems: 'center', marginVertical: 30, paddingHorizontal: 10 }}>
      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: gold ? t.core1 : t.surface2, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
        <Icon name="sparkle" size={15} color={gold ? '#1c1708' : t.core1} />
      </View>
      <Text style={{ fontFamily: serif(500, true), fontSize: 22, lineHeight: 31, color: gold ? t.core1 : t.ink, textAlign: 'center' }}>{children}</Text>
    </View>
  );
}

function AllocRow({ label, pct, color }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 7 }}>
      <Text style={{ width: 66, fontSize: 13.5, fontFamily: sans(600), color: t.inkSoft }}>{label}</Text>
      <View style={{ flex: 1, height: 8, borderRadius: 999, backgroundColor: t.surface3, overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: '100%', borderRadius: 999, backgroundColor: color }} />
      </View>
      <Text style={{ width: 40, textAlign: 'right', fontFamily: serif(500), fontSize: 16, color: t.ink }}>
        {pct}<Text style={{ fontSize: 11, color: t.inkFaint }}>%</Text>
      </Text>
    </View>
  );
}

function GapBar({ label, pct, color, track }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 6 }}>
      <Text style={{ width: 72, fontSize: 12.5, fontFamily: sans(700), color }}>{label}</Text>
      <View style={{ flex: 1, height: 10, borderRadius: 999, backgroundColor: t.surface3, overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: '100%', borderRadius: 999, backgroundColor: track }} />
      </View>
    </View>
  );
}

// a simple alignment ring: track + progress arc + centered value
function AlignmentRing({ value = 72, size = 132 }) {
  const { t } = useTheme();
  const sw = 10;
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - value / 100);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={t.surface3} strokeWidth={sw} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={t.core1} strokeWidth={sw} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} />
      </Svg>
      <Text style={{ fontFamily: serif(500), fontSize: 34, color: t.ink }}>{value}<Text style={{ fontSize: 16, color: t.inkFaint }}>%</Text></Text>
      <Text style={{ fontSize: 11.5, fontFamily: sans(700), letterSpacing: 1, textTransform: 'uppercase', color: t.inkFaint, marginTop: 2 }}>aligned</Text>
    </View>
  );
}

const STARS = [
  { x: 70, y: 60, r: 5.5, o: 1 },
  { x: 180, y: 38, r: 3, o: 0.5 },
  { x: 300, y: 78, r: 6.5, o: 1 },
  { x: 410, y: 46, r: 2.4, o: 0.4 },
  { x: 250, y: 140, r: 4, o: 0.85 },
  { x: 130, y: 150, r: 3.2, o: 0.7 },
  { x: 380, y: 150, r: 2.8, o: 0.55 },
];
const LINKS = [[0, 1], [1, 2], [2, 3], [0, 5], [5, 4], [4, 2], [4, 6], [6, 2]];

// the closing visual — drawn to match the user's Portfolio view (orbit vs constellation)
function ConstellationMark() {
  const { t } = useTheme();
  const idc = idcOf(t);
  // colorful stars (like the orbit's planets), each with a glow in its own hue
  const palette = [idc.writer, idc.reader, idc.engineer, idc.musician, idc.painter, idc.relax];
  const lineCol = t.name === 'light' ? t.cstInk : t.star; // links stay a subtle neutral
  return (
    <Svg width="100%" height={180} viewBox="0 0 480 200">
      {LINKS.map(([a, b], k) => (
        <Line key={k} x1={STARS[a].x} y1={STARS[a].y} x2={STARS[b].x} y2={STARS[b].y} stroke={lineCol} strokeOpacity={0.32} strokeWidth={1} />
      ))}
      {STARS.map((s, k) => {
        const col = palette[k % palette.length];
        return (
          <React.Fragment key={k}>
            <Circle cx={s.x} cy={s.y} r={s.r + 6} fill={col} opacity={s.o * 0.22} />
            <Circle cx={s.x} cy={s.y} r={s.r} fill={col} opacity={s.o} />
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

function OrbitMark() {
  const { t } = useTheme();
  const idc = idcOf(t);
  const planets = [
    { c: idc.engineer, x: 150, y: 64, r: 11 },
    { c: idc.writer, x: 52, y: 92, r: 13 },
    { c: idc.reader, x: 156, y: 140, r: 9 },
    { c: idc.musician, x: 98, y: 162, r: 10 },
  ];
  return (
    <Svg width={200} height={200} viewBox="0 0 200 200">
      {[42, 68, 94].map((r) => (
        <Circle key={r} cx={100} cy={100} r={r} fill="none" stroke={t.ring} strokeWidth={1.5} strokeDasharray="2 10" />
      ))}
      {/* golden core sun */}
      <Circle cx={100} cy={100} r={28} fill={t.core1} opacity={0.16} />
      <Line x1={82} y1={100} x2={118} y2={100} stroke={t.core1} strokeWidth={2.5} strokeLinecap="round" opacity={0.9} />
      <Line x1={100} y1={82} x2={100} y2={118} stroke={t.core1} strokeWidth={2.5} strokeLinecap="round" opacity={0.9} />
      <Circle cx={100} cy={100} r={14} fill={t.core1} />
      <Circle cx={100} cy={100} r={14} fill="#fff" opacity={0.18} />
      {planets.map((p, i) => (
        <React.Fragment key={i}>
          <Circle cx={p.x} cy={p.y} r={p.r * 2.2} fill={p.c} opacity={0.2} />
          <Circle cx={p.x} cy={p.y} r={p.r} fill={p.c} />
        </React.Fragment>
      ))}
    </Svg>
  );
}

export default function Methodology({ open, onClose }) {
  const insets = useSafeAreaInsets();
  const { t } = useTheme(); // follow the app's light/dark theme
  const { form } = useStore(); // mirror the Portfolio view: orbit vs constellation
  const whole = form === 'orbit' ? 'orbit' : 'constellation'; // the word for chapter 04
  const idc = idcOf(t);
  const [mounted, setMounted] = useState(false);
  const slide = useRef(new Animated.Value(0)).current; // 0 hidden, 1 shown
  const reveal = useRef(new Animated.Value(0)).current; // cascade driver
  const scroller = useRef(null);

  const IDENTS = [
    { name: 'Engineer', c: idc.engineer },
    { name: 'Writer', c: idc.writer },
    { name: 'Musician', c: idc.musician },
    { name: 'Parent', c: idc.painter },
    { name: 'Reader', c: idc.reader },
    { name: 'Friend', c: idc.relax },
  ];

  useEffect(() => {
    let cancelled = false;
    if (open) {
      setMounted(true);
      scroller.current?.scrollTo({ y: 0, animated: false });
      AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
        if (cancelled) return;
        if (reduced) { slide.setValue(1); reveal.setValue(1); return; }
        slide.setValue(0); reveal.setValue(0);
        Animated.timing(slide, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
        Animated.timing(reveal, { toValue: 1, duration: 1100, delay: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      });
    } else if (mounted) {
      Animated.timing(slide, { toValue: 0, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!mounted) return null;

  return (
    <Animated.View
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 70,
        backgroundColor: t.bg,
        opacity: slide,
        transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
      }}
    >
      <Starfield count={56} />

      {/* header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 8 }}>
        <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close" style={({ pressed }) => ({ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surface2, borderWidth: 1, borderColor: t.line, opacity: pressed ? 0.6 : 1 })}>
          <View style={{ transform: [{ rotate: '90deg' }] }}><Icon name="chevron" size={20} stroke={2.2} color={t.inkSoft} /></View>
        </Pressable>
        <Text style={{ fontSize: 12.5, fontFamily: sans(700), letterSpacing: 1.4, textTransform: 'uppercase', color: t.inkFaint }}>The Cosmo Method</Text>
        <View style={{ width: 42 }} />
      </View>

      <ScrollView ref={scroller} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 32, paddingBottom: 60 + insets.bottom }} showsVerticalScrollIndicator={false}>
        {/* hero */}
        <Rise reveal={reveal} index={0} style={{ paddingTop: 24, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 18 }}>
            <Icon name="sparkle" size={13} color={t.core1} />
            <Text style={{ fontSize: 12, fontFamily: sans(700), letterSpacing: 1.8, textTransform: 'uppercase', color: t.core1 }}>The philosophy</Text>
          </View>
          <Text style={{ fontFamily: serif(500), fontSize: 46, lineHeight: 50, color: t.ink, textAlign: 'center' }}>The Cosmo{'\n'}Method</Text>
          <Text style={{ fontFamily: serif(400), fontSize: 19, lineHeight: 29, color: t.inkSoft, textAlign: 'center', marginTop: 22 }}>
            Most people track what they <Text style={{ textDecorationLine: 'line-through', color: t.inkFaint }}>do</Text>.{'\n'}
            Cosmo tracks who they <Text style={{ fontFamily: serif(400, true), color: t.ink }}>become</Text>.
          </Text>
        </Rise>

        {/* intro — identities */}
        <Rise reveal={reveal} index={1}>
          <Rule />
          <Body style={{ marginTop: 0 }}>
            A life isn’t made up of goals, habits, or achievements alone. It’s made up of <B>identities</B> — the different parts of you that matter.
          </Body>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 18 }}>
            {IDENTS.map((i) => (
              <View key={i.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i.c }} />
                <Text style={{ fontSize: 13.5, fontFamily: sans(600), color: t.ink }}>{i.name}</Text>
              </View>
            ))}
            <View style={{ paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderStyle: 'dashed', borderColor: t.line }}>
              <Text style={{ fontSize: 13.5, fontFamily: sans(500), color: t.inkFaint }}>…or something entirely your own</Text>
            </View>
          </View>
          <Body>
            Each week, these identities compete for the same limited resource: <B>your time</B>. The challenge isn’t becoming one thing — it’s deciding how much of yourself belongs to each.
          </Body>
        </Rise>

        <Rise reveal={reveal} index={2}><Rule /></Rise>

        {/* 01 — percentages */}
        <Rise reveal={reveal} index={3}>
          <Section num="01" kicker="The unit" title="Why percentages, not hours?">
            <View style={{ marginTop: 20, gap: 12 }}>
              <View style={{ padding: 16, borderRadius: t.radii.md, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface }}>
                <Text style={{ fontSize: 11.5, fontFamily: sans(700), letterSpacing: 0.6, textTransform: 'uppercase', color: t.inkFaint, marginBottom: 12 }}>Traditional goals ask</Text>
                {[['Read', '5 hours'], ['Practice piano', '3 hours'], ['Write', '2 hours']].map(([l, h]) => (
                  <View key={l} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                    <Text style={{ fontSize: 14.5, fontFamily: sans(500), color: t.inkSoft }}>{l}</Text>
                    <Text style={{ fontSize: 14.5, fontFamily: sans(700), color: t.inkFaint }}>{h}</Text>
                  </View>
                ))}
              </View>
              <View style={{ padding: 16, borderRadius: t.radii.md, borderWidth: 1, borderColor: t.core1 + '55', backgroundColor: t.surface }}>
                <Text style={{ fontSize: 11.5, fontFamily: sans(700), letterSpacing: 0.6, textTransform: 'uppercase', color: t.core1, marginBottom: 12 }}>Cosmo asks instead</Text>
                <AllocRow label="Reading" pct={40} color={idc.reader} />
                <AllocRow label="Piano" pct={35} color={idc.musician} />
                <AllocRow label="Writing" pct={25} color={idc.writer} />
              </View>
            </View>

            <Body>Life rarely gives us the same amount of free time every week. Some weeks hold twenty free hours. Others hold fifty.</Body>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}>
              {[['20', 'free hours'], ['50', 'free hours']].map(([n, u]) => (
                <View key={n} style={{ flex: 1, alignItems: 'center', paddingVertical: 18, borderRadius: t.radii.md, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface }}>
                  <Text style={{ fontFamily: serif(500), fontSize: 34, color: t.ink }}>{n}</Text>
                  <Text style={{ fontSize: 12.5, fontFamily: sans(600), color: t.inkFaint, marginTop: 2 }}>{u}</Text>
                </View>
              ))}
            </View>
            <Body>
              What matters isn’t a fixed number of hours — it’s the <B>share of your life</B> you choose to give each identity. A week where 25% of your free time went to writing tells a more meaningful story than a week where you happened to write for five hours.
            </Body>
            <Quote>Cosmo measures allocation, not productivity.</Quote>
          </Section>
        </Rise>

        <Rise reveal={reveal} index={4}><Rule /></Rise>

        {/* 02 — intention & reality */}
        <Rise reveal={reveal} index={5}>
          <Section num="02" kicker="The practice" title="Intention and reality">
            <Body>
              At the start of each week, you decide how you want to spend your free time. This becomes your <B>intention</B>. As the week unfolds, you record where your time actually went. This becomes your <B>reality</B>.
            </Body>
            <View style={{ marginTop: 22, padding: 18, borderRadius: t.radii.md, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface }}>
              <GapBar label="Intention" pct={72} color={t.core1} track={t.core1} />
              <GapBar label="Reality" pct={52} color={t.inkSoft} track={t.inkSoft} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 12 }}>
                <Icon name="sparkle" size={14} color={t.core1} />
                <Text style={{ flex: 1, fontSize: 13.5, lineHeight: 19, fontFamily: sans(500), color: t.inkSoft }}>
                  The <B>gap</B> between them is where reflection begins.
                </Text>
              </View>
            </View>
            <Body>
              Neither is right or wrong. Sometimes life asks more of one identity than another — deadlines pull, opportunities appear, energy changes. Cosmo doesn’t judge these shifts. It simply helps you see them.
            </Body>
          </Section>
        </Rise>

        <Rise reveal={reveal} index={6}><Rule /></Rise>

        {/* 03 — alignment */}
        <Rise reveal={reveal} index={7}>
          <Section num="03" kicker="The measure" title="Alignment">
            <Body>Alignment is the degree to which your lived time matches your intended time.</Body>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 22 }}>
              <AlignmentRing value={72} size={128} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 15.5, fontFamily: sans(700), color: t.ink, marginBottom: 6 }}>Not a grade</Text>
                <Text style={{ fontSize: 14, lineHeight: 21, fontFamily: sans(500), color: t.inkSoft }}>A high score doesn’t mean a perfect week. It means your actions and your priorities moved in the same direction.</Text>
              </View>
            </View>
            <Body>A low score isn’t failure. <B>It’s information.</B> It’s an invitation to ask:</Body>
            <Quote gold>“Is this the life I intended to live?”</Quote>
          </Section>
        </Rise>

        <Rise reveal={reveal} index={8}><Rule /></Rise>

        {/* 04 — constellation / orbit */}
        <Rise reveal={reveal} index={9}>
          <Section num="04" kicker="The whole" title={`Your ${whole}`}>
            <Body>Every identity you choose becomes part of your {whole}. Some grow brighter. Some grow quieter. Some disappear for a while, and return.</Body>
            <View style={{ marginTop: 22, alignItems: 'center' }}>
              {form === 'orbit' ? <OrbitMark /> : <ConstellationMark />}
            </View>
            <Body>There is no perfect balance. There is only the ongoing practice of deciding who you want to become — and giving that person your time.</Body>

            <View style={{ alignItems: 'center', marginTop: 36 }}>
              <Text style={{ fontFamily: serif(500), fontSize: 24, lineHeight: 31, color: t.ink, textAlign: 'center', marginBottom: 24 }}>Because time is how identities grow.</Text>
              <Pressable onPress={onClose} style={({ pressed }) => ({ backgroundColor: t.core1, borderRadius: 999, paddingVertical: 16, paddingHorizontal: 40, opacity: pressed ? 0.9 : 1 })}>
                <Text style={{ fontFamily: sans(700), fontSize: 16, color: '#1c1708' }}>Begin where you are</Text>
              </Pressable>
            </View>
          </Section>
        </Rise>
      </ScrollView>
    </Animated.View>
  );
}
