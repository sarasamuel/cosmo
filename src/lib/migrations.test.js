import { migrateData, needsMigration, DATA_VERSION } from './migrations';

describe('migrateData', () => {
  test('upgrades a legacy v0 blob to the current shape', () => {
    const legacy = { identities: [{ id: 'w', desired: 25 }], relax: { desired: 15 }, sessions: [{ id: 'w', ts: 1, mins: 30 }] };
    const m = migrateData(legacy);
    expect(m.v).toBe(DATA_VERSION);
    expect(m.planHistory).toEqual({});       // v1 backfill
    expect(m.relax.tracked).toBe(true);       // v1 derive
    expect(m.sessions[0].sid).toBeDefined();  // v2 backfill
  });

  test('relax.tracked derives false when desired is 0', () => {
    expect(migrateData({ relax: { desired: 0 } }).relax.tracked).toBe(false);
  });

  test('legacy session gets the SAME sid on every device (deterministic backfill)', () => {
    const s = { id: 'w', ts: 1700000000000, mins: 30, label: 'pages' };
    const a = migrateData({ v: 1, sessions: [{ ...s }] }).sessions[0].sid;
    const b = migrateData({ v: 1, sessions: [{ ...s }] }).sessions[0].sid;
    expect(a).toBe(b);
  });

  test('is idempotent — re-migrating keeps the sid and version', () => {
    const once = migrateData({ sessions: [{ id: 'w', ts: 1, mins: 5 }] });
    const twice = migrateData(once);
    expect(twice.v).toBe(DATA_VERSION);
    expect(twice.sessions[0].sid).toBe(once.sessions[0].sid);
  });

  test('preserves unknown fields (cloud snapshot extras)', () => {
    const m = migrateData({ updatedAt: 999, theme: 'dark' });
    expect(m.updatedAt).toBe(999);
    expect(m.theme).toBe('dark');
  });

  test('passes through null/undefined safely', () => {
    expect(migrateData(null)).toBeNull();
    expect(migrateData(undefined)).toBeUndefined();
  });
});

describe('needsMigration', () => {
  test('true for a legacy blob, false at the current version', () => {
    expect(needsMigration({})).toBe(true);
    expect(needsMigration({ v: DATA_VERSION })).toBe(false);
  });
});
