# Lift Journal

A mobile-friendly website and iPhone app built with Expo / React Native.

## Website

The website runs in Safari without Expo Go. Workout data stays in browser storage on the device and website address you use. Clearing website data or using private browsing can remove it; there is no cloud backup. Photos require internet access.

For development: `npm ci`, then `npm run web`.

For static hosting: `npm run build:web`. Upload the **contents** of `dist/` to an HTTPS static host, at the root of its domain. No backend or secret keys are required. Hosting is not connected or published from this workspace yet.

On iPhone, open the published HTTPS website in Safari and choose Share → Add to Home Screen. The app shell supports reopening offline after the first successful load; photo availability still depends on the network. Actual Safari installation still needs device verification.

Browser checks: `npm run test:web` (after building). These cover lifting history, cardio, reload persistence, viewport layout, and offline reopening in Chromium at iPhone screen size. They do not replace an actual Safari device test.

## Native app

An iPhone-first Expo / React Native workout log. All workout records are stored locally with AsyncStorage; there is no account or backend.

## Open on your iPhone

On a computer with Node.js 24 and access to this checkout:

```sh
npm ci
npm start
```

Install **Expo Go** on your iPhone and scan the terminal QR code with the Camera app. The phone and computer must be on the same Wi-Fi network. Use an Expo Go release compatible with the pinned Expo SDK 58. A cloud workspace's localhost is not accessible from your phone; run the development server on your own computer to preview it. Native compilation requires macOS/Xcode or a separately configured cloud build; neither has been tested here.

## First version

- Weight-lifting and Cardio tabs.
- Separate Legs + Shoulders, Chest + Biceps, and Back + Triceps workout days.
- Searchable muscle-specific exercise picker with equipment filters and demonstration photos.
- Three sets per exercise, with kilograms and reps in each row.
- Today’s editable column followed by the most recent completed workout and horizontally scrollable earlier sessions.
- Finish a workout to save a dated column. Partially entered workouts persist as drafts.
- Cardio activity, duration in minutes, distance in kilometers, and activity history.
- No rest timers or custom exercise creation.

Workout selections, drafts, completed sessions, and cardio entries persist across restarts. Removing the app can remove the local data; this version does not include backup, sync, or export. Exercise names are bundled for offline use. Demonstration photos currently load over HTTPS and require Internet access; unavailable photos display a fallback.

## Development checks

```sh
npm run typecheck
npm test
EXPO_OFFLINE=1 npm run export:ios
```

Tests exercise default sets, set validation, and day-isolated serializable history. An iOS JavaScript export verifies bundling, not a native device build or device interaction. Actual iPhone interaction and persistence across device restarts still need validation in Expo Go.

## Exercise source

The bundled 876-entry catalog and hosted photographs come from [yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db), which identifies the dataset as public domain under the Unlicense. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Muscle filters include primary and supporting muscles. The catalog is broad, not exhaustive, and has not been medically reviewed.

## GitHub Pages publishing

The `Publish gym tracker` GitHub Actions workflow builds and deploys the website on pushes to `main`, or when run manually from the Actions tab. Set repository Settings → Pages → Source to GitHub Actions. The workflow obtains the deployment base path from GitHub, so links and offline caching work at `/Itzik/`.

Expected website: https://izick8-hub.github.io/Itzik/ (available after successful deployment). Exercise illustrations currently remain upstream photos, not uniform custom illustrations.

Saved lifting workout columns include a pencil to edit all exercises in that session and a trash button with confirmation to delete the entire session. Editing and deletion preserve ongoing drafts and other workouts.
