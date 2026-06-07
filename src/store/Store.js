/* App store — a single React context mirroring the prototype's App-level state.
   Holds identities, the drift bucket (with per-app tracked/pct/mins), sessions,
   active tab, theme, onboarding flag, and transient log-sheet/toast state.
   Theme + onboarding-complete are persisted to AsyncStorage. Drift `actual` is
   always derived from the apps array (never stored twice). */

import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as storage from '../lib/storage';
import {
  IDENTITIES, DRIFT, RELAX, SESSIONS, THIS_WEEK,
  alignment as alignmentFn, driftSum, driftActual, assignHue,
} from '../data/data';
import { themes, identityColors } from '../theme/theme';

const StoreContext = createContext(null);

const KEY_THEME = 'cosmo-theme';
const KEY_STARTED = 'cosmo-started';
const KEY_WEEK = 'cosmo-week-' + THIS_WEEK.label;
const KEY_FORM = 'cosmo-form';
const KEY_DATA = 'cosmo-data'; // mutable domain state (identities/drift/relax/sessions)

export function StoreProvider({ children }) {
  const [form, setFormState] = useState('constellation');
  const [theme, setThemeName] = useState('dark');
  const [started, setStarted] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const [tab, setTab] = useState('home');
  const [identities, setIdentities] = useState(IDENTITIES);
  const [drift, setDrift] = useState(DRIFT);
  const [relax, setRelax] = useState(RELAX);
  const [sessions, setSessions] = useState(SESSIONS);

  const [logOpen, setLogOpen] = useState(false);
  const [logPreset, setLogPreset] = useState(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [weekPlanned, setWeekPlanned] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [cosmosFocus, setCosmosFocus] = useState(null); // focused identity in the cosmos card
  const [detail, setDetail] = useState(null); // identity whose full Detail screen is open (null = none)
  const [toast, setToast] = useState(null);

  // hydrate persisted prefs + the mutable domain state. storage.getItem logs and
  // returns null on a failed read (never rejects), so a read error degrades to
  // seed defaults *with a logged signal* rather than silently.
  useEffect(() => {
    (async () => {
      const [t, s, w, f, d] = await Promise.all([
        storage.getItem(KEY_THEME),
        storage.getItem(KEY_STARTED),
        storage.getItem(KEY_WEEK),
        storage.getItem(KEY_FORM),
        storage.getItem(KEY_DATA),
      ]);
      if (t === 'light' || t === 'dark') setThemeName(t);
      if (s === '1') setStarted(true);
      if (w === '1') setWeekPlanned(true);
      if (f === 'orbit' || f === 'constellation') setFormState(f);
      if (d) {
        try {
          const data = JSON.parse(d);
          if (Array.isArray(data?.identities) && data.identities.length) setIdentities(data.identities);
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

  // persist the mutable domain state whenever it changes — gated on `hydrated`
  // so the initial seed values can't clobber stored data before the load above
  // completes. Written as one atomic blob (no partial/half-saved states).
  useEffect(() => {
    if (!hydrated) return;
    storage.setItem(KEY_DATA, JSON.stringify({ identities, drift, relax, sessions }));
  }, [hydrated, identities, drift, relax, sessions]);

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

  const openLog = useCallback((preset) => {
    setLogPreset(preset && preset.id ? preset : null);
    setLogOpen(true);
  }, []);
  const closeLog = useCallback(() => setLogOpen(false), []);

  const commitLog = useCallback((idn, mins, note) => {
    const bump = Math.max(1, Math.round(mins / 12));
    const title = (note || '').trim(); // optional session label typed in the log sheet

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
      showToast({ kind: 'log', name: 'Relaxation', mins, idn, spill }, 2800);
      return;
    }

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
    showToast({ kind: 'log', name: idn.name, mins, idn });
  }, [relax, showToast]);

  const openPlan = useCallback(() => setPlanOpen(true), []);
  const closePlan = useCallback(() => setPlanOpen(false), []);
  const commitWeekPlan = useCallback((plan) => {
    setIdentities((prev) => prev.map((i) => (plan[i.id] != null ? { ...i, desired: plan[i.id] } : i)));
    setWeekPlanned(true);
    storage.setItem(KEY_WEEK, '1');
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
      setDesired,
      enter,
      restart,
      toast,
      // helper: resolve an identity's colors for the active theme
      colorsFor: (idn) => identityColors(idn, themeObj),
    }),
    [
      theme, themeObj, setTheme, started, hydrated, tab, goTo, form, setForm, identities, driftView,
      relax, sessions, align, logTargets, logOpen, logPreset, openLog, closeLog,
      commitLog, planOpen, openPlan, closePlan, commitWeekPlan, weekPlanned,
      toggleDriftApp, addOpen, openAdd, closeAdd, addIdentities, cosmosFocus,
      focusCosmos, clearCosmos, detail, openDetail, closeDetail, setDesired, enter, restart, toast,
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
