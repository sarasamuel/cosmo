/* Signed-in cloud-sync tests: push on sign-in, debounced push on change, the
   durable backoff retry after a failure, and the foreground flush. The lib
   layers are mocked; fake timers drive the debounce/backoff. */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';

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
  cancelDaily: jest.fn(),
  cancelAll: jest.fn(),
  ensurePermission: jest.fn(async () => true),
  hasPermission: jest.fn(async () => true),
  scheduleDaily: jest.fn(),
  scheduleWeekly: jest.fn(),
  cancelWeekly: jest.fn(),
}));
jest.mock('../lib/auth', () => ({
  isConfigured: true,
  getSession: jest.fn(async () => ({ user: { id: 'u1', email: 'a@b.c' } })), // signed in
  onAuthChange: () => () => {},
  signOut: jest.fn(),
  deleteAccount: jest.fn(async () => ({ ok: true })),
}));
jest.mock('../lib/sync', () => ({
  pushState: jest.fn(async () => true),
  pullState: jest.fn(async () => null),
}));

const sync = require('../lib/sync');
const { StoreProvider, useStore } = require('./Store');

// mount + wait (real timers) until the sign-in backup settles to "synced"
async function mountSignedIn() {
  sync.pushState.mockResolvedValue(true);
  sync.pullState.mockResolvedValue(null);
  const hook = renderHook(() => useStore(), { wrapper: StoreProvider });
  await waitFor(() => expect(hook.result.current.syncStatus).toBe('synced'));
  return hook;
}

const log = (result) => act(() => {
  result.current.commitLog(result.current.logTargets[0], 30, undefined, { silent: true });
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

describe('cloud sync (signed in)', () => {
  test('on sign-in, backs up local state and reaches "synced"', async () => {
    const { result } = await mountSignedIn();
    expect(sync.pullState).toHaveBeenCalledWith('u1');
    expect(sync.pushState).toHaveBeenCalledWith('u1', expect.objectContaining({ updatedAt: expect.any(Number) }));
    expect(result.current.lastSyncedAt).toBeGreaterThan(0);
  });

  test('a change debounces a push and returns to "synced"', async () => {
    const { result } = await mountSignedIn();
    const before = sync.pushState.mock.calls.length;

    jest.useFakeTimers();
    sync.pushState.mockResolvedValue(true);
    log(result);
    await act(async () => { await jest.advanceTimersByTimeAsync(1000); }); // fire the ~900ms debounce
    expect(sync.pushState.mock.calls.length).toBeGreaterThan(before);
    expect(result.current.syncStatus).toBe('synced');
  });

  test('a failed push surfaces "error", then the backoff retry recovers to "synced"', async () => {
    const { result } = await mountSignedIn();

    jest.useFakeTimers();
    sync.pushState.mockResolvedValue(false); // pushes fail
    log(result);
    await act(async () => { await jest.advanceTimersByTimeAsync(1000); }); // debounce fires → fails
    expect(result.current.syncStatus).toBe('error');

    sync.pushState.mockResolvedValue(true); // network back
    await act(async () => { await jest.advanceTimersByTimeAsync(5000); }); // backoff (~4s) fires → succeeds
    expect(result.current.syncStatus).toBe('synced');
  });

  test('foregrounding flushes a change left pending by a failed push', async () => {
    const addSpy = jest.spyOn(AppState, 'addEventListener');
    const { result } = await mountSignedIn();
    const onAppState = (addSpy.mock.calls.find((c) => c[0] === 'change') || [])[1];
    expect(typeof onAppState).toBe('function');

    jest.useFakeTimers();
    sync.pushState.mockResolvedValue(false); // change can't sync now → stays dirty
    log(result);
    await act(async () => { await jest.advanceTimersByTimeAsync(1000); });
    expect(result.current.syncStatus).toBe('error');
    const before = sync.pushState.mock.calls.length;

    sync.pushState.mockResolvedValue(true); // recovered
    await act(async () => { onAppState('active'); await jest.advanceTimersByTimeAsync(50); }); // foreground flush
    expect(sync.pushState.mock.calls.length).toBeGreaterThan(before);
    expect(result.current.syncStatus).toBe('synced');
    addSpy.mockRestore();
  });
});
