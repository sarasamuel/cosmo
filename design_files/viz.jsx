/* MOSAIC — persona visualizations: Constellation, Mosaic tiles, Orbital rings */

const VIZ_W = 360, VIZ_H = 300;

function fillLevel(idn) {
  // how "full" an identity is vs its intention, 0..1
  if (!idn.desired) return 0;
  return Math.max(0.08, Math.min(1, idn.actual / idn.desired));
}

/* ---------------- shared node ---------------- */
function VizNode({ idn, x, y, r, delay, onTap, dim }) {
  const lvl = fillLevel(idn);
  const inner = Math.max(6, r * Math.sqrt(lvl));
  return (
    <g className="viz-node" style={{ animationDelay: (delay || 0) + 'ms', cursor: 'pointer', opacity: dim ? 0.32 : 1 }}
       onClick={() => onTap && onTap(idn)} transform={`translate(${x},${y})`}>
      <circle r={r + 6} fill={idn.soft} />
      <circle r={r} fill="none" stroke={idn.color} strokeWidth="1.5" strokeOpacity="0.55" />
      <circle r={inner} fill={idn.color} />
      <text textAnchor="middle" dominantBaseline="central" y="0.5"
            fontFamily="Newsreader, serif" fontSize={Math.max(13, inner * 0.95)} fill="#fff" fontWeight="500">
        {idn.glyph}
      </text>
      <text textAnchor="middle" y={r + 22} fontFamily="Hanken Grotesk, sans-serif"
            fontSize="14" fontWeight="600" fill="var(--ink)">{idn.name}</text>
      <text textAnchor="middle" y={r + 39} fontFamily="Hanken Grotesk, sans-serif"
            fontSize="12.5" fontWeight="600" fill="var(--ink-faint)">{idn.actual}% · {idn.desired}%</text>
    </g>
  );
}

/* ---------------- 1. Constellation ---------------- */
const CONSTELLATION_POS = {
  writer:   { x: 84,  y: 86 },
  reader:   { x: 268, y: 66 },
  engineer: { x: 306, y: 178 },
  musician: { x: 176, y: 152 },
  painter:  { x: 96,  y: 222 },
};
const CONSTELLATION_EDGES = [
  ['writer', 'musician'], ['musician', 'engineer'], ['musician', 'reader'],
  ['musician', 'painter'], ['writer', 'reader'], ['painter', 'engineer'],
];
const BG_STARS = [[40,40],[330,52],[44,150],[340,250],[210,40],[150,250],[260,230],[20,250]];

function Constellation({ identities, onTap }) {
  const byId = {}; identities.forEach(i => byId[i.id] = i);
  const r = (i) => 16 + i.desired * 0.62;
  return (
    <svg viewBox={`0 0 ${VIZ_W} ${VIZ_H}`} width="100%" style={{ display: 'block' }}>
      <g>
        {BG_STARS.map(([x, y], k) => (
          <circle key={k} className="twinkle" style={{ animationDelay: (k * 420) + 'ms' }}
                  cx={x} cy={y} r="1.4" fill="var(--ink-faint)" />
        ))}
        {CONSTELLATION_EDGES.map(([a, b], k) => {
          const pa = CONSTELLATION_POS[a], pb = CONSTELLATION_POS[b];
          if (!pa || !pb) return null;
          return <line key={k} className="viz-edge" style={{ animationDelay: (k * 80) + 'ms' }}
                       x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                       stroke="var(--ink)" strokeOpacity="0.16" strokeWidth="1" />;
        })}
        {identities.map((i, k) => {
          const p = CONSTELLATION_POS[i.id] || { x: 40 + k * 70, y: 150 };
          return <VizNode key={i.id} idn={i} x={p.x} y={p.y} r={r(i)} delay={120 + k * 90} onTap={onTap} />;
        })}
      </g>
    </svg>
  );
}

/* ---------------- 2. Mosaic tiles (squarified treemap) ---------------- */
function squarify(items, x, y, w, h) {
  // items: [{value, ...}] -> [{...item, x,y,w,h}]
  const total = items.reduce((s, i) => s + i.value, 0);
  const scale = (w * h) / total;
  const scaled = items.map(i => ({ ...i, area: i.value * scale }));
  const out = [];
  let rx = x, ry = y, rw = w, rh = h;
  let row = [], i = 0;

  const worst = (row, len) => {
    const s = row.reduce((a, b) => a + b.area, 0);
    const max = Math.max(...row.map(r => r.area));
    const min = Math.min(...row.map(r => r.area));
    const len2 = len * len, s2 = s * s;
    return Math.max((len2 * max) / s2, s2 / (len2 * min));
  };
  const layoutRow = (row, len, horiz) => {
    const s = row.reduce((a, b) => a + b.area, 0);
    const thick = s / len;
    let off = 0;
    row.forEach(it => {
      const cell = it.area / thick;
      if (horiz) { out.push({ ...it, x: rx, y: ry + off, w: thick, h: cell }); }
      else { out.push({ ...it, x: rx + off, y: ry, w: cell, h: thick }); }
      off += cell;
    });
    if (horiz) { rx += thick; rw -= thick; } else { ry += thick; rh -= thick; }
  };

  while (i < scaled.length) {
    const horiz = rw < rh ? false : true; // place along shorter side
    const len = horiz ? rh : rw;
    const next = scaled[i];
    if (row.length === 0) { row.push(next); i++; continue; }
    if (worst(row, len) >= worst([...row, next], len)) { row.push(next); i++; }
    else { layoutRow(row, len, horiz); row = []; }
  }
  if (row.length) layoutRow(row, (rw < rh ? false : true) ? rh : rw, rw < rh ? false : true);
  return out;
}

function MosaicTiles({ identities, onTap, includeDrift }) {
  const W = 360, H = 280, gap = 6;
  const list = identities.map(i => ({ ...i, value: i.desired }));
  const tiles = squarify(list, 0, 0, W, H);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
      <defs>
        <clipPath id="mosaic-clip"><rect x="0" y="0" width={W} height={H} rx="18" /></clipPath>
      </defs>
      <g clipPath="url(#mosaic-clip)">
        {tiles.map((t, k) => {
          const lvl = fillLevel(t);
          const fillH = t.h - gap;
          const actualH = fillH * lvl;
          return (
            <g key={t.id} className="viz-tile" style={{ animationDelay: (k * 80) + 'ms', cursor: 'pointer' }}
               onClick={() => onTap && onTap(t)}>
              <rect x={t.x + gap / 2} y={t.y + gap / 2} width={t.w - gap} height={fillH} rx="13" fill={t.soft} />
              <clipPath id={`tc-${t.id}`}><rect x={t.x + gap / 2} y={t.y + gap / 2} width={t.w - gap} height={fillH} rx="13" /></clipPath>
              <rect clipPath={`url(#tc-${t.id})`} x={t.x + gap / 2} y={t.y + gap / 2 + (fillH - actualH)}
                    width={t.w - gap} height={actualH} fill={t.color} opacity="0.92" />
              <text x={t.x + 14} y={t.y + 26} fontFamily="Newsreader, serif" fontSize="17"
                    fontWeight="600" fill={t.color}>{t.name}</text>
              <text x={t.x + 14} y={t.y + fillH - 6} fontFamily="Hanken Grotesk, sans-serif"
                    fontSize="13" fontWeight="700" fill={t.color}>{t.actual}<tspan opacity="0.65"> / {t.desired}%</tspan></text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/* ---------------- 3. Orbital rings ---------------- */
function OrbitalRings({ identities, onTap }) {
  const W = 360, H = 360, cx = W / 2, cy = 184;
  const ordered = [...identities].sort((a, b) => b.desired - a.desired);
  const angles = [-90, -18, 54, 126, 198, 270]; // evenly spread
  const ringRadii = [66, 104, 142];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
      <g>
        {ringRadii.map((rad, k) => (
          <circle key={k} cx={cx} cy={cy} r={rad} fill="none" stroke="var(--ink)"
                  strokeOpacity="0.09" strokeWidth="1" strokeDasharray="2 6" />
        ))}
        <circle cx={cx} cy={cy} r="30" fill="var(--surface-2)" stroke="var(--line)" />
        <text x={cx} y={cy - 2} textAnchor="middle" fontFamily="Newsreader, serif" fontStyle="italic"
              fontSize="16" fill="var(--ink-soft)">you</text>
        <text x={cx} y={cy + 15} textAnchor="middle" fontFamily="Hanken Grotesk" fontSize="10.5"
              fontWeight="700" fill="var(--ink-faint)" letterSpacing="0.08em">CORE</text>
        {ordered.map((i, k) => {
          const rad = 150 - i.desired * 1.6;            // higher intention sits closer in
          const ang = (angles[k] || k * 67) * Math.PI / 180;
          const x = cx + rad * Math.cos(ang);
          const y = cy + rad * Math.sin(ang);
          const nr = 14 + i.desired * 0.46;
          return <VizNode key={i.id} idn={i} x={x} y={y} r={nr} delay={150 + k * 90} onTap={onTap} />;
        })}
      </g>
    </svg>
  );
}

Object.assign(window, { Constellation, MosaicTiles, OrbitalRings, VizNode, fillLevel });
