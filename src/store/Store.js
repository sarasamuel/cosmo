/* App store — a single React context mirroring the prototype's App-level state.
   Holds identities, the drift bucket (with per-app tracked/pct/mins), sessions,
   active tab, theme, onboarding flag, and transient log-sheet/toast state.
   Theme + onboarding-complete are persisted to AsyncStorage. Drift `actual` is
   always derived from the apps array (never stored twice). */

import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as storage from '../lib/storage';
import * as notifications from '../lib/notifications';
import {
  IDENTITIES, DRIFT, RELAX, SESSIONS, THIS_WEEK, FREE_HOURS_WEEK,
  alignment as alignmentFn, driftSum, driftActual, assignHue,
} from '../data/data';
import { themes, identityColors } from '../theme/theme';

const StoreContext = createContext(null);

const KEY_THEME = 'cosmo-theme';
const KEY_STARTED = 'cosmo-started';
const KEY_WEEK = 'cosmo-week-' + THIS_WEEK.label;
const KEY_ALLMET = 'cosmo-allmet-' + THIS_WEEK.label; // fired-once flag for the whole-week celebration
const KEY_FORM = 'cosmo-form';
const KEY_DATA = 'cosmo-data'; // mutable domain state (identities/drift/relax/sessions)
const KEY_REMINDER = 'cosmo-reminder'; // { enabled, hour, minute } for the daily local reminder
const KEY_LASTNOTIF = 'cosmo-lastnotif'; // delivery stamp of the last reminder tap we opened the review for
const KEY_FREEHOURS = 'cosmo-freehours'; // weekly free hours the user has to allocate (from onboarding / re-plan)

const DEFAULT_REMINDER = { enabled: false, hour: 9, minute: 0 };

export function StoreProvider({ children }) {
  const [form, setFormState] = useState('orbit');
  const [theme, setThemeName] = useState('dark');
  const [started, setStarted] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const [tab, setTab] = useState('home');
  const [identities, setIdentities] = useState(IDENTITIES);
  const [retired, setRetired] = useState([]); // retired identities — kept for history, out of active lists/viz
  const [drift, setDrift] = useState(DRIFT);
  const [relax, setRelax] = useState(RELAX);
  const [sessions, setSessions] = useState(SESSIONS);

  const [logOpen, setLogOpen] = useState(false);
  const [logPreset, setLogPreset] = useState(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [weekPlanned, setWeekPlanned] = useState(false);
  const [freeHours, setFreeHoursState] = useState(FREE_HOURS_WEEK.def);
  const [addOpen, setAddOpen] = useState(false);
  const [cosmosFocus, setCosmosFocus] = useState(null); // focused identity in the cosmos card
  const [detail, setDetail] = useState(null); // identity whose full Detail screen is open (null = none)
  const [review, setReview] = useState(false); // end-of-day review screen open (from the reminder tap)
  const [celebrate, setCelebrate] = useState(null); // identity that just reached its intention (celebration overlay)
  const [allMetOpen, setAllMetOpen] = useState(false); // whole-week "every intention met" celebration
  const [allMetFired, setAllMetFired] = useState(false); // already celebrated this week (fire once)
  const [reminder, setReminder] = useState(DEFAULT_REMINDER); // daily local notification prefs
  const [toast, setToast] = useState(null);

  // hydrate persisted prefs + the mutable domain state. storage.getItem logs and
  // returns null on a failed read (never rejects), so a read error degrades to
  // seed defaults *with a logged signal* rather than silently.
  useEffect(() => {
    (async () => {
      const [t, s, w, f, d, rem, fh, am] = await Promise.all([
        storage.getItem(KEY_THEME),
        storage.getItem(KEY_STARTED),
        storage.getItem(KEY_WEEK),
        storage.getItem(KEY_FORM),
        storage.getItem(KEY_DATA),
        storage.getItem(KEY_REMINDER),
        storage.getItem(KEY_FREEHOURS),
        storage.getItem(KEY_ALLMET),
      ]);
      if (t === 'light' || t === 'dark') setThemeName(t);
      if (am === '1') setAllMetFired(true);
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
          const data = JSON.parse(d);
          if (Array.isArray(data?.identities) && data.identities.length) setIdentities(data.identities);
          if (Array.isArray(data?.retired)) setRetired(data.retired);
          if (data?.drift) setDrift(data.drift);
          if (data?.relax) setRelax(data.relax);
          if (Array.isArray(data?.sessions)) setSessions(data.sessions);
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
  // a stale one doesn't. We only schedule our own notification, so any response
  // is the reminder.
  useEffect(() => {
    const unsub = notifications.addResponseListener(() => setReview(true));
    (async () => {
      const resp = await notifications.getInitialResponse();
      if (!resp) return;
      const stamp = String((resp.notification && resp.notification.date) || '');
      if (stamp) {
        const seen = await storage.getItem(KEY_LASTNOTIF);
        if (stamp === seen) return; // already handled this exact delivery
        storage.setItem(KEY_LASTNOTIF, stamp);
      }
      setReview(true);
    })();
    return unsub;
  }, []);

  // persist the mutable domain state whenever it changes — gated on `hydrated`
  // so the initial seed values can't clobber stored data before the load above
  // completes. Written as one atomic blob (no partial/half-saved states).
  useEffect(() => {
    if (!hydrated) return;
    storage.setItem(KEY_DATA, JSON.stringify({ identities, retired, drift, relax, sessions }));
  }, [hydrated, identities, retired, drift, relax, sessions]);

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

  const setTheme = useCallback((t) => {
    setThemeName(t);
    storage.setItem(KEY_THEME, t);
  }, []);

  const setForm = useCallback((f) => { setFormState(f); storage.setItem(KEY_FORM, f); }, []);

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
    if (!next.enabled) {
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
  }, []);
  const setReminderEnabled = useCallback((enabled) => persistReminder({ ...reminder, enabled }), [reminder, persistReminder]);
  const setReminderTime = useCallback((hour, minute) => persistReminder({ ...reminder, enabled: true, hour, minute }), [reminder, persistReminder]);

  const openLog = useCallback((preset) => {
    setLogPreset(preset && preset.id ? preset : null);
    setLogOpen(true);
  }, []);
  const closeLog = useCallback(() => setLogOpen(false), []);

  const closeAllMet = useCallback(() => setAllMetOpen(false), []);

  // Whole-week triumph — fire as soon as every active identity has met its
  // intention and we haven't celebrated yet this week. Reactive (watches state),
  // so it catches *any* path to all-met: a log, the end-of-day review, planning
  // intentions down, or retiring the last unmet identity. Gated on `hydrated`
  // (no fire mid-load) and the persisted per-week flag (shows once; commitWeekPlan
  // re-arms it). desired 0 (rested) counts as trivially met.
  useEffect(() => {
    if (!hydrated || allMetFired) return;
    const allMet = identities.length > 0 && identities.every((i) => i.actual >= i.desired);
    if (!allMet) return;
    setAllMetFired(true);
    storage.setItem(KEY_ALLMET, '1');
    setAllMetOpen(true);
    setCelebrate(null); // the triumph supersedes any single-identity celebration
  }, [hydrated, allMetFired, identities]);

  // opts.silent suppresses the per-item toast (the end-of-day review applies
  // several logs at once and shows a single summary toast instead).
  const commitLog = useCallback((idn, mins, note, opts) => {
    const bump = Math.max(1, Math.round(mins / 12));
    const title = (note || '').trim(); // optional session label typed in the log sheet
    const silent = !!(opts && opts.silent);

    // Relaxation: fill up to the allowance you set; the rest is honest Drift.
    if (idn.isRelax) {
      // computed purely from current state (relax is in this callback's deps),
      // so the setState updaters stay side-effect free
      const space = Math.max(0, relax.desired - relax.actual);
      const toRelax = Math.min(bump, space);
      const spill = bump - toRelax;
      setRelax((r) => ({ ...r, actual: Math.min(r.desired, r.actual + toRelax), lastActiveDays: 0 }));
      // any overflow beyond the allowance becomes Drift, tracked as `spill` so it
      // survives app toggles (drift's `actual` is derived from apps + spill)
      if (spill > 0) setDrift((d) => ({ ...d, spill: (d.spill || 0) + spill }));
      setSessions((s) => [{ id: 'relax', label: title || 'Relaxation', mins, when: 'Just now' }, ...s]);
      setLogOpen(false);
      if (!silent) showToast({ kind: 'log', name: 'Relaxation', mins, idn, spill }, 2800);
      return;
    }

    // did this log push the identity from under its intention to met? (celebrate
    // once, on the crossing — not every log after it's already met)
    const cur = identities.find((x) => x.id === idn.id);
    const newActual = cur ? Math.min(60, cur.actual + bump) : 0;
    const metNow = cur && cur.desired > 0 && cur.actual < cur.desired && newActual >= cur.desired;
    // projected list (only `actual` matters for the all-met check) — kept as a
    // concrete array for the transition test; the state update stays functional
    // so batched (review) logs still compose correctly.
    const nextIdentities = identities.map((i) => (i.id === idn.id ? { ...i, actual: newActual } : i));

    setIdentities((prev) =>
      prev.map((i) =>
        i.id === idn.id
          ? { ...i, actual: Math.min(60, i.actual + bump), lastActiveDays: 0, streak: i.streak + 1 }
          : i
      )
    );
    // logging an identity reclaims drift: shrink the tracked apps' share (the
    // app-derived portion). `actual` is derived, so we only scale the apps.
    setDrift((d) => {
      const appSum = driftSum(d.apps);
      const next = Math.max(0, appSum - Math.round(bump / 2));
      const ratio = appSum ? next / appSum : 0;
      return {
        ...d,
        apps: d.apps.map((a) =>
          a.tracked ? { ...a, pct: a.pct * ratio, mins: Math.round(a.mins * ratio) } : a
        ),
      };
    });
    setSessions((s) => [{ id: idn.id, label: title || idn.name + ' session', mins, when: 'Just now' }, ...s]);
    setLogOpen(false);
    // if this log completes the week, let the reactive all-met effect own the
    // moment (whole-week triumph > single-identity crossing > plain toast) — skip
    // the single celebration/toast so they don't flash under the triumph.
    const willFireAllMet = !allMetFired && nextIdentities.length > 0 && nextIdentities.every((i) => i.actual >= i.desired);
    if (willFireAllMet) return;
    if (metNow && !silent) setCelebrate({ ...cur, actual: newActual });
    else if (!silent) showToast({ kind: 'log', name: idn.name, mins, idn });
  }, [identities, relax, showToast, allMetFired]);

  const clearCelebrate = useCallback(() => setCelebrate(null), []);

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

  // End-of-day review: apply several logs at once. entries: [{ id, mins }].
  // Reuses commitLog per entry (so drift reclaim / relax spill / sessions all
  // stay correct), silenced, then shows one summary toast.
  const openReview = useCallback(() => setReview(true), []);
  const closeReview = useCallback(() => setReview(false), []);
  const commitReview = useCallback(
    (entries) => {
      const targets = relax.tracked ? [...identities, relax] : identities;
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
    [identities, relax, commitLog, showToast]
  );

  const openPlan = useCallback(() => setPlanOpen(true), []);
  const closePlan = useCallback(() => setPlanOpen(false), []);
  const commitWeekPlan = useCallback((plan) => {
    setIdentities((prev) => prev.map((i) => (plan[i.id] != null ? { ...i, desired: plan[i.id] } : i)));
    setWeekPlanned(true);
    storage.setItem(KEY_WEEK, '1');
    // re-planning re-arms the whole-week celebration (new intentions to meet)
    setAllMetFired(false);
    storage.removeItem(KEY_ALLMET);
    setPlanOpen(false);
    showToast({ kind: 'plan' });
  }, [showToast]);

  const toggleDriftApp = useCallback((id) => {
    setDrift((d) => ({
      ...d,
      apps: d.apps.map((a) => (a.id === id ? { ...a, tracked: !a.tracked } : a)),
    }));
  }, []);

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

  // Add one or more identities by name (from the catalog or typed by the user).
  // Each gets the next palette hue far enough from every hue already in use, so
  // colors stay distinct. Names already present (case-insensitive) are skipped.
  const addIdentities = useCallback(
    (names) => {
      if (!names || !names.length) return;
      setIdentities((prev) => {
        const acc = [...prev];
        names.forEach((raw) => {
          const name = (raw || '').trim();
          if (!name) return;
          if (acc.some((i) => i.name.toLowerCase() === name.toLowerCase())) return;
          const hue = assignHue([...acc, drift, relax]);
          acc.push({
            id: name.toLowerCase().replace(/\s+/g, '-'),
            name,
            glyph: name[0].toUpperCase(),
            hue,
            desired: 10,
            actual: 0,
            lastActiveDays: 99,
            streak: 0,
          });
        });
        return acc;
      });
      setAddOpen(false);
    },
    [drift, relax]
  );
  const openAdd = useCallback(() => setAddOpen(true), []);
  const closeAdd = useCallback(() => setAddOpen(false), []);

  const setDesired = useCallback((id, v) => {
    setIdentities((prev) => prev.map((i) => (i.id === id ? { ...i, desired: v } : i)));
  }, []);

  const themeObj = themes[theme] || themes.dark;
  // Drift's `actual` is derived (apps + spill), never stored. Consumers get this
  // view; the raw `drift` state (apps/spill) is what's mutated and persisted.
  const driftView = useMemo(() => ({ ...drift, actual: driftActual(drift) }), [drift]);
  const align = alignmentFn(identities, driftView);
  // what you can log time to: your identities, plus Relaxation if it's tracked
  const logTargets = relax.tracked ? [...identities, relax] : identities;

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
      identities,
      setIdentities,
      retired,
      retireIdentity,
      drift: driftView,
      relax,
      sessions,
      align,
      week: THIS_WEEK,
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
      toggleDriftApp,
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
      freeHours,
      setFreeHours,
      setDesired,
      enter,
      restart,
      toast,
      // helper: resolve an identity's colors for the active theme
      colorsFor: (idn) => identityColors(idn, themeObj),
    }),
    [
      theme, themeObj, setTheme, started, hydrated, tab, goTo, form, setForm, identities, retired, retireIdentity, driftView,
      relax, sessions, align, logTargets, logOpen, logPreset, openLog, closeLog,
      commitLog, planOpen, openPlan, closePlan, commitWeekPlan, weekPlanned,
      toggleDriftApp, addOpen, openAdd, closeAdd, addIdentities, cosmosFocus,
      focusCosmos, clearCosmos, detail, openDetail, closeDetail, review, openReview, closeReview, commitReview,
      celebrate, clearCelebrate, allMetOpen, closeAllMet, reminder, setReminderEnabled, setReminderTime, freeHours, setFreeHours,
      setDesired, enter, restart, toast,
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
