/* Rule-based "A note from Cosmo" — a gentle weekly reflection assembled from the
   user's own data (lead/lag, neglect, streaks, vs. last week). Deterministic,
   on-device, no LLM. Picks the most salient story and tells it in the app's
   no-guilt voice. Returns { date, note }. */

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function today() {
  const d = new Date();
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

const days = (n) => `${n} day${n === 1 ? '' : 's'}`;
// added but never logged (new identities seed lastActiveDays = 99)
const neverTended = (i) => i.actual === 0 && i.lastActiveDays >= 30;

export function coachNote(identities, lastWeekRows) {
  const date = today();
  const list = identities || [];
  const rows = lastWeekRows || [];
  const behindLast = (id) => {
    const r = rows.find((x) => x.id === id);
    return r ? r.actual < r.plan : false; // false when there's no history (brand new)
  };

  if (list.length === 0) {
    return { date, note: 'Your cosmos is quiet right now — no identities to tend. Add one and give it a little of your week; that’s where Cosmo begins.' };
  }

  // 0 — nothing logged yet this week (fresh start, or every identity brand new).
  const anyTended = list.some((i) => i.actual > 0 || i.streak > 0);
  if (!anyTended) {
    return { date, note: 'A fresh start. Your identities are set — give one of them a little of your week, and watch your cosmos come to life.' };
  }

  const byOver = [...list].sort((a, b) => b.actual - b.desired - (a.actual - a.desired));
  const lead = byOver[0];
  const lag = byOver[byOver.length - 1];
  const neglected = [...list].sort((a, b) => b.lastActiveDays - a.lastActiveDays)[0];
  const streaker = [...list].sort((a, b) => b.streak - a.streak)[0];

  // 1 — a single identity: no lead/lag contrast to draw.
  if (list.length === 1) {
    const i = list[0];
    return {
      date,
      note: i.desired <= 0 || i.actual >= i.desired
        ? `${i.name} is right where you intended this week — a steady, single focus.`
        : `You’re giving ${i.name} steady attention this week. A little more would bring it to your intention.`,
    };
  }

  // 2 — everything met: rare, celebratory, no nudge.
  if (list.every((i) => i.desired <= 0 || i.actual >= i.desired)) {
    return { date, note: 'Every identity has had its share of you this week — a whole, rare balance. Nothing to fix here; just keep the rhythm that got you here.' };
  }

  // 3 — a neglected (or brand-new) identity: open with warmth, then a gentle nudge.
  if (neglected.lastActiveDays >= 5) {
    const open = streaker.streak >= 3 && streaker.id !== neglected.id
      ? `${streaker.name} is carrying your week — ${days(streaker.streak)} running. `
      : lead.id !== neglected.id && lead.actual > lead.desired
      ? `${lead.name} has led your hours this week. `
      : '';
    if (neverTended(neglected)) {
      return { date, note: `${open}${neglected.name} is still waiting for its first session — whenever you’re ready to begin.` };
    }
    const trend = behindLast(neglected.id) ? ', and it was quiet last week too' : '';
    return { date, note: `${open}${neglected.name} has gone ${days(neglected.lastActiveDays)} untended${trend} — a short session would reawaken it, no guilt attached.` };
  }

  // 4 — well balanced: small total gap and nothing badly neglected.
  const totalGap = list.reduce((s, i) => s + Math.abs(i.desired - i.actual), 0);
  if (totalGap <= list.length * 4) {
    return { date, note: 'Your week is finding its balance — most identities are close to what you intended. Keep tending whatever feels most alive; the rest will follow.' };
  }

  // 5 — general lead / lag.
  const trend = behindLast(lag.id) ? ' two weeks running' : '';
  return { date, note: `Your hours are leaning toward ${lead.name}. ${lag.name} sits furthest below your intention${trend} — a little time there would even things out, when you’re ready.` };
}

/* The Reflect screen's "In a sentence" recap: a summary line + a few concrete
   "win" chips, all derived from the data (streaks, met intentions, who showed
   up). Returns { summary, wins }. New/untended identities never produce a win. */
export function weekSummary(identities, lastWeekRows) {
  const list = identities || [];

  if (list.length === 0) {
    return { summary: 'No identities to reflect on yet — add one, and a week of tending will start to take shape here.', wins: [] };
  }

  const tended = list.filter((i) => i.actual > 0);
  const met = list.filter((i) => i.desired > 0 && i.actual >= i.desired);
  const byOver = [...list].sort((a, b) => b.actual - b.desired - (a.actual - a.desired));
  const lead = byOver[0];
  const lag = byOver[byOver.length - 1];
  const neglected = [...list].sort((a, b) => b.lastActiveDays - a.lastActiveDays)[0];
  const allMet = list.every((i) => i.desired <= 0 || i.actual >= i.desired);
  const totalGap = list.reduce((s, i) => s + Math.abs(i.desired - i.actual), 0);

  let summary;
  if (!tended.length) {
    summary = 'A quiet week so far — your identities are waiting. A single session is enough to begin the story.';
  } else if (list.length === 1) {
    const i = list[0];
    summary = i.desired <= 0 || i.actual >= i.desired
      ? `A focused week, all of it for ${i.name} — right where you meant it to be.`
      : `A week given to ${i.name}, building steadily toward what you intended.`;
  } else if (allMet) {
    summary = `A whole week: every identity got its share of you. ${lead.name} led, but nothing was left waiting.`;
  } else if (totalGap <= list.length * 4) {
    summary = `A balanced week — your hours landed close to your intentions, with ${lead.name} just ahead and ${lag.name} just behind.`;
  } else if (neglected.lastActiveDays >= 5 && !neverTended(neglected)) {
    summary = `A week that leaned toward ${lead.name}, while ${neglected.name} slipped to the edges — a shape that’s yours to even out.`;
  } else {
    summary = `${lead.name} carried this week; ${lag.name} had the least of you. Not a failure — just where your hours happened to fall.`;
  }

  // wins, in priority order, capped at 3 — concrete and earned
  const wins = [];
  const used = new Set();
  [...list].filter((i) => i.streak >= 3).sort((a, b) => b.streak - a.streak).slice(0, 2).forEach((i) => {
    wins.push(`${i.streak}-day ${i.name} streak`);
    used.add(i.id);
  });
  met.filter((i) => !used.has(i.id)).slice(0, Math.max(0, 3 - wins.length)).forEach((i) => {
    wins.push(`${i.name} tended in full`);
    used.add(i.id);
  });
  if (!wins.length && tended.length) {
    wins.push(`Showed up for ${tended.length} ${tended.length === 1 ? 'identity' : 'identities'}`);
  }

  return { summary, wins: wins.slice(0, 3) };
}

/* Reflect hero — last completed week vs. the one before. { week, aligned, delta, note } */
export function lastWeekTrend(weeks) {
  const list = weeks || [];
  if (list.length === 0) {
    return { week: '—', aligned: 0, delta: 0, note: 'No completed weeks yet. Your first reflection will appear here.' };
  }
  const last = list[0];
  const prev = list[1];
  const delta = prev ? last.aligned - prev.aligned : 0;
  let note;
  if (!prev) note = 'Your first full week, lived and logged — a starting point to build from.';
  else if (delta > 0) note = 'Closer than the week before — your intentions and your hours are converging.';
  else if (delta < 0) note = 'A little further from your intentions than the week before — an easy week to re-center.';
  else note = 'Holding steady with the week before — a consistent rhythm.';
  return { week: last.label, aligned: last.aligned, delta, note };
}

/* Insights tab — rebalancing observations generated from the live identities
   (no demo data). Returns up to three cards in the same shape the screen renders:
   { kind, id, title, body, action }. `kind` drives only the icon; the card's
   color comes from the identity itself. Returns [] when there's nothing honest
   to say yet (e.g. a fresh week with nothing logged). */
export function buildInsights(identities) {
  const list = identities || [];
  if (!list.length) return [];

  const byOver = [...list].sort((a, b) => b.actual - b.desired - (a.actual - a.desired));
  const lead = byOver[0];
  const lag = byOver[byOver.length - 1];
  const neglected = [...list].sort((a, b) => b.lastActiveDays - a.lastActiveDays)[0];

  const out = [];

  // neglect — the longest-untended identity (or one never begun)
  if (neglected && neverTended(neglected)) {
    out.push({
      kind: 'neglect', id: neglected.id,
      title: `${neglected.name} is waiting for its first session`,
      body: 'You added it but haven’t begun. A few minutes is enough to bring it to life — whenever you’re ready.',
      action: `Begin ${neglected.name}`,
    });
  } else if (neglected && neglected.lastActiveDays >= 5 && neglected.lastActiveDays < 30) {
    out.push({
      kind: 'neglect', id: neglected.id,
      title: `${neglected.name} has been quiet for ${days(neglected.lastActiveDays)}`,
      body: 'Its longest gap lately. A short session would reawaken it — no guilt attached.',
      action: `Tend to ${neglected.name}`,
    });
  }

  // nudge — furthest below intention (when it isn't the same one we just flagged)
  if (lag && lag.desired > 0 && lag.actual < lag.desired && lag.id !== (neglected && neglected.id)) {
    out.push({
      kind: 'nudge', id: lag.id,
      title: `A short session for ${lag.name} today`,
      body: `would bring it back within reach of your ${lag.desired}% intention.`,
      action: `Tend to ${lag.name}`,
    });
  }

  // balance — carrying the week, comfortably above intention
  if (lead && lead.desired > 0 && lead.actual > lead.desired && lead.id !== lag.id) {
    out.push({
      kind: 'balance', id: lead.id,
      title: `${lead.name} is carrying the week`,
      body: `It’s ${lead.actual - lead.desired} points above your intention. Nothing wrong — just worth noticing.`,
      action: null,
    });
  }

  return out.slice(0, 3);
}

/* "Where to lean next week" — the identities furthest below their intention. */
export function focusIdentities(identities, max = 2) {
  return (identities || [])
    .filter((i) => i.desired > 0 && i.actual < i.desired)
    .sort((a, b) => a.actual - a.desired - (b.actual - b.desired)) // most below first
    .slice(0, max);
}
