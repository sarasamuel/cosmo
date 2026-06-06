/* MOSAIC data model — plain globals */
(function () {
  const IDENTITIES = [
    { id: 'writer',   name: 'Writer',   glyph: 'W', hue: 254, color: 'var(--c-writer)',   soft: 'var(--c-writer-soft)',   deep: '#3f53a6', desired: 25, actual: 12, lastActiveDays: 1,  streak: 3 },
    { id: 'reader',   name: 'Reader',   glyph: 'R', hue: 46,  color: 'var(--c-reader)',   soft: 'var(--c-reader-soft)',   deep: '#b85b2c',  desired: 20, actual: 8,  lastActiveDays: 2,  streak: 0 },
    { id: 'engineer', name: 'Engineer', glyph: 'E', hue: 168, color: 'var(--c-engineer)', soft: 'var(--c-engineer-soft)', deep: '#1f7d5e', desired: 20, actual: 28, lastActiveDays: 0,  streak: 9 },
    { id: 'musician', name: 'Musician', glyph: 'M', hue: 326, color: 'var(--c-musician)', soft: 'var(--c-musician-soft)', deep: '#9b3b7d', desired: 20, actual: 5,  lastActiveDays: 4,  streak: 0 },
    { id: 'painter',  name: 'Painter',  glyph: 'P', hue: 80,  color: 'var(--c-painter)',  soft: 'var(--c-painter-soft)',  deep: '#9a7a24',  desired: 15, actual: 3,  lastActiveDays: 8,  streak: 0 },
  ];

  // ---- Drift: the unintended time sink, made of the apps a user opts to track ----
  // Each tracked app's usage rolls up into the single Drift bucket shown in the
  // portfolio and every metric. pct = share of waking time; mins = this week.
  const DRIFT_APPS = [
    { id: 'instagram', name: 'Instagram',    glyph: 'I', pct: 13, mins: 184, tracked: true  },
    { id: 'tiktok',    name: 'TikTok',       glyph: 'T', pct: 10, mins: 142, tracked: true  },
    { id: 'games',     name: 'Mobile games', glyph: 'G', pct: 9,  mins: 121, tracked: true  },
    { id: 'youtube',   name: 'YouTube',      glyph: 'Y', pct: 7,  mins: 96,  tracked: false },
    { id: 'x',         name: 'X',            glyph: 'X', pct: 5,  mins: 64,  tracked: false },
    { id: 'reddit',    name: 'Reddit',       glyph: 'R', pct: 4,  mins: 58,  tracked: false },
    { id: 'facebook',  name: 'Facebook',     glyph: 'F', pct: 3,  mins: 41,  tracked: false },
  ];
  const driftSum = (apps) => apps.filter(a => a.tracked).reduce((s, a) => s + a.pct, 0);
  function fmtMins(m) {
    const h = Math.floor(m / 60), mm = Math.round(m % 60);
    if (!h) return mm + 'm';
    if (!mm) return h + 'h';
    return h + 'h ' + mm + 'm';
  }

  // non-identity time sink (drift) — an aggregate of the tracked apps above
  const DRIFT = {
    id: 'drift', name: 'Drift', glyph: '∞', hue: 280,
    color: 'var(--c-drift)', soft: 'var(--c-drift-soft)', deep: '#4a4757',
    desired: 0, actual: driftSum(DRIFT_APPS), apps: DRIFT_APPS,
  };

  // catalog for onboarding
  const CATALOG = [
    'Writer', 'Reader', 'Engineer', 'Musician', 'Painter',
    'Athlete', 'Chef', 'Photographer', 'Gardener', 'Linguist',
    'Designer', 'Filmmaker', 'Dancer', 'Naturalist', 'Poet',
    'Free Time',
  ];

  // recent logged sessions (most recent first)
  const SESSIONS = [
    { id: 'engineer', label: 'Coding',          mins: 90, when: 'Today · 9:10 AM' },
    { id: 'reader',   label: 'Reading',         mins: 25, when: 'Today · 7:40 AM' },
    { id: 'musician', label: 'Piano practice',  mins: 30, when: 'Yesterday · 8:15 PM' },
    { id: 'engineer', label: 'Coding',          mins: 75, when: 'Yesterday · 2:00 PM' },
    { id: 'writer',   label: 'Morning pages',   mins: 20, when: 'Yesterday · 6:55 AM' },
    { id: 'painter',  label: 'Watercolor',      mins: 60, when: 'May 30 · 4:30 PM' },
  ];

  // weekly trend, fraction of each day given to the identity (for sparklines)
  const TREND = {
    writer:   [0.30, 0.10, 0.0,  0.15, 0.12, 0.05, 0.10],
    reader:   [0.10, 0.05, 0.20, 0.0,  0.08, 0.06, 0.04],
    engineer: [0.20, 0.40, 0.45, 0.35, 0.30, 0.22, 0.18],
    musician: [0.05, 0.0,  0.0,  0.10, 0.0,  0.06, 0.05],
    painter:  [0.0,  0.0,  0.05, 0.0,  0.0,  0.0,  0.02],
  };
  const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  // rebalancing insights
  const INSIGHTS = [
    { kind: 'neglect', id: 'painter',  title: 'Painter has been quiet for 8 days', body: 'Your longest gap this month. A short session would reawaken it.', action: 'Log 30m painting' },
    { kind: 'nudge',   id: 'writer',   title: 'A 30-minute writing session today', body: 'would bring Writer back within reach of your 25% intention.', action: 'Start writing' },
    { kind: 'trade',   id: 'drift',    title: '3 hours on Instagram this week', body: 'is roughly equal to 4 writing sessions, or 6 piano practices.', action: 'Set a gentle limit' },
    { kind: 'balance', id: 'engineer', title: 'Engineer is carrying the week', body: 'It is 8 points above your intention. Nothing wrong — just worth noticing.', action: null },
  ];

  // coach daily note + weekly reflection lines
  const COACH = {
    date: 'Thursday, June 4',
    note: 'This week your hours leaned toward Engineer more than Writer. That isn’t failure — deadlines pull. But your happiest logged days this month each held both reading and music. A small evening for either might be worth more than it costs.',
    signoff: 'Cosmo',
  };

  const REFLECTION = {
    week: 'May 29 – Jun 4',
    summary: 'A productive, head-down week. Engineering momentum was real, but three of your five identities went mostly untended. The good news: your mornings are working — every writing and reading session this week happened before noon.',
    wins: ['9-day Engineer streak', 'Every reading session before noon', 'Returned to morning pages twice'],
    focus: ['painter', 'musician'],
    aligned: 53,
    alignedLast: 47,
  };

  // helpers
  function alignment(list) {
    // 100 - half the total absolute drift, including the drift bucket
    let diff = 0;
    list.forEach(i => { diff += Math.abs(i.desired - i.actual); });
    diff += DRIFT.actual; // drift desired is 0
    return Math.max(0, Math.round(100 - diff / 2));
  }

  /* ---- unique-color palette system ----
     Well-separated hues; the first five match the canonical identities so the
     onboarding demo keeps its signature look. New personas draw the next hue
     that is far enough from every hue already in use (golden-angle fallback),
     so no two personas ever share a color. */
  const PALETTE_HUES = [254, 46, 168, 326, 80, 22, 132, 292, 200, 104, 350, 230, 60, 150, 312, 8, 188, 270];
  function mkColor(hue) {
    const h = ((hue % 360) + 360) % 360;
    return {
      hue: h,
      color: `oklch(0.70 0.12 ${h})`,
      soft:  `oklch(0.70 0.12 ${h} / 0.16)`,
      deep:  `oklch(0.52 0.13 ${h})`,
    };
  }
  const PALETTE = PALETTE_HUES.map(mkColor);
  function hueDist(a, b) { let d = Math.abs(((a - b) % 360 + 360) % 360); return d > 180 ? 360 - d : d; }
  function assignColor(existing) {
    const used = (existing || []).map(i => i.hue).filter(h => h != null);
    for (const p of PALETTE) { if (used.every(u => hueDist(u, p.hue) > 22)) return { ...p }; }
    // palette exhausted: choose the hue that is maximally far from every used hue
    let best = 0, bestMin = -1;
    for (let c = 0; c < 360; c += 1) {
      const m = used.length ? Math.min(...used.map(u => hueDist(u, c))) : 180;
      if (m > bestMin) { bestMin = m; best = c; }
    }
    return mkColor(best);
  }
  function paletteColor(index) { return PALETTE[((index % PALETTE.length) + PALETTE.length) % PALETTE.length]; }

  window.MOSAIC = {
    USER: { name: 'Sara' },
    IDENTITIES, DRIFT, DRIFT_APPS, CATALOG, SESSIONS, TREND, DAYS, INSIGHTS, COACH, REFLECTION, DAYS,
    alignment, driftSum, fmtMins, PALETTE, assignColor, paletteColor, mkColor,
  };
})();
