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
- Today’s editable sets beside a selectable previous session, with older/newer controls and no horizontal scrolling.
- Finish a workout to save a dated column. Partially entered workouts persist as drafts.
- Cardio activity, duration in minutes, distance in kilometers, and activity history.
- No rest timers. Custom exercise creation and personal exercise names are supported on the website.

Workout selections, drafts, completed sessions, and cardio entries persist across restarts. Removing the app can remove the local data; this version does not include backup, sync, or export. Exercise names and 873 catalog photos are bundled with the website. Viewed photos cache on demand for offline use. Three catalog entries have no source photo; custom exercises use a neutral placeholder. Failed photo loads offer a Retry action on exercise cards.

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

## Website design and insights

The website uses `App.web.tsx` with shared data types and the existing `lift-journal:v1` storage key. Native Expo builds continue using `App.tsx`. The website adds Home, Weight-lifting and Cardio navigation, Inter typography, safe-area-aware bottom navigation and in-page workout completion, and responsive layouts. No stored workouts are migrated or discarded.

Dashboard metrics use completed lifting sessions: all-time session count, consecutive local calendar training days (ending today or yesterday), and volume as the sum of logged kilograms × reps. Volume is an external-load logging metric, not a measure of total mechanical work. Recent progress identifies the exercise and compares mean recorded weight. Exercise cards compare the two most recent sessions within that day, only when set counts match; weight and total-rep changes are separate, and zero baselines do not produce percentages.

Progression guidance is a general starting point: keep load and add a controlled rep, or consider a 2.5–5% increase after all equal-load sets reach 12 reps, only if technique felt controlled. It does not infer recovery, injuries, exertion, or equipment increments from missing data. Unequal-load sets and bodyweight exercises receive rep-focused guidance.

Responsive browser checks cover 320, 390, 768 and 1440 pixel widths. The current workspace browser is Chromium; actual Safari device testing remains separate.

Exercise removal now supports immediate Undo and persistent Restore controls. Removed selections keep their drafts and saved history. The New workout action creates a dated draft without replacing any unfinished draft and restores exercises from the last completed session; current and previous dates appear above each exercise table. Older saved sessions remain available through the history arrows.

## Personalized muscle illustrations

The six user-approved mascot illustrations appear in muscle-section headings and workout rotation cards. The transparent atlas in public/icons/muscle-atlas.png is displayed as CSS-positioned tiles; source image pixels are unchanged. Icon order and zero-based cell positions are documented in public/icons/manifest.json. A 56-icon PNG atlas pack (six muscle icons and fifty action variants) is available at icons/lift-journal-icon-pack.zip. The action atlas and downloadable ZIP are excluded from offline precaching to avoid unnecessary mobile downloads.

Muscle artwork now uses muscle-outline-atlas.png: lime-green contours with transparent interiors and no colored skin fills or white sticker border. The original color variant is retained in the downloadable icon pack.

Exercise cards include Rename, which stores a personal name override while preserving the original exercise ID and all saved sets. The picker offers Add custom exercise; custom entries persist on this device and are grouped by the section in which they were created. Photo paths use src/photo-files.json and local public/exercise-photos files. Photos are excluded from bulk precaching; the service worker caches successfully viewed images in lift-journal-photos-v1. No image pixels have been altered.

## Body check-ins and training hints

The homepage includes the user's Nov 1, 2026 scan, transcribed in src/body.ts. All subsequent check-ins and editable targets are local browser data. Baseline import happens only when bodyMeasurements is absent; existing check-ins and explicit target choices are preserved. The confirmed profile is male, age 31 at baseline, 178 cm, with a fat-loss/muscle-preservation goal.

The editable starting proposal is 18% body fat and approximately 83.7 kg, calculated as 68.6 kg reported fat-free mass / (1 - 0.18). This assumes preserved fat-free mass and is not a medical optimum. No target is inferred for water compartments, phase angle, BMC, or BMR. Direct CDC, ACE and PMC research retrieval was blocked by the environment network policy; links are shown as unverified references, not claimed as completed live research.

Check-ins use entered dates and store optional body fat and skeletal muscle mass. Weight changes show percent differences; body-fat differences use percentage points. Goal completion is directional from the original baseline, can be negative when moving away, and its visual progress bar is capped at 0–100. Missing optional measurements are not carried forward as fresh readings.

Grey lifting placeholders use the latest completed session: retain the previous set load, or suggest a 2.5% increase after all equal-load sets reach 12 reps, rounded to 0.1 kg. Actual equipment increments may differ. Suggestions never populate or save a set; user-entered weights show per-set percentage load changes against the last session.

## Metallic homepage interactions

The homepage now includes a machined-metal training dial: tap its hub or use the accessible range slider/keyboard to choose a split. Start Workout opens the selected day. The body console switches between recorded values and actual percentage changes; goal rings use the existing goal-progress calculation. These controls do not change saved measurements.

Metal highlights, button press feedback, one-time metric entry transitions and on-change ring motion are restrained; there are no continuous decorative animation loops. All animation/transition effects are disabled under prefers-reduced-motion. Mobile layouts are checked from 320px upward, and the existing in-page completion action and touch scrolling remain intact.
