import { scheduleWeek, retimeSession, moveSessionToDay, removeSession, scheduleSummary, clockLabel } from './schedule';

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
