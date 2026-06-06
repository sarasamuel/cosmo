/* Constellation form of the cosmos — same contract as CosmosViz
   ({ identities, onLog, allowLog, name, themeObj }). Ported from constellation.jsx.

   Each identity is a star: brightness/size = time LIVED, the dashed ring =
   INTENTION. The stars form a CLOSED, irregular figure (seeded angular jitter +
   per-star radius, slot order kept so edges never cross), centered on the card,
   each pulsing in place on its own seeded rhythm. The intention ring pulses in
   lockstep so the gap between core and ring stays constant. Tap a star to focus. */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, Line, Text as SvgText, G, Rect } from 'react-native-svg';
import { useTheme } from '../store/Store';
import { identityColors } from '../theme/theme';
import { Glyph, Pill } from '../components/primitives';
import Icon from '../components/Icon';
import { serif, sans, SERIF_ITALIC } from '../theme/fonts';

const W = 520; // card width is fixed; the figure spreads vertically as n grows
const CX = W / 2;
const BASE_H = 372; // reference height for background-star density

function bgStars(n, w, h, seed) {
  let s = seed || 11;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  return Array.from({ length: n }, () => ({
    x: rnd() * w,
    y: rnd() * h,
    r: 0.4 + rnd() * 1.3,
    o: 0.14 + rnd() * 0.5,
    ph: rnd() * Math.PI * 2,
  }));
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/* per-star seeded jitter (around the sunflower position) + own pulse rhythm */
function motionParams(n, seed) {
  let s = seed || 7;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  return Array.from({ length: n }, () => ({
    jt: (rnd() - 0.5) * 0.6, // angular jitter (radians)
    jr: 0.86 + rnd() * 0.28, // radial jitter factor
    pFreq: 0.55 + rnd() * 0.85,
    pAmp: 0.16 + rnd() * 0.16,
    pPhase: rnd() * Math.PI * 2,
  }));
}

/* A natural "stick-figure" wiring: a minimum spanning tree (Prim's) so the
   stars form a branching tree, with a few preferential-attachment loop edges
   added past a count threshold so busy stars become hubs. */
function constellationEdges(pts) {
  const n = pts.length;
  if (n <= 1) return [];
  const d2 = (a, b) => {
    const dx = pts[a].x - pts[b].x;
    const dy = pts[a].y - pts[b].y;
    return dx * dx + dy * dy;
  };
  // Prim's MST (O(n^2), fine for these sizes)
  const inT = new Array(n).fill(false);
  const best = new Array(n).fill(Infinity);
  const from = new Array(n).fill(-1);
  inT[0] = true;
  for (let j = 1; j < n; j++) {
    best[j] = d2(0, j);
    from[j] = 0;
  }
  const edges = [];
  for (let it = 1; it < n; it++) {
    let u = -1;
    let bu = Infinity;
    for (let j = 0; j < n; j++) if (!inT[j] && best[j] < bu) (bu = best[j]), (u = j);
    if (u < 0) break;
    inT[u] = true;
    edges.push([from[u], u]);
    for (let j = 0; j < n; j++)
      if (!inT[j]) {
        const d = d2(u, j);
        if (d < best[j]) (best[j] = d), (from[j] = u);
      }
  }
  // extra loop edges past the threshold, growing with count
  const extraLoops = n >= 10 ? Math.floor((n - 7) / 3) : 0;
  if (extraLoops > 0) {
    const deg = new Array(n).fill(0);
    const have = new Set();
    edges.forEach(([a, b]) => {
      deg[a]++;
      deg[b]++;
      have.add(a < b ? a + '-' + b : b + '-' + a);
    });
    const cand = [];
    for (let a = 0; a < n; a++)
      for (let b = a + 1; b < n; b++) if (!have.has(a + '-' + b)) cand.push([a, b, Math.sqrt(d2(a, b))]);
    for (let e = 0; e < extraLoops && cand.length; e++) {
      // favor short edges that touch already-busy stars (preferential attachment)
      let bi = -1;
      let bs = Infinity;
      for (let c = 0; c < cand.length; c++) {
        const [a, b, d] = cand[c];
        const score = d / (1 + 0.6 * (deg[a] + deg[b]));
        if (score < bs) (bs = score), (bi = c);
      }
      if (bi < 0) break;
      const [a, b] = cand[bi];
      edges.push([a, b]);
      deg[a]++;
      deg[b]++;
      cand.splice(bi, 1);
    }
  }
  return edges;
}

export default function ConstellationViz({
  identities,
  onLog,
  allowLog = true,
  name,
  themeObj,
  focusedId,
  onFocus,
  onRelease,
  interactive = true, // when false (e.g. onboarding reveal), taps don't focus
}) {
  const ctx = useTheme();
  const t = themeObj || ctx.t;
  const colorsFor = themeObj ? (idn) => identityColors(idn, themeObj) : ctx.colorsFor;

  const [boxW, setBoxW] = useState(0);
  const [now, setNow] = useState(0);
  // Controlled when a parent supplies onFocus (the dashboard lifts focus to the
  // store so the detail panel can float at the app root); otherwise local.
  const controlled = typeof onFocus === 'function';
  const [localSel, setLocalSel] = useState(null);
  const selectedId = controlled ? focusedId || null : localSel;

  const n = identities.length;

  // Static layout (per-star params, positions, MST edges, height, starfield)
  // depends only on the identity count — compute it once per count, NOT every
  // animation frame. The rAF clock below drives only each star's pulse.
  const geom = useMemo(() => {
    const mp = motionParams(n, 7);
    const kk = Math.sqrt(n / 5); // 1 at 5 identities
    const RADX = Math.min(205, 150 * kk); // horizontal radius (capped to card width)
    const RADY = Math.min(300, 150 * kk); // vertical radius
    // sunflower scatter (phyllotaxis) + seeded jitter, re-centered on the origin
    const raw = Array.from({ length: n }, (_, i) => {
      const m = mp[i];
      const rr = Math.sqrt((i + 0.5) / n) * m.jr;
      const theta = i * GOLDEN + m.jt;
      return { x: Math.cos(theta) * RADX * rr, y: Math.sin(theta) * RADY * rr };
    });
    const cen = raw.reduce((a, p) => ({ x: a.x + p.x / n, y: a.y + p.y / n }), { x: 0, y: 0 });
    const rel = raw.map((p) => ({ x: p.x - cen.x, y: p.y - cen.y }));
    const edges = constellationEdges(rel); // branching tree (+ hub loops past a threshold)
    let minY = Infinity;
    let maxY = -Infinity;
    rel.forEach((p) => {
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });
    const topPad = 38;
    const botPad = 70;
    const H = Math.max(360, Math.round(maxY - minY + topPad + botPad));
    const field = bgStars(Math.round((66 * H) / BASE_H), W, H, 99);
    return { mp, rel, edges, H, cx: CX, cy: Math.round(-minY + topPad), field };
  }, [n]);
  const { mp, rel, edges, H, cx, cy, field } = geom;

  const fillOf = (idn) =>
    idn.desired > 0 ? Math.max(0, Math.min(1, idn.actual / idn.desired)) : idn.actual > 0 ? 1 : 0;

  // animation clock — each star reads its own breath from it. Guarded so a throw
  // stops the loop (and logs once) rather than recurring uncaught every frame.
  useEffect(() => {
    let raf;
    let t0 = null;
    const loop = (ts) => {
      try {
        if (t0 == null) t0 = ts;
        setNow((ts - t0) / 1000);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('ConstellationViz animation loop error:', e);
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const deselect = () => {
    if (controlled) onRelease && onRelease();
    else setLocalSel(null);
  };
  const focusNode = (idn) => {
    if (selectedId === idn.id) {
      deselect();
      return;
    }
    if (controlled) onFocus(idn);
    else setLocalSel(idn.id);
  };

  // Per-frame: only the pulse depends on the clock (and the selected star calms);
  // positions/edges come from the memoized geometry above.
  const proj = identities.map((idn, i) => {
    const m = mp[i];
    const calm = idn.id === selectedId ? 0.15 : 1;
    const pulse = 1 + Math.sin(now * m.pFreq + m.pPhase) * m.pAmp * calm;
    return { idn, i, sx: cx + rel[i].x, sy: cy + rel[i].y, pulse };
  });
  // positions are re-centered on the origin, so the centroid is exactly (cx, cy)
  const ctr = { x: cx, y: cy };
  const selProj = proj.find((p) => p.idn.id === selectedId);
  const selIdn = selProj && selProj.idn;
  const selColors = selIdn ? colorsFor(selIdn) : null;

  const svgH = boxW * (H / W);
  const nameFs = name ? Math.max(20, Math.min(46, 360 / Math.max(4, name.trim().length))) : 0;

  return (
    <View style={{ width: '100%' }} onLayout={(e) => setBoxW(e.nativeEvent.layout.width)}>
      {boxW > 0 && (
        <Svg width={boxW} height={svgH} viewBox={`0 0 ${W} ${H}`}>
          {/* tap-anywhere backdrop to release focus */}
          <Rect x="0" y="0" width={W} height={H} fill="transparent" onPress={() => selectedId && deselect()} />

          {/* background sky */}
          {field.map((s, i) => (
            <Circle
              key={'bg' + i}
              cx={s.x}
              cy={s.y}
              r={s.r}
              fill={t.star}
              opacity={s.o * (0.5 + 0.5 * (0.5 + 0.5 * Math.sin(now * 1.3 + s.ph)))}
            />
          ))}

          {/* the figure's name, faint behind the stars */}
          {name ? (
            <SvgText
              x={ctr.x}
              y={ctr.y + nameFs * 0.34}
              textAnchor="middle"
              fontFamily={SERIF_ITALIC}
              fontSize={nameFs}
              fill={t.cstInk}
              opacity={selectedId ? 0.05 : 0.12}
            >
              {name.trim()}
            </SvgText>
          ) : null}

          {/* closed constellation figure */}
          {edges.map(([a, b], k) => {
            const na = proj[a];
            const nb = proj[b];
            return (
              <Line
                key={k}
                x1={na.sx}
                y1={na.sy}
                x2={nb.sx}
                y2={nb.sy}
                stroke={t.cstInk}
                strokeWidth="1"
                strokeLinecap="round"
                strokeOpacity={selectedId ? 0.1 : 0.24}
              />
            );
          })}

          {/* stars */}
          {proj.map(({ idn, sx, sy, pulse }) => {
            const c = colorsFor(idn);
            const isSel = idn.id === selectedId;
            const dim = selectedId && !isSel;
            const fill = fillOf(idn);
            const coreR = (3 + Math.sqrt(idn.actual) * 1.7) * pulse * (isSel ? 1.22 : 1);
            const gap = 9 + idn.desired * 0.5 - (3 + Math.sqrt(idn.actual) * 1.7);
            const haloR = coreR + gap;
            const bright = (0.42 + 0.58 * fill) * (0.85 + 0.15 * pulse);
            const glint = coreR + 6;
            return (
              <G key={idn.id} opacity={isSel ? 1 : dim ? 0.34 : 1} onPress={interactive ? () => focusNode(idn) : undefined}>
                {/* intention halo */}
                <Circle cx={sx} cy={sy} r={haloR} fill="none" stroke={c.color} strokeWidth={isSel ? 1.6 : 1} strokeOpacity="0.42" strokeDasharray="2 5" />
                {/* soft glow */}
                <Circle cx={sx} cy={sy} r={glint} fill={c.color} opacity={0.22 * bright} />
                {/* sparkle glints */}
                <G stroke={c.color} strokeWidth="1.1" strokeLinecap="round" opacity={0.5 * bright}>
                  <Line x1={sx - glint} y1={sy} x2={sx + glint} y2={sy} />
                  <Line x1={sx} y1={sy - glint} x2={sx} y2={sy + glint} />
                </G>
                {/* the lived star */}
                <Circle cx={sx} cy={sy} r={coreR} fill={c.color} opacity={bright} />
                <Circle cx={sx} cy={sy} r={coreR} fill="#fff" opacity={0.2 * fill} />
                {/* labels */}
                <SvgText x={sx} y={sy + haloR + 15} textAnchor="middle" fontFamily={sans(600)} fontSize={13} fill={t.ink}>
                  {idn.name}
                </SvgText>
                <SvgText x={sx} y={sy + haloR + 30} textAnchor="middle" fontFamily={sans(600)} fontSize={11.5} fill={t.inkFaint}>
                  {idn.actual}% · {idn.desired}%
                </SvgText>
              </G>
            );
          })}
        </Svg>
      )}

      {/* focused-star detail — only when uncontrolled (e.g. onboarding reveal);
          in the app the panel is portaled to the root so it floats above the
          tab bar regardless of card height / scroll. */}
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
