import {
  mergeSessions, newSessionId, fmtAgo, SESSION_POINTS, alignment,
  weekStartMs, lastWeekStartMs, inWeek, weekPoints,
  planForWeek, pastWeeks, recentWeeksFor, daysSinceLast, dayStreak,
} from './data';

const DAY = 86400000;
const idn = (id, desired) => ({ id, name: id, glyph: id[0].toUpperCase(), desired });

describe('mergeSessions (multi-device safety)', () => {
  test('unions distinct sessions, newest first', () => {
    const a = [{ id: 'w', sid: '1', ts: 300, mins: 30 }, { id: 'e', sid: '2', ts: 200, mins: 60 }];
    const b = [{ id: 'e', sid: '2', ts: 200, mins: 60 }, { id: 'r', sid: '3', ts: 100, mins: 20 }];
    expect(mergeSessions(a, b).map((s) => s.sid)).toEqual(['1', '2', '3']);
  });

  test('dedupes by sid; keeps genuinely distinct sids', () => {
    expect(mergeSessions([{ id: 'w', sid: 'x', ts: 5, mins: 30 }], [{ id: 'w', sid: 'x', ts: 5, mins: 30 }])).toHaveLength(1);
    expect(mergeSessions([{ id: 'w', sid: 'a', ts: 5, mins: 30 }], [{ id: 'w', sid: 'b', ts: 5, mins: 30 }])).toHaveLength(2);
  });

  test('legacy sessions without sid fall back to the content key', () => {
    expect(mergeSessions(
      [{ id: 'w', ts: 5, mins: 30, label: 'p' }],
      [{ id: 'w', ts: 5, mins: 30, label: 'p' }],
    )).toHaveLength(1);
  });

  test('handles null/empty inputs and drops entries without ts', () => {
    expect(mergeSessions(null, [{ id: 'w', sid: '1', ts: 1, mins: 1 }])).toHaveLength(1);
    expect(mergeSessions([], null)).toHaveLength(0);
    expect(mergeSessions([{ id: 'w', sid: '1' }], [])).toHaveLength(0);
  });
});

describe('newSessionId', () => {
  test('is unique per call', () => {
    expect(newSessionId()).not.toBe(newSessionId());
  });
});

describe('fmtAgo', () => {
  const NOW = 1_000_000_000_000;
  test('buckets seconds/minutes/hours and empty', () => {
    expect(fmtAgo(NOW, NOW)).toBe('just now');
    expect(fmtAgo(NOW - 90 * 1000, NOW)).toBe('2m ago');
    expect(fmtAgo(NOW - 3 * 3600 * 1000, NOW)).toBe('3h ago');
    expect(fmtAgo(0)).toBe('');
  });
});

describe('SESSION_POINTS', () => {
  test('~12 min = 1 pt, floor of 1', () => {
    expect(SESSION_POINTS(12)).toBe(1);
    expect(SESSION_POINTS(60)).toBe(5);
    expect(SESSION_POINTS(1)).toBe(1);
    expect(SESSION_POINTS(0)).toBe(1);
  });
});

describe('alignment', () => {
  test('100 when lived matches intended', () => {
    expect(alignment([{ desired: 25, actual: 25 }, { desired: 20, actual: 20 }])).toBe(100);
  });
  test('drops by half the total gap', () => {
    expect(alignment([{ desired: 30, actual: 10 }])).toBe(90);
  });
});

describe('weekly window', () => {
  test('inWeek: now true, 8 days ago false', () => {
    const now = Date.now();
    expect(inWeek(now)).toBe(true);
    expect(inWeek(now - 8 * DAY)).toBe(false);
  });
  test('weekPoints sums only this-week sessions for the id', () => {
    const ws = weekStartMs();
    const sessions = [
      { id: 'w', ts: ws + DAY, mins: 60 },
      { id: 'w', ts: ws + 2 * DAY, mins: 36 },
      { id: 'w', ts: ws - 2 * DAY, mins: 60 }, // prior week → excluded
    ];
    expect(weekPoints(sessions, 'w')).toBe(SESSION_POINTS(60) + SESSION_POINTS(36));
  });
});

describe('plan history (planForWeek / pastWeeks / recentWeeksFor)', () => {
  const W1 = lastWeekStartMs();
  const W2 = weekStartMs(W1 - 1);
  const W0 = weekStartMs(W2 - 1);
  const ph = { [W2]: { eng: 20 }, [W1]: { eng: 30 } };
  const mid = (ws) => ws + 3 * DAY;
  const sessions = [
    { id: 'eng', sid: 'a', ts: mid(W1), mins: 75 },
    { id: 'eng', sid: 'b', ts: mid(W2), mins: 120 },
  ];

  test('planForWeek returns the plan in force, falling back to current desired', () => {
    expect(planForWeek(ph, W1, idn('eng', 99))).toBe(30);
    expect(planForWeek(ph, W2, idn('eng', 99))).toBe(20);
    expect(planForWeek(ph, W0, idn('eng', 99))).toBe(99); // older than any recorded plan
    expect(planForWeek({}, W1, idn('eng', 99))).toBe(99);
  });

  test('pastWeeks scores each completed active week against its plan', () => {
    const weeks = pastWeeks(sessions, [idn('eng', 30)], ph);
    expect(weeks).toHaveLength(2);
    expect(weeks[0].rows[0].plan).toBe(30); // last week
    expect(weeks[1].rows[0].plan).toBe(20); // two weeks ago, old plan (NOT current desired)
  });

  test('recentWeeksFor returns this identity\'s per-week history', () => {
    const rows = recentWeeksFor(sessions, idn('eng', 30), ph);
    expect(rows.map((r) => r.plan)).toEqual([30, 20]);
  });

  test('empty for a fresh user with no sessions', () => {
    expect(pastWeeks([], [idn('eng', 30)], {})).toEqual([]);
    expect(recentWeeksFor([], idn('eng', 30), {})).toEqual([]);
  });
});

describe('daysSinceLast / dayStreak', () => {
  test('daysSinceLast returns the fallback when never logged', () => {
    expect(daysSinceLast([], 'w', 99)).toBe(99);
  });
  test('dayStreak counts consecutive days including today', () => {
    const d = new Date(); d.setHours(12, 0, 0, 0);
    const sessions = [{ id: 'w', ts: d.getTime() }, { id: 'w', ts: d.getTime() - DAY }];
    expect(dayStreak(sessions, 'w')).toBe(2);
  });
});
