/* Layout tokens + responsive helpers — the single home for spacing and
   breakpoints (the theme owns color/radii; these are theme-independent).
   Centralizing them stops the "this -18 must equal that 18" coupling and the
   scattered unnamed width thresholds from drifting apart. */
import { useWindowDimensions } from 'react-native';

/* Named width breakpoints (px). */
export const BREAKPOINT = {
  hint: 400, // below this, hide secondary hint text in tight headers
  twoCol: 480, // at/above this, two-column card grids; below, single column
  tablet: 600,
};

/* Horizontal padding tokens. Full-bleed helpers reference the SAME token a
   container pads with, so a child can extend exactly to its edges without a
   hardcoded mirror value. */
export const SPACING = {
  cosmosCardPad: 18, // inside the cosmos card (LinearGradient)
  onboardingPad: 44, // onboarding screen horizontal padding
  sheetPad: 40, // bottom-sheet horizontal padding
};

/* Bleed a child to its padded container's edges: pair with a `pad` token. */
export const bleed = (pad) => ({ marginHorizontal: -pad });

/* Responsive main-screen horizontal padding: ~20–24 on phones, up to 36 on
   tablets, scaling smoothly with width. */
const SCREEN_PAD = { min: 20, max: 36, ratio: 0.055 };
export function useScreenPad() {
  const { width } = useWindowDimensions();
  return Math.round(Math.min(SCREEN_PAD.max, Math.max(SCREEN_PAD.min, width * SCREEN_PAD.ratio)));
}

/* Width-based layout flags, named once. */
export function useBreakpoints() {
  const { width } = useWindowDimensions();
  return {
    width,
    showHint: width >= BREAKPOINT.hint,
    twoCol: width >= BREAKPOINT.twoCol,
    tablet: width >= BREAKPOINT.tablet,
  };
}
