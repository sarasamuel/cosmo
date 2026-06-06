/* Design tokens ported from styles.css.
   The original used CSS custom properties for two themes ("Celestial dawn"
   light / "Deep space" dark, the hero). React Native has no CSS variables, so
   each theme is a plain object of resolved color strings, consumed through
   ThemeContext. OKLCH colors are converted to rgb()/rgba() via lib/color. */

import { oklch, oklcha } from '../lib/color';

const radii = { sm: 12, md: 18, lg: 26, xl: 34 };

/* RN shadow approximations of the three CSS shadow tiers. iOS uses the shadow*
   props; Android uses elevation. */
const shadowLight = {
  sm: { shadowColor: '#1e1c3c', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  md: { shadowColor: '#1e1c3c', shadowOpacity: 0.12, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
  lg: { shadowColor: '#1e1c3c', shadowOpacity: 0.18, shadowRadius: 40, shadowOffset: { width: 0, height: 22 }, elevation: 16 },
};
const shadowDark = {
  sm: { shadowColor: '#000000', shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  md: { shadowColor: '#000000', shadowOpacity: 0.6, shadowRadius: 28, shadowOffset: { width: 0, height: 12 }, elevation: 10 },
  lg: { shadowColor: '#000000', shadowOpacity: 0.65, shadowRadius: 50, shadowOffset: { width: 0, height: 22 }, elevation: 18 },
};

export const lightTheme = {
  name: 'light',
  bg: '#ecebf6',
  bg2: '#e3e2f1',
  surface: '#ffffff',
  surface2: '#f3f3fb',
  surface3: '#e8e8f4',
  ink: '#1f1e2e',
  inkSoft: '#5d5c72',
  inkFaint: '#9897b0',
  line: 'rgba(30,28,60,0.10)',
  line2: 'rgba(30,28,60,0.05)',
  glow: 'rgba(120,110,200,0.12)',
  star: '#9a9dca',
  ring: 'rgba(40,36,80,0.18)',
  core1: '#f0c258',
  core2: oklch(0.8, 0.1, 72),
  cstInk: '#393566', // constellation name + connecting lines (dark on light)
  good: oklch(0.6, 0.085, 168),
  warn: oklch(0.66, 0.13, 50),
  // nebula glow blobs for the screen backdrop
  nebula: ['#f8f7ff', '#edecf8', 'rgba(176,158,230,0.26)', 'rgba(150,180,230,0.22)'],
  radii,
  shadow: shadowLight,
  id: {
    writer: { color: oklch(0.6, 0.1, 252), soft: oklcha(0.6, 0.1, 252, 0.13), deep: '#3f53a6' },
    reader: { color: oklch(0.63, 0.115, 40), soft: oklcha(0.63, 0.115, 40, 0.13), deep: '#b85b2c' },
    engineer: { color: oklch(0.6, 0.085, 168), soft: oklcha(0.6, 0.085, 168, 0.13), deep: '#1f7d5e' },
    musician: { color: oklch(0.585, 0.105, 322), soft: oklcha(0.585, 0.105, 322, 0.13), deep: '#9b3b7d' },
    painter: { color: oklch(0.7, 0.105, 70), soft: oklcha(0.7, 0.105, 70, 0.13), deep: '#9a7a24' },
    drift: { color: oklch(0.62, 0.014, 280), soft: oklcha(0.62, 0.014, 280, 0.13), deep: '#4a4757' },
    relax: { color: oklch(0.64, 0.075, 210), soft: oklcha(0.64, 0.075, 210, 0.13), deep: '#2f6d82' },
  },
};

export const darkTheme = {
  name: 'dark',
  bg: '#0a0a15',
  bg2: '#060610',
  surface: 'rgba(26,24,44,0.62)',
  surface2: 'rgba(38,35,62,0.58)',
  surface3: 'rgba(54,50,84,0.5)',
  ink: '#eef0fb',
  inkSoft: '#a9a8c6',
  inkFaint: '#6c6a8a',
  line: 'rgba(160,160,230,0.13)',
  line2: 'rgba(160,160,230,0.06)',
  glow: 'rgba(150,160,255,0.10)',
  star: '#cfd3ff',
  ring: 'rgba(180,188,255,0.42)',
  core1: '#fff3d2',
  core2: oklch(0.8, 0.13, 72),
  cstInk: '#fff3d2', // constellation name + connecting lines (warm on deep space)
  good: oklch(0.76, 0.1, 168),
  warn: oklch(0.8, 0.13, 64),
  nebula: ['#1b1838', '#0c0b1c', 'rgba(108,82,180,0.30)', 'rgba(46,96,150,0.24)'],
  radii,
  shadow: shadowDark,
  id: {
    writer: { color: oklch(0.74, 0.11, 254), soft: oklcha(0.74, 0.11, 254, 0.18), deep: '#3f53a6' },
    reader: { color: oklch(0.76, 0.125, 46), soft: oklcha(0.76, 0.125, 46, 0.18), deep: '#b85b2c' },
    engineer: { color: oklch(0.76, 0.1, 168), soft: oklcha(0.76, 0.1, 168, 0.18), deep: '#1f7d5e' },
    musician: { color: oklch(0.74, 0.115, 326), soft: oklcha(0.74, 0.115, 326, 0.18), deep: '#9b3b7d' },
    painter: { color: oklch(0.82, 0.11, 80), soft: oklcha(0.82, 0.11, 80, 0.18), deep: '#9a7a24' },
    drift: { color: oklch(0.66, 0.018, 280), soft: oklcha(0.66, 0.018, 280, 0.18), deep: '#4a4757' },
    relax: { color: oklch(0.76, 0.085, 210), soft: oklcha(0.76, 0.085, 210, 0.18), deep: '#2f6d82' },
  },
};

export const themes = { light: lightTheme, dark: darkTheme };

/* Resolve an identity's concrete colors for the active theme.
   - Canonical personas carry a `palette` key (writer/reader/.../drift).
   - Runtime-added personas carry a numeric `hue` and use the palette formula
     (theme-independent), mirroring data.js mkColor(). */
export function identityColors(idn, theme) {
  if (idn.palette && theme.id[idn.palette]) return theme.id[idn.palette];
  const h = ((idn.hue % 360) + 360) % 360;
  return {
    color: oklch(0.7, 0.12, h),
    soft: oklcha(0.7, 0.12, h, 0.16),
    deep: oklch(0.52, 0.13, h),
  };
}
