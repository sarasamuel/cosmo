/* MOSAIC — Dashboard + Insights screens */

function CosmosHero({ identities, onTap, name }) {
  return (
    <div className="card cosmos-card" style={{ padding: '20px 20px 18px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="eyebrow">Your cosmos</span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-faint)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>✦</span> drag to rotate
        </span>
      </div>
      <CosmosViz identities={identities} onLog={onTap} name={name} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, justifyContent: 'center', marginTop: 2 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, color: 'var(--ink-faint)' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--ink-soft)' }} /> filled = your time
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, color: 'var(--ink-faint)' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid var(--ink-soft)' }} /> ring = intention
        </span>
      </div>
    </div>
  );
}

function Dashboard({ identities, drift, coach, sessions, onTap, onLog, onToggleApp }) {
  const user = window.MOSAIC.USER;
  const { fmtMins } = window.MOSAIC;
  const align = window.MOSAIC.alignment(identities);
  const [driftOpen, setDriftOpen] = useState(false);
  const lead = [...identities].sort((a, b) => (b.actual - b.desired) - (a.actual - a.desired))[0];
  const lag = [...identities].sort((a, b) => (a.actual - a.desired) - (b.actual - b.desired))[0];
  const tracked = drift.apps.filter(a => a.tracked);
  const untracked = drift.apps.filter(a => !a.tracked);
  const maxApp = Math.max(...tracked.map(a => a.pct), 1);
  return (
    <div className="scroll" style={{ padding: '8px 36px 30px' }}>
      <div style={{ paddingTop: 8 }}>
        <div className="eyebrow">{coach.date}</div>
        <h1 className="serif" style={{ fontSize: 38, fontWeight: 500, lineHeight: 1.05, margin: '8px 0 6px', letterSpacing: '-0.01em' }}>
          Good morning, {user.name}
        </h1>
        <p className="h-question" style={{ fontSize: 19 }}>
          Am I spending my time becoming the person I want to be?
        </p>
      </div>

      <div style={{ marginTop: 22 }}>
        <CosmosHero identities={identities} onTap={onTap} name={user.name} />
      </div>

      {/* alignment summary */}
      <div className="card" style={{ marginTop: 18, padding: 26, display: 'flex', gap: 24, alignItems: 'center' }}>
        <AlignmentRing value={align} />
        <div style={{ flex: 1 }}>
          <div className="section-title" style={{ marginBottom: 8 }}>This week’s balance</div>
          <p style={{ fontSize: 15.5, lineHeight: 1.5, color: 'var(--ink-soft)' }}>
            Your hours leaned toward <b style={{ color: 'var(--ink)' }}>{lead.name}</b>, while <b style={{ color: 'var(--ink)' }}>{lag.name}</b> sits furthest below your intention.
          </p>
          <button className="pill" style={{ marginTop: 14, background: 'var(--ink)', color: 'var(--bg)' }} onClick={() => onLog(lag)}>
            <Icon name="plus" size={15} /> Tend to {lag.name}
          </button>
        </div>
      </div>

      {/* breakdown */}
      <div className="card" style={{ marginTop: 18, padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span className="section-title">Desired vs. actual</span>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-faint)' }}>past 7 days</span>
        </div>
        {identities.map(i => <IdentityRow key={i.id} idn={i} onTap={onTap} />)}
        {/* drift — aggregate of tracked apps */}
        <div style={{ marginTop: 4, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
          <button className="id-row" style={{ padding: '0', width: '100%' }} onClick={() => setDriftOpen(o => !o)}>
            <span className="glyph" style={{ width: 38, height: 38, background: drift.color, fontSize: 20 }}>{drift.glyph}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 9 }}>
                <span style={{ fontSize: 16.5, fontWeight: 600, color: 'var(--ink)' }}>
                  {drift.name} <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--warn)', marginLeft: 6 }}>DRIFT</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-soft)' }}>{Math.round(drift.actual)}<span style={{ color: 'var(--ink-faint)' }}> / 0%</span></span>
                  <span style={{ display: 'inline-flex', color: 'var(--ink-faint)', transform: driftOpen ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform 0.25s' }}><Icon name="chevron" size={16} /></span>
                </span>
              </div>
              <div className="dualbar"><div className="actual" style={{ width: drift.actual + '%', background: drift.color }} /></div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', fontWeight: 600, marginTop: 8 }}>
                {tracked.length ? `Tracking ${tracked.length} app${tracked.length > 1 ? 's' : ''} · ${fmtMins(tracked.reduce((s, a) => s + a.mins, 0))} this week` : 'No apps tracked'}
              </div>
            </div>
          </button>

          {driftOpen && (
            <div className="fade-up" style={{ marginTop: 14, paddingLeft: 54 }}>
              {tracked.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0' }}>
                  <span className="glyph" style={{ width: 28, height: 28, background: drift.color, fontSize: 13, opacity: 0.85 }}>{a.glyph}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 14.5, fontWeight: 600 }}>{a.name}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)' }}>{fmtMins(a.mins)}</span>
                    </div>
                    <div className="dualbar" style={{ height: 6 }}><div className="actual" style={{ width: (a.pct / maxApp * 100) + '%', background: drift.color, opacity: 0.7 }} /></div>
                  </div>
                  <button className="pill" style={{ padding: '6px 12px', fontSize: 12, background: 'var(--surface-2)' }} onClick={() => onToggleApp(a.id)}>Stop</button>
                </div>
              ))}

              {untracked.length > 0 && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line-2)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 12 }}>Also track</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
                    {untracked.map(a => (
                      <button key={a.id} className="chip" style={{ padding: '9px 14px', fontSize: 14 }} onClick={() => onToggleApp(a.id)}>
                        <Icon name="plus" size={14} stroke={2.4} />{a.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* coach */}
      <div style={{ marginTop: 18 }}><CoachNote coach={coach} compact /></div>

      {/* recent */}
      <div style={{ marginTop: 26 }}>
        <div className="section-title" style={{ marginBottom: 12 }}>Recent sessions</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sessions.slice(0, 4).map((s, k) => {
            const idn = identities.find(i => i.id === s.id) || drift;
            return (
              <div key={k} className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <span className="glyph" style={{ width: 32, height: 32, background: idn.color, fontSize: 15 }}>{idn.glyph}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15.5, fontWeight: 600 }}>{s.label}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', fontWeight: 600 }}>{s.when}</div>
                </div>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-soft)' }}>{s.mins}m</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Insights ---------------- */
function Insights({ identities, drift, insights, coach, onLog }) {
  const tone = {
    neglect: { color: 'var(--c-painter)', icon: 'clock' },
    nudge:   { color: 'var(--c-writer)', icon: 'arrow' },
    trade:   { color: 'var(--c-drift)', icon: 'bell' },
    balance: { color: 'var(--c-engineer)', icon: 'flame' },
  };
  const find = (id) => identities.find(i => i.id === id) || drift;
  return (
    <div className="scroll" style={{ padding: '8px 36px 30px' }}>
      <div style={{ paddingTop: 8 }}>
        <div className="eyebrow">Rebalancing</div>
        <h1 className="serif" style={{ fontSize: 34, fontWeight: 500, margin: '8px 0 4px' }}>Insights</h1>
        <p style={{ fontSize: 15.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
          Gentle observations from the gap between intention and action. Nothing here is a verdict.
        </p>
      </div>

      <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {insights.map((ins, k) => {
          const t = tone[ins.kind]; const idn = find(ins.id);
          return (
            <div key={k} className="card insight-card" style={{ animationDelay: (k * 90) + 'ms' }}>
              <span className="ico" style={{ background: idn.color }}><Icon name={t.icon} size={22} /></span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.3, marginBottom: 6 }}>{ins.title}</div>
                <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>{ins.body}</p>
                {ins.action && (
                  <button className="pill" style={{ marginTop: 14, background: idn.soft, color: 'var(--ink)' }}
                          onClick={() => onLog(idn.id === 'drift' ? null : idn)}>
                    {ins.action} <Icon name="chevron" size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 22 }}><CoachNote coach={coach} /></div>
    </div>
  );
}

Object.assign(window, { CosmosHero, Dashboard, Insights });
