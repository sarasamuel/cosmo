/* MOSAIC — Reflect + Identities screens */

function StackedBar({ items, field, label }) {
  const total = items.reduce((s, i) => s + i[field], 0) || 1;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', height: 26, borderRadius: 8, overflow: 'hidden', gap: 2 }}>
        {items.map(i => (
          <div key={i.id} title={i.name} style={{ width: (i[field] / total * 100) + '%', background: i.color,
            display: 'grid', placeItems: 'center', minWidth: i[field] > 0 ? 2 : 0 }}>
            {i[field] / total > 0.1 && <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>{i.glyph}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Reflect({ identities, drift, reflection, trend, days }) {
  const delta = reflection.aligned - reflection.alignedLast;
  const lived = [...identities, drift];
  const trDir = (id) => {
    const t = trend[id]; if (!t) return 0;
    return (t[t.length - 1] + t[t.length - 2]) - (t[0] + t[1]);
  };
  return (
    <div className="scroll" style={{ padding: '8px 36px 30px' }}>
      <div style={{ paddingTop: 8 }}>
        <div className="eyebrow">Weekly reflection</div>
        <h1 className="serif" style={{ fontSize: 34, fontWeight: 500, margin: '8px 0 2px' }}>{reflection.week}</h1>
        <p style={{ fontSize: 15.5, color: 'var(--ink-soft)' }}>A quiet look back at where your hours went.</p>
      </div>

      {/* hero */}
      <div className="card" style={{ marginTop: 20, padding: 28, display: 'flex', gap: 24, alignItems: 'center' }}>
        <AlignmentRing value={reflection.aligned} size={140} />
        <div style={{ flex: 1 }}>
          <div className="section-title" style={{ marginBottom: 8 }}>Identity alignment</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap',
                        color: delta >= 0 ? 'var(--good)' : 'var(--warn)' }}>
            <Icon name="arrow" size={16} stroke={2} /> {delta >= 0 ? '+' : ''}{delta} from last week
          </div>
          <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', lineHeight: 1.5, marginTop: 12 }}>
            Closer than last week, though still drifting. Your intention and your hours are slowly converging.
          </p>
        </div>
      </div>

      {/* portfolio balance */}
      <div className="card" style={{ marginTop: 18, padding: 24 }}>
        <div className="section-title" style={{ marginBottom: 18 }}>Portfolio balance</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <StackedBar items={identities} field="desired" label="Intended" />
          <StackedBar items={lived} field="actual" label="Lived" />
        </div>
      </div>

      {/* trends */}
      <div style={{ marginTop: 26 }}>
        <div className="section-title" style={{ marginBottom: 14 }}>Identity trends</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {identities.map(i => {
            const d = trDir(i.id);
            return (
              <div key={i.id} className="card" style={{ padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span className="glyph" style={{ width: 26, height: 26, background: i.color, fontSize: 13 }}>{i.glyph}</span>
                  <span style={{ fontSize: 14.5, fontWeight: 600 }}>{i.name}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 700,
                    color: d > 0.02 ? 'var(--good)' : d < -0.02 ? 'var(--warn)' : 'var(--ink-faint)' }}>
                    {d > 0.02 ? '↑' : d < -0.02 ? '↓' : '→'}
                  </span>
                </div>
                <Sparkline data={trend[i.id]} color={i.color} w={150} h={34} />
              </div>
            );
          })}
        </div>
      </div>

      {/* summary */}
      <div className="card coach-card" style={{ marginTop: 26, padding: 30 }}>
        <div className="section-title" style={{ marginBottom: 14 }}>In a sentence</div>
        <p className="serif" style={{ fontSize: 22, lineHeight: 1.5 }}>{reflection.summary}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 20 }}>
          {reflection.wins.map((w, k) => (
            <span key={k} className="pill" style={{ background: 'var(--surface-3)', cursor: 'default' }}>
              <Icon name="check" size={14} stroke={2.4} /> {w}
            </span>
          ))}
        </div>
      </div>

      {/* focus */}
      <div style={{ marginTop: 26 }}>
        <div className="section-title" style={{ marginBottom: 14 }}>Where to lean next week</div>
        <div style={{ display: 'flex', gap: 12 }}>
          {reflection.focus.map(fid => {
            const i = identities.find(x => x.id === fid);
            return (
              <div key={fid} className="card" style={{ flex: 1, padding: 22, textAlign: 'center', overflow: 'hidden', position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 0, background: i.soft, opacity: 0.5 }} />
                <div style={{ position: 'relative' }}>
                  <span className="glyph" style={{ width: 46, height: 46, background: i.color, fontSize: 22, margin: '0 auto 12px' }}>{i.glyph}</span>
                  <div style={{ fontSize: 17, fontWeight: 700 }}>{i.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-soft)', fontWeight: 600, marginTop: 2 }}>
                    {i.desired - i.actual}pts below intention
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Identities ("You") ---------------- */
function Identities({ identities, setIdentities, drift, onAdd, onReplayIntro, theme, setTheme }) {
  const total = identities.reduce((s, i) => s + i.desired, 0);
  const balanced = total === 100;
  const setDesired = (id, v) => {
    setIdentities(prev => prev.map(i => i.id === id ? { ...i, desired: v } : i));
  };
  return (
    <div className="scroll" style={{ padding: '8px 36px 30px' }}>
      <div style={{ paddingTop: 8 }}>
        <div className="eyebrow">Your identities</div>
        <h1 className="serif" style={{ fontSize: 34, fontWeight: 500, margin: '8px 0 4px' }}>The people you’re becoming</h1>
        <p style={{ fontSize: 15.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
          Set how much of yourself each one deserves. They should sum to a whole.
        </p>
      </div>

      {/* balance meter */}
      <div className="card" style={{ marginTop: 20, padding: 22, display: 'flex', alignItems: 'center', gap: 18 }}>
        <div className="serif" style={{ fontSize: 32, fontWeight: 500, color: balanced ? 'var(--good)' : 'var(--warn)' }}>{total}%</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700 }}>{balanced ? 'Balanced' : total > 100 ? 'Over-committed' : 'Room to give'}</div>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)', fontWeight: 600 }}>
            {balanced ? 'Your intentions add to a whole self.' : `${Math.abs(100 - total)}% ${total > 100 ? 'over' : 'unassigned'}`}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16, padding: '8px 24px' }}>
        {identities.map((i, k) => (
          <div key={i.id} style={{ padding: '18px 0', borderTop: k ? '1px solid var(--line-2)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
              <span className="glyph" style={{ width: 38, height: 38, background: i.color, fontSize: 18 }}>{i.glyph}</span>
              <span style={{ fontSize: 17, fontWeight: 600, flex: 1 }}>{i.name}</span>
              <span className="serif" style={{ fontSize: 22, fontWeight: 500, color: 'var(--ink)' }}>{i.desired}<span style={{ fontSize: 14, color: 'var(--ink-faint)' }}>%</span></span>
            </div>
            <input type="range" className="alloc" min="0" max="50" step="5" value={i.desired}
                   style={{ '--c': i.color }} onChange={e => setDesired(i.id, +e.target.value)} />
          </div>
        ))}
      </div>

      {/* appearance */}
      <div className="section-title" style={{ marginTop: 28, marginBottom: 12 }}>Appearance</div>
      <div className="card" style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 16 }}>
        <span className="glyph" style={{ width: 38, height: 38, background: theme === 'dark' ? 'var(--c-writer)' : 'var(--c-painter)', fontSize: 16, color: '#fff' }}>
          <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={18} stroke={2} />
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Theme</div>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)', fontWeight: 600 }}>{theme === 'dark' ? 'Deep space' : 'Celestial dawn'}</div>
        </div>
        <div className="segmented">
          <button className={theme === 'light' ? 'on' : ''} onClick={() => setTheme('light')} style={{ display: 'flex', alignItems: 'center', gap: 7, background: theme === 'light' ? 'var(--surface)' : 'transparent', boxShadow: theme === 'light' ? 'var(--shadow-sm)' : 'none' }}>
            <Icon name="sun" size={15} stroke={2} /> Light
          </button>
          <button className={theme === 'dark' ? 'on' : ''} onClick={() => setTheme('dark')} style={{ display: 'flex', alignItems: 'center', gap: 7, background: theme === 'dark' ? 'var(--surface)' : 'transparent', boxShadow: theme === 'dark' ? 'var(--shadow-sm)' : 'none' }}>
            <Icon name="moon" size={14} stroke={2} /> Dark
          </button>
        </div>
      </div>

      <button className="btn btn-soft" style={{ width: '100%', marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }} onClick={onAdd}>
        <Icon name="plus" size={20} /> Add an identity
      </button>

      <button className="btn btn-ghost" style={{ width: '100%', marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }} onClick={onReplayIntro}>
        <Icon name="sparkle" size={18} /> Replay the intro
      </button>
    </div>
  );
}

Object.assign(window, { Reflect, Identities, StackedBar });
