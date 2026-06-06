/* MOSAIC — Log session sheet */

function LogSheet({ open, identities, preset, onClose, onCommit }) {
  const [step, setStep] = useState(1);
  const [sel, setSel] = useState(null);
  const [mins, setMins] = useState(30);

  useEffect(() => {
    if (open) {
      if (preset) { setSel(preset); setStep(2); } else { setSel(null); setStep(1); }
      setMins(30);
    }
  }, [open, preset]);

  const presets = [15, 30, 45, 60, 90];
  const commit = () => { onCommit(sel, mins); };
  const btnBg = (idn) => idn.deep || idn.color;

  return (
    <>
      <div className={'sheet-scrim' + (open ? ' open' : '')} onClick={onClose} />
      <div className={'sheet' + (open ? ' open' : '')}>
        <div className="sheet-grip" />
        {step === 1 && (
          <div>
            <h2 className="serif" style={{ fontSize: 27, fontWeight: 500, marginBottom: 4 }}>What did you tend to?</h2>
            <p style={{ fontSize: 15, color: 'var(--ink-soft)', marginBottom: 24 }}>Choose the identity you gave time to.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {identities.map(i => {
                const on = sel && sel.id === i.id;
                return (
                  <button key={i.id} className={'pick-card' + (on ? ' on' : '')}
                          style={on ? { '--pc': i.color, borderColor: i.color, background: i.soft } : { '--pc': i.color }}
                          onClick={() => setSel(i)}>
                    <span className="glyph pick-glyph" style={{ width: on ? 52 : 44, height: on ? 52 : 44, background: i.color, fontSize: on ? 25 : 21 }}>{i.glyph}</span>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)' }}>{i.name}</div>
                      <div style={{ fontSize: 12.5, color: on ? i.color : 'var(--ink-faint)', fontWeight: 600 }}>
                        {i.lastActiveDays === 0 ? 'active today' : `${i.lastActiveDays}d since last`}
                      </div>
                    </div>
                    <span className="pick-check" style={{ background: i.color, opacity: on ? 1 : 0, transform: on ? 'scale(1)' : 'scale(0.4)' }}>
                      <Icon name="check" size={14} stroke={2.6} />
                    </span>
                  </button>
                );
              })}
            </div>
            <button className="btn" style={{ width: '100%', marginTop: 20, background: sel ? btnBg(sel) : 'var(--ink)', color: '#fff', boxShadow: 'var(--shadow-md)', opacity: sel ? 1 : 0.4, pointerEvents: sel ? 'auto' : 'none' }}
                    onClick={() => sel && setStep(2)}>
              {sel ? `Continue with ${sel.name}` : 'Select an identity'}
            </button>
            <button className="btn btn-ghost" style={{ width: '100%', marginTop: 6 }} onClick={onClose}>Cancel</button>
          </div>
        )}

        {step === 2 && sel && (
          <div className="fade-up">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
              <span className="glyph" style={{ width: 48, height: 48, background: sel.color, fontSize: 23 }}>{sel.glyph}</span>
              <div>
                <h2 className="serif" style={{ fontSize: 25, fontWeight: 500, lineHeight: 1 }}>{sel.name}</h2>
                <button className="btn-ghost" style={{ padding: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--ink-faint)', background: 'none', border: 'none', cursor: 'pointer' }}
                        onClick={() => setStep(1)}>change identity</button>
              </div>
            </div>

            <MinuteDial value={mins} max={180} onChange={setMins} color={sel.color} />

            <div style={{ display: 'flex', gap: 9, justifyContent: 'center', margin: '20px 0 26px', flexWrap: 'wrap' }}>
              {presets.map(p => (
                <button key={p} className="chip" style={{ padding: '10px 18px', borderColor: mins === p ? 'transparent' : 'var(--line)', background: mins === p ? btnBg(sel) : 'var(--surface)', color: mins === p ? '#fff' : 'var(--ink)' }}
                        onClick={() => setMins(p)}>{p}m</button>
              ))}
            </div>

            <button className="btn" style={{ width: '100%', background: btnBg(sel), color: '#fff', boxShadow: 'var(--shadow-md)' }} onClick={commit}>
              Log {mins} minutes
            </button>
            <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={onClose}>Cancel</button>
          </div>
        )}
      </div>
    </>
  );
}

Object.assign(window, { LogSheet });
