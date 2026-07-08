import { buildNeglectItems, buildSessionItems, NEGLECT_DAYS } from './nudges';

const DAY = 86400000;
const NOW = new Date(2026, 6, 8, 12, 0, 0).getTime(); // Wed Jul 8 2026, noon (local)
const sess = (id, daysAgo) => ({ id, sid: `${id}-${daysAgo}`, ts: NOW - daysAgo * DAY, mins: 30 });

describe('buildNeglectItems (drill sergeant neglect nudges)', () => {
  const writer = { id: 'writer', name: 'Writer', desired: 20 };

  test('an identity logged recently gets a nudge at lastSession + threshold', () => {
    const [item] = buildNeglectItems([writer], [sess('writer', 1)], NOW);
    expect(item.identityId).toBe('writer');
    // crossing = 1 day ago + 3 days = 2 days from now → in the future, kept
    expect(item.date.getTime()).toBeGreaterThan(NOW);
    expect(item.title).toBe(`Writer: ${NEGLECT_DAYS} days untended.`);
  });

  test('an already-crossed identity fires tomorrow, never in the past or instantly', () => {
    const [item] = buildNeglectItems([writer], [sess('writer', 10)], NOW);
    expect(item.date.getTime()).toBeGreaterThan(NOW);
    expect(item.date.getTime()).toBeLessThan(NOW + 2 * DAY);
    expect(item.title).toMatch(/Writer: \d+ days untended\./);
  });

  test('never-logged identities are skipped (the 99-day seed never scolds)', () => {
    expect(buildNeglectItems([writer], [], NOW)).toHaveLength(0);
  });

  test('resting identities (desired 0) and relaxation are excluded', () => {
    const resting = { id: 'reader', name: 'Reader', desired: 0 };
    const relax = { id: 'relax', name: 'Relaxation', desired: 15, isRelax: true };
    const out = buildNeglectItems([resting, relax], [sess('reader', 5), sess('relax', 5)], NOW);
    expect(out).toHaveLength(0);
  });

  test('uses the identity preferred hour when set', () => {
    const noonWriter = { ...writer, prefTime: 720 }; // 12:00 PM
    const [item] = buildNeglectItems([noonWriter], [sess('writer', 1)], NOW);
    expect(item.date.getHours()).toBe(12);
    expect(item.body).toContain('12 PM');
  });

  test('caps at the most-neglected identities', () => {
    const ids = Array.from({ length: 8 }, (_, k) => ({ id: `i${k}`, name: `I${k}`, desired: 10 }));
    const logs = ids.map((i, k) => sess(i.id, k + 1)); // i7 most neglected
    const out = buildNeglectItems(ids, logs, NOW, 3);
    expect(out).toHaveLength(3);
    expect(out[0].identityId).toBe('i7'); // longest-untended wins the budget
  });
});

describe('buildSessionItems (style-aware session reminders)', () => {
  const identities = [{ id: 'writer', name: 'Writer' }];
  const weekStart = new Date(2026, 6, 5).getTime(); // Sun Jul 5, local midnight
  const plan = [
    { day: 'Sun', sessions: [] },
    { day: 'Mon', sessions: [{ identityId: 'writer', hour: 9, min: 30, mins: 45 }] },
  ];

  test('gentle: one reminder, 30 minutes before, original tone', () => {
    const items = buildSessionItems(plan, weekStart, identities, 'gentle');
    expect(items).toHaveLength(1);
    expect(items[0].date.getHours()).toBe(9);
    expect(items[0].date.getMinutes()).toBe(0); // 9:30 − 30m
    expect(items[0].body).toContain('45m session');
  });

  test('drill: adds a second reminder at session start with firmer copy', () => {
    const items = buildSessionItems(plan, weekStart, identities, 'drill');
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe('Writer in 30 minutes.');
    expect(items[1].date.getHours()).toBe(9);
    expect(items[1].date.getMinutes()).toBe(30); // exactly at start
    expect(items[1].title).toBe('Writer: now.');
  });
});
