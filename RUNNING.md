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

## Building locally (development build)

Some native modules don't work in **Expo Go** and need a custom **development
build**. Notably **`expo-notifications`** (daily reminders) is unsupported in
Expo Go on SDK 53+ — the toggle persists, but nothing fires until you run a dev
build. Any time you add a native module, you're in this path.

### One-time: install CocoaPods (iOS)

iOS builds need CocoaPods. macOS **system Ruby is 2.6**, which is too old for
modern CocoaPods, so install it via Homebrew (which brings its own Ruby) rather
than `gem install`:

```sh
# install Homebrew (prompts for your password, then Enter)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zshrc
eval "$(/opt/homebrew/bin/brew shellenv)"
brew install cocoapods
```

### Build & run

```sh
npx expo run:ios       # builds the dev client + runs pod install for you
npx expo run:android   # Android equivalent (needs Android Studio + an SDK)
```

Re-run the same command to rebuild after native changes. JS-only changes still
hot-reload over Metro as usual — you only rebuild when native deps change.

No Homebrew? Build in the cloud instead with **EAS** (needs a free Expo account,
slower per build): `npx eas-cli build --profile development --platform ios`,
then `npx eas-cli build:run -p ios`.

### Gotcha: `expo install` can float transitive native deps

`npx expo install <pkg>` runs a plain `npm install`, which can bump a **transitive**
native dependency past what its parent supports. We hit this with Reanimated:
`react-native-worklets` floated to `0.8.3` while Reanimated 4.2.1 requires
`0.7.x`, breaking `pod install` with a *"Failed to validate worklets version"*
error. `expo install --check` won't catch it — it only audits **direct** deps.

Fix by pinning the SDK-bundled version as a direct dep:

```sh
npx expo install react-native-worklets   # installs the SDK-pinned 0.7.4
```

General reset when pods misbehave after adding native modules:

```sh
npx expo install --fix                      # realign direct deps to SDK versions
rm -rf ios/Pods ios/Podfile.lock && npx pod-install ios
```

## Architecture

| Concern | File |
| --- | --- |
| App root + routing (onboarding ↔ tabs) | [`App.js`](App.js) |
| State + persistence (mirrors prototype `App`) | [`src/store/Store.js`](src/store/Store.js) |
| Data model + helpers | [`src/data/data.js`](src/data/data.js) |
| Theme tokens (light/dark) | [`src/theme/theme.js`](src/theme/theme.js) |
| OKLCH → RGB conversion | [`src/lib/color.js`](src/lib/color.js) |
| Nightly reminder (local notifications) | [`src/lib/notifications.js`](src/lib/notifications.js) |
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
