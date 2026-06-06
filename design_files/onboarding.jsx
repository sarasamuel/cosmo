/* MOSAIC — Onboarding flow */

/* Each persona's color is its position in the selection list mapped onto the
   shared palette — guaranteeing every chosen persona has a distinct color. */
const paletteColorAt = (idx) => window.MOSAIC.paletteColor(idx).color;

/* "Free Time" is an intentional allowance for rest, drift, doomscrolling —
   not an aspiration, so it wears the neutral drift tone instead of a jewel hue. */
const FREE_TIME = 'Free Time';
const personaColor = (name, idx) => name === FREE_TIME ? 'var(--c-drift)' : paletteColorAt(idx);

/* Cadence presets — the rhythm at which a life is balanced. Each carries a
   sensible default pool of free hours and the range the slider can roam. */
const CADENCE = {
  day:   { key: 'day',   label: 'By day',   per: '/day', noun: 'each day',   min: 1,  max: 16,  step: 1, def: 7,   window: true  },
  week:  { key: 'week',  label: 'By week',  per: '/wk',  noun: 'each week',  min: 5,  max: 90,  step: 1, def: 35,  window: false },
  month: { key: 'month', label: 'By month', per: '/mo',  noun: 'each month', min: 20, max: 360, step: 5, def: 150, window: false },
};

/* hours (float) → "1h 24m" / "45m" / "2h" */
const fmtDur = (h) => {
  const m = Math.round(h * 60);
  if (m <= 0) return '0m';
  const hh = Math.floor(m / 60), mm = m % 60;
  if (!hh) return mm + 'm';
  if (!mm) return hh + 'h';
  return hh + 'h ' + mm + 'm';
};

/* 24h decimal → "5:00 PM" */
const clock = (h) => {
  const hr = ((Math.round(h) % 24) + 24) % 24;
  const ap = hr < 12 ? 'AM' : 'PM';
  let h12 = hr % 12; if (h12 === 0) h12 = 12;
  return h12 + ':00 ' + ap;
};

function Onboarding({ onDone }) {
  const { CATALOG, IDENTITIES } = window.MOSAIC;
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState(['Writer', 'Reader', 'Engineer', 'Musician', 'Painter', FREE_TIME]);
  const [custom, setCustom] = useState('');
  const [cadence, setCadence] = useState('day');
  const [freeHours, setFreeHours] = useState(CADENCE.day.def);
  const [tracked, setTracked] = useState(() => new Set(window.MOSAIC.DRIFT_APPS.filter(a => a.tracked).map(a => a.id)));
  const toggleApp = (id) => setTracked(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  // switching cadence reseeds the pool to that rhythm's natural default
  const pickCadence = (k) => { setCadence(k); setFreeHours(CADENCE[k].def); };

  const toggle = (name) => setSelected(s => s.includes(name) ? s.filter(x => x !== name) : [...s, name]);
  const addCustom = () => {
    const n = custom.trim();
    if (n && !selected.includes(n)) { setSelected(s => [...s, n]); }
    setCustom('');
  };

  const next = () => setStep(s => s + 1);

  return (
    <div className="onb">
      <Starfield count={60} />
      <StatusBar />

      <div className="scroll" style={{ padding: '0 44px', display: 'flex', flexDirection: 'column' }}>
        {/* STEP 0 — welcome */}
        {step === 0 && (
          <div className="fade-up" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 920, textAlign: 'center' }}>
            <div style={{ margin: '0 auto 40px' }}>
              <svg width="140" height="140" viewBox="0 0 140 140">
                {[['var(--c-writer)',70,30,16],['var(--c-reader)',104,60,13],['var(--c-engineer)',92,104,15],['var(--c-musician)',44,100,12],['var(--c-painter)',34,54,14]].map(([c,x,y,r],k)=>(
                  <g key={k}>
                    <line x1="70" y1="70" x2={x} y2={y} stroke="var(--ink)" strokeOpacity="0.18" />
                    <circle cx={x} cy={y} r={r} fill={c} className="viz-node" style={{ animationDelay: (k*120)+'ms' }} />
                  </g>
                ))}
                <circle cx="70" cy="70" r="7" fill="var(--ink)" />
              </svg>
            </div>
            <div className="eyebrow" style={{ marginBottom: 16 }}>Cosmo</div>
            <h1 className="serif" style={{ fontSize: 44, fontWeight: 500, lineHeight: 1.08, letterSpacing: '-0.01em', marginBottom: 20 }}>
              You are not your<br /><span style={{ fontStyle: 'italic' }}>to-do list.</span>
            </h1>
            <p style={{ fontSize: 18, lineHeight: 1.55, color: 'var(--ink-soft)', maxWidth: 460, margin: '0 auto' }}>
              Cosmo helps you spend your hours on the people you most want to become — not the tasks that happen to be loudest.
            </p>
            <button className="btn btn-primary" style={{ marginTop: 44, alignSelf: 'center', padding: '18px 48px' }} onClick={next}>Begin</button>
          </div>
        )}

        {/* STEP 1 — choose */}
        {step === 1 && (
          <div className="fade-up" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 920, paddingTop: 50 }}>
            <div className="eyebrow">Step one</div>
            <h1 className="serif" style={{ fontSize: 33, fontWeight: 500, margin: '10px 0 8px' }}>Who do you want to be?</h1>
            <p style={{ fontSize: 16, color: 'var(--ink-soft)', marginBottom: 28, lineHeight: 1.5 }}>
              Choose a few identities to tend to. Pick from these, or name your own.
            </p>
            <div className="persona-pick" style={{ justifyContent: 'flex-start' }}>
              {CATALOG.map((name, k) => {
                const on = selected.includes(name);
                return (
                  <button key={name} className={'chip' + (on ? ' sel' : '')}
                          style={on ? { background: personaColor(name, selected.indexOf(name)), color: '#fff' } : {}}
                          onClick={() => toggle(name)}>
                    {on && <Icon name="check" size={15} stroke={2.6} />}{name}
                  </button>
                );
              })}
              {selected.filter(n => !CATALOG.includes(n)).map((name, k) => (
                <button key={name} className="chip sel" style={{ background: personaColor(name, selected.indexOf(name)), color: '#fff' }} onClick={() => toggle(name)}>
                  <Icon name="check" size={15} stroke={2.6} />{name}
                </button>
              ))}
            </div>

            {selected.includes(FREE_TIME) && (
              <div className="fade-up" style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5, color: 'var(--ink-faint)', fontWeight: 500, lineHeight: 1.4 }}>
                  <span className="identity-dot" style={{ width: 11, height: 11, background: 'var(--c-drift)', flex: '0 0 auto' }} />
                  <span><span style={{ color: 'var(--ink-soft)', fontWeight: 600 }}>Free Time</span> reserves guilt-free hours for rest, scrolling, nothing in particular. Deselect it to give every hour to an identity.</span>
                </div>

                <div className="card" style={{ marginTop: 16, padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 700, whiteSpace: 'nowrap' }}>Track app usage</span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-faint)' }}>optional</span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.45, marginBottom: 14 }}>
                    Choose which apps to count. Their time rolls up into your <b style={{ color: 'var(--ink)' }}>Drift</b> — so you can see where Free Time really goes.
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
                    {window.MOSAIC.DRIFT_APPS.map(a => {
                      const on = tracked.has(a.id);
                      return (
                        <button key={a.id} className={'chip' + (on ? ' sel' : '')}
                                style={{ padding: '9px 14px', fontSize: 14, ...(on ? { background: 'var(--c-drift)', color: '#fff' } : {}) }}
                                onClick={() => toggleApp(a.id)}>
                          {on ? <Icon name="check" size={14} stroke={2.6} /> : <Icon name="plus" size={14} stroke={2.4} />}{a.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <input value={custom} onChange={e => setCustom(e.target.value)}
                     onKeyDown={e => e.key === 'Enter' && addCustom()} placeholder="Add your own…"
                     style={{ flex: 1, padding: '15px 20px', borderRadius: 999, border: '1px solid var(--line)', background: 'var(--surface)', fontSize: 16, fontFamily: 'Hanken Grotesk', color: 'var(--ink)', outline: 'none' }} />
              <button className="btn btn-soft" style={{ padding: '15px 24px' }} onClick={addCustom}>Add</button>
            </div>

            <div style={{ marginTop: 'auto', paddingBottom: 30 }}>
              <div style={{ fontSize: 14, color: 'var(--ink-faint)', fontWeight: 600, textAlign: 'center', marginBottom: 14 }}>{selected.length} chosen</div>
              <button className="btn btn-primary" style={{ width: '100%' }} disabled={selected.length < 2}
                      onClick={next}>Continue</button>
            </div>
          </div>
        )}

        {/* STEP 2 — cadence + free time */}
        {step === 2 && (
          <OnbCadence cadence={cadence} freeHours={freeHours} onPick={pickCadence}
                      onSetHours={setFreeHours} onBack={() => setStep(1)} onContinue={next} />
        )}

        {/* STEP 3 — allocate */}
        {step === 3 && (
          <OnbAllocate selected={selected} cadence={cadence} freeHours={freeHours}
                       onBack={() => setStep(2)} onContinue={next} />
        )}

        {/* STEP 4 — reveal */}
        {step === 4 && (
          <div className="fade-up" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 920, textAlign: 'center' }}>
            <div className="eyebrow" style={{ marginBottom: 18 }}>Your cosmos</div>
            <h1 className="serif" style={{ fontSize: 32, fontWeight: 500, marginBottom: 10 }}>Here is the shape of you.</h1>
            <p style={{ fontSize: 16, color: 'var(--ink-soft)', marginBottom: 10, lineHeight: 1.5, maxWidth: 440, margin: '0 auto 10px' }}>
              These identities now orbit together. Cosmo will help you keep them in balance.
            </p>
            <div style={{ margin: '6px 0 24px' }}>
              <CosmosViz identities={IDENTITIES} allowLog={false} name={window.MOSAIC.USER.name} />
            </div>
            <button className="btn btn-primary" style={{ alignSelf: 'center', padding: '18px 48px' }} onClick={onDone}>Enter Cosmos</button>
          </div>
        )}
      </div>

      {/* progress dots */}
      <div style={{ flex: '0 0 auto', padding: '14px 0 30px' }}>
        <div className="dots-prog">
          {[0,1,2,3,4].map(i => <i key={i} className={i === step ? 'on' : ''} />)}
        </div>
      </div>
    </div>
  );
}

function OnbAllocate({ selected, cadence, freeHours, onBack, onContinue }) {
  const cfg = CADENCE[cadence];
  const seed = () => {
    const base = Math.floor(100 / selected.length / 5) * 5;
    return selected.map((n, k) => ({ name: n, color: personaColor(n, k), pct: base }));
  };
  const [rows, setRows] = useState(seed);
  const total = rows.reduce((s, r) => s + r.pct, 0);
  const set = (name, v) => setRows(rs => rs.map(r => r.name === name ? { ...r, pct: v } : r));
  return (
    <div className="fade-up" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 920, paddingTop: 50 }}>
      <div className="eyebrow">Step three</div>
      <h1 className="serif" style={{ fontSize: 33, fontWeight: 500, margin: '10px 0 8px' }}>How much of you?</h1>
      <p style={{ fontSize: 16, color: 'var(--ink-soft)', marginBottom: 8, lineHeight: 1.5 }}>
        Divide your {fmtDur(freeHours)} {cfg.noun} between them. Don’t overthink it — you can always retune.
      </p>
      <div style={{ fontSize: 15, fontWeight: 700, color: total === 100 ? 'var(--good)' : 'var(--warn)', marginBottom: 18 }}>
        {total}% allocated {total === 100 ? '· balanced' : ''}
      </div>
      <div className="card" style={{ padding: '6px 22px' }}>
        {rows.map((r, k) => (
          <div key={r.name} style={{ padding: '16px 0', borderTop: k ? '1px solid var(--line-2)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span className="identity-dot" style={{ width: 18, height: 18, background: r.color }} />
              <span style={{ fontSize: 16, fontWeight: 600, flex: 1 }}>{r.name}</span>
              <span style={{ textAlign: 'right', lineHeight: 1.15, whiteSpace: 'nowrap' }}>
                <span className="serif" style={{ fontSize: 20, fontWeight: 500 }}>{r.pct}%</span>
                <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-faint)', marginTop: 1, whiteSpace: 'nowrap' }}>
                  {fmtDur(freeHours * r.pct / 100)}{cfg.per}
                </span>
              </span>
            </div>
            <input type="range" className="alloc" min="0" max="50" step="5" value={r.pct} style={{ '--c': r.color }} onChange={e => set(r.name, +e.target.value)} />
          </div>
        ))}
      </div>
      <div style={{ marginTop: 'auto', paddingBottom: 30, display: 'flex', gap: 12 }}>
        <button className="btn btn-soft" style={{ flex: '0 0 auto', padding: '18px 28px' }} onClick={onBack}>Back</button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={onContinue}>Continue</button>
      </div>
    </div>
  );
}

function OnbCadence({ cadence, freeHours, onPick, onSetHours, onBack, onContinue }) {
  const cfg = CADENCE[cadence];
  const startH = 24 - freeHours; // illustrative evening window for the daily rhythm

  return (
    <div className="fade-up" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 920, paddingTop: 50 }}>
      <div className="eyebrow">Step two</div>
      <h1 className="serif" style={{ fontSize: 33, fontWeight: 500, margin: '10px 0 8px' }}>How do you keep time?</h1>
      <p style={{ fontSize: 16, color: 'var(--ink-soft)', marginBottom: 26, lineHeight: 1.5 }}>
        Balance can be measured a day, a week, or a month at a time. Choose the rhythm that fits your life.
      </p>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 30 }}>
        <Segmented
          options={Object.values(CADENCE).map(c => ({ value: c.key, label: c.label }))}
          value={cadence}
          onChange={onPick}
        />
      </div>

      <div className="card" style={{ padding: '30px 26px 26px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>Free time {cfg.noun}</span>
          <span className="serif" style={{ fontSize: 34, fontWeight: 500, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>{fmtDur(freeHours)}</span>
        </div>
        <p style={{ fontSize: 13.5, color: 'var(--ink-faint)', fontWeight: 500, marginBottom: 22, lineHeight: 1.4 }}>
          The hours that are truly yours to spend — after work, sleep, and obligations.
        </p>
        <input type="range" className="alloc" min={cfg.min} max={cfg.max} step={cfg.step}
               value={freeHours} style={{ '--c': 'var(--ink)' }}
               onChange={e => onSetHours(+e.target.value)} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 12.5, fontWeight: 600, color: 'var(--ink-faint)' }}>
          <span>{fmtDur(cfg.min)}</span>
          <span>{fmtDur(cfg.max)}</span>
        </div>

        {cfg.window && (
          <div style={{ marginTop: 22, paddingTop: 20, borderTop: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 32, height: 32, borderRadius: '50%', flex: '0 0 auto', display: 'grid', placeItems: 'center', background: 'var(--surface-2)', color: 'var(--ink-soft)' }}>
              <Icon name="moon" size={15} stroke={2} />
            </span>
            <div style={{ lineHeight: 1.35 }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Your evening</div>
              <div style={{ fontSize: 16, fontWeight: 600, whiteSpace: 'nowrap' }}>{clock(startH)} – {clock(24)}</div>
            </div>
          </div>
        )}
      </div>

      <p style={{ fontSize: 13.5, color: 'var(--ink-faint)', fontWeight: 500, marginTop: 18, lineHeight: 1.45, textAlign: 'center' }}>
        Every identity’s share is scaled to this — so a percentage always means real hours.
      </p>

      <div style={{ marginTop: 'auto', paddingBottom: 30, display: 'flex', gap: 12 }}>
        <button className="btn btn-soft" style={{ flex: '0 0 auto', padding: '18px 28px' }} onClick={onBack}>Back</button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={onContinue}>Continue</button>
      </div>
    </div>
  );
}

Object.assign(window, { Onboarding });
