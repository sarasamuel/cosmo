/* OKLCH -> sRGB conversion.
   React Native's style engine cannot parse CSS `oklch(...)` color strings, so
   every color in the original design system (which was authored in OKLCH) is
   converted to a concrete hex / rgba string here at definition time.

   Reference: Björn Ottosson's OKLab/OKLCH -> linear sRGB matrices. */

function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

// linear-light channel -> gamma-encoded sRGB (0..1)
function gamma(x) {
  return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
}

function toByte(x) {
  return Math.round(clamp01(x) * 255);
}

/* L: 0..1 lightness, C: chroma, H: hue in degrees -> {r,g,b} bytes 0..255 */
export function oklchToRgb(L, C, H) {
  const hr = (H * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);

  // OKLab -> approximate (non-linear) LMS
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  // LMS -> linear sRGB
  const rl = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const gl = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return {
    r: toByte(gamma(rl)),
    g: toByte(gamma(gl)),
    b: toByte(gamma(bl)),
  };
}

export function oklch(L, C, H) {
  const { r, g, b } = oklchToRgb(L, C, H);
  return `rgb(${r}, ${g}, ${b})`;
}

export function oklcha(L, C, H, alpha) {
  const { r, g, b } = oklchToRgb(L, C, H);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* Parse an "oklch(L C H)" or "oklch(L C H / a)" string (as written in the
   original CSS) and return an rgb/rgba string. Tolerant of extra whitespace. */
export function parseOklch(str) {
  const m = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)\s*)?\)/i.exec(str);
  if (!m) return str;
  const [, L, C, H, A] = m;
  return A != null
    ? oklcha(+L, +C, +H, +A)
    : oklch(+L, +C, +H);
}
