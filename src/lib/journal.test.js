import { autoMilestones, resurface, buildFeed, journalState } from './journal';
import { weekStartMs } from '../data/data';

const DAY = 86400000;

describe('autoMilestones (derived, deterministic)', () => {
  test('empty when there are no sessions', () => {
    expect(autoMilestones([{ id: 'w', name: 'Writer', desired: 20 }], [])).toEqual([]);
  });

  test('first session, hour thresholds, and unique keys', () => {
    const now = Date.now();
    const ids = [{ id: 'eng', name: 'Engineer', desired: 20 }];
    const sessions = [
      { id: 'eng', sid: '1', ts: now - 5 * DAY, mins: 300, label: 'Coding' },
      { id: 'eng', sid: '2', ts: now - 4 * DAY, mins: 360 }, // cumulative 11h → crosses 10
    ];
    const keys = autoMilestones(ids, sessions, { now }).map((m) => m.key);
    expect(keys).toContain('first-session');
    expect(keys).toContain('hours-eng-10');
    expect(new Set(keys).size).toBe(keys.length); // each milestone fires once
  });

  test('a 7-day streak is detected', () => {
    const now = Date.now();
    const ids = [{ id: 'r', name: 'Reader', desired: 20 }];
    const sessions = Array.from({ length: 7 }, (_, i) => ({ id: 'r', sid: `s${i}`, ts: now - (7 - i) * DAY, mins: 30 }));
    expect(autoMilestones(ids, sessions, { now }).map((m) => m.key)).toContain('streak-r-7');
  });

  test('intention met this week emits a milestone', () => {
    const now = Date.now();
    const ws = weekStartMs(now);
    const ids = [{ id: 'w', name: 'Writer', desired: 2 }];
    const sessions = [{ id: 'w', sid: 'a', ts: ws + DAY, mins: 60 }]; // 5 pts ≥ 2
    expect(autoMilestones(ids, sessions, { now }).some((m) => m.key.startsWith('intention-'))).toBe(true);
  });

  test('Relaxation sessions are ignored', () => {
    const now = Date.now();
    const ms = autoMilestones([{ id: 'w', name: 'Writer', desired: 5 }], [{ id: 'relax', sid: 'x', ts: now - DAY, mins: 60 }], { now });
    expect(ms).toEqual([]);
  });
});

describe('resurface (verbatim juxtaposition, no interpretation)', () => {
  test('pairs a milestone with the earliest earlier note for that identity', () => {
    const now = Date.now();
    const entries = [
      { id: 'n1', identityId: 'w', type: 'note', text: 'showed up', ts: now - 40 * DAY },
      { id: 'm1', identityId: 'w', type: 'milestone', text: 'finished it', ts: now - 2 * DAY },
    ];
    const sessions = [{ id: 'w', ts: now - 30 * DAY }, { id: 'w', ts: now - 10 * DAY }];
    const r = resurface(entries, sessions);
    expect(r.then.text).toBe('showed up'); // verbatim
    expect(r.now.text).toBe('finished it'); // verbatim
    expect(r.spanWeeks).toBeGreaterThanOrEqual(5);
    expect(r.sessionCount).toBe(2);
  });

  test('null when a milestone has no earlier note', () => {
    expect(resurface([{ id: 'm', identityId: 'w', type: 'milestone', text: 'x', ts: 1 }], [])).toBeNull();
  });
});

describe('journalState + buildFeed', () => {
  test('routes cold / seeded / full by content', () => {
    expect(journalState([], [])).toBe('cold');
    expect(journalState([], [{ key: 'a' }])).toBe('seeded');
    expect(journalState([{ id: '1' }], [])).toBe('full');
  });

  test('buildFeed merges user + auto + cosmo, newest first, tagged by kind', () => {
    const feed = buildFeed({
      entries: [{ id: '1', type: 'note', text: 'a', ts: 500, identityId: 'w' }],
      autoMs: [{ key: 'k', ts: 800, title: 'x', sub: 'y' }],
      coachNote: 'weekly note',
      now: 1000000,
    });
    expect(feed[0].ts).toBeGreaterThanOrEqual(feed[feed.length - 1].ts);
    expect(feed.map((r) => r.kind)).toEqual(expect.arrayContaining(['note', 'auto', 'cosmo']));
  });

  test('buildFeed surfaces insights as cosmo rows (no CTA), tagged to their identity', () => {
    const feed = buildFeed({
      entries: [],
      autoMs: [],
      insights: [{ kind: 'balance', id: 'eng', title: 'Engineer is carrying the week', body: 'It’s 8 points above your intention.' }],
      now: 1000000,
    });
    const row = feed.find((r) => r.kind === 'cosmo' && r.identityId === 'eng');
    expect(row).toBeTruthy();
    expect(row.text).toContain('Engineer is carrying the week');
    expect(row.action).toBeUndefined(); // no call-to-action in the feed
  });
});
