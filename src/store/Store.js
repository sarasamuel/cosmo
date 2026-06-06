/* App store — a single React context mirroring the prototype's App-level state.
   Holds identities, the drift bucket (with per-app tracked/pct/mins), sessions,
   active tab, theme, onboarding flag, and transient log-sheet/toast state.
   Theme + onboarding-complete are persisted to AsyncStorage. Drift `actual` is
   always derived from the apps array (never stored twice). */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  IDENTITIES, DRIFT, RELAX, SESSIONS, THIS_WEEK,
  alignment as alignmentFn, driftSum, assignHue,
} from '../data/data';
import { themes, identityColors } from '../theme/theme';

const StoreContext = createContext(null);

const KEY_THEME = 'cosmo-theme';
const KEY_STARTED = 'cosmo-started';
const KEY_WEEK = 'cosmo-week-' + THIS_WEEK.label;
const KEY_FORM = 'cosmo-form';

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
  const [toast, setToast] = useState(null);

  // hydrate persisted theme + onboarding flag + this-week-planned flag
  useEffect(() => {
    (async () => {
      try {
        const [t, s, w, f] = await Promise.all([
          AsyncStorage.getItem(KEY_THEME),
          AsyncStorage.getItem(KEY_STARTED),
          AsyncStorage.getItem(KEY_WEEK),
          AsyncStorage.getItem(KEY_FORM),
        ]);
        if (t === 'light' || t === 'dark') setThemeName(t);
        if (s === '1') setStarted(true);
        if (w === '1') setWeekPlanned(true);
        if (f === 'orbit' || f === 'constellation') setFormState(f);
      } catch (e) {
        // ignore — fall back to defaults
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  const setTheme = useCallback((t) => {
    setThemeName(t);
    AsyncStorage.setItem(KEY_THEME, t).catch(() => {});
  }, []);

  const setForm = useCallback((f) => { setFormState(f); AsyncStorage.setItem(KEY_FORM, f).catch(() => {}); }, []);

  const enter = useCallback(() => {
    setStarted(true);
    AsyncStorage.setItem(KEY_STARTED, '1').catch(() => {});
  }, []);

  const restart = useCallback(() => {
    AsyncStorage.removeItem(KEY_STARTED).catch(() => {});
    setTab('home');
    setStarted(false);
  }, []);

  const openLog = useCallback((preset) => {
    setLogPreset(preset && preset.id ? preset : null);
    setLogOpen(true);
  }, []);
  const closeLog = useCallback(() => setLogOpen(false), []);

  const commitLog = useCallback((idn, mins) => {
    const bump = Math.max(1, Math.round(mins / 12));

    // Relaxation: fill up to the allowance you set; the rest is honest Drift.
    if (idn.isRelax) {
      let spill = 0;
      setRelax((r) => {
        const space = Math.max(0, r.desired - r.actual);
        const toRelax = Math.min(bump, space);
        spill = bump - toRelax;
        return { ...r, actual: Math.min(r.desired, r.actual + toRelax), lastActiveDays: 0 };
      });
      // any overflow beyond the allowance becomes Drift
      setDrift((d) => (spill > 0 ? { ...d, actual: Math.min(100, d.actual + spill) } : d));
      setSessions((s) => [{ id: 'relax', label: 'Relaxation', mins, when: 'Just now' }, ...s]);
      setLogOpen(false);
      setToast({ kind: 'log', name: 'Relaxation', mins, idn, spill });
      setTimeout(() => setToast(null), 2800);
      return;
    }

    setIdentities((prev) =>
      prev.map((i) =>
        i.id === idn.id
          ? { ...i, actual: Math.min(60, i.actual + bump), lastActiveDays: 0, streak: i.streak + 1 }
          : i
      )
    );
    setDrift((d) => {
      const next = Math.max(0, d.actual - Math.round(bump / 2));
      const ratio = d.actual ? next / d.actual : 0;
      return {
        ...d,
        actual: next,
        apps: d.apps.map((a) =>
          a.tracked ? { ...a, pct: a.pct * ratio, mins: Math.round(a.mins * ratio) } : a
        ),
      };
    });
    setSessions((s) => [{ id: idn.id, label: idn.name + ' session', mins, when: 'Just now' }, ...s]);
    setLogOpen(false);
    setToast({ kind: 'log', name: idn.name, mins, idn });
    setTimeout(() => setToast(null), 2600);
  }, []);

  const openPlan = useCallback(() => setPlanOpen(true), []);
  const closePlan = useCallback(() => setPlanOpen(false), []);
  const commitWeekPlan = useCallback((plan) => {
    setIdentities((prev) => prev.map((i) => (plan[i.id] != null ? { ...i, desired: plan[i.id] } : i)));
    setWeekPlanned(true);
    AsyncStorage.setItem(KEY_WEEK, '1').catch(() => {});
    setPlanOpen(false);
    setToast({ kind: 'plan' });
    setTimeout(() => setToast(null), 2600);
  }, []);

  const toggleDriftApp = useCallback((id) => {
    setDrift((d) => {
      const apps = d.apps.map((a) => (a.id === id ? { ...a, tracked: !a.tracked } : a));
      return { ...d, apps, actual: driftSum(apps) };
    });
  }, []);

  const goTo = useCallback((t) => {
    setTab(t);
    setCosmosFocus(null); // release any focused cosmos star when changing tabs
  }, []);

  const focusCosmos = useCallback((idn) => setCosmosFocus(idn), []);
  const clearCosmos = useCallback(() => setCosmosFocus(null), []);

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
  const align = alignmentFn(identities, drift);
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
      drift,
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
      setDesired,
      enter,
      restart,
      toast,
      // helper: resolve an identity's colors for the active theme
      colorsFor: (idn) => identityColors(idn, themeObj),
    }),
    [
      theme, themeObj, setTheme, started, hydrated, tab, goTo, form, setForm, identities, drift,
      relax, sessions, align, logTargets, logOpen, logPreset, openLog, closeLog,
      commitLog, planOpen, openPlan, closePlan, commitWeekPlan, weekPlanned,
      toggleDriftApp, addOpen, openAdd, closeAdd, addIdentities, cosmosFocus,
      focusCosmos, clearCosmos, setDesired, enter, restart, toast,
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
