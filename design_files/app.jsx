/* MOSAIC — app root */
const { useState: useStateR, useEffect: useEffectR, useRef: useRefR } = React;

function useScale() {
  useEffectR(() => {
    const scaler = document.querySelector('.device-scaler');
    const fit = () => {
      const pad = 40;
      const s = Math.min((window.innerWidth - pad) / 868, (window.innerHeight - pad) / 1228);
      if (scaler) scaler.style.transform = `scale(${Math.min(s, 1)})`;
    };
    fit(); window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
}

function ThemeToggle({ theme, setTheme }) {
  return (
    <button className="theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="toggle theme">
      <span className="knob" style={{ display: 'grid', placeItems: 'center', color: 'var(--bg)' }}>
        <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={14} stroke={2} />
      </span>
    </button>
  );
}

function App() {
  useScale();
  const M = window.MOSAIC;
  const [theme, setTheme] = useStateR(() => localStorage.getItem('cosmo-theme') || 'dark');
  const [started, setStarted] = useStateR(() => localStorage.getItem('cosmo-started') === '1');
  const [tab, setTab] = useStateR('home');
  const [identities, setIdentities] = useStateR(M.IDENTITIES);
  const [drift, setDrift] = useStateR(M.DRIFT);
  const [sessions, setSessions] = useStateR(M.SESSIONS);
  const [logOpen, setLogOpen] = useStateR(false);
  const [logPreset, setLogPreset] = useStateR(null);
  const [toast, setToast] = useStateR(null);
  const scrollRef = useRefR(null);

  useEffectR(() => { localStorage.setItem('cosmo-theme', theme); }, [theme]);

  const enter = () => { setStarted(true); localStorage.setItem('cosmo-started', '1'); };
  const restart = () => { localStorage.removeItem('cosmo-started'); setTab('home'); setStarted(false); };

  const openLog = (preset) => { setLogPreset(preset && preset.id ? preset : null); setLogOpen(true); };
  const commitLog = (idn, mins) => {
    const bump = Math.max(1, Math.round(mins / 12));
    setIdentities(prev => prev.map(i => i.id === idn.id ? { ...i, actual: Math.min(60, i.actual + bump), lastActiveDays: 0, streak: i.streak + 1 } : i));
    setDrift(d => {
      const next = Math.max(0, d.actual - Math.round(bump / 2));
      const ratio = d.actual ? next / d.actual : 0;
      return { ...d, actual: next, apps: d.apps.map(a => a.tracked ? { ...a, pct: a.pct * ratio, mins: Math.round(a.mins * ratio) } : a) };
    });
    setSessions(s => [{ id: idn.id, label: idn.name + ' session', mins, when: 'Just now' }, ...s]);
    setLogOpen(false);
    setToast({ name: idn.name, mins, color: idn.color, glyph: idn.glyph });
    setTimeout(() => setToast(null), 2600);
  };

  const toggleDriftApp = (id) => setDrift(d => {
    const apps = d.apps.map(a => a.id === id ? { ...a, tracked: !a.tracked } : a);
    return { ...d, apps, actual: M.driftSum(apps) };
  });

  const goTo = (t) => { setTab(t); const sc = document.querySelector('.app-root .scroll'); if (sc) sc.scrollTop = 0; };

  const addIdentity = () => {
    const pool = M.CATALOG.filter(n => !identities.some(i => i.name === n));
    const name = pool[0]; if (!name) return;
    const c = M.assignColor([...identities, drift]);
    setIdentities(prev => [...prev, { id: name.toLowerCase(), name, glyph: name[0], hue: c.hue, color: c.color, soft: c.soft, deep: c.deep, desired: 10, actual: 0, lastActiveDays: 99, streak: 0 }]);
  };

  return (
    <div className="stage">
      <div className="device-scaler">
        <div className="device">
          <div className="screen" data-theme={theme}>
            {!started ? (
              <Onboarding onDone={enter} />
            ) : (
              <div className="app-root">
                <Starfield count={72} />
                <StatusBar />
                {tab === 'home' && <Dashboard identities={identities} drift={drift} coach={M.COACH} sessions={sessions} onTap={openLog} onLog={openLog} onToggleApp={toggleDriftApp} />}
                {tab === 'insights' && <Insights identities={identities} drift={drift} insights={M.INSIGHTS} coach={M.COACH} onLog={openLog} />}
                {tab === 'reflect' && <Reflect identities={identities} drift={drift} reflection={M.REFLECTION} trend={M.TREND} days={M.DAYS} />}
                {tab === 'identities' && <Identities identities={identities} setIdentities={setIdentities} drift={drift} onAdd={addIdentity} onReplayIntro={restart} theme={theme} setTheme={setTheme} />}
                <TabBar tab={tab} setTab={goTo} onLog={() => openLog(null)} />
                <LogSheet open={logOpen} identities={identities} preset={logPreset} onClose={() => setLogOpen(false)} onCommit={commitLog} />
                <div className={'toast' + (toast ? ' show' : '')}>
                  {toast && <><span className="glyph" style={{ width: 24, height: 24, background: toast.color, fontSize: 12 }}>{toast.glyph}</span>{toast.mins}m of {toast.name} logged</>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
