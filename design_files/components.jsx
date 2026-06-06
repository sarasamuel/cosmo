/* MOSAIC — shared UI components */
const { useState, useEffect, useRef } = React;

/* ---------------- icons ---------------- */
function Icon({ name, size = 24, stroke = 1.7 }) {
  const p = {
    portfolio: <><circle cx="8" cy="8" r="3.2"/><circle cx="16.5" cy="9.5" r="2.4"/><circle cx="11" cy="16.5" r="2.8"/><path d="M9.6 10.2l1.6 4M14.4 11.1l-2.2 3.3"/></>,
    insights: <><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/><circle cx="12" cy="12" r="4"/><path d="M12 9.5l1 2.5-1 2.5-1-2.5z" fill="currentColor" stroke="none"/></>,
    reflect: <><path d="M17.5 14.5A6 6 0 0 1 9.5 6.5 6.5 6.5 0 1 0 17.5 14.5z"/></>,
    plus: <><path d="M12 6v12M6 12h12"/></>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/></>,
    moon: <><path d="M18 14.5A6.5 6.5 0 0 1 9.5 6 6.5 6.5 0 1 0 18 14.5z"/></>,
    chevron: <><path d="M9 6l6 6-6 6"/></>,
    check: <><path d="M5 12.5l4.5 4.5L19 7"/></>,
    clock: <><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></>,
    flame: <><path d="M12 3c2.5 3 4.5 5 4.5 8.5A4.5 4.5 0 0 1 7.5 11.5C7.5 9.5 9 8 9 8s0 2.5 1.5 3c0-3 1.5-5 1.5-8z"/></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    bell: <><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6zM10 20a2 2 0 0 0 4 0"/></>,
    sparkle: <><path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6z"/></>,
  }[name];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {p}
    </svg>
  );
}

/* ---------------- status bar ---------------- */
function StatusBar() {
  return (
    <div className="statusbar">
      <span>9:41</span>
      <div className="dots">
        <span></span><span></span><span></span>
        <div className="batt"><i></i></div>
      </div>
    </div>
  );
}

/* ---------------- segmented control ---------------- */
function Segmented({ options, value, onChange }) {
  const ref = useRef(null);
  const [thumb, setThumb] = useState({ left: 5, width: 0 });
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const idx = options.findIndex(o => o.value === value);
    const btn = el.querySelectorAll('button')[idx];
    if (btn) setThumb({ left: btn.offsetLeft, width: btn.offsetWidth });
  }, [value, options]);
  return (
    <div className="segmented" ref={ref}>
      <div className="seg-thumb" style={{ left: thumb.left, width: thumb.width }} />
      {options.map(o => (
        <button key={o.value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- alignment ring ---------------- */
function AlignmentRing({ value, size = 132, stroke = 11, label = 'aligned' }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const [shown, setShown] = useState(value);
  useEffect(() => {
    let raf, start; const from = 0;
    const step = (t) => { if (!start) start = t; const k = Math.min(1, (t - start) / 1100);
      setShown(Math.round(from + (value - from) * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--ink)" strokeWidth={stroke}
                strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - shown / 100)}
                transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition: 'stroke-dashoffset 0.1s linear' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div>
          <div className="serif" style={{ fontSize: 40, fontWeight: 500, lineHeight: 1, color: 'var(--ink)' }}>{shown}<span style={{ fontSize: 20 }}>%</span></div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-faint)', marginTop: 4, letterSpacing: '0.04em' }}>{label}</div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- identity row (dual bar) ---------------- */
function IdentityRow({ idn, onTap }) {
  const gap = idn.actual - idn.desired;
  return (
    <button className="id-row" onClick={() => onTap && onTap(idn)}>
      <span className="glyph" style={{ width: 38, height: 38, background: idn.color, fontSize: 18 }}>{idn.glyph}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 9 }}>
          <span style={{ fontSize: 16.5, fontWeight: 600, color: 'var(--ink)' }}>{idn.name}</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-soft)' }}>
            {idn.actual}<span style={{ color: 'var(--ink-faint)' }}> / {idn.desired}%</span>
          </span>
        </div>
        <div className="dualbar">
          <div className="actual" style={{ width: Math.min(100, idn.actual) + '%', background: idn.color }} />
          <div className="desired-tick" style={{ left: Math.min(100, idn.desired) + '%' }} />
        </div>
      </div>
    </button>
  );
}

/* ---------------- sparkline ---------------- */
function Sparkline({ data, color, w = 96, h = 30 }) {
  const max = Math.max(...data, 0.01);
  const pts = data.map((d, i) => [ (i / (data.length - 1)) * w, h - (d / max) * (h - 4) - 2 ]);
  const path = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = path + ` L${w} ${h} L0 ${h} Z`;
  const gid = 'sg-' + Math.round(color.length * 97 + w);
  return (
    <svg width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity="0.22" /><stop offset="100%" stopColor={color} stopOpacity="0" />
      </linearGradient></defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="2.6" fill={color} />
    </svg>
  );
}

/* ---------------- coach note ---------------- */
function CoachNote({ coach, compact }) {
  return (
    <div className="card coach-card" style={{ padding: compact ? 24 : 30 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span className="coach-orb"><Icon name="sparkle" size={16} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap' }}>A note from Cosmo</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', fontWeight: 600 }}>{coach.date}</div>
        </div>
      </div>
      <p className="serif" style={{ fontSize: compact ? 19 : 21, lineHeight: 1.5, color: 'var(--ink)', fontWeight: 400 }}>
        {coach.note}
      </p>
    </div>
  );
}

/* ---------------- minute dial ---------------- */
function MinuteDial({ value, max = 180, onChange, color }) {
  const ref = useRef(null);
  const START = -220, SWEEP = 260; // degrees
  const frac = Math.max(0, Math.min(1, value / max));
  const ang = START + frac * SWEEP;
  const size = 240, R = 96, cx = size/2, cy = size/2;
  const polar = (a) => [ cx + R * Math.cos(a * Math.PI/180), cy + R * Math.sin(a * Math.PI/180) ];
  const arcPath = (a0, a1) => {
    const [x0,y0] = polar(a0), [x1,y1] = polar(a1);
    const large = (a1 - a0) > 180 ? 1 : 0;
    return `M${x0} ${y0} A${R} ${R} 0 ${large} 1 ${x1} ${y1}`;
  };
  const [kx, ky] = polar(ang);

  const setFromEvent = (e) => {
    const el = ref.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left - rect.width/2;
    const py = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top - rect.height/2;
    let a = Math.atan2(py, px) * 180 / Math.PI;
    let rel = a - START; while (rel < 0) rel += 360; while (rel > 360) rel -= 360;
    if (rel > SWEEP) { rel = (rel - SWEEP > (360 - SWEEP)/2) ? 0 : SWEEP; }
    const v = Math.round((rel / SWEEP) * max / 5) * 5;
    onChange(Math.max(0, Math.min(max, v)));
  };
  const drag = (e) => { e.preventDefault(); setFromEvent(e);
    const move = (ev) => setFromEvent(ev);
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  return (
    <div ref={ref} style={{ width: size, height: size, position: 'relative', margin: '0 auto', touchAction: 'none' }}
         onPointerDown={drag}>
      <svg width={size} height={size}>
        <path d={arcPath(START, START + SWEEP)} fill="none" stroke="var(--surface-3)" strokeWidth="16" strokeLinecap="round" />
        <path d={arcPath(START, ang)} fill="none" stroke={color} strokeWidth="16" strokeLinecap="round"
              style={{ transition: 'none' }} />
        <circle cx={kx} cy={ky} r="15" fill="var(--surface)" stroke={color} strokeWidth="4" />
      </svg>
      <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center', pointerEvents:'none' }}>
        <div style={{ textAlign:'center' }}>
          <div className="serif" style={{ fontSize: 58, fontWeight: 500, lineHeight: 1, color:'var(--ink)' }}>{value}</div>
          <div style={{ fontSize: 14, fontWeight: 600, color:'var(--ink-faint)', letterSpacing:'0.04em' }}>minutes</div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- tab bar ---------------- */
function TabBar({ tab, setTab, onLog }) {
  const tabs = [
    { id: 'home', label: 'Portfolio', icon: 'portfolio' },
    { id: 'insights', label: 'Insights', icon: 'insights' },
  ];
  const tabs2 = [
    { id: 'reflect', label: 'Reflect', icon: 'reflect' },
    { id: 'identities', label: 'You', icon: 'sparkle' },
  ];
  return (
    <div className="tabbar">
      {tabs.map(t => (
        <button key={t.id} className={'tab' + (tab === t.id ? ' on' : '')} onClick={() => setTab(t.id)}>
          <span className="ic"><Icon name={t.icon} /></span><span>{t.label}</span>
        </button>
      ))}
      <div className="tab-log"><button onClick={onLog}><Icon name="plus" size={28} /></button></div>
      {tabs2.map(t => (
        <button key={t.id} className={'tab' + (tab === t.id ? ' on' : '')} onClick={() => setTab(t.id)}>
          <span className="ic"><Icon name={t.icon} /></span><span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

Object.assign(window, { Icon, StatusBar, Segmented, AlignmentRing, IdentityRow, Sparkline, CoachNote, MinuteDial, TabBar });
