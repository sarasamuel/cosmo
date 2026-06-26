import { scheduleWeek, retimeSession, setSessionTime, placeSession, moveSessionToDay, removeSession, scheduleSummary, clockLabel, clockLabelHM } from './schedule';

const IDS = [
  { id: 'writer', name: 'Writer', glyph: 'W', desired: 30 },
  { id: 'reader', name: 'Reader', glyph: 'R', desired: 10 },
];
const NOW = 1718000000000; // fixed → deterministic
const base = { identities: IDS, sessions: [], freeHours: 10, now: NOW };
const con = (over) => ({ identities: ['writer', 'reader'], fullness: 'balanced', hoursPerWeek: 10, windows: ['mornings', 'daytime', 'evenings', 'weekends'], shape: 'deep', protect: [], ...over });

describe('scheduleWeek — shape & determinism', () => {
  test('always returns 7 day rows', () => {
    expect(scheduleWeek(con(), base)).toHaveLength(7);
  });

  test('is deterministic (same inputs → identical plan)', () => {
    const a = scheduleWeek(con(), base);
    const b = scheduleWeek(con(), base);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test('weights minutes by each identity\'s intention (Writer 30% > Reader 10%)', () => {
    const sum = scheduleSummary(scheduleWeek(con(), base));
    expect(sum.perIdentity.writer).toBeGreaterThan(sum.perIdentity.reader);
  });

  test('no targets → an empty (but well-formed) week', () => {
    const plan = scheduleWeek(con({ identities: [] }), { ...base, identities: [{ id: 'x', name: 'X', desired: 0 }] });
    expect(plan).toHaveLength(7);
    expect(scheduleSummary(plan).sessionCount).toBe(0);
  });
});

describe('scheduleWeek — learns the logged rhythm (weekday + time of day)', () => {
  // a session for `id` on a given weekday (0=Sun) at a given clock hour
  const sess = (id, dow, hour, n = 0) => {
    const d = new Date(2024, 5, 2); // Sun Jun 2 2024
    d.setDate(d.getDate() + dow);
    d.setHours(hour, 0, 0, 0);
    return { id, sid: `${id}-${dow}-${hour}-${n}`, ts: d.getTime(), mins: 30 };
  };
  const writerSessions = (plan) => plan.flatMap((d, idx) => d.sessions.filter((s) => s.identityId === 'writer').map((s) => ({ ...s, idx, dowIndex: d.dowIndex })));
  const allWindows = { identities: ['writer'], fullness: 'balanced', hoursPerWeek: 3, windows: ['mornings', 'daytime', 'evenings', 'weekends'], shape: 'deep', protect: [] };

  test('an evening-logger gets evening sessions, at its usual hour (not the canonical 7pm)', () => {
    const sessions = [0, 1, 2, 3, 4].map((dw) => sess('writer', dw, 20)); // always 8pm
    const got = writerSessions(scheduleWeek(allWindows, { ...base, sessions }));
    expect(got.length).toBeGreaterThan(0);
    expect(got.every((s) => s.window === 'evenings')).toBe(true);
    expect(got.every((s) => s.hour === 20)).toBe(true); // personalized modal hour, not 19
  });

  test('a morning-logger gets morning sessions at its usual early hour', () => {
    const sessions = [0, 1, 2, 3, 4].map((dw) => sess('writer', dw, 6)); // always 6am
    const got = writerSessions(scheduleWeek(allWindows, { ...base, sessions }));
    expect(got.length).toBeGreaterThan(0);
    expect(got.every((s) => s.window === 'mornings')).toBe(true);
    expect(got.every((s) => s.hour === 6)).toBe(true); // not the canonical 8am
  });

  test('weekday rhythm is honored (the now-fixed dow signal): a Tuesday-logger loads Tuesday most', () => {
    // spread hours across windows so the time-of-day signal is neutral; only the
    // weekday (always Tuesday) is distinctive.
    const sessions = [8, 13, 20, 8, 13, 20].map((h, n) => sess('writer', 2, h, n));
    const got = writerSessions(scheduleWeek(allWindows, { ...base, sessions }));
    const byDay = {};
    got.forEach((s) => { byDay[s.dowIndex] = (byDay[s.dowIndex] || 0) + 1; });
    const busiest = Object.keys(byDay).sort((a, b) => byDay[b] - byDay[a])[0];
    expect(Number(busiest)).toBe(2); // Tuesday
  });

  test('with no history it stays deterministic and uses canonical window hours', () => {
    const got = writerSessions(scheduleWeek(allWindows, { ...base, sessions: [] }));
    expect(got.length).toBeGreaterThan(0);
    got.forEach((s) => expect([8, 13, 19]).toContain(s.hour)); // canonical fallbacks
  });
});

describe('scheduleWeek — protect constraints are honored strictly', () => {
  test('rest-day leaves exactly one eligible day truly empty', () => {
    const plan = scheduleWeek(con({ protect: ['rest-day'] }), base);
    const rest = plan.filter((d) => d.rest);
    expect(rest).toHaveLength(1);
    expect(rest[0].sessions).toHaveLength(0);
  });

  test('calm-mornings → no morning sessions', () => {
    const plan = scheduleWeek(con({ protect: ['calm-mornings'], windows: ['mornings', 'daytime'] }), base);
    expect(plan.flatMap((d) => d.sessions).some((s) => s.window === 'mornings' || s.hour < 9)).toBe(false);
  });

  test('family-evenings → no evening sessions', () => {
    const plan = scheduleWeek(con({ protect: ['family-evenings'], windows: ['daytime', 'evenings'] }), base);
    expect(plan.flatMap((d) => d.sessions).some((s) => s.window === 'evenings')).toBe(false);
  });

  test('weekdays-only when weekends not selected', () => {
    const plan = scheduleWeek(con({ windows: ['daytime'] }), base);
    expect(plan.filter((d) => d.dowIndex === 0 || d.dowIndex === 6).flatMap((d) => d.sessions)).toHaveLength(0);
  });

  test('weekends become eligible when selected', () => {
    const plan = scheduleWeek(con({ windows: ['weekends', 'daytime'], shape: 'short', fullness: 'ambitious' }), base);
    // with a dense plan and weekends allowed, at least one weekend session lands
    expect(plan.filter((d) => d.dowIndex === 0 || d.dowIndex === 6).flatMap((d) => d.sessions).length).toBeGreaterThan(0);
  });
});

describe('retimeSession', () => {
  test('moves one session to the chosen window and re-sorts the day', () => {
    const plan = scheduleWeek(con({ windows: ['daytime'] }), base);
    const di = plan.findIndex((d) => d.sessions.length === 1);
    const moved = retimeSession(plan, di, 0, 'evenings', con());
    expect(moved[di].sessions[0].window).toBe('evenings');
    expect(moved[di].sessions[0].time).toBe(clockLabel(19));
  });

  test('refuses to move into a protected window (calm mornings)', () => {
    const plan = scheduleWeek(con({ windows: ['daytime'] }), base);
    const di = plan.findIndex((d) => d.sessions.length >= 1);
    const same = retimeSession(plan, di, 0, 'mornings', con({ protect: ['calm-mornings'] }));
    expect(same[di].sessions[0].window).not.toBe('mornings');
  });

  test('SWAPS with the occupant when the target window is taken (no silent no-op)', () => {
    // a full day: one morning + one evening session sharing the day
    const plan = scheduleWeek(con({ windows: ['mornings', 'evenings', 'weekends'], shape: 'mix' }), base);
    const di = plan.findIndex((d) => !d.rest && d.sessions.length === 2 && d.sessions.some((s) => s.window === 'mornings') && d.sessions.some((s) => s.window === 'evenings'));
    expect(di).toBeGreaterThanOrEqual(0); // the engine fills both windows → full day exists
    const mornIdx = plan[di].sessions.findIndex((s) => s.window === 'mornings');
    const eveId = plan[di].sessions.find((s) => s.window === 'evenings').identityId;
    const mornId = plan[di].sessions[mornIdx].identityId;
    // move the morning session to evenings → they swap, and the plan actually changes
    const out = retimeSession(plan, di, mornIdx, 'evenings', con());
    expect(out).not.toBe(plan); // not a silent no-op
    const nowEve = out[di].sessions.find((s) => s.window === 'evenings');
    const nowMorn = out[di].sessions.find((s) => s.window === 'mornings');
    expect(nowEve.identityId).toBe(mornId); // mine took evening
    expect(nowMorn.identityId).toBe(eveId); // the occupant took my morning
    expect(out[di].sessions).toHaveLength(2); // nothing stacked or lost
  });
});

describe('setSessionTime (hand-picked exact time)', () => {
  test('sets the exact hour/minute, derives the window, and labels with minutes', () => {
    const plan = scheduleWeek(con({ windows: ['daytime'] }), base);
    const di = plan.findIndex((d) => d.sessions.length === 1);
    const out = setSessionTime(plan, di, 0, 7, 30, con()); // 7:30 AM → mornings
    expect(out[di].sessions[0].hour).toBe(7);
    expect(out[di].sessions[0].min).toBe(30);
    expect(out[di].sessions[0].window).toBe('mornings');
    expect(out[di].sessions[0].time).toBe(clockLabelHM(7, 30));
  });

  test('re-sorts the day chronologically after a time change', () => {
    // a two-session day; push the later one to an early morning time
    const plan = scheduleWeek(con({ windows: ['mornings', 'evenings', 'weekends'], shape: 'mix' }), base);
    const di = plan.findIndex((d) => !d.rest && d.sessions.length === 2);
    const out = setSessionTime(plan, di, 1, 6, 15, con()); // move 2nd session to 6:15 AM
    const times = out[di].sessions.map((s) => s.hour * 60 + (s.min || 0));
    expect(times[0]).toBeLessThanOrEqual(times[1]); // sorted ascending by clock time
  });

  test('refuses a time inside a protected window (family evenings)', () => {
    const plan = scheduleWeek(con({ windows: ['daytime'] }), base);
    const di = plan.findIndex((d) => d.sessions.length >= 1);
    const same = setSessionTime(plan, di, 0, 20, 0, con({ protect: ['family-evenings'] })); // 8 PM = evenings
    expect(same).toBe(plan); // unchanged
  });
});

describe('placeSession (day + exact time, committed together)', () => {
  test('moves to a new day AND keeps the hand-picked time', () => {
    const plan = scheduleWeek(con({ windows: ['daytime'] }), base);
    const from = plan.findIndex((d) => !d.rest && d.sessions.length >= 1);
    const to = plan.findIndex((d, i) => i !== from && !d.rest);
    const id = plan[from].sessions[0].identityId;
    const out = placeSession(plan, from, 0, to, 7, 45, con()); // 7:45 AM on another day
    const moved = out[to].sessions.find((s) => s.identityId === id);
    expect(moved).toBeTruthy();
    expect(moved.hour).toBe(7);
    expect(moved.min).toBe(45);
    expect(moved.time).toBe(clockLabelHM(7, 45));
    expect(out[from].sessions.find((s) => s.identityId === id)).toBeUndefined(); // left the old day
  });

  test('same-day call just sets the time in place', () => {
    const plan = scheduleWeek(con({ windows: ['daytime'] }), base);
    const di = plan.findIndex((d) => d.sessions.length === 1);
    const out = placeSession(plan, di, 0, di, 9, 0, con());
    expect(out[di].sessions[0].hour).toBe(9);
    expect(out[di].sessions[0].min).toBe(0);
  });

  test('refuses a rest-day destination', () => {
    const plan = scheduleWeek(con({ windows: ['daytime'], protect: ['rest-day'] }), base);
    const from = plan.findIndex((d) => !d.rest && d.sessions.length >= 1);
    const restDay = plan.findIndex((d) => d.rest);
    if (restDay === -1) return; // no rest day this run → nothing to assert
    expect(placeSession(plan, from, 0, restDay, 8, 0, con({ protect: ['rest-day'] }))).toBe(plan);
  });
});

describe('moveSessionToDay / removeSession (tap-to-move + remove)', () => {
  test('moves a session from one day to another (totals preserved)', () => {
    const plan = scheduleWeek(con({ windows: ['daytime'] }), base);
    const from = plan.findIndex((d) => d.sessions.length >= 1);
    const to = plan.findIndex((d, i) => i !== from && !d.rest && d.dowIndex !== 0 && d.dowIndex !== 6);
    const before = scheduleSummary(plan).sessionCount;
    const moved = moveSessionToDay(plan, from, 0, to, con());
    expect(moved[from].sessions.length).toBe(plan[from].sessions.length - 1);
    expect(moved[to].sessions.length).toBe(plan[to].sessions.length + 1);
    expect(scheduleSummary(moved).sessionCount).toBe(before); // none lost
  });

  test('refuses to move onto a protected rest day', () => {
    const plan = scheduleWeek(con({ protect: ['rest-day'] }), base);
    const restIdx = plan.findIndex((d) => d.rest);
    const from = plan.findIndex((d) => d.sessions.length >= 1);
    const moved = moveSessionToDay(plan, from, 0, restIdx, con({ protect: ['rest-day'] }));
    expect(moved[restIdx].sessions).toHaveLength(0); // rest day stays clear
  });

  test('removeSession drops just that one session', () => {
    const plan = scheduleWeek(con({ windows: ['daytime'] }), base);
    const di = plan.findIndex((d) => d.sessions.length >= 1);
    const before = scheduleSummary(plan).sessionCount;
    const out = removeSession(plan, di, 0);
    expect(out[di].sessions.length).toBe(plan[di].sessions.length - 1);
    expect(scheduleSummary(out).sessionCount).toBe(before - 1);
  });
});

describe('scheduleSummary', () => {
  test('counts sessions, minutes, and names the rest day', () => {
    const plan = scheduleWeek(con({ protect: ['rest-day'] }), base);
    const sum = scheduleSummary(plan);
    expect(sum.sessionCount).toBe(plan.flatMap((d) => d.sessions).length);
    expect(sum.totalMins).toBeGreaterThan(0);
    expect(typeof sum.restDay).toBe('string');
  });
});
