/* App store — a single React context mirroring the prototype's App-level state.
   Holds identities, the Relaxation allowance, sessions, active tab, theme,
   onboarding flag, and transient log-sheet/toast state. Theme + onboarding-
   complete + the mutable domain state are persisted to AsyncStorage. */

import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { AppState, Share } from 'react-native';
import * as storage from '../lib/storage';
import * as notifications from '../lib/notifications';
import * as auth from '../lib/auth';
import * as sync from '../lib/sync';
import { DATA_VERSION, migrateData } from '../lib/migrations';
import {
  IDENTITIES, RELAX, SESSIONS, FREE_HOURS_WEEK,
  alignment as alignmentFn, assignHue, fmtWhen,
  weekStartMs, weekLabel, weekDayIndex, weekPoints, daysSinceLast, dayStreak, SESSION_POINTS, mergeSessions, newSessionId,
} from '../data/data';
import { themes, identityColors } from '../theme/theme';

const StoreContext = createContext(null);

const KEY_THEME = 'cosmo-theme';
const KEY_STARTED = 'cosmo-started';
const KEY_WEEK = 'cosmo-week'; // weekPlanned flag (a plan has been committed)
const KEY_ALLMET = 'cosmo-allmet'; // week-start (ms) the whole-week triumph last fired for (fire once per week)
const KEY_FORM = 'cosmo-form';
const KEY_DATA = 'cosmo-data'; // mutable domain state (identities/retired/relax/sessions)
const KEY_REMINDER = 'cosmo-reminder'; // { enabled, hour, minute } for the daily local reminder
const KEY_REMINDERS_ON = 'cosmo-reminders-on'; // master switch for ALL Cosmo notifications (nightly + session reminders)
const KEY_LASTNOTIF = 'cosmo-lastnotif'; // delivery stamp of the last reminder tap we opened the review for
const KEY_FREEHOURS = 'cosmo-freehours'; // weekly free hours the user has to allocate (from onboarding / re-plan)
const KEY_STAMP = 'cosmo-stamp'; // logical version (ms) of the synced state, for last-write-wins
const KEY_NAME = 'cosmo-name'; // display name (captured at sign-in)
const KEY_AUTHSEEN = 'cosmo-authseen'; // the auth-entry flow was completed or skipped (don't show it again)
const KEY_SYNCED = 'cosmo-synced'; // ms of the last successful cloud push/pull (for the "backed up · …" label)
const KEY_SYNCEDSTAMP = 'cosmo-syncedstamp'; // local version (stamp) last confirmed in the cloud — drives dirty-tracking + retry
const KEY_JOINED = 'cosmo-joined'; // ms of first launch (for journal anniversaries)
const KEY_SCHEDULE = 'cosmo-schedule'; // this week's arranged session plan { weekStart, plan, constraints }

const DEFAULT_REMINDER = { enabled: false, hour: 9, minute: 0 };

// "30 minutes before each session" reminder payloads, derived from an arranged
// plan. `weekStart` anchors day k to a real calendar date. Past times are
// filtered downstream (scheduleSessionReminders skips them).
function buildReminderItems(plan, weekStart, identities) {
  const nameOf = (id) => { const i = (identities || []).find((x) => x.id === id); return i ? i.name : 'your identity'; };
  const items = [];
  (plan || []).forEach((d, k) => {
    (d.sessions || []).forEach((s) => {
      const when = new Date(weekStart);
      when.setDate(when.getDate() + k);
      when.setHours(s.hour, 0, 0, 0);
      when.setMinutes(when.getMinutes() - 30);
      const name = nameOf(s.identityId);
      items.push({ date: when, identityId: s.identityId, title: `${name} in 30 minutes`, body: `Time to tend to ${name} — your ${s.mins}m session is coming up.` });
    });
  });
  return items;
}

export function StoreProvider({ children }) {
  const [form, setFormState] = useState('orbit');
  const [theme, setThemeName] = useState('dark');
  const [started, setStarted] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const [tab, setTab] = useState('home');
  const [identities, setIdentities] = useState(IDENTITIES);
  const [retired, setRetired] = useState([]); // retired identities — kept for history, out of active lists/viz
  const [relax, setRelax] = useState(RELAX);
  const [sessions, setSessions] = useState(SESSIONS);
  const [planHistory, setPlanHistory] = useState({}); // { weekStartMs: { identityId: pct } } — committed plans, kept for real weekly history
  const [journal, setJournal] = useState([]); // user-authored journal entries (notes + milestones); auto-milestones are DERIVED, not stored
  const [joinedAt, setJoinedAt] = useState(0); // ms the user first opened the app (for anniversaries)

  const [logOpen, setLogOpen] = useState(false);
  const [logPreset, setLogPreset] = useState(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [weekPlanned, setWeekPlanned] = useState(false);
  const [freeHours, setFreeHoursState] = useState(FREE_HOURS_WEEK.def);
  const [addOpen, setAddOpen] = useState(false);
  const [cosmosFocus, setCosmosFocus] = useState(null); // focused identity in the cosmos card
  const [detail, setDetail] = useState(null); // identity whose full Detail screen is open (null = none)
  const [editing, setEditing] = useState(null); // identity being edited in the name/color sheet (null = closed)
  const [settingsOpen, setSettingsOpen] = useState(false); // Settings screen (pushed from the You-tab gear)
  const [scheduleOpen, setScheduleOpen] = useState(false); // the "arrange your week" flow (supplemental scheduler)
  const [scheduleData, setScheduleData] = useState(null); // { weekStart, plan, constraints } — this week's arranged sessions
  const [review, setReview] = useState(false); // end-of-day review screen open (from the reminder tap)
  const [celebrate, setCelebrate] = useState(null); // identity that just reached its intention (celebration overlay)
  const [allMetOpen, setAllMetOpen] = useState(false); // whole-week "every intention met" celebration
  const [allMetWeek, setAllMetWeek] = useState(0); // week-start (ms) the triumph last fired for (0 = never)
  const [reminder, setReminder] = useState(DEFAULT_REMINDER); // daily local notification prefs
  const [remindersOn, setRemindersOnState] = useState(true); // master switch for all notifications (default on)
  const [session, setSession] = useState(null); // Supabase auth session (null = signed out / offline-only)
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle' | 'syncing' | 'synced' | 'error'
  const [lastSyncedAt, setLastSyncedAt] = useState(0);  // ms of last successful cloud push/pull
  const [backupOpen, setBackupOpen] = useState(false); // cloud-backup (email-OTP) sheet
  const [userName, setUserNameState] = useState(''); // display name (captured at sign-in)
  const [authSeen, setAuthSeen] = useState(false); // auth-entry flow completed or skipped
  const [toast, setToast] = useState(null);

  // ---- cloud sync (document backup) bookkeeping ----
  const stampRef = useRef(0); // logical version (ms) of local synced state, for last-write-wins
  const sessionRef = useRef(null); // latest session, read inside debounced timers without re-subscribing
  const pendingRef = useRef(null); // latest snapshot awaiting a debounced push
  const pushTimerRef = useRef(null);
  const syncInitRef = useRef(false); // skip the first post-hydration settle so it isn't counted as a change
  const syncedStampRef = useRef(0); // local version last CONFIRMED in the cloud (dirty when stampRef > this)
  const retryAttemptRef = useRef(0); // exponential-backoff counter for failed pushes
  const flushingRef = useRef(false); // a push is in flight (prevents concurrent/overlapping pushes)
  const buildSnapshotRef = useRef(null); // latest buildSnapshot, for export from stable callbacks

  // hydrate persisted prefs + the mutable domain state. storage.getItem logs and
  // returns null on a failed read (never rejects), so a read error degrades to
  // seed defaults *with a logged signal* rather than silently.
  useEffect(() => {
    (async () => {
      const [t, s, w, f, d, rem, fh, am, nm, as] = await Promise.all([
        storage.getItem(KEY_THEME),
        storage.getItem(KEY_STARTED),
        storage.getItem(KEY_WEEK),
        storage.getItem(KEY_FORM),
        storage.getItem(KEY_DATA),
        storage.getItem(KEY_REMINDER),
        storage.getItem(KEY_FREEHOURS),
        storage.getItem(KEY_ALLMET),
        storage.getItem(KEY_NAME),
        storage.getItem(KEY_AUTHSEEN),
      ]);
      if (t === 'light' || t === 'dark') setThemeName(t);
      { const n = Number(am); if (am != null && Number.isFinite(n)) setAllMetWeek(n); }
      if (nm) setUserNameState(nm);
      if (as === '1') setAuthSeen(true);
      const stampNum = Number(await storage.getItem(KEY_STAMP));
      if (Number.isFinite(stampNum)) stampRef.current = stampNum;
      { const sy = Number(await storage.getItem(KEY_SYNCED)); if (Number.isFinite(sy) && sy) setLastSyncedAt(sy); }
      { const ss = Number(await storage.getItem(KEY_SYNCEDSTAMP)); if (Number.isFinite(ss)) syncedStampRef.current = ss; }
      { const jn = Number(await storage.getItem(KEY_JOINED)); if (Number.isFinite(jn) && jn) { setJoinedAt(jn); } else { const t0 = Date.now(); setJoinedAt(t0); storage.setItem(KEY_JOINED, String(t0)); } }
      { const sc = await storage.getItem(KEY_SCHEDULE); if (sc) { try { const p = JSON.parse(sc); if (p && p.weekStart && Array.isArray(p.plan)) setScheduleData(p); } catch (e) { /* corrupt → ignore */ } } }
      { const ro = await storage.getItem(KEY_REMINDERS_ON); if (ro === '0') setRemindersOnState(false); }
      const fhNum = Number(fh);
      if (fh != null && Number.isFinite(fhNum)) {
        setFreeHoursState(Math.max(FREE_HOURS_WEEK.min, Math.min(FREE_HOURS_WEEK.max, fhNum)));
      }
      if (s === '1') setStarted(true);
      if (w === '1') setWeekPlanned(true);
      if (f === 'orbit' || f === 'constellation') setFormState(f);
      if (rem) {
        try {
          const r = JSON.parse(rem);
          if (typeof r?.hour === 'number' && typeof r?.minute === 'number') {
            setReminder({ enabled: !!r.enabled, hour: r.hour, minute: r.minute });
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn(`[storage] corrupt "${KEY_REMINDER}", using defaults:`, e && e.message ? e.message : e);
        }
      }
      if (d) {
        try {
          // migrate the stored blob up to the current shape before applying.
          // The persist effect rewrites it stamped at DATA_VERSION once state settles.
          const data = migrateData(JSON.parse(d));
          if (Array.isArray(data?.identities) && data.identities.length) setIdentities(data.identities);
          if (Array.isArray(data?.retired)) setRetired(data.retired);
          if (data?.relax) setRelax(data.relax);
          if (Array.isArray(data?.sessions)) setSessions(data.sessions);
          if (data?.planHistory && typeof data.planHistory === 'object') setPlanHistory(data.planHistory);
          if (Array.isArray(data?.journal)) setJournal(data.journal);
        } catch (e) {
          // corrupt blob: keep seed defaults, but don't swallow it silently
          // eslint-disable-next-line no-console
          console.warn(`[storage] corrupt "${KEY_DATA}", using defaults:`, e && e.message ? e.message : e);
        }
      }
      setHydrated(true);
    })();
  }, []);

  // Tapping the nightly reminder opens the end-of-day review. A warm tap fires
  // the listener; a cold launch-by-tap comes through getInitialResponse. The
  // latter can return a *cached* response on later launches, so we dedupe by the
  // notification's delivery time — a new day's tap has a new stamp and reopens,
  // a stale one doesn't. Session-reminder taps (data.kind === 'schedule') are NOT
  // the nightly review, so they don't open it.
  const isScheduleTap = (resp) => resp?.notification?.request?.content?.data?.kind === 'schedule';
  useEffect(() => {
    const unsub = notifications.addResponseListener((resp) => { if (!isScheduleTap(resp)) setReview(true); });
    (async () => {
      const resp = await notifications.getInitialResponse();
      if (!resp || isScheduleTap(resp)) return;
      const stamp = String((resp.notification && resp.notification.date) || '');
      if (stamp) {
        const seen = await storage.getItem(KEY_LASTNOTIF);
        if (stamp === seen) return; // already handled this exact delivery
        storage.setItem(KEY_LASTNOTIF, stamp);
      }
      setReview(true);
    })();
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track the Supabase auth session (cloud backup). No-op when Supabase isn't
  // configured — the app stays fully usable offline. Sync of the domain state is
  // a later slice; this just exposes who's signed in.
  useEffect(() => {
    auth.getSession().then(setSession);
    const unsub = auth.onAuthChange(setSession);
    return unsub;
  }, []);

  const openBackup = useCallback(() => setBackupOpen(true), []);
  const closeBackup = useCallback(() => setBackupOpen(false), []);
  const signOut = useCallback(() => auth.signOut(), []);

  // Export the full local snapshot as JSON via the share sheet (works offline,
  // signed in or not). Returns { ok, error }.
  const exportData = useCallback(async () => {
    try {
      const json = JSON.stringify(buildSnapshotRef.current ? buildSnapshotRef.current() : {}, null, 2);
      await Share.share({ message: json, title: 'Cosmo data export' });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e && e.message ? e.message : 'Could not export.' };
    }
  }, []);

  // Factory reset: clear every persisted key, cancel notifications, and reset
  // in-memory state to a pristine pre-onboarding slate (routes back to AuthFlow).
  const resetLocal = useCallback(() => {
    [KEY_THEME, KEY_STARTED, KEY_WEEK, KEY_FORM, KEY_DATA, KEY_REMINDER, KEY_LASTNOTIF,
      KEY_FREEHOURS, KEY_STAMP, KEY_NAME, KEY_AUTHSEEN, KEY_ALLMET, KEY_SYNCED, KEY_SYNCEDSTAMP]
      .forEach((k) => storage.removeItem(k));
    notifications.cancelDaily();
    setIdentities(IDENTITIES); setRetired([]); setRelax(RELAX); setSessions(SESSIONS); setPlanHistory({});
    setThemeName('dark'); setFormState('orbit'); setFreeHoursState(FREE_HOURS_WEEK.def);
    setReminder(DEFAULT_REMINDER); setWeekPlanned(false); setAllMetWeek(0);
    setUserNameState(''); setAuthSeen(false); setStarted(false);
    stampRef.current = 0; syncedStampRef.current = 0;
    setSyncStatus('idle'); setLastSyncedAt(0);
  }, []);

  // Delete account + data. Signed in: delete the cloud account first (cascades
  // the data); only wipe the device if that succeeds, so a failed cloud delete
  // doesn't strand the account with the local copy gone. Signed out: just wipe
  // local ("delete my data"). Returns { ok, error }.
  const deleteAccount = useCallback(async () => {
    if (sessionRef.current && sessionRef.current.user) {
      const res = await auth.deleteAccount();
      if (!res.ok) return res;
    }
    resetLocal();
    return { ok: true };
  }, [resetLocal]);

  const setUserName = useCallback((name) => {
    const v = (name || '').trim();
    setUserNameState(v);
    storage.setItem(KEY_NAME, v);
  }, []);
  // mark the auth-entry flow as done (signed in or skipped) so it isn't shown again
  const markAuthSeen = useCallback(() => {
    setAuthSeen(true);
    storage.setItem(KEY_AUTHSEEN, '1');
  }, []);

  // persist the mutable domain state whenever it changes — gated on `hydrated`
  // so the initial seed values can't clobber stored data before the load above
  // completes. Written as one atomic blob (no partial/half-saved states).
  useEffect(() => {
    if (!hydrated) return;
    storage.setItem(KEY_DATA, JSON.stringify({ v: DATA_VERSION, identities, retired, relax, sessions, planHistory, journal }));
  }, [hydrated, identities, retired, relax, sessions, planHistory, journal]);

  // ===== Cloud sync (document backup) ====================================
  // The whole domain snapshot is one JSON row in profiles.state, last-write-wins
  // by `updatedAt` (a ms stamp inside the blob). Local stays the source of truth.
  useEffect(() => { sessionRef.current = session; }, [session]);

  // the snapshot we back up — everything that defines a user's state
  const buildSnapshot = () => ({
    v: DATA_VERSION,
    updatedAt: stampRef.current,
    identities, retired, relax, sessions, planHistory, journal, joinedAt,
    theme, form, freeHours, reminder, weekPlanned, started, allMetWeek, userName,
  });
  // keep a ref to the latest snapshot builder so export reads current state
  // from a stable callback (no giant dependency list).
  buildSnapshotRef.current = buildSnapshot;

  // apply a remote snapshot to local state + the offline cache (pref keys that
  // have no auto-persisting setter are written here). The change-watch effect
  // below will fire once and push it straight back — a harmless idempotent echo.
  const applyRemote = (snapRaw) => {
    const snap = migrateData(snapRaw); // upgrade an older app version's backup before applying
    if (Array.isArray(snap.identities) && snap.identities.length) setIdentities(snap.identities);
    if (Array.isArray(snap.retired)) setRetired(snap.retired);
    if (snap.relax) setRelax(snap.relax);
    // sessions are append-only → UNION local + remote so a session logged on
    // either device survives the restore (never a wholesale overwrite). The
    // merged set is pushed straight back by the change-watch effect, so the
    // cloud converges to the union too.
    if (Array.isArray(snap.sessions)) setSessions((local) => mergeSessions(local, snap.sessions));
    // plan history: union the weeks both sides know about (remote wins a same-week conflict)
    if (snap.planHistory && typeof snap.planHistory === 'object') setPlanHistory((local) => ({ ...local, ...snap.planHistory }));
    // journal is append-only → union by entry id (never lose a note across devices)
    if (Array.isArray(snap.journal)) setJournal((local) => {
      const seen = new Set(); const out = [];
      [...(local || []), ...snap.journal].forEach((e) => { if (e && e.id && !seen.has(e.id)) { seen.add(e.id); out.push(e); } });
      return out.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    });
    if (typeof snap.joinedAt === 'number' && snap.joinedAt) {
      setJoinedAt((local) => { const v = local ? Math.min(local, snap.joinedAt) : snap.joinedAt; storage.setItem(KEY_JOINED, String(v)); return v; });
    }
    if (snap.theme === 'light' || snap.theme === 'dark') { setThemeName(snap.theme); storage.setItem(KEY_THEME, snap.theme); }
    if (snap.form === 'orbit' || snap.form === 'constellation') { setFormState(snap.form); storage.setItem(KEY_FORM, snap.form); }
    if (typeof snap.freeHours === 'number') { setFreeHoursState(snap.freeHours); storage.setItem(KEY_FREEHOURS, String(snap.freeHours)); }
    if (snap.reminder) { setReminder(snap.reminder); storage.setItem(KEY_REMINDER, JSON.stringify(snap.reminder)); }
    if (typeof snap.weekPlanned === 'boolean') { setWeekPlanned(snap.weekPlanned); snap.weekPlanned ? storage.setItem(KEY_WEEK, '1') : storage.removeItem(KEY_WEEK); }
    if (typeof snap.started === 'boolean') { setStarted(snap.started); snap.started ? storage.setItem(KEY_STARTED, '1') : storage.removeItem(KEY_STARTED); }
    if (typeof snap.allMetWeek === 'number') { setAllMetWeek(snap.allMetWeek); storage.setItem(KEY_ALLMET, String(snap.allMetWeek)); }
    if (typeof snap.userName === 'string') { setUserNameState(snap.userName); storage.setItem(KEY_NAME, snap.userName); }
    stampRef.current = snap.updatedAt || Date.now();
    storage.setItem(KEY_STAMP, String(stampRef.current));
  };

  // record a successful round-trip — drives the "Backed up · 2m ago" label
  const markSynced = () => {
    const now = Date.now();
    setSyncStatus('synced');
    setLastSyncedAt(now);
    storage.setItem(KEY_SYNCED, String(now));
  };

  const RETRY_BASE = 4000; // ms — first backoff delay after a failed push
  const RETRY_MAX = 60000; // ms — backoff cap

  // The single push path. Debounced/retried via one timer. Pushes the latest
  // snapshot only if local is ahead of what the cloud has confirmed; on failure
  // it reschedules itself with exponential backoff (durable retry) instead of
  // waiting for the next edit. `delay` 0 = flush now (foreground/reconnect).
  const schedulePush = (delay = 900) => {
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(async () => {
      pushTimerRef.current = null;
      const uid = sessionRef.current && sessionRef.current.user && sessionRef.current.user.id;
      if (!uid) return;
      if (flushingRef.current) { schedulePush(500); return; } // a push is already in flight — try again shortly
      const snap = pendingRef.current;
      if (!snap || (snap.updatedAt || 0) <= syncedStampRef.current) { if (!isDirty()) setSyncStatus('synced'); return; } // already in the cloud
      flushingRef.current = true;
      setSyncStatus('syncing');
      const ok = await sync.pushState(uid, snap);
      flushingRef.current = false;
      if (ok) {
        syncedStampRef.current = snap.updatedAt || Date.now();
        storage.setItem(KEY_SYNCEDSTAMP, String(syncedStampRef.current));
        retryAttemptRef.current = 0;
        markSynced();
        // edits landed during the push → we're dirty again; flush once more
        if ((stampRef.current || 0) > syncedStampRef.current) schedulePush(300);
      } else {
        setSyncStatus('error'); // surfaced in the UI
        const backoff = Math.min(RETRY_MAX, RETRY_BASE * 2 ** retryAttemptRef.current);
        retryAttemptRef.current += 1;
        schedulePush(backoff); // keep trying without waiting for another edit
      }
    }, delay);
  };

  // true when local has changes the cloud hasn't confirmed yet
  const isDirty = () => (stampRef.current || 0) > syncedStampRef.current;

  // bump the version + queue a debounced push whenever any synced state changes.
  // skip the first settle after hydration (it's the load, not a user edit).
  useEffect(() => {
    if (!hydrated) return;
    if (!syncInitRef.current) { syncInitRef.current = true; return; }
    stampRef.current = Date.now();
    storage.setItem(KEY_STAMP, String(stampRef.current));
    pendingRef.current = buildSnapshot();
    if (sessionRef.current && sessionRef.current.user) schedulePush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, identities, retired, relax, sessions, planHistory, journal, joinedAt, theme, form, freeHours, reminder, weekPlanned, started, allMetWeek, userName]);

  // on sign-in (and on launch if already signed in): pull, then restore-or-back-up.
  useEffect(() => {
    const uid = session && session.user && session.user.id;
    if (!hydrated) return undefined;
    if (!uid) { setSyncStatus('idle'); return undefined; } // signed out → offline-only
    let cancelled = false;
    (async () => {
      setSyncStatus('syncing');
      const remote = await sync.pullState(uid);
      if (cancelled) return;
      if (remote && (remote.updatedAt || 0) > stampRef.current) {
        applyRemote(remote); // cloud is newer → restore (sessions/plan history are merged, not overwritten)
        syncedStampRef.current = remote.updatedAt || Date.now();
        storage.setItem(KEY_SYNCEDSTAMP, String(syncedStampRef.current));
        markSynced();
      } else {
        // local is newer / no remote → back it up now. Force the upload even when
        // the version looks "clean" (stamp 0 on a fresh device): the cloud has
        // nothing yet, so the first sign-in must push local state. Stamp a real
        // version first so future dirty-tracking is consistent.
        if (!stampRef.current) {
          stampRef.current = Date.now();
          storage.setItem(KEY_STAMP, String(stampRef.current));
        }
        pendingRef.current = buildSnapshot();
        setSyncStatus('syncing');
        const ok = await sync.pushState(uid, pendingRef.current);
        if (cancelled) return;
        if (ok) {
          syncedStampRef.current = pendingRef.current.updatedAt || Date.now();
          storage.setItem(KEY_SYNCEDSTAMP, String(syncedStampRef.current));
          markSynced();
        } else {
          setSyncStatus('error');
          schedulePush(RETRY_BASE); // durable retry
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, session]);

  // Flush pending changes when the app returns to the foreground — a stand-in
  // for "the network came back" without a NetInfo dependency. Catches the case
  // where a push failed while backgrounded/offline: if signed in and dirty, push
  // now (schedulePush no-ops when already in sync).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      const uid = sessionRef.current && sessionRef.current.user && sessionRef.current.user.id;
      if (s === 'active' && uid && isDirty()) schedulePush(0);
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // ======================================================================

  // Single transient toast with one shared timer: clear any pending dismissal
  // before showing a new one (so rapid toasts don't cut each other off), and
  // clear on unmount (no setState-after-unmount).
  const toastTimer = useRef(null);
  const showToast = useCallback((payload, ms = 2600) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(payload);
    toastTimer.current = setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, ms);
  }, []);
  useEffect(() => () => toastTimer.current && clearTimeout(toastTimer.current), []);

  // Weekly free hours — the pool the per-identity % scale into real hours. Set in
  // onboarding and re-adjustable from the weekly plan sheet; persisted.
  const setFreeHours = useCallback((h) => {
    const clamped = Math.max(FREE_HOURS_WEEK.min, Math.min(FREE_HOURS_WEEK.max, Math.round(h)));
    setFreeHoursState(clamped);
    storage.setItem(KEY_FREEHOURS, String(clamped));
  }, []);

  // The Relaxation allowance: its weekly share. 0 means rest isn't reserved, so
  // it's not tracked. Persisted with the domain blob (relax is part of KEY_DATA).
  const setRelaxAllowance = useCallback((pct) => {
    setRelax((r) => ({ ...r, desired: Math.max(0, Math.round(pct)), tracked: pct > 0 }));
  }, []);

  const setTheme = useCallback((t) => {
    setThemeName(t);
    storage.setItem(KEY_THEME, t);
  }, []);

  const setForm = useCallback((f) => { setFormState(f); storage.setItem(KEY_FORM, f); }, []);

  // Finish onboarding with the user's real cosmos: their chosen identities (with
  // their first-week allocations as `desired`) replace the seed personas, and the
  // demo sessions are cleared so nothing reads as already-logged. `actual`,
  // `streak`, and `lastActiveDays` re-derive from the now-empty session list, so a
  // fresh user opens with zero lived time and nothing "leaning" anywhere.
  const seedOnboarding = useCallback((nextIdentities) => {
    if (Array.isArray(nextIdentities) && nextIdentities.length) {
      setIdentities(nextIdentities);
      // the allocations the user just set ARE this week's plan — record them as
      // the first entry of the plan history so the opening week reads truthfully.
      const plan = {};
      nextIdentities.forEach((i) => { plan[i.id] = i.desired; });
      setPlanHistory({ [weekStartMs()]: plan });
    }
    setSessions([]);
  }, []);

  const enter = useCallback(() => {
    setStarted(true);
    storage.setItem(KEY_STARTED, '1');
  }, []);

  const restart = useCallback(() => {
    storage.removeItem(KEY_STARTED);
    setTab('home');
    setStarted(false);
  }, []);

  // Persist the reminder prefs and (re)schedule or cancel the OS notification.
  // Turning it on requires permission; if denied we revert to off so the UI
  // reflects reality. Stable (no deps) — callers pass the full next state.
  const persistReminder = useCallback(async (next) => {
    setReminder(next);
    storage.setItem(KEY_REMINDER, JSON.stringify(next));
    // the master switch gates everything: don't schedule the nightly while it's off.
    if (!next.enabled || !remindersOn) {
      await notifications.cancelDaily();
      return;
    }
    const granted = await notifications.ensurePermission();
    if (!granted) {
      const off = { ...next, enabled: false };
      setReminder(off);
      storage.setItem(KEY_REMINDER, JSON.stringify(off));
      return;
    }
    await notifications.scheduleDaily(next.hour, next.minute);
  }, [remindersOn]);
  const setReminderEnabled = useCallback((enabled) => persistReminder({ ...reminder, enabled }), [reminder, persistReminder]);
  const setReminderTime = useCallback((hour, minute) => persistReminder({ ...reminder, enabled: true, hour, minute }), [reminder, persistReminder]);

  // Master Reminders switch — governs ALL of Cosmo's notifications. Off: cancel
  // everything (nightly + session reminders) and stop scheduling new ones. On:
  // re-apply whatever's configured (the nightly if enabled, this week's schedule
  // reminders if a plan exists), gated by OS permission underneath.
  const setRemindersOn = useCallback((on) => {
    setRemindersOnState(on);
    storage.setItem(KEY_REMINDERS_ON, on ? '1' : '0');
    if (!on) {
      notifications.cancelAll();
      if (scheduleData && Array.isArray(scheduleData.notifIds) && scheduleData.notifIds.length) {
        const cleared = { ...scheduleData, notifIds: [] };
        setScheduleData(cleared);
        storage.setItem(KEY_SCHEDULE, JSON.stringify(cleared));
      }
      return;
    }
    (async () => {
      const granted = await notifications.ensurePermission();
      if (!granted) return;
      if (reminder.enabled) notifications.scheduleDaily(reminder.hour, reminder.minute);
      if (scheduleData && Array.isArray(scheduleData.plan) && scheduleData.weekStart === weekStartMs()) {
        const ids = await notifications.scheduleSessionReminders(buildReminderItems(scheduleData.plan, scheduleData.weekStart, identities));
        const data = { ...scheduleData, notifIds: ids };
        setScheduleData(data);
        storage.setItem(KEY_SCHEDULE, JSON.stringify(data));
      }
    })();
  }, [reminder, scheduleData, identities]);

  const openLog = useCallback((preset) => {
    setLogPreset(preset && preset.id ? preset : null);
    setLogOpen(true);
  }, []);
  const closeLog = useCallback(() => setLogOpen(false), []);

  const closeAllMet = useCallback(() => setAllMetOpen(false), []);

  // ---- Derived "live" state: a single source of truth (logged sessions) ----
  // `actual` (this week's points), `lastActiveDays`, and `streak` are no longer
  // stored counters — they're computed from `sessions` against the current
  // calendar week. So they reset on their own at the week boundary and never
  // drift. `identities`/`relax` state still hold the editable fields (name,
  // glyph, hue, desired); these overlays add the activity fields on top.
  const currentWeek = weekStartMs();
  // the arranged plan only counts for the current week (it auto-expires when the
  // week rolls over, like the all-met stamp) — no reset bookkeeping needed.
  const schedule = scheduleData && scheduleData.weekStart === currentWeek ? scheduleData : null;
  const liveIdentities = useMemo(
    () =>
      identities.map((i) => ({
        ...i,
        actual: Math.min(60, weekPoints(sessions, i.id)),
        lastActiveDays: daysSinceLast(sessions, i.id, i.lastActiveDays),
        streak: dayStreak(sessions, i.id),
      })),
    [identities, sessions, currentWeek]
  );
  const liveRelax = useMemo(
    () => ({
      ...relax,
      actual: Math.min(relax.desired, weekPoints(sessions, 'relax')),
      lastActiveDays: daysSinceLast(sessions, 'relax', relax.lastActiveDays),
    }),
    [relax, sessions, currentWeek]
  );
  // the triumph fires once per *calendar* week: it's "already fired" only when
  // the stored week-start matches the week we're in now (so it re-arms itself
  // every week, and commitWeekPlan re-arms it mid-week by clearing the stamp).
  const allMetFired = allMetWeek === currentWeek;

  // Whole-week triumph — fire as soon as every active identity has met its
  // intention and we haven't celebrated yet this week. Reactive (watches state),
  // so it catches *any* path to all-met: a log, the end-of-day review, planning
  // intentions down, or retiring the last unmet identity. Gated on `hydrated`
  // (no fire mid-load) and the per-week stamp. desired 0 (rested) counts as met.
  useEffect(() => {
    if (!hydrated || allMetFired) return;
    const allMet = liveIdentities.length > 0 && liveIdentities.every((i) => i.actual >= i.desired);
    if (!allMet) return;
    setAllMetWeek(currentWeek);
    storage.setItem(KEY_ALLMET, String(currentWeek));
    setAllMetOpen(true);
    setCelebrate(null); // the triumph supersedes any single-identity celebration
  }, [hydrated, allMetFired, liveIdentities, currentWeek]);

  // opts.silent suppresses the per-item toast (the end-of-day review applies
  // several logs at once and shows a single summary toast instead).
  const commitLog = useCallback((idn, mins, note, opts) => {
    const bump = SESSION_POINTS(mins);
    const title = (note || '').trim(); // optional session label typed in the log sheet
    const silent = !!(opts && opts.silent);

    // Logging just records a session with a real timestamp — `actual`, `streak`,
    // and `lastActiveDays` re-derive from `sessions` on the next render. No
    // counters to bump, so a new week's window starts fresh automatically.

    // Relaxation: fill up to the allowance you set; beyond it the allowance just
    // caps (rest is never a failure — there's nowhere for it to "spill" to).
    if (idn.isRelax) {
      const overAllowance = weekPoints(sessions, 'relax') + bump >= relax.desired;
      setSessions((s) => { const ts = Date.now(); return [{ id: 'relax', sid: newSessionId(), label: title || 'Relaxation', mins, ts, when: fmtWhen(ts) }, ...s]; });
      setLogOpen(false);
      if (!silent) showToast({ kind: 'log', name: 'Relaxation', mins, idn, full: overAllowance }, 2800);
      return;
    }

    // did this log push the identity from under its intention to met? (celebrate
    // once, on the crossing — not every log after it's already met). Computed
    // from the live (derived) actual plus this session's bump.
    const cur = liveIdentities.find((x) => x.id === idn.id);
    const newActual = cur ? Math.min(60, cur.actual + bump) : 0;
    const metNow = cur && cur.desired > 0 && cur.actual < cur.desired && newActual >= cur.desired;
    // projected list (only `actual` matters for the all-met check)
    const nextIdentities = liveIdentities.map((i) => (i.id === idn.id ? { ...i, actual: newActual } : i));

    const sid = newSessionId();
    const ts = Date.now();
    setSessions((s) => [{ id: idn.id, sid, label: title || idn.name + ' session', mins, ts, when: fmtWhen(ts) }, ...s]);
    // a typed note becomes a journal entry tied to this session (a milestone if
    // the user marked it). Empty note → no entry. We never interpret the text.
    if (title) {
      const isMile = !!(opts && opts.milestone);
      setJournal((j) => [{ id: newSessionId(), identityId: idn.id, type: isMile ? 'milestone' : 'note', text: title, ts, sessionId: sid }, ...j]);
    }
    setLogOpen(false);
    // if this log completes the week, let the reactive all-met effect own the
    // moment (whole-week triumph > single-identity crossing > plain toast) — skip
    // the single celebration/toast so they don't flash under the triumph.
    const willFireAllMet = !allMetFired && nextIdentities.length > 0 && nextIdentities.every((i) => i.actual >= i.desired);
    if (willFireAllMet) return;
    if (metNow && !silent) setCelebrate({ ...cur, actual: newActual });
    else if (!silent) showToast({ kind: 'log', name: idn.name, mins, idn });
  }, [liveIdentities, relax, sessions, showToast, allMetFired]);

  const clearCelebrate = useCallback(() => setCelebrate(null), []);

  // Standalone journal entry (from the Journal tab / Identity Detail composer).
  // type 'note' | 'milestone'. Empty text is ignored. We never read the text.
  const addJournalEntry = useCallback(({ identityId, type, text, sessionId }) => {
    const body = (text || '').trim();
    if (!body) return;
    setJournal((j) => [{ id: newSessionId(), identityId, type: type === 'milestone' ? 'milestone' : 'note', text: body, ts: Date.now(), sessionId: sessionId || null }, ...j]);
  }, []);
  const removeJournalEntry = useCallback((id) => setJournal((j) => j.filter((e) => e.id !== id)), []);

  // Retire an identity: pull it from the active set (lists, visualizations, log
  // targets, alignment) but keep it in `retired` so its past sessions still
  // resolve a name/glyph/color in history. Closes the Detail screen it came from.
  const retireIdentity = useCallback(
    (id) => {
      const found = identities.find((i) => i.id === id);
      if (!found) return;
      setIdentities((prev) => prev.filter((i) => i.id !== id));
      setRetired((r) => [found, ...r.filter((x) => x.id !== id)]);
      setDetail(null);
      setCosmosFocus(null);
      showToast({ kind: 'retire', name: found.name });
    },
    [identities, showToast]
  );

  // Rest an identity for THIS week — same effect as the rest toggle in the
  // Re-plan sheet: pause it at 0% (no intention to meet, excluded from the
  // balance) without retiring it. Reversible by re-planning the week, which
  // reopens a 0% identity as "resting". Snapshots the plan in force so history
  // stays honest. desired lives on the raw `identities` state.
  const restIdentity = useCallback((id) => {
    const found = identities.find((i) => i.id === id);
    if (!found || found.desired === 0) return;
    const next = identities.map((i) => (i.id === id ? { ...i, desired: 0 } : i));
    setIdentities(next);
    setPlanHistory((h) => ({ ...h, [weekStartMs()]: Object.fromEntries(next.map((i) => [i.id, i.desired])) }));
    showToast({ kind: 'notice', message: `${found.name} is resting this week — log freely.` });
  }, [identities, showToast]);

  // End-of-day review: apply several logs at once. entries: [{ id, mins }].
  // Reuses commitLog per entry (so identity bumps / relax / sessions all stay
  // correct), silenced, then shows one summary toast.
  const openReview = useCallback(() => setReview(true), []);
  const closeReview = useCallback(() => setReview(false), []);
  const commitReview = useCallback(
    (entries) => {
      const targets = liveRelax.tracked ? [...liveIdentities, liveRelax] : liveIdentities;
      let totalMins = 0;
      let count = 0;
      entries.forEach(({ id, mins }) => {
        const idn = targets.find((x) => x.id === id);
        if (idn && mins > 0) {
          commitLog(idn, mins, undefined, { silent: true });
          totalMins += mins;
          count += 1;
        }
      });
      setReview(false);
      // if the batch completed the week, the reactive all-met effect fires the
      // triumph (over this toast); otherwise the summary toast stands alone.
      if (count > 0) showToast({ kind: 'review', count, mins: totalMins });
    },
    [liveIdentities, liveRelax, commitLog, showToast]
  );

  const openPlan = useCallback(() => setPlanOpen(true), []);
  const closePlan = useCallback(() => setPlanOpen(false), []);
  const commitWeekPlan = useCallback((plan) => {
    setIdentities((prev) => prev.map((i) => (plan[i.id] != null ? { ...i, desired: plan[i.id] } : i)));
    // snapshot this week's plan so completed weeks keep the intention they were
    // actually planned with (keyed by week start; re-committing overwrites it).
    setPlanHistory((h) => ({ ...h, [weekStartMs()]: { ...plan } }));
    setWeekPlanned(true);
    storage.setItem(KEY_WEEK, '1');
    // re-planning re-arms the whole-week celebration (new intentions to meet),
    // even within the same week — clear the per-week stamp so it can fire again.
    setAllMetWeek(0);
    storage.removeItem(KEY_ALLMET);
    setPlanOpen(false);
    showToast({ kind: 'plan' });
  }, [showToast]);

  const goTo = useCallback((t) => {
    setTab(t);
    setCosmosFocus(null); // release any focused cosmos star when changing tabs
    setDetail(null); // leave the Detail screen when switching tabs
  }, []);

  const focusCosmos = useCallback((idn) => setCosmosFocus(idn), []);
  const clearCosmos = useCallback(() => setCosmosFocus(null), []);

  // Open the full Detail screen for an identity (from the cosmos focus panel).
  // Releasing the cosmos focus dismisses the floating panel as we navigate in.
  const openDetail = useCallback((idn) => {
    setCosmosFocus(null);
    setDetail(idn);
  }, []);
  const closeDetail = useCallback(() => setDetail(null), []);

  // Edit an identity's name and/or color. A custom `hue` overrides the canonical
  // `palette` (identityColors prefers palette, so we clear it). Empty name is
  // ignored. setIdentities triggers the persistence + sync effect on its own.
  const openEditIdentity = useCallback((idn) => setEditing(idn), []);
  const closeEditIdentity = useCallback(() => setEditing(null), []);
  const editIdentity = useCallback((id, changes) => {
    setIdentities((prev) => prev.map((i) => {
      if (i.id !== id) return i;
      const next = { ...i };
      if (typeof changes.name === 'string' && changes.name.trim()) next.name = changes.name.trim();
      if (typeof changes.hue === 'number') {
        next.hue = ((changes.hue % 360) + 360) % 360;
        next.palette = undefined; // let the custom hue win over a canonical palette
      }
      return next;
    }));
    setEditing(null);
  }, []);

  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  const openSchedule = useCallback(() => setScheduleOpen(true), []);
  const closeSchedule = useCallback(() => setScheduleOpen(false), []);
  // commit the arranged week (a session layout that helps hit the % plan — it
  // doesn't change intentions, the % sheet owns those). Persisted week-scoped.
  // Also asks for notification permission (once) and schedules a local reminder
  // 30 minutes before each upcoming session, so the plan actually nudges.
  const commitSchedule = useCallback(async (plan, constraints) => {
    const ws = weekStartMs();
    // drop the previous plan's reminders so re-planning doesn't stack duplicates
    if (scheduleData && Array.isArray(scheduleData.notifIds)) notifications.cancelReminders(scheduleData.notifIds);

    let notifIds = [];
    const hasSessions = plan.some((d) => d.sessions.length > 0);
    // schedule reminders only when the master switch is on AND the OS allows it.
    let granted = false;
    if (remindersOn) {
      granted = await notifications.ensurePermission(); // prompts only if not asked yet
      if (granted) notifIds = await notifications.scheduleSessionReminders(buildReminderItems(plan, ws, identities));
    }

    const data = { weekStart: ws, plan, constraints, notifIds };
    setScheduleData(data);
    storage.setItem(KEY_SCHEDULE, JSON.stringify(data));
    setScheduleOpen(false);

    // surface a gentle message so a silent "no reminders" state isn't invisible
    if (!remindersOn && hasSessions) {
      showToast({ kind: 'notice', message: 'Reminders are off — turn them on in Settings to get nudged.' }, 4200);
    } else if (!granted && hasSessions) {
      showToast({ kind: 'notice', message: 'Allow notifications in Settings to get nudged before sessions.' }, 4200);
    } else if (notifIds.length) {
      showToast({ kind: 'notice', message: 'Week arranged · I’ll nudge you 30 min before each session.' }, 3200);
    } else {
      showToast({ kind: 'notice', message: 'Week arranged.' }, 2400);
    }
  }, [scheduleData, identities, remindersOn, showToast]);
  const clearSchedule = useCallback(() => {
    if (scheduleData && Array.isArray(scheduleData.notifIds)) notifications.cancelReminders(scheduleData.notifIds);
    setScheduleData(null);
    storage.removeItem(KEY_SCHEDULE);
  }, [scheduleData]);

  // Add one or more identities by name (from the catalog or typed by the user).
  // If a name matches a RETIRED identity, RESTORE that one — same id, color,
  // glyph, and intention — so its logged history (sessions keyed by that id)
  // reconnects in Reflect / Identity Detail, and no duplicate is left in
  // `retired`. Otherwise create fresh with the next well-separated palette hue.
  // Names already active (case-insensitive) are skipped.
  const addIdentities = useCallback(
    (names) => {
      if (!names || !names.length) return;
      // decide restore-vs-create up front from current state (synchronous), so we
      // can also prune `retired` without relying on the setState updater timing.
      const activeNames = new Set(identities.map((i) => i.name.toLowerCase()));
      const toRestore = [];
      const toCreate = [];
      (names || []).forEach((raw) => {
        const name = (raw || '').trim();
        if (!name || activeNames.has(name.toLowerCase())) return;
        activeNames.add(name.toLowerCase()); // de-dupe within this batch too
        const wasRetired = retired.find((i) => i.name.toLowerCase() === name.toLowerCase());
        if (wasRetired) toRestore.push(wasRetired);
        else toCreate.push(name);
      });
      if (toRestore.length || toCreate.length) {
        setIdentities((prev) => {
          const acc = [...prev];
          toRestore.forEach((idn) => acc.push({ ...idn }));
          toCreate.forEach((name) => {
            const hue = assignHue([...acc, relax]);
            acc.push({ id: name.toLowerCase().replace(/\s+/g, '-'), name, glyph: name[0].toUpperCase(), hue, desired: 10, actual: 0, lastActiveDays: 99, streak: 0 });
          });
          return acc;
        });
        if (toRestore.length) {
          const restoredIds = new Set(toRestore.map((i) => i.id));
          setRetired((r) => r.filter((x) => !restoredIds.has(x.id)));
        }
      }
      setAddOpen(false);
    },
    [identities, retired, relax]
  );
  const openAdd = useCallback(() => setAddOpen(true), []);
  const closeAdd = useCallback(() => setAddOpen(false), []);

  const setDesired = useCallback((id, v) => {
    setIdentities((prev) => prev.map((i) => (i.id === id ? { ...i, desired: v } : i)));
  }, []);

  const themeObj = themes[theme] || themes.dark;
  const align = alignmentFn(liveIdentities);
  // the live calendar week (label + day-of-week), recomputed when it rolls over
  const week = useMemo(
    () => ({ label: weekLabel(), short: 'This week', daysIn: weekDayIndex(), daysTotal: 7 }),
    [currentWeek]
  );
  // what you can log time to: your identities, plus Relaxation if it's tracked
  const logTargets = liveRelax.tracked ? [...liveIdentities, liveRelax] : liveIdentities;

  const value = useMemo(
    () => ({
      theme,
      themeObj,
      setTheme,
      started,
      hydrated,
      tab,
      goTo,
      form,
      setForm,
      identities: liveIdentities,
      setIdentities,
      retired,
      retireIdentity,
      restIdentity,
      relax: liveRelax,
      sessions,
      planHistory,
      journal,
      joinedAt,
      addJournalEntry,
      removeJournalEntry,
      align,
      week,
      logTargets,
      logOpen,
      logPreset,
      openLog,
      closeLog,
      commitLog,
      planOpen,
      openPlan,
      closePlan,
      commitWeekPlan,
      weekPlanned,
      addOpen,
      openAdd,
      closeAdd,
      addIdentities,
      cosmosFocus,
      focusCosmos,
      clearCosmos,
      detail,
      openDetail,
      closeDetail,
      editing,
      openEditIdentity,
      closeEditIdentity,
      editIdentity,
      settingsOpen,
      openSettings,
      closeSettings,
      scheduleOpen,
      openSchedule,
      closeSchedule,
      schedule,
      commitSchedule,
      clearSchedule,
      review,
      openReview,
      closeReview,
      commitReview,
      celebrate,
      clearCelebrate,
      allMetOpen,
      closeAllMet,
      reminder,
      setReminderEnabled,
      setReminderTime,
      remindersOn,
      setRemindersOn,
      freeHours,
      setFreeHours,
      setRelaxAllowance,
      session,
      syncStatus,
      lastSyncedAt,
      backupOpen,
      openBackup,
      closeBackup,
      signOut,
      exportData,
      deleteAccount,
      authConfigured: auth.isConfigured,
      userName,
      setUserName,
      authSeen,
      markAuthSeen,
      setDesired,
      seedOnboarding,
      enter,
      restart,
      toast,
      // helper: resolve an identity's colors for the active theme
      colorsFor: (idn) => identityColors(idn, themeObj),
    }),
    [
      theme, themeObj, setTheme, started, hydrated, tab, goTo, form, setForm, liveIdentities, retired, retireIdentity, restIdentity,
      liveRelax, sessions, planHistory, journal, joinedAt, addJournalEntry, removeJournalEntry, align, week, logTargets, logOpen, logPreset, openLog, closeLog,
      commitLog, planOpen, openPlan, closePlan, commitWeekPlan, weekPlanned,
      addOpen, openAdd, closeAdd, addIdentities, cosmosFocus,
      focusCosmos, clearCosmos, detail, openDetail, closeDetail, editing, openEditIdentity, closeEditIdentity, editIdentity, settingsOpen, openSettings, closeSettings,
      scheduleOpen, openSchedule, closeSchedule, schedule, commitSchedule, clearSchedule, review, openReview, closeReview, commitReview,
      celebrate, clearCelebrate, allMetOpen, closeAllMet, reminder, setReminderEnabled, setReminderTime, remindersOn, setRemindersOn, freeHours, setFreeHours, setRelaxAllowance,
      session, syncStatus, lastSyncedAt, backupOpen, openBackup, closeBackup, signOut, exportData, deleteAccount, userName, setUserName, authSeen, markAuthSeen,
      setDesired, seedOnboarding, enter, restart, toast,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

/* Convenience: theme object + color resolver, used by leaf components that
   don't need the whole store. */
export function useTheme() {
  const { themeObj, colorsFor } = useStore();
  return { t: themeObj, colorsFor };
}
