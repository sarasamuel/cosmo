/* Cosmo — cold-start splash, re-implemented natively from the web design spec
   (cosmo-splash.jsx / "Cosmo Splash Screens.html"). The OS draws a static launch
   frame first (deep-space bg, see app.json `splash`); the instant the app mounts
   this overlay picks up from that frame and plays the ~2.2s constellation intro —
   stars fade in one by one, lines trace between them, then the wordmark + tagline
   settle. It holds until the app is ready (fonts + store hydrated) and a minimum
   beat has passed, then cross-fades to reveal the app underneath.

   Motion uses RN's built-in Animated + react-native-svg (the app's convention;
   no SVG blur filters — glows are translucent halos, per RUNNING.md). The intro
   timeline is JS-driven (SVG props), the exit fade is native-driven (View opacity).

   Animation contract (from the spec, total ≈2.2s then hold):
   - stars enter at 0.3 + i*0.14s   - lines draw at 0.95 + k*0.08s
   - wordmark 1.5s   - tagline 1.72s */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, AccessibilityInfo, useWindowDimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, G, Line, Circle } from 'react-native-svg';
import { darkTheme } from '../theme/theme';
import { serif, sans } from '../theme/fonts';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedLine = Animated.createAnimatedComponent(Line);

const GOLD = '#ffe9b0';
const DURATION = 2300; // ms — master intro timeline; element windows are fractions of it
const MIN_HOLD = 2600; // ms — never reveal the app before this, so a fast boot still shows the beat
const RM_HOLD = 700;   // ms — reduced-motion: brief frozen beat, then proceed

// jewel hues straight from the app's dark palette, so the splash matches the cosmos
const JEWEL = {
  writer: darkTheme.id.writer.color,
  reader: darkTheme.id.reader.color,
  engineer: darkTheme.id.engineer.color,
  musician: darkTheme.id.musician.color,
  painter: darkTheme.id.painter.color,
};

// constellation geometry (1024 viewBox), from the design spec's CST lockup
const STARS = [
  { x: 512, y: 388, r: 42, hero: true },
  { x: 318, y: 296, r: 21, key: 'writer' },
  { x: 712, y: 318, r: 22, key: 'musician' },
  { x: 748, y: 588, r: 21, key: 'engineer' },
  { x: 556, y: 714, r: 18, key: 'painter' },
  { x: 396, y: 616, r: 20, key: 'reader' },
];
const EDGES = [[1, 0], [0, 2], [2, 3], [3, 4], [4, 5], [5, 0]];
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// seeded full-screen background stars (deep-space, theme-independent). Each
// carries a core radius + opacity; rendered with a soft glow halo behind it.
function makeBgStars(w, h, n, seed) {
  let s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  return Array.from({ length: n }, () => ({
    x: +(rnd() * w).toFixed(1), y: +(rnd() * h).toFixed(1),
    r: +(0.5 + rnd() * 1.2).toFixed(2), o: +(0.25 + rnd() * 0.55).toFixed(2),
  }));
}

export default function SplashScreen({ appReady, onHidden }) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [resolved, setResolved] = useState(false); // accessibility flag checked
  const progress = useRef(new Animated.Value(0)).current; // 0→1 intro timeline
  const fade = useRef(new Animated.Value(1)).current;     // overlay opacity for exit
  const [minElapsed, setMinElapsed] = useState(false);
  const exitingRef = useRef(false);
  const { width, height } = useWindowDimensions();
  const stars = useMemo(() => makeBgStars(width || 402, height || 874, 70, 4242), [width, height]);

  // resolve reduced-motion once, then start the timeline accordingly
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((rm) => { if (alive) { setReduceMotion(rm); setResolved(true); } })
      .catch(() => { if (alive) setResolved(true); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!resolved) return undefined;
    let timer;
    if (reduceMotion) {
      progress.setValue(1); // frozen end-state — no pops, draws, or fades
      timer = setTimeout(() => setMinElapsed(true), RM_HOLD);
    } else {
      Animated.timing(progress, { toValue: 1, duration: DURATION, easing: Easing.linear, useNativeDriver: false }).start();
      timer = setTimeout(() => setMinElapsed(true), MIN_HOLD);
    }
    return () => clearTimeout(timer);
  }, [resolved, reduceMotion, progress]);

  // reveal the app once it's ready AND the minimum beat has passed (whichever is later)
  useEffect(() => {
    if (!appReady || !minElapsed || exitingRef.current) return;
    exitingRef.current = true;
    Animated.timing(fade, { toValue: 0, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: true })
      .start(() => onHidden && onHidden());
  }, [appReady, minElapsed, fade, onHidden]);

  if (!resolved) {
    // hold the deep-space bg for the one tick before the a11y flag resolves (no flash)
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000000' }]} pointerEvents="none" />;
  }

  // interpolation helpers — `start`/`dur` are fractions of DURATION
  const appear = (start, dur = 0.13) =>
    progress.interpolate({ inputRange: [start, start + dur], outputRange: [0, 1], extrapolate: 'clamp' });
  const rise = (start, dur = 0.13) =>
    progress.interpolate({ inputRange: [start, start + dur], outputRange: [12, 0], extrapolate: 'clamp' });

  const wordAt = 1500 / DURATION;
  const tagAt = 1720 / DURATION;

  return (
    // capture touches while shown so taps can't fall through to the app mounting
    // behind it; the overlay unmounts entirely once revealed, so it never eats input after
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade, zIndex: 100 }]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' }]}>
        {/* full-screen starfield — each star a small bright core with a soft glow halo */}
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none" width={width} height={height}>
          {stars.map((s, i) => (
            <G key={`bg${i}`}>
              <Circle cx={s.x} cy={s.y} r={s.r * 4.5} fill="#cfd6ff" opacity={s.o * 0.10} />
              <Circle cx={s.x} cy={s.y} r={s.r * 2.2} fill="#dfe2ff" opacity={s.o * 0.22} />
              <Circle cx={s.x} cy={s.y} r={s.r} fill="#f2f4ff" opacity={s.o} />
            </G>
          ))}
        </Svg>

        {/* the constellation figure */}
        <Svg width={300} height={300} viewBox="0 0 1024 1024">
          <Defs>
            <RadialGradient id="spCore" cx="42%" cy="38%" r="68%">
              <Stop offset="0%" stopColor="#fff9ea" />
              <Stop offset="38%" stopColor="#ffe6a6" />
              <Stop offset="78%" stopColor="#f6bf5c" />
              <Stop offset="100%" stopColor="#e7a23e" />
            </RadialGradient>
            {/* soft glow per star — color at the core fading to fully transparent
                (a gradient falloff, not a flat translucent disc) */}
            {STARS.map((st, i) => {
              const color = st.hero ? GOLD : JEWEL[st.key];
              return (
                <RadialGradient key={`g${i}`} id={`spGlow${i}`} cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor={color} stopOpacity="0.6" />
                  <Stop offset="35%" stopColor={color} stopOpacity="0.28" />
                  <Stop offset="70%" stopColor={color} stopOpacity="0.08" />
                  <Stop offset="100%" stopColor={color} stopOpacity="0" />
                </RadialGradient>
              );
            })}
          </Defs>

          {/* connecting lines — drawn via strokeDashoffset after the stars are up */}
          {EDGES.map(([a, b], k) => {
            const pa = STARS[a], pb = STARS[b], L = dist(pa, pb);
            const start = (950 + k * 80) / DURATION;
            return (
              <AnimatedLine
                key={`e${k}`}
                x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                stroke="rgba(214,220,255,0.30)" strokeWidth={3} strokeLinecap="round"
                strokeDasharray={L}
                strokeDashoffset={progress.interpolate({ inputRange: [start, start + 0.22], outputRange: [L, 0], extrapolate: 'clamp' })}
                opacity={appear(start, 0.18)}
              />
            );
          })}

          {/* stars — each pops in (scale overshoot + fade) on its own delay */}
          {STARS.map((st, i) => {
            const start = (300 + i * 140) / DURATION;
            const color = st.hero ? GOLD : JEWEL[st.key];
            return (
              // pure opacity fade-in — no scale/movement, the star just brightens from the background
              <AnimatedG key={`s${i}`} opacity={appear(start, 0.26)}>
                {/* radial-gradient glow (fades to transparent, no hard ring) */}
                <Circle cx={st.x} cy={st.y} r={st.r * 3.6} fill={`url(#spGlow${i})`} />
                {st.hero && (
                  <G stroke={GOLD} strokeWidth={6} strokeLinecap="round" opacity={0.85}>
                    <Line x1={st.x - st.r * 2.3} y1={st.y} x2={st.x + st.r * 2.3} y2={st.y} />
                    <Line x1={st.x} y1={st.y - st.r * 2.3} x2={st.x} y2={st.y + st.r * 2.3} />
                  </G>
                )}
                <Circle cx={st.x} cy={st.y} r={st.r} fill={st.hero ? 'url(#spCore)' : color} />
                <Circle cx={st.x - st.r * 0.28} cy={st.y - st.r * 0.3} r={st.r * 0.42} fill="#fff" opacity={st.hero ? 0.55 : 0.4} />
              </AnimatedG>
            );
          })}
        </Svg>

        {/* wordmark + tagline */}
        <Animated.Text
          style={{
            fontFamily: serif(400), fontSize: 50, color: '#f4f4ff', marginTop: 4, letterSpacing: 0.5,
            opacity: appear(wordAt), transform: [{ translateY: rise(wordAt) }],
          }}
        >
          Cosmo
        </Animated.Text>
        <Animated.Text
          style={{ fontFamily: sans(500), fontSize: 15, color: '#a9a8c6', marginTop: 12, opacity: appear(tagAt) }}
        >
          Make time for every you
        </Animated.Text>
      </View>
    </Animated.View>
  );
}
