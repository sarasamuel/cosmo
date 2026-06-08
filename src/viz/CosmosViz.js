/* 3D rotating celestial visualization (constellation + orbit), ported from
   viz3d.jsx. Horizontal drag spins it; tapping a planet eases it to the front
   and shows a detail card; tapping it again or the backdrop releases focus.
   A requestAnimationFrame loop drives rotation + the focus "grow" easing.

   Differences from the web original:
   - SVG <filter> glow is replaced by a translucent halo circle (react-native-svg
     filters are unreliable on the new architecture).
   - Drag uses PanResponder; node taps use react-native-svg onPress. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, PanResponder } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle, Path, Line, Text as SvgText, G, Rect } from 'react-native-svg';
import { useTheme } from '../store/Store';
import { identityColors } from '../theme/theme';
import { Glyph } from '../components/primitives';
import { Pill } from '../components/primitives';
import Icon from '../components/Icon';
import { serif, sans, SERIF_ITALIC } from '../theme/fonts';

const W = 520;
const H = 372;
const CX = W / 2;
const CY = H / 2 + 6;
const R = 152;
const D = 760;
const TILT = -0.46;
const SPIN = 0.003;

function fillLevel(idn) {
  if (!idn.desired) return 0;
  return Math.max(0.08, Math.min(1, idn.actual / idn.desired));
}

/* seeded background stars (stable across renders) */
function makeStars(n, w, h, seed) {
  let s = seed || 7;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  return Array.from({ length: n }, () => ({
    x: rnd() * w,
    y: rnd() * h,
    r: 0.4 + rnd() * 1.4,
    o: 0.18 + rnd() * 0.6,
    ph: rnd() * Math.PI * 2,
  }));
}

function projectPoint(p, angle, tilt) {
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const x = p.x * ca + p.z * sa;
  const z1 = -p.x * sa + p.z * ca;
  const ct = Math.cos(tilt), stt = Math.sin(tilt);
  const y = p.y * ct - z1 * stt;
  const z = p.y * stt + z1 * ct;
  const scale = D / (D - z);
  return { sx: CX + x * scale, sy: CY - y * scale, z, scale };
}

function spherePositions(n, rad) {
  const ga = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: n }, (_, i) => {
    const yy = 1 - ((i + 0.5) / n) * 2;
    const r = Math.sqrt(Math.max(0, 1 - yy * yy));
    const phi = i * ga;
    return { x: Math.cos(phi) * r * rad, y: yy * rad, z: Math.sin(phi) * r * rad };
  });
}

function ringPath(plane, angle, tilt, rad) {
  let d = '';
  for (let k = 0; k <= 80; k++) {
    const tt = (k / 80) * Math.PI * 2;
    const p =
      plane === 'xz'
        ? { x: Math.cos(tt) * rad, y: 0, z: Math.sin(tt) * rad }
        : { x: Math.cos(tt) * rad, y: Math.sin(tt) * rad, z: 0 };
    const pr = projectPoint(p, angle, tilt);
    d += (k ? 'L' : 'M') + pr.sx.toFixed(1) + ' ' + pr.sy.toFixed(1);
  }
  return d + 'Z';
}

export default function CosmosViz({
  identities,
  onLog,
  allowLog = true,
  name,
  themeObj,
  focusedId,
  onFocus,
  onRelease,
  interactive = true, // when false (e.g. onboarding reveal), taps don't focus
  showLabels = true, // false for the celebration figure (figure-only, no text)
}) {
  const ctx = useTheme();
  // when rendered inside the always-dark cosmos card, a themeObj override is
  // passed so the viz uses the deep-space palette regardless of app theme.
  const t = themeObj || ctx.t;
  const colorsFor = themeObj ? (idn) => identityColors(idn, themeObj) : ctx.colorsFor;
  const [boxW, setBoxW] = useState(0);
  const [angle, setAngle] = useState(0.3);
  const [grow, setGrow] = useState(0);
  // Controlled when a parent supplies onFocus (the dashboard lifts focus to the
  // store so the detail panel can float at the app root); otherwise local.
  const controlled = typeof onFocus === 'function';
  const [localSel, setLocalSel] = useState(null);
  const selectedId = controlled ? focusedId || null : localSel;

  const st = useRef({ a: 0.3, v: 0, drag: false, lastX: 0, sel: null, target: null, grow: 0 }).current;

  const ptsRef = useRef(null);
  if (!ptsRef.current || ptsRef.current.n !== identities.length) {
    ptsRef.current = { n: identities.length, pts: spherePositions(identities.length, R) };
  }
  const pts = ptsRef.current.pts;

  // `selectedId` is the single source of truth for focus. The rAF loop can't read
  // React state, so mirror it into the ref here (one place) and aim the rotation
  // at the focused planet — derived from selectedId, not set by handlers.
  useEffect(() => {
    st.sel = selectedId;
    if (selectedId == null) {
      st.target = null;
      return;
    }
    const i = identities.findIndex((x) => x.id === selectedId);
    if (i >= 0) {
      const p = pts[i];
      st.target = Math.atan2(p.z, p.x) - Math.PI / 2; // rotate it to the front
    }
  }, [selectedId, identities, pts, st]);

  const fieldRef = useRef(null);
  if (!fieldRef.current) fieldRef.current = makeStars(66, W, H, 99);
  const field = fieldRef.current;

  // animation loop — guarded so a throw inside the frame stops the loop (and
  // logs once) instead of going uncaught past the error boundary every frame
  useEffect(() => {
    let raf;
    const loop = () => {
      try {
        if (st.target != null) {
          let diff = st.target - st.a;
          while (diff > Math.PI) diff -= 2 * Math.PI;
          while (diff < -Math.PI) diff += 2 * Math.PI;
          st.a += diff * 0.14;
          st.v = 0;
          if (Math.abs(diff) < 0.0015) {
            st.a = st.target;
            st.target = null;
          }
        } else if (!st.drag) {
          const auto = st.sel ? 0 : SPIN;
          st.a += auto + st.v;
          st.v *= 0.92;
        }
        const goalGrow = st.sel ? 1 : 0;
        st.grow += (goalGrow - st.grow) * 0.16;
        setAngle(st.a);
        setGrow(st.grow);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('CosmosViz animation loop error:', e);
        return; // stop scheduling further frames
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [st]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 4,
      onPanResponderGrant: (e) => {
        st.drag = true;
        st.v = 0;
        st.target = null;
        st.lastX = e.nativeEvent.pageX;
      },
      onPanResponderMove: (e) => {
        if (!st.drag) return;
        const x = e.nativeEvent.pageX;
        const dx = x - st.lastX;
        st.lastX = x;
        st.a += dx * 0.011;
        st.v = dx * 0.011;
      },
      onPanResponderRelease: () => {
        st.drag = false;
      },
      onPanResponderTerminate: () => {
        st.drag = false;
      },
    })
  ).current;

  // handlers only change the logical selection; the effect above mirrors it into
  // the rAF ref and sets the rotation target. (st.sel/st.target are derived, not
  // owned here.)
  const select = (idn) => (controlled ? onFocus(idn) : setLocalSel(idn.id));
  const deselect = () => (controlled ? onRelease && onRelease() : setLocalSel(null));
  const focusNode = (idn) => (selectedId === idn.id ? deselect() : select(idn));

  const proj = identities.map((idn, i) => {
    const pr = projectPoint(pts[i], angle, TILT);
    const depth = (pr.z + R) / (2 * R);
    return { idn, i, ...pr, depth };
  });
  const order = [...proj].sort((a, b) => {
    if (a.idn.id === selectedId) return 1;
    if (b.idn.id === selectedId) return -1;
    return a.z - b.z;
  });
  const selProj = proj.find((p) => p.idn.id === selectedId);
  const selIdn = selProj && selProj.idn;
  const selColors = selIdn ? colorsFor(selIdn) : null;

  const svgH = boxW * (H / W);

  // The core disc is small (~68px). Show the first name, scaled to fit its usable
  // width; if even that won't fit at a legible floor, fall back to initials
  // ("Alexandria" → "A", "Ada Grace Lovelace" → "AGL"). Depends only on `name`.
  const { sunLabel, sunFont, sunY } = useMemo(() => {
    let label = '';
    let fs = 25;
    if (name) {
      const usable = 56;
      const tokens = name.trim().split(/\s+/).filter(Boolean);
      const first = tokens[0] || name;
      const widthAt = (str, f) => str.length * f * 0.52; // Newsreader italic ≈ 0.52em/char
      label = first;
      while (fs > 12 && widthAt(label, fs) > usable) fs -= 1;
      if (widthAt(label, fs) > usable) {
        label = tokens.map((tk) => tk[0]).join('').slice(0, 3).toUpperCase();
        fs = 19;
      }
    }
    return { sunLabel: label, sunFont: fs, sunY: CY + fs * 0.34 };
  }, [name]);

  return (
    <View style={{ width: '100%' }} onLayout={(e) => setBoxW(e.nativeEvent.layout.width)} {...pan.panHandlers}>
      {boxW > 0 && (
        <Svg width={boxW} height={svgH} viewBox={`0 0 ${W} ${H}`}>
          <Defs>
            <RadialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={t.core1} stopOpacity="1" />
              <Stop offset="35%" stopColor={t.core2} stopOpacity="0.9" />
              <Stop offset="100%" stopColor={t.core2} stopOpacity="0" />
            </RadialGradient>
          </Defs>

          {/* tap-anywhere backdrop to release focus */}
          <Rect
            x="0"
            y="0"
            width={W}
            height={H}
            fill="transparent"
            onPress={() => {
              if (selectedId) deselect();
            }}
          />

          {/* blinking background stars */}
          {field.map((s, i) => (
            <Circle
              key={'bg' + i}
              cx={s.x}
              cy={s.y}
              r={s.r}
              fill={t.star}
              opacity={s.o * (0.55 + 0.45 * (0.5 + 0.5 * Math.sin(angle * 2 + s.ph)))}
            />
          ))}

          {/* orbital rings */}
          <G opacity={1 - grow * 0.7}>
            <Path d={ringPath('xz', angle, TILT, R)} fill="none" stroke={t.ring} strokeWidth="1" strokeOpacity="0.5" />
            <Path
              d={ringPath('xy', angle, TILT, R * 0.82)}
              fill="none"
              stroke={t.ring}
              strokeWidth="1"
              strokeOpacity="0.32"
              strokeDasharray="2 6"
            />
          </G>

          {/* core glow + disc */}
          <G opacity={1 - grow * 0.55}>
            <Circle cx={CX} cy={CY} r="55" fill="url(#coreGlow)" />
            <Circle cx={CX} cy={CY} r="34" fill={t.core2} opacity="0.30" />
            <Circle cx={CX} cy={CY} r="34" fill="none" stroke={t.core1} strokeOpacity="0.45" strokeWidth="1" />
            {!name && <Circle cx={CX} cy={CY} r="9" fill={t.core1} />}
          </G>

          {/* spokes */}
          {order.map(({ idn, sx, sy, depth }) => {
            const c = colorsFor(idn);
            return (
              <Line
                key={'s' + idn.id}
                x1={CX}
                y1={CY}
                x2={sx}
                y2={sy}
                stroke={c.color}
                strokeWidth={0.8 + depth}
                strokeOpacity={(selectedId ? 0.04 : 0.08) + depth * 0.22}
              />
            );
          })}

          {/* nodes far->front, selected last */}
          {order.map(({ idn, sx, sy, scale, depth }) => {
            const c = colorsFor(idn);
            const isSel = idn.id === selectedId;
            const selBoost = isSel ? 1 + grow * 1.25 : 1;
            const base = (13 + idn.desired * 0.58) * scale * selBoost;
            const inner = base * Math.sqrt(fillLevel(idn));
            const dimmed = selectedId && !isSel;
            const op = isSel ? 1 : dimmed ? 0.22 : 0.45 + depth * 0.55;
            // A focused planet grows and is rotated to the front, which the tilt
            // pushes high — its halo can overrun the top of the viewBox. Clamp the
            // grown planet's center so the halo (+ its label) stay fully on-screen.
            const haloR = base * 1.5;
            const labelRoom = base + 16 * scale;
            const cy = isSel ? Math.max(haloR + 6, Math.min(H - labelRoom, sy)) : sy;
            return (
              <G
                key={idn.id}
                opacity={op}
                onPress={interactive ? () => focusNode(idn) : undefined}
              >
                <Circle cx={sx} cy={cy} r={base * 1.5} fill={c.color} opacity={(isSel ? 0.28 : 0.18) * (isSel ? 1 : depth)} />
                <Circle
                  cx={sx}
                  cy={cy}
                  r={base}
                  fill="none"
                  stroke={c.color}
                  strokeWidth={(2.2 + (isSel ? grow * 1.2 : 0)) * scale}
                  strokeOpacity={isSel ? 0.95 : 0.78}
                />
                <Circle cx={sx} cy={cy} r={inner} fill={c.color} />
                {/* full identity name beneath the planet, fading with depth */}
                {showLabels && (
                  <SvgText
                    x={sx}
                    y={cy + base + 13 * scale}
                    textAnchor="middle"
                    fontFamily={sans(600)}
                    fontSize={12.5}
                    fill={t.ink}
                    opacity={isSel ? 1 : Math.min(1, depth + 0.2)}
                  >
                    {idn.name}
                  </SvgText>
                )}
              </G>
            );
          })}

          {/* your name in the sun — full name if short, else a monogram initial */}
          {name ? (
            <SvgText
              x={CX}
              y={sunY}
              textAnchor="middle"
              fontFamily={SERIF_ITALIC}
              fontSize={sunFont}
              fill="#7a6033"
              opacity={1 - grow * 0.55}
            >
              {sunLabel}
            </SvgText>
          ) : null}
        </Svg>
      )}

      {/* focused-planet detail card — only when interactive AND uncontrolled;
          in the app it is portaled to the root so it floats above the tab bar. */}
      {!controlled && interactive && selIdn && (
        <View
          style={[
            {
              position: 'absolute',
              left: 14,
              right: 14,
              bottom: 6,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              paddingVertical: 10,
              paddingLeft: 10,
              paddingRight: 12,
              borderRadius: 18,
              backgroundColor: t.surface2,
              borderWidth: 1,
              borderColor: t.line,
            },
            t.shadow.md,
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Glyph char={selIdn.glyph} size={38} fontSize={18} color={selColors.color} />
            <View>
              <Text style={{ fontFamily: serif(500), fontSize: 20, color: t.ink }}>{selIdn.name}</Text>
              <Text style={{ fontSize: 12.5, fontFamily: sans(600), color: t.inkFaint }}>
                {selIdn.actual}% lived · {selIdn.desired}% intended
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {allowLog && onLog && (
              <Pill bg={selColors.color} onPress={() => onLog(selIdn)}>
                <Icon name="plus" size={14} color="#fff" />
                <Text style={{ color: '#fff', fontFamily: sans(700), fontSize: 13 }}>Log time</Text>
              </Pill>
            )}
            <Pill bg={t.surface3} onPress={deselect} style={{ width: 34, height: 34, paddingHorizontal: 0, justifyContent: 'center' }}>
              <Text style={{ color: t.inkSoft, fontSize: 13, fontFamily: sans(600) }}>✕</Text>
            </Pill>
          </View>
        </View>
      )}
    </View>
  );
}
