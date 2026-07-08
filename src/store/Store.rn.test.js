/* Store integration tests — mount the real StoreProvider with the side-effecting
   lib layers (storage / notifications / auth / sync) mocked, and drive the
   actions we built. Runs under the jest-expo (React Native) project. */
import { renderHook, act, waitFor } from '@testing-library/react-native';

// in-memory AsyncStorage stand-in
jest.mock('../lib/storage', () => {
  const mem = {};
  return {
    getItem: jest.fn(async (k) => (k in mem ? mem[k] : null)),
    setItem: jest.fn(async (k, v) => { mem[k] = v; }),
    removeItem: jest.fn(async (k) => { delete mem[k]; }),
  };
});
jest.mock('../lib/notifications', () => ({
  addResponseListener: () => () => {},
  getInitialResponse: jest.fn(async () => null),
  cancelDaily: jest.fn(async () => {}),
  cancelAll: jest.fn(async () => {}),
  ensurePermission: jest.fn(async () => true),
  hasPermission: jest.fn(async () => true),
  scheduleDaily: jest.fn(async () => {}),
  scheduleWeekly: jest.fn(async () => {}),
  cancelWeekly: jest.fn(async () => {}),
  cancelNightlyToday: jest.fn(async () => {}),
  scheduleNeglectNudges: jest.fn(async () => {}),
  cancelNeglectNudges: jest.fn(async () => {}),
}));
jest.mock('../lib/auth', () => ({
  isConfigured: false,
  getSession: jest.fn(async () => null), // signed out
  onAuthChange: () => () => {},
  signOut: jest.fn(),
  deleteAccount: jest.fn(async () => ({ ok: true })),
}));
jest.mock('../lib/sync', () => ({
  pushState: jest.fn(async () => true),
  pullState: jest.fn(async () => null),
}));

const { StoreProvider, useStore } = require('./Store');

async function mountStore() {
  const hook = renderHook(() => useStore(), { wrapper: StoreProvider });
  await waitFor(() => expect(hook.result.current.hydrated).toBe(true));
  return hook;
}

describe('StoreProvider', () => {
  test('hydrates from storage', async () => {
    const { result } = await mountStore();
    expect(result.current.hydrated).toBe(true);
    expect(Array.isArray(result.current.identities)).toBe(true);
  });

  test('commitLog appends a session carrying a sid for the chosen target', async () => {
    const { result } = await mountStore();
    const before = result.current.sessions.length;
    const target = result.current.logTargets[0];
    act(() => { result.current.commitLog(target, 30, undefined, { silent: true }); });
    expect(result.current.sessions.length).toBe(before + 1);
    expect(result.current.sessions[0].id).toBe(target.id);
    expect(result.current.sessions[0].sid).toBeTruthy(); // the UUID hardening
  });

  test('logging lifts the target identity\'s derived weekly actual', async () => {
    const { result } = await mountStore();
    const target = result.current.identities[0];
    const before = result.current.identities.find((i) => i.id === target.id).actual;
    act(() => { result.current.commitLog(target, 60, undefined, { silent: true }); });
    const after = result.current.identities.find((i) => i.id === target.id).actual;
    expect(after).toBeGreaterThan(before); // ~12min = 1pt, derived live from sessions
  });

  test('logging with a note creates a journal entry (milestone when marked)', async () => {
    const { result } = await mountStore();
    const target = result.current.logTargets[0];
    act(() => { result.current.commitLog(target, 30, 'words came easier', { silent: true, milestone: true }); });
    const entry = result.current.journal[0];
    expect(entry.text).toBe('words came easier');
    expect(entry.type).toBe('milestone');
    expect(entry.identityId).toBe(target.id);
    expect(entry.sessionId).toBe(result.current.sessions[0].sid); // linked to the session
  });

  test('logging without a note creates no journal entry', async () => {
    const { result } = await mountStore();
    const before = result.current.journal.length;
    act(() => { result.current.commitLog(result.current.logTargets[0], 30, '', { silent: true }); });
    expect(result.current.journal.length).toBe(before);
  });

  test('seedOnboarding installs the chosen identities and clears demo sessions', async () => {
    const { result } = await mountStore();
    act(() => {
      result.current.seedOnboarding([
        { id: 'painter', name: 'Painter', glyph: 'P', desired: 20, actual: 0, lastActiveDays: 99, streak: 0 },
      ]);
    });
    expect(result.current.sessions).toHaveLength(0);
    expect(result.current.identities.map((i) => i.id)).toEqual(['painter']);
  });

  test('retiring then re-adding an identity restores it (same id) and reconnects its logged history', async () => {
    const { result } = await mountStore();
    const target = result.current.identities[0];
    const id = target.id;
    act(() => { result.current.commitLog(target, 60, undefined, { silent: true }); }); // log some history
    expect(result.current.sessions.filter((s) => s.id === id).length).toBeGreaterThan(0);

    act(() => { result.current.retireIdentity(id); });
    expect(result.current.identities.some((i) => i.id === id)).toBe(false);
    expect(result.current.retired.some((i) => i.id === id)).toBe(true);

    act(() => { result.current.addIdentities([target.name]); });
    // restored (not duplicated), removed from retired, and its derived activity is back
    expect(result.current.identities.filter((i) => i.id === id)).toHaveLength(1);
    expect(result.current.retired.some((i) => i.id === id)).toBe(false);
    expect(result.current.identities.find((i) => i.id === id).actual).toBeGreaterThan(0);
  });

  test('starts signed out with idle sync status', async () => {
    const { result } = await mountStore();
    expect(result.current.session).toBeNull();
    expect(result.current.syncStatus).toBe('idle');
  });
});
