# Running Cosmo (React Native / Expo)

This is the React Native (Expo SDK 55) implementation of the Cosmo prototype.
The original design references live in [`design_files/`](design_files/) and the
design handoff is in [`README.md`](README.md).

## Prerequisites

Node was installed for you at `~/.local/node-current` and added to your
`~/.zshrc` PATH. In a fresh terminal, `node -v` should print `v22.x`. If not:

```sh
export PATH="$HOME/.local/node-current/bin:$PATH"
```

## Run it

```sh
npm install        # only needed if node_modules is missing
npx expo start     # opens the dev server + QR code
```

Then:

- **On your phone:** install **Expo Go** (App Store / Play Store), make sure the
  phone is on the same Wi‑Fi as this Mac, and scan the QR code.
- **iOS Simulator:** press `i` (requires the full Xcode app, not just Command
  Line Tools).
- **Android emulator:** press `a` (requires Android Studio + an AVD).

To reset onboarding/theme while testing, use the **Replay the intro** button on
the *You* tab, or clear the app's storage in Expo Go.

## Architecture

| Concern | File |
| --- | --- |
| App root + routing (onboarding ↔ tabs) | [`App.js`](App.js) |
| State + persistence (mirrors prototype `App`) | [`src/store/Store.js`](src/store/Store.js) |
| Data model + helpers | [`src/data/data.js`](src/data/data.js) |
| Theme tokens (light/dark) | [`src/theme/theme.js`](src/theme/theme.js) |
| OKLCH → RGB conversion | [`src/lib/color.js`](src/lib/color.js) |
| Fonts (Newsreader / Hanken Grotesk) | [`src/theme/fonts.js`](src/theme/fonts.js) |
| Cosmos 3D visualization | [`src/viz/CosmosViz.js`](src/viz/CosmosViz.js) |
| Screens | [`src/screens/`](src/screens/) |
| Onboarding (5 steps) | [`src/onboarding/`](src/onboarding/) |
| Shared components | [`src/components/`](src/components/) |

### Notes on the web → native port

- **OKLCH colors** and **CSS variables** don't exist in RN, so colors are
  converted at runtime (`lib/color.js`) and themes are plain objects consumed
  through context. Dynamically generated persona hues still work.
- **CSS custom fonts** can't switch weight via `fontWeight`, so each weight/italic
  is a separately loaded family, selected via the `serif()` / `sans()` helpers.
- The prototype's **868×1228 device frame + scaler** is dropped — the app renders
  full‑screen and respects safe‑area insets. The faux iOS status bar is kept as a
  design element; the OS status bar is hidden.
- **Gestures/animation:** the cosmos uses `PanResponder` + a `requestAnimationFrame`
  loop; the SVG glow `filter` is replaced by a translucent halo circle (RN‑SVG
  filters are unreliable on the new architecture).
