/* COSMO — 3D rotating celestial visualization (constellation + orbit) */

/* seeded starfield (module-level, static) */
function makeStars(n, w, h, seed) {
  let s = seed || 7;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  return Array.from({ length: n }, () => ({
    x: rnd() * w, y: rnd() * h, r: 0.4 + rnd() * 1.4, o: 0.18 + rnd() * 0.6, d: rnd() * 4,
  }));
}

function Starfield({ count = 70, w = 824, h = 1184 }) {
  const stars = React.useRef(null);
  if (!stars.current) stars.current = makeStars(count, w, h, 99);
  return (
    <svg className="starfield" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid slice"
         width="100%" height="100%" aria-hidden="true">
      {stars.current.map((st, i) => (
        <circle key={i} cx={st.x} cy={st.y} r={st.r} fill="var(--star)"
                opacity={st.o} className="twinkle" style={{ animationDelay: st.d + 's' }} />
      ))}
    </svg>
  );
}

/* ---- 3D math ---- */
function projectPoint(p, angle, tilt, cx, cy, D) {
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const x = p.x * ca + p.z * sa;
  const z1 = -p.x * sa + p.z * ca;
  const ct = Math.cos(tilt), stt = Math.sin(tilt);
  const y = p.y * ct - z1 * stt;
  const z = p.y * stt + z1 * ct;
  const scale = D / (D - z);
  return { sx: cx + x * scale, sy: cy - y * scale, z, scale };
}

function spherePositions(n, R) {
  const ga = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: n }, (_, i) => {
    const yy = 1 - ((i + 0.5) / n) * 2;
    const r = Math.sqrt(Math.max(0, 1 - yy * yy));
    const phi = i * ga;
    return { x: Math.cos(phi) * r * R, y: yy * R, z: Math.sin(phi) * r * R };
  });
}

function ringPath(plane, angle, tilt, R, cx, cy, D) {
  let d = '';
  for (let k = 0; k <= 80; k++) {
    const t = (k / 80) * Math.PI * 2;
    const p = plane === 'xz'
      ? { x: Math.cos(t) * R, y: 0, z: Math.sin(t) * R }
      : { x: Math.cos(t) * R, y: Math.sin(t) * R, z: 0 };
    const pr = projectPoint(p, angle, tilt, cx, cy, D);
    d += (k ? 'L' : 'M') + pr.sx.toFixed(1) + ' ' + pr.sy.toFixed(1);
  }
  return d + 'Z';
}

function CosmosViz({ identities, onLog, allowLog = true, name }) {
  const W = 520, H = 372, cx = W / 2, cy = H / 2 + 6, R = 152, D = 760, tilt = -0.46;
  const [angle, setAngle] = React.useState(0.3);
  const [selectedId, setSelectedId] = React.useState(null);
  const [grow, setGrow] = React.useState(0); // 0..1 eased enlarge factor for selected
  const st = React.useRef({ a: 0.3, v: 0, drag: false, touched: false, lastX: 0, base: spinRate(), target: null, sel: null, grow: 0 });

  function spinRate() { return 0.0030; }

  const ptsRef = React.useRef(null);
  if (!ptsRef.current || ptsRef.current.n !== identities.length) {
    ptsRef.current = { n: identities.length, pts: spherePositions(identities.length, R) };
  }
  const pts = ptsRef.current.pts;

  React.useEffect(() => {
    let raf;
    const loop = () => {
      const s = st.current;
      if (s.target != null) {
        // ease rotation toward the focused planet's front position
        let diff = s.target - s.a;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        s.a += diff * 0.14;
        s.v = 0;
        if (Math.abs(diff) < 0.0015) { s.a = s.target; s.target = null; }
      } else if (!s.drag) {
        const auto = s.sel ? 0 : s.base; // drift whenever no planet is focused; pause only while focused
        s.a += auto + s.v; s.v *= 0.92;
      }
      // ease the enlarge factor
      const goalGrow = s.sel ? 1 : 0;
      s.grow += (goalGrow - s.grow) * 0.16;
      setAngle(s.a); setGrow(s.grow);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  React.useEffect(() => {
    const move = (e) => {
      const s = st.current; if (!s.drag) return;
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      const dx = x - s.lastX; s.lastX = x;
      s.a += dx * 0.011; s.v = dx * 0.011;
    };
    const up = () => { st.current.drag = false; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, []);

  const onDown = (e) => {
    const s = st.current; s.drag = true; s.touched = true; s.v = 0; s.target = null;
    s.lastX = e.touches ? e.touches[0].clientX : e.clientX;
  };

  const focusNode = (idn, i) => {
    const s = st.current;
    if (s.sel === idn.id) { deselect(); return; }   // tapping the focused planet again releases it
    const p = pts[i];
    s.target = Math.atan2(p.z, p.x) - Math.PI / 2;   // rotate this planet to the front
    s.sel = idn.id;
    setSelectedId(idn.id);
  };
  const deselect = () => {
    const s = st.current; s.sel = null; s.target = null; setSelectedId(null);
  };

  const proj = identities.map((idn, i) => {
    const pr = projectPoint(pts[i], angle, tilt, cx, cy, D);
    const depth = (pr.z + R) / (2 * R); // 0 back .. 1 front
    return { idn, i, ...pr, depth };
  });
  // draw far->front, but always paint the selected planet last (on top)
  const order = [...proj].sort((a, b) => {
    if (a.idn.id === selectedId) return 1;
    if (b.idn.id === selectedId) return -1;
    return a.z - b.z;
  });
  const selProj = proj.find(p => p.idn.id === selectedId);
  const selIdn = selProj && selProj.idn;

  return (
    <div style={{ position: 'relative', width: '100%', touchAction: 'none', cursor: 'grab' }} onPointerDown={onDown}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%"
           style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--core-1)" stopOpacity="1" />
            <stop offset="35%" stopColor="var(--core-2)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--core-2)" stopOpacity="0" />
          </radialGradient>
          <filter id="nodeGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* tap-anywhere backdrop to release focus */}
        <rect x="0" y="0" width={W} height={H} fill="transparent"
              onPointerDown={(e) => { if (selectedId) { e.stopPropagation(); deselect(); } }} />

        {/* orbital rings */}
        <g opacity={1 - grow * 0.7}>
          <path d={ringPath('xz', angle, tilt, R, cx, cy, D)} fill="none" stroke="var(--ring)" strokeWidth="1" strokeOpacity="0.5" />
          <path d={ringPath('xy', angle, tilt, R * 0.82, cx, cy, D)} fill="none" stroke="var(--ring)" strokeWidth="1" strokeOpacity="0.32" strokeDasharray="2 6" />
        </g>

        {/* core glow + disc (behind spokes) */}
        <g opacity={1 - grow * 0.55}>
          <circle cx={cx} cy={cy} r="76" fill="url(#coreGlow)" />
          <circle cx={cx} cy={cy} r="34" fill="var(--core-2)" opacity="0.30" />
          <circle cx={cx} cy={cy} r="34" fill="none" stroke="var(--core-1)" strokeOpacity="0.45" strokeWidth="1" />
          {!name && <circle cx={cx} cy={cy} r="9" fill="var(--core-1)" />}
        </g>

        {/* spokes (behind nodes), far first */}
        {order.map(({ idn, sx, sy, depth }) => (
          <line key={'s' + idn.id} x1={cx} y1={cy} x2={sx} y2={sy}
                stroke={idn.color} strokeWidth={0.8 + depth} strokeOpacity={(selectedId ? 0.04 : 0.08) + depth * 0.22} />
        ))}

        {/* nodes far->front, selected last */}
        {order.map(({ idn, sx, sy, scale, depth }) => {
          const isSel = idn.id === selectedId;
          const selBoost = isSel ? (1 + grow * 1.5) : 1;
          const base = (13 + idn.desired * 0.58) * scale * selBoost;
          const inner = base * Math.sqrt(fillLevel(idn));
          const dimmed = selectedId && !isSel;
          const op = isSel ? 1 : (dimmed ? 0.22 - 0.0 : (0.45 + depth * 0.55));
          return (
            <g key={idn.id} style={{ cursor: 'pointer' }} opacity={op}
               onPointerDown={(e) => e.stopPropagation()}
               onClick={(e) => { e.stopPropagation(); focusNode(idn, proj.findIndex(p => p.idn.id === idn.id)); }}>
              <circle cx={sx} cy={sy} r={base * 1.5} fill={idn.color} opacity={(isSel ? 0.28 : 0.18) * (isSel ? 1 : depth)} filter="url(#nodeGlow)" />
              <circle cx={sx} cy={sy} r={base} fill="none" stroke={idn.color} strokeWidth={(1.4 + (isSel ? grow * 1.2 : 0)) * scale} strokeOpacity={isSel ? 0.9 : 0.6} />
              <circle cx={sx} cy={sy} r={inner} fill={idn.color} />
              <text x={sx} y={sy} textAnchor="middle" dominantBaseline="central"
                    fontFamily="Newsreader, serif" fontSize={Math.max(10, inner * 0.95)} fontWeight="500"
                    fill="#fff" opacity={isSel ? 1 : Math.min(1, depth + 0.3)}>{idn.glyph}</text>
            </g>
          );
        })}

        {/* your name in the sun (above spokes & nodes) */}
        {name && (
          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" opacity={1 - grow * 0.55}
                fontFamily="Newsreader, serif" fontStyle="italic" fontWeight="400"
                fontSize={Math.max(13, 27 - name.length * 1.0)} fill="#7a6033"
                style={{ letterSpacing: '0.01em' }}>{name}</text>
        )}
      </svg>

      {/* focused-planet detail */}
      {selIdn && (
        <div className="cosmo-focus">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="glyph" style={{ width: 38, height: 38, background: selIdn.color, fontSize: 18 }}>{selIdn.glyph}</span>
            <div style={{ lineHeight: 1.2 }}>
              <div className="serif" style={{ fontSize: 20, fontWeight: 500 }}>{selIdn.name}</div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-faint)' }}>
                {selIdn.actual}% lived · {selIdn.desired}% intended
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {allowLog && onLog && (
              <button className="pill" style={{ background: selIdn.color, color: '#fff' }}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); onLog(selIdn); }}>
                <Icon name="plus" size={14} /> Log time
              </button>
            )}
            <button className="pill cosmo-close" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); deselect(); }} aria-label="release">✕</button>
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { CosmosViz, Starfield });
