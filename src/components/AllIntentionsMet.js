/* Whole-week triumph overlay — fires once when EVERY identity has met its weekly
   intention. RN port of the prototype's all-intentions-met.jsx (window.AllIntentionsMet).

   The figure animation is a faithful port of the prototype's OrbitFull /
   ConstellationFull, NOT the in-app viz: a single clock `t` (seconds since the
   figure mounted) drives every node's position / radius / opacity each frame —
   no CSS keyframes, no stroke-dash line-drawing, no per-element animation state.
   Web-only bits are approximated: SVG feGaussianBlur glow → translucent halo
   circles (RN-SVG filters are unreliable), mix-blend screen nebula → low-opacity
   colored circles. The glint "spark" is Animated (DOM spans have no RN analog).

   Behavior (match this, don't reinvent):
   - Orbit: Fibonacci sphere, continuous spin (angle = 0.35 + t*0.16, never stops),
     rings + golden sun reveal over ~1.3s, planets ignite staggered, z-sorted.
   - Constellation: cached seeded geometry (sunflower + MST + DFS edge order);
     stars fade up center-outward FIRST, then a nebula rises, then the lines
     fade in (opacity only — no traveling tip) staggered along the DFS walk;
     stars hold a gentle breathing.
   - Glint burst ~1s after open; headline/CTA in at 1350ms; whole-figure breathe
     at 2200ms. Replay re-runs the figure only. Reduced motion → settled state. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, View, Text, Pressable, Easing, AccessibilityInfo, useWindowDimensions, Share } from 'react-native';
import Svg, { Circle, Line, Path, G, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useTheme } from '../store/Store';
import { serif, sans } from '../theme/fonts';

/* ---------- easing + math (ported) ---------- */
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

function amSphere(n, R) {
  const ga = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: n }, (_, i) => {
    const yy = 1 - ((i + 0.5) / n) * 2;
    const r = Math.sqrt(Math.max(0, 1 - yy * yy));
    const phi = i * ga;
    return { x: Math.cos(phi) * r * R, y: yy * R, z: Math.sin(phi) * r * R };
  });
}
function amProject(p, angle, tilt, cx, cy, D) {
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const x = p.x * ca + p.z * sa, z1 = -p.x * sa + p.z * ca;
  const ct = Math.cos(tilt), stt = Math.sin(tilt);
  const y = p.y * ct - z1 * stt, z = p.y * stt + z1 * ct;
  const scale = D / (D - z);
  return { sx: cx + x * scale, sy: cy - y * scale, z, scale };
}
function amRingPath(plane, angle, tilt, R, cx, cy, D) {
  let d = '';
  for (let k = 0; k <= 80; k += 1) {
    const tt = (k / 80) * Math.PI * 2;
    const p = plane === 'xz'
      ? { x: Math.cos(tt) * R, y: 0, z: Math.sin(tt) * R }
      : { x: Math.cos(tt) * R, y: Math.sin(tt) * R, z: 0 };
    const pr = amProject(p, angle, tilt, cx, cy, D);
    d += (k ? 'L' : 'M') + pr.sx.toFixed(1) + ' ' + pr.sy.toFixed(1);
  }
  return d + 'Z';
}
function amMst(pts) {
  const n = pts.length;
  if (n < 2) return [];
  const inTree = [0];
  const rest = new Set();
  for (let i = 1; i < n; i += 1) rest.add(i);
  const edges = [];
  while (rest.size) {
    let best = null;
    for (const a of inTree) for (const b of rest) {
      const dx = pts[a].x - pts[b].x, dy = pts[a].y - pts[b].y, d = dx * dx + dy * dy;
      if (!best || d < best.d) best = { a, b, d };
    }
    edges.push([best.a, best.b]); inTree.push(best.b); rest.delete(best.b);
  }
  return edges;
}
function amConstEdges(pts, extras) {
  const tree = amMst(pts);
  if (!extras || extras <= 0) return tree;
  const deg = {};
  tree.forEach(([a, b]) => { deg[a] = (deg[a] || 0) + 1; deg[b] = (deg[b] || 0) + 1; });
  const used = new Set(tree.map(([a, b]) => (a < b ? a + '-' + b : b + '-' + a)));
  const all = [];
  for (let a = 0; a < pts.length; a += 1) for (let b = a + 1; b < pts.length; b += 1) {
    const dx = pts[a].x - pts[b].x, dy = pts[a].y - pts[b].y;
    all.push({ a, b, d: Math.sqrt(dx * dx + dy * dy) });
  }
  const out = [...tree];
  for (let e = 0; e < extras; e += 1) {
    let best = null;
    for (const c of all) {
      const key = c.a < c.b ? c.a + '-' + c.b : c.b + '-' + c.a;
      if (used.has(key)) continue;
      const score = c.d / (1 + 0.6 * ((deg[c.a] || 0) + (deg[c.b] || 0)));
      if (!best || score < best.score) best = { a: c.a, b: c.b, key, score };
    }
    if (!best) break;
    out.push([best.a, best.b]); used.add(best.key);
    deg[best.a] = (deg[best.a] || 0) + 1; deg[best.b] = (deg[best.b] || 0) + 1;
  }
  return out;
}

/* clock — seconds since mount; pinned to a settled value under reduced motion */
function useClock() {
  const [t, setT] = useState(0);
  useEffect(() => {
    let raf;
    let stopped = false;
    const t0 = Date.now();
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (reduced) { stopped = true; if (raf) cancelAnimationFrame(raf); setT(99); }
    });
    const loop = () => {
      if (stopped) return;
      setT((Date.now() - t0) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { stopped = true; if (raf) cancelAnimationFrame(raf); };
  }, []);
  return t;
}

const SVG = 360;
const CX = SVG / 2;

/* ============================== ORBIT, fully lit ============================== */
function OrbitFull({ identities, size }) {
  const { t: th, colorsFor } = useTheme();
  const t = useClock();
  const R = 122, D = 840, tilt = -0.46;
  const n = identities.length;
  const pts = useMemo(() => amSphere(n, R), [n]);

  const angle = 0.35 + t * 0.16; // continuous spin — never settles
  const reveal = easeOut(clamp(t / 1.3, 0, 1));

  const proj = identities.map((idn, i) => {
    const pr = amProject(pts[i], angle, tilt, CX, CX, D);
    const depth = (pr.z + R) / (2 * R);
    const ig = easeOut(clamp((t - 0.18 - i * 0.12) / 0.55, 0, 1));
    return { idn, ...pr, depth, ig };
  });
  const order = [...proj].sort((a, b) => a.z - b.z);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${SVG} ${SVG}`}>
      <Defs>
        <RadialGradient id="amCoreGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={th.core1} stopOpacity="1" />
          <Stop offset="38%" stopColor={th.core2} stopOpacity="0.9" />
          <Stop offset="100%" stopColor={th.core2} stopOpacity="0" />
        </RadialGradient>
      </Defs>

      <G opacity={reveal}>
        <Path d={amRingPath('xz', angle, tilt, R, CX, CX, D)} fill="none" stroke={th.ring} strokeWidth="1" strokeOpacity={0.5} />
        <Path d={amRingPath('xy', angle, tilt, R * 0.82, CX, CX, D)} fill="none" stroke={th.ring} strokeWidth="1" strokeOpacity={0.3} strokeDasharray="2 6" />
      </G>

      {/* golden core sun */}
      <G opacity={reveal}>
        <Circle cx={CX} cy={CX} r={92 * (0.6 + reveal * 0.4)} fill="url(#amCoreGlow)" />
        <Circle cx={CX} cy={CX} r={32} fill={th.core2} opacity={0.3} />
        <Circle cx={CX} cy={CX} r={32} fill="none" stroke={th.core1} strokeOpacity={0.45} strokeWidth="1" />
        <Circle cx={CX} cy={CX} r={9} fill={th.core1} />
      </G>

      {/* spokes */}
      {order.map(({ idn, sx, sy, depth, ig }) => (
        <Line key={'s' + idn.id} x1={CX} y1={CX} x2={sx} y2={sy} stroke={colorsFor(idn).color} strokeWidth={0.8 + depth} strokeOpacity={(0.09 + depth * 0.22) * ig} />
      ))}

      {/* planets — every one filled to the brim */}
      {order.map(({ idn, sx, sy, scale, depth, ig }) => {
        const col = colorsFor(idn).color;
        const base = (13 + idn.desired * 0.5) * scale * ig;
        return (
          <G key={idn.id} opacity={0.5 + depth * 0.5}>
            <Circle cx={sx} cy={sy} r={base * 1.6} fill={col} opacity={0.22 * depth * ig} />
            <Circle cx={sx} cy={sy} r={base} fill={col} opacity={0.96} />
            <Circle cx={sx} cy={sy} r={base} fill="none" stroke="#fff" strokeWidth={1 * scale} strokeOpacity={0.5 * ig} />
            <Circle cx={sx - base * 0.28} cy={sy - base * 0.3} r={base * 0.34} fill="#fff" opacity={0.45 * ig} />
          </G>
        );
      })}
    </Svg>
  );
}

/* ========================= CONSTELLATION, shining ============================ */
function ConstellationFull({ identities, size }) {
  const { t: th, colorsFor } = useTheme();
  const t = useClock();
  const n = identities.length;

  const geo = useMemo(() => {
    const GOLD = Math.PI * (3 - Math.sqrt(5));
    let s = 7;
    const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    const RAD = 112;
    const raw = Array.from({ length: n }, (_, i) => {
      const rr = Math.sqrt((i + 0.5) / n), ang = i * GOLD;
      return { x: Math.cos(ang) * rr * RAD + (rnd() - 0.5) * 22, y: Math.sin(ang) * rr * RAD + (rnd() - 0.5) * 22 };
    });
    const cen = raw.reduce((a, p) => ({ x: a.x + p.x / n, y: a.y + p.y / n }), { x: 0, y: 0 });
    const rel = raw.map((p) => ({ x: p.x - cen.x, y: p.y - cen.y }));
    const edges = amConstEdges(rel, n >= 10 ? Math.floor((n - 7) / 3) : 0);
    let s2 = 13;
    const r2 = () => { s2 = (s2 * 1103515245 + 12345) & 0x7fffffff; return s2 / 0x7fffffff; };
    const mp = Array.from({ length: n }, () => ({ f: 0.5 + r2() * 0.8, a: 0.12 + r2() * 0.13, ph: r2() * Math.PI * 2 }));

    // stars settle center-outward
    const dist = rel.map((p) => Math.hypot(p.x, p.y));
    const ordIdx = dist.map((d, i) => [d, i]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    const starDelay = new Array(n);
    ordIdx.forEach((i, rank) => { starDelay[i] = 0.1 + rank * 0.07; });
    const starsLit = (n ? Math.max(...starDelay) : 0) + 0.4;

    // DFS edge order so the line cascade flows along the figure
    const adj = Array.from({ length: n }, () => []);
    edges.forEach((e, ei) => { adj[e[0]].push({ to: e[1], ei }); adj[e[1]].push({ to: e[0], ei }); });
    const usedE = new Set();
    const ordered = [];
    const walk = (u) => {
      for (const { to, ei } of adj[u]) {
        if (usedE.has(ei)) continue;
        usedE.add(ei); ordered.push([u, to]); walk(to);
      }
    };
    if (n) walk(0);
    edges.forEach((e, ei) => { if (!usedE.has(ei)) ordered.push(e); });

    const LINE_BEGIN = starsLit - 0.05, STAGGER = 0.13, FADE = 0.85;
    const fadeStart = ordered.map((_, k) => LINE_BEGIN + k * STAGGER);
    return { rel, edges: ordered, mp, starDelay, starsLit, fadeStart, fadeDur: FADE };
  }, [n]);

  const { rel, edges, mp, starDelay, starsLit, fadeStart, fadeDur } = geo;
  const proj = identities.map((idn, i) => ({ idn, i, sx: CX + rel[i].x, sy: CX + rel[i].y }));
  const nebIn = easeOut(clamp((t - (starsLit - 0.5)) / 1.4, 0, 1));

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${SVG} ${SVG}`}>
      {/* one soft radial gradient per star — fades to fully transparent at the
          edge so the glow melts into the background (like the orbit sun) rather
          than reading as a hard-edged colored disc */}
      <Defs>
        {proj.map(({ idn, i }) => {
          const col = colorsFor(idn).color;
          return (
            <RadialGradient key={'g' + i} id={`amNeb-${i}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={col} stopOpacity="0.68" />
              <Stop offset="46%" stopColor={col} stopOpacity="0.2" />
              <Stop offset="100%" stopColor={col} stopOpacity="0" />
            </RadialGradient>
          );
        })}
      </Defs>

      {/* ambient nebula — soft colored clouds glowing up behind each star */}
      <G opacity={nebIn}>
        {proj.map(({ idn, sx, sy, i }) => {
          const m = mp[i];
          const breathe = 1 + Math.sin(t * m.f * 0.5 + m.ph) * 0.16;
          return <Circle key={'neb' + idn.id} cx={sx} cy={sy} r={(66 + idn.desired * 1.1) * breathe} fill={`url(#amNeb-${i})`} />;
        })}
      </G>

      {/* connecting lines — pure opacity fade-in, nothing directional */}
      {edges.map(([a, b], k) => {
        const na = proj[a], nb = proj[b];
        const p = easeInOut(clamp((t - fadeStart[k]) / fadeDur, 0, 1));
        if (p <= 0) return null;
        return (
          <G key={k}>
            <Line x1={na.sx} y1={na.sy} x2={nb.sx} y2={nb.sy} stroke={th.cstInk} strokeWidth="2.6" strokeLinecap="round" strokeOpacity={0.1 * p} />
            <Line x1={na.sx} y1={na.sy} x2={nb.sx} y2={nb.sy} stroke={th.cstInk} strokeWidth="1.1" strokeLinecap="round" strokeOpacity={0.34 * p} />
          </G>
        );
      })}

      {/* stars — fade up, then hold a calm breathing (reticle: ring + cross + core) */}
      {proj.map(({ idn, sx, sy, i }) => {
        const ig = easeOut(clamp((t - starDelay[i]) / 0.55, 0, 1));
        const m = mp[i];
        const amp = m.a * clamp((t - starsLit) / 0.8, 0, 1);
        const breathe = 1 + Math.sin(t * m.f + m.ph) * amp;
        const coreR = (5 + idn.desired * 0.16) * ig * breathe;
        const ringR = coreR + 9;
        const glint = coreR + 7;
        const col = colorsFor(idn).color;
        return (
          <G key={idn.id}>
            <Circle cx={sx} cy={sy} r={ringR} fill="none" stroke={col} strokeWidth="1.4" strokeOpacity={0.5 * ig} />
            <Circle cx={sx} cy={sy} r={glint} fill={col} opacity={0.26 * ig} />
            <G stroke={col} strokeWidth="1.2" strokeLinecap="round" opacity={0.55 * ig}>
              <Line x1={sx - glint} y1={sy} x2={sx + glint} y2={sy} />
              <Line x1={sx} y1={sy - glint} x2={sx} y2={sy + glint} />
            </G>
            <Circle cx={sx} cy={sy} r={coreR} fill={col} opacity={ig} />
            <Circle cx={sx} cy={sy} r={coreR * 0.5} fill="#fff" opacity={0.5 * ig} />
          </G>
        );
      })}
    </Svg>
  );
}

/* glint burst — DOM spans have no RN analog, so Animated dots; fires ~1s after open */
const AM_GLINTS = [
  { a: -86, d: 168, s: 8 }, { a: -52, d: 200, s: 6 }, { a: -20, d: 150, s: 11 }, { a: 12, d: 188, s: 7 },
  { a: 40, d: 158, s: 9 }, { a: 74, d: 196, s: 6 }, { a: 104, d: 152, s: 10 }, { a: 134, d: 190, s: 7 },
  { a: 162, d: 164, s: 8 }, { a: 196, d: 200, s: 5 }, { a: 222, d: 154, s: 9 }, { a: 250, d: 188, s: 6 },
  { a: 282, d: 160, s: 10 }, { a: 312, d: 198, s: 6 }, { a: 340, d: 150, s: 8 }, { a: -120, d: 184, s: 6 },
];

export default function AllIntentionsMet({ open, form, identities, onClose, onShare }) {
  const { t } = useTheme();
  const { width } = useWindowDimensions();
  const [mounted, setMounted] = useState(false);
  const [playKey, setPlayKey] = useState(0);

  const dim = useRef(new Animated.Value(0)).current;
  const spark = useRef(new Animated.Value(0)).current;
  const textIn = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(1)).current;
  const timers = useRef([]);

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  const playSpark = () => {
    spark.setValue(0);
    Animated.timing(spark, { toValue: 1, duration: 750, delay: 950, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  };
  const startBreathe = () => {
    breathe.stopAnimation();
    breathe.setValue(1);
    Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1.02, duration: 2600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  };
  const runIn = (resetText) => {
    clearTimers();
    breathe.stopAnimation();
    breathe.setValue(1);
    setPlayKey((k) => k + 1); // remount figure → clock resets → replays from t=0
    playSpark();
    timers.current.push(setTimeout(startBreathe, 2200)); // whole-figure breathe after it forms
    if (resetText) {
      textIn.setValue(0);
      timers.current.push(setTimeout(() => Animated.timing(textIn, { toValue: 1, duration: 420, useNativeDriver: true }).start(), 1350));
    }
  };

  useEffect(() => {
    if (open) {
      setMounted(true);
      dim.setValue(0);
      Animated.timing(dim, { toValue: 1, duration: 320, useNativeDriver: true }).start();
      runIn(true);
    } else if (mounted) {
      clearTimers();
      Animated.timing(dim, { toValue: 0, duration: 220, useNativeDriver: true }).start(({ finished }) => finished && setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => () => clearTimers(), []);

  if (!mounted) return null;

  const isOrbit = form === 'orbit';
  const n = identities.length;
  const figW = Math.min(width - 40, 360);
  const scrimColor = t.name === 'light' ? '#eceaf4' : '#05050c';
  const scrimMax = t.name === 'light' ? 0.92 : 0.94;
  // open the OS share sheet with a celebratory line; the overlay stays up so the
  // user can keep admiring / replay / dismiss on their own. onShare overrides.
  const doShare = async () => {
    try {
      await Share.share({
        message: `Every intention met this week on Cosmo — all ${n} ${n === 1 ? 'identity' : 'identities'} tended in full. ✦`,
      });
    } catch (e) {
      /* user dismissed or share unavailable — no-op */
    }
  };
  const share = onShare || doShare;

  return (
    <Pressable onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 70, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
      <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: scrimColor, opacity: dim.interpolate({ inputRange: [0, 1], outputRange: [0, scrimMax] }) }} />

      {/* figure (clock-driven) + glint burst over its center */}
      <View style={{ width: figW, height: figW, alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
        <Animated.View style={{ transform: [{ scale: breathe }] }}>
          {isOrbit ? (
            <OrbitFull key={playKey} identities={identities} size={figW} />
          ) : (
            <ConstellationFull key={playKey} identities={identities} size={figW} />
          )}
        </Animated.View>
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          {AM_GLINTS.map((g, i) => {
            const rad = (g.a * Math.PI) / 180;
            const ex = (Math.cos(rad) * g.d * figW) / SVG;
            const ey = (Math.sin(rad) * g.d * figW) / SVG;
            const tx = spark.interpolate({ inputRange: [0, 1], outputRange: [ex * 0.35, ex] });
            const ty = spark.interpolate({ inputRange: [0, 1], outputRange: [ey * 0.35, ey] });
            const op = spark.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] });
            const sc = spark.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.2, 1, 0.2] });
            return (
              <Animated.View key={i} style={{ position: 'absolute', width: g.s, height: g.s, borderRadius: g.s / 2, backgroundColor: t.core1, opacity: op, transform: [{ translateX: tx }, { translateY: ty }, { scale: sc }] }} />
            );
          })}
        </View>
      </View>

      {/* copy + CTAs — fade up after the figure forms (~1.35s) */}
      <Animated.View style={{ alignItems: 'center', opacity: textIn, transform: [{ translateY: textIn.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <View style={{ width: 22, height: 1, backgroundColor: t.core1, opacity: 0.5 }} />
          <Text style={{ fontSize: 12.5, fontFamily: sans(700), letterSpacing: 2.4, textTransform: 'uppercase', color: t.core1 }}>Every intention met</Text>
          <View style={{ width: 22, height: 1, backgroundColor: t.core1, opacity: 0.5 }} />
        </View>
        <Text style={{ fontFamily: serif(500), fontSize: 32, lineHeight: 40, color: t.ink, textAlign: 'center' }}>
          {isOrbit ? 'You’ve got a full orbit!' : 'Your constellation is shining bright!'}
        </Text>
        <Text style={{ fontSize: 15.5, fontFamily: sans(500), color: t.inkSoft, textAlign: 'center', marginTop: 12 }}>
          All <Text style={{ fontFamily: sans(700), color: t.ink }}>{n}</Text> {n === 1 ? 'identity' : 'identities'}, tended in full this week.
        </Text>

        <Pressable onPress={onClose} style={({ pressed }) => ({ marginTop: 24, backgroundColor: t.core1, borderRadius: 999, paddingVertical: 15, paddingHorizontal: 46, opacity: pressed ? 0.9 : 1 })}>
          <Text style={{ fontFamily: sans(700), fontSize: 16, color: '#1f1e2e' }}>Beautiful</Text>
        </Pressable>
        <Pressable onPress={share} hitSlop={8} style={({ pressed }) => ({ marginTop: 16, opacity: pressed ? 0.6 : 1 })}>
          <Text style={{ fontFamily: sans(700), fontSize: 14, color: t.inkSoft }}>Share this week</Text>
        </Pressable>
        <Pressable onPress={() => runIn(false)} hitSlop={8} style={({ pressed }) => ({ marginTop: 14, opacity: pressed ? 0.6 : 1 })}>
          <Text style={{ fontSize: 13, fontFamily: sans(600), color: t.inkFaint }}>↺ Replay</Text>
        </Pressable>
      </Animated.View>
    </Pressable>
  );
}
