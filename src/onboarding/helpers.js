/* Onboarding helpers ported from onboarding.jsx. */
import { paletteHue, FREE_HOURS_WEEK } from '../data/data';
import { oklch } from '../lib/color';

export const FREE_TIME = 'Relaxation Time';

/* Each persona's color is its position in the selection list mapped onto the
   shared palette. "Relaxation Time" is an intentional allowance for rest, so it
   wears the calm teal relax tone instead of a jewel hue. */
export function personaColor(name, idx, theme) {
  if (name === FREE_TIME) return theme.id.relax.color;
  return oklch(0.7, 0.12, paletteHue(idx));
}

/* Cadence presets — the rhythm at which a life is balanced. */
export const CADENCE = {
  day: { key: 'day', label: 'By day', per: '/day', noun: 'each day', min: 1, max: 16, step: 1, def: 7, window: true },
  week: { ...FREE_HOURS_WEEK, key: 'week', label: 'By week', per: '/wk', noun: 'each week', window: false },
  month: { key: 'month', label: 'By month', per: '/mo', noun: 'each month', min: 20, max: 360, step: 5, def: 150, window: false },
};

/* hours (float) -> "1h 24m" / "45m" / "2h" */
export function fmtDur(h) {
  const m = Math.round(h * 60);
  if (m <= 0) return '0m';
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  if (!hh) return mm + 'm';
  if (!mm) return hh + 'h';
  return hh + 'h ' + mm + 'm';
}

/* 24h decimal -> "5:00 PM" */
export function clock(h) {
  const hr = ((Math.round(h) % 24) + 24) % 24;
  const ap = hr < 12 ? 'AM' : 'PM';
  let h12 = hr % 12;
  if (h12 === 0) h12 = 12;
  return h12 + ':00 ' + ap;
}
