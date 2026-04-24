# Noto Repo Audit

Date: 2026-04-24  
Repo: `/Users/huyphan/Downloads/ACTE`  
Scope: Expo SDK 55 / React Native app source, services, Supabase functions and migrations, widgets, custom native modules, config plugins, tests, scripts, and local tooling. Generated/vendor folders were not deeply reviewed except where local artifacts affected repo hygiene.

## Executive Summary

The app has solid recent progress: TypeScript strict mode is enabled, coverage is broad, sensitive local credential files are ignored, and the app has clear ownership boundaries in `AGENTS.md`. The highest-risk current issues are not cosmetic. They sit in sync/data deletion, storage authority, native/widget runtime behavior, and verification gates.

Top priorities:

1. Fix red local gates: `lint:ci`, `theme:audit`, and the failing `homeScreenEmptyState` Jest tests.
2. Harden cloud authority: sticker asset cleanup and photo quota/billing currently trust client-writable state too much.
3. Fix dual-capture media cleanup paths before orphan cleanup can delete referenced files.
4. Page or move delete-all remote tombstoning server-side so sync does not leave other devices with undeleted notes.
5. Move expensive Android widget image work off broadcast/update paths and serialize iOS dual-camera session mutations.
6. Add tracked CI so these checks run before merge/release.

## Initial Verification Run

| Check | Result | Notes |
| --- | --- | --- |
| `npm run typecheck` | Passed | `tsc --noEmit` completed successfully. |
| `npm run lint:ci` | Failed | One `react-hooks/exhaustive-deps` warning in `components/screens/HomeScreen.tsx:2444`; max warnings is 0. |
| `npm run theme:audit` | Failed | `components/home/capture/CaptureCardSections.tsx` increased raw color literals from baseline 12 to 21. |
| `npm test -- --runInBand __tests__/homeScreenEmptyState.test.tsx` | Failed | 2 failing tests around reminder recovery prompt storage lookup. |
| Full `npm test -- --runInBand` | Failed / did not finish cleanly | Hit the same `homeScreenEmptyState` failures before the run exited abnormally. |

Sub-agent checks also reported `expo-doctor` drift and `npm audit --omit=dev` advisories. I did not mutate application code in this audit; only this report was added.

## Fix Pass Status

Follow-up implementation addressed the practical app-code and release-gate findings from this report. Current local verification:

| Check | Result | Notes |
| --- | --- | --- |
| `npm run typecheck` | Passed | TypeScript app check is green. |
| `npm run lint:ci` | Passed | ESLint with max warnings 0 is green. |
| `npm run theme:audit` | Passed | Capture chrome colors are now feature tokens. |
| Focused Jest suites | Passed | 6 suites / 61 tests covering home, media integrity, shared feed, sync, sticker cleanup, and account deletion. |
| `npm run expo:doctor` | Passed | 18/18 Expo checks passed after SDK-aligned dependency updates. |
| `npm run audit:prod` | Passed | Production dependency audit reports 0 vulnerabilities. |
| `npm run supabase:functions:check` | Not run locally | Local shell does not have `deno`; the added GitHub Actions workflow installs Deno before running this check. |
| `npm test -- --runInBand` | Inconclusive locally | The full Jest run passed initial suites then stopped emitting output for several minutes; the process was stopped to avoid leaving a hung runner. |

Not all long-term architecture recommendations are fully closed by this pass. Server-authoritative RevenueCat quota enforcement, local encryption at rest, generated widget contract schemas, and a larger service decomposition remain product/architecture work rather than safe one-session patches.

## High Priority Findings

### 1. Sticker GC can delete service-role storage paths from client-controlled rows

- Area: security / Supabase storage
- Evidence:
  - `supabase/migrations/20260403110000_add_sticker_asset_registry.sql:3`
  - `supabase/migrations/20260411133000_reset_sticker_registry_rls.sql:51`
  - `supabase/functions/cleanup-sticker-assets/index.ts:186`
- Problem: clients can write `sticker_assets` rows for their `owner_user_id`, including `storage_bucket`, `storage_path`, and `last_seen_at`. The cleanup edge function later runs with the service role and deletes those paths.
- Impact: a modified client may steer privileged cleanup toward paths it should not control.
- Recommendation: make bucket/path immutable and validated against the owner, or move sticker registration behind a security-definer RPC that only accepts paths under a constrained prefix such as `note-media/<uid>/...`.

### 2. Billing and photo quota enforcement is client-trusted

- Area: security / billing / product limits
- Evidence:
  - `hooks/useSubscription.tsx:77`
  - `components/screens/HomeScreen.tsx:603`
  - `supabase/migrations/20260321113000_noto_initial.sql:226`
  - `services/syncService.ts:2914`
- Problem: Plus status comes from client RevenueCat state, photo quota checks run in app code, and `user_usage` is client-writable by owner policy.
- Impact: a modified client can bypass photo limits and premium UI gates.
- Recommendation: mirror RevenueCat entitlements server-side via webhooks and enforce premium/usage-sensitive writes through RPCs or database triggers.

### 3. Dual-capture media can be deleted by orphan cleanup

- Area: data correctness / media integrity
- Evidence:
  - `services/mediaIntegrity.ts:20`
  - `services/database.ts:679`
- Problem: `cleanupOrphanPhotoFiles()` treats only `content`, `photo_local_uri`, and `paired_video_local_uri` as live references. It misses dual primary, dual secondary, dual composed, and relevant synced media columns.
- Impact: startup cleanup can delete still-referenced dual-capture images, breaking detail, widget, edit, or sync flows.
- Recommendation: centralize a note media reference helper and include all local media columns. Add a regression test with a dual note plus orphan cleanup.

### 4. Delete-all remote sync tombstones can be incomplete

- Area: sync / data deletion
- Evidence:
  - `services/syncService.ts:1829`
  - `services/syncService.ts:1962`
- Problem: `deleteAllRemoteNotesForUser()` fetches remote IDs with unpaginated Supabase selects, then deletes/tombstones based on that subset. Supabase responses are commonly capped.
- Impact: some remote rows can be deleted without tombstones, so other devices may retain notes forever.
- Recommendation: page through all note/shared-post IDs before deletion, or better, use a server-side RPC that atomically deletes and tombstones all affected IDs. Test with more than one Supabase page of notes/posts.

### 5. Local verification is red

- Area: quality gates
- Evidence:
  - `components/screens/HomeScreen.tsx:2307`
  - `components/screens/HomeScreen.tsx:2444`
  - `components/home/capture/CaptureCardSections.tsx:57`
  - `__tests__/homeScreenEmptyState.test.tsx:489`
  - `__tests__/homeScreenEmptyState.test.tsx:504`
- Problems:
  - Save callback uses `appTheme` and `isDark` but omits them from dependencies.
  - Theme audit detects new hardcoded color debt.
  - Reminder recovery prompt tests expect key `noto.home.reminder-recovery-prompt.v1.user-1`, but Home only reads the live-photo hint and capture draft keys.
- Impact: the advertised `verify` gate cannot be trusted until these are green.
- Recommendation: fix the callback deps, move capture colors into theme/feature tokens, and decide whether reminder recovery was accidentally removed or the tests are stale.

### 6. Android widget rendering does heavy bitmap work synchronously

- Area: native / widgets / performance
- Evidence:
  - `widgets/android/NotoWidgetProvider.kt:831`
  - `widgets/android/NotoWidgetProvider.kt:861`
  - `widgets/android/NotoWidgetProvider.kt:1202`
  - `widgets/android/NotoWidgetProvider.kt:1459`
  - `widgets/android/NotoWidgetProvider.kt:2290`
- Problem: receiver/update paths call `updateWidget` directly and decode/render multiple bitmaps into `RemoteViews`.
- Impact: widget updates can ANR, exceed Binder transaction limits, or become flaky on large photos.
- Recommendation: pre-render/cache widget images in background work, cap bitmap dimensions, and keep `RemoteViews` binding cheap.

### 7. iOS dual-camera session work is split across queues

- Area: native / camera correctness
- Evidence:
  - `modules/noto-dual-camera/ios/NotoDualCameraModule.swift:73`
  - `modules/noto-dual-camera/ios/NotoDualCameraModule.swift:102`
  - `modules/noto-dual-camera/ios/NotoDualCameraModule.swift:131`
  - `modules/noto-dual-camera/ios/NotoDualCameraModule.swift:189`
- Problem: preview start/stop uses `sessionQueue`, but `captureStill` configures and captures from the caller context. `deinit` also uses `sessionQueue.sync`.
- Impact: AVFoundation session mutation can race or deadlock.
- Recommendation: serialize all session configuration/capture mutations onto one queue and review teardown to avoid sync-on-own-queue deadlock.

### 8. No tracked CI workflow

- Area: tooling / release safety
- Evidence:
  - no `.github/workflows/*`
  - `package.json:15`
- Problem: the repo has a good local `verify` script, but no tracked workflow was found to enforce it.
- Impact: broken lint/tests/theme audit can land unnoticed.
- Recommendation: add GitHub Actions with `npm ci`, `npm run lint:ci`, `npm run theme:audit`, `npm run typecheck`, `npm test -- --ci --runInBand`, `npx expo-doctor`, and `npm audit --omit=dev --audit-level=moderate`.

## Medium Priority Findings

### 9. Shared-post dual artifacts are not cleaned up on delete

- Area: data correctness / storage cleanup
- Evidence:
  - `services/sharedFeedService.ts:1739`
  - `services/sharedFeedService.ts:1825`
- Problem: delete paths fetch `id`, `photo_path`, `paired_video_path`, and stickers, but omit `dual_primary_photo_path` and `dual_secondary_photo_path`.
- Impact: dual shared-post storage artifacts can leak.
- Recommendation: select and pass the dual paths into cleanup, with tests for single and bulk delete.

### 10. Sync cursor clearing preserves stale cursors

- Area: sync correctness
- Evidence:
  - `services/syncService.ts:957`
  - `services/syncService.ts:1027`
- Problem: `upsertSyncState()` uses `?? existing` for cursor fields, so a caller cannot intentionally clear a cursor by passing `null`.
- Impact: stale cursors can survive after remote notes/tombstones are gone.
- Recommendation: distinguish omitted fields from explicit null, or add an explicit clear operation.

### 11. Missing remote photo media advances the sync cursor

- Area: sync resilience
- Evidence:
  - `services/syncService.ts:1568`
  - `services/syncService.ts:2361`
- Problem: remote photo rows with missing storage objects are skipped while the cursor can still advance. The `cursorBlockedByMissingMedia` path appears unused.
- Impact: a temporarily missing file can become a permanent missed import until the row is updated.
- Recommendation: prevent cursor advancement for required missing media or persist a retryable failed import marker.

### 12. Android background location permission is always declared

- Area: permissions / privacy / Play compliance
- Evidence:
  - `app.config.js:17`
  - `app.config.js:152`
  - `app.config.js:192`
- Problem: `EXPO_PUBLIC_ENABLE_PLACE_REMINDERS=false` disables background location plugin config, but `android.permission.ACCESS_BACKGROUND_LOCATION` remains in `android.permissions`.
- Impact: builds that intend to disable reminders still request a sensitive background permission.
- Recommendation: conditionally include `ACCESS_BACKGROUND_LOCATION` only when place reminders are enabled.

### 13. Local notes/media are not encrypted at rest

- Area: privacy
- Evidence:
  - `services/database.ts:185`
  - `services/database.ts:657`
  - `services/photoStorage.ts:10`
  - `services/livePhotoStorage.ts:10`
- Problem: place-linked note text, coordinates, shared cache, and media live in normal SQLite/document paths.
- Impact: local-first is expected, but the data is sensitive if device backups, shared computers, or filesystem extraction are in scope.
- Recommendation: consider SQLCipher or encrypted blobs for sensitive fields, backup exclusion, iOS file protection, and explicit privacy documentation.

### 14. Dependency and Expo SDK drift

- Area: dependency hygiene
- Evidence:
  - `package.json:35`
  - `package.json:51`
  - `package.json:83`
  - `package-lock.json:5301`
  - `package-lock.json:16744`
- Problem: sub-agent checks found `expo-doctor` mismatches for `expo-blur`, `expo-media-library`, and `react-native-worklets`, plus `npm audit --omit=dev` advisories including `@xmldom/xmldom` and `uuid` through `xcode`.
- Impact: runtime/build incompatibilities and dependency advisories can pile up quietly.
- Recommendation: use `npx expo install` for SDK-aligned packages, keep the Expo validation exclusion list small, and handle audit findings with targeted overrides or upgrades.

### 15. Supabase functions are outside typechecking

- Area: TypeScript / server correctness
- Evidence:
  - `tsconfig.json:17`
  - `__tests__/deleteAccountFunction.test.ts:17`
- Problem: `supabase/functions/**/*` is excluded from `tsc`; tests transpile function code without typechecking.
- Impact: Deno/server regressions can pass app typecheck.
- Recommendation: add a Deno/Supabase function check script and run it in CI.

### 16. App config does not gate RevenueCat for production

- Area: release config
- Evidence:
  - `app.config.js:65`
  - `constants/subscription.ts:8`
- Problem: production config asserts EAS, Maps, privacy, support, and deletion config, but not RevenueCat keys even though Plus is a core product surface.
- Impact: production builds can silently ship with purchases unavailable.
- Recommendation: require platform RevenueCat keys for production profiles unless an explicit `ALLOW_NO_BILLING` escape hatch is set.

### 17. Raw operational errors can leak internals

- Area: security / logging
- Evidence:
  - `supabase/functions/delete-account/index.ts:273`
  - `supabase/functions/send-social-notifications/index.ts:621`
  - `supabase/functions/cleanup-sticker-assets/index.ts:222`
  - `hooks/useAuth.tsx:747`
- Problem: some edge catches return raw error messages, and client logs include whole error objects.
- Impact: schema names, storage paths, provider messages, or PII can leak to clients/logs.
- Recommendation: return stable public error codes/messages and keep sanitized server-side diagnostic logs.

### 18. Android subject cutout can allocate full-size images

- Area: native / memory
- Evidence:
  - `modules/noto-subject-cutout/android/src/main/java/expo/modules/notosubjectcutout/NotoSubjectCutoutModule.kt:83`
  - `modules/noto-subject-cutout/android/src/main/java/expo/modules/notosubjectcutout/NotoSubjectCutoutModule.kt:155`
  - `modules/noto-subject-cutout/android/src/main/java/expo/modules/notosubjectcutout/NotoSubjectCutoutModule.kt:196`
- Problem: the module decodes full images and allocates full-size pixel arrays/bitmaps.
- Impact: large photos can cause OOMs.
- Recommendation: downsample before segmentation and enforce a max working dimension.

### 19. Custom plugins are fragile around generated native templates

- Area: build maintainability
- Evidence:
  - `plugins/withAndroidReleaseHardening.js:67`
  - `plugins/withCustomAndroidWidget.js:41`
  - `plugins/withCustomAndroidWidget.js:52`
- Problem: plugins depend on exact string/regex anchors and sometimes warn/skip instead of failing when required generated files are missing.
- Impact: Expo/RN template drift can produce broken native output without a clear failure.
- Recommendation: prefer stable config-plugin helpers, fail fast for required widget files, and add regression tests against current generated templates.

### 20. Legacy Live Photo iOS bridge may duplicate the Expo module

- Area: native simplification
- Evidence:
  - `app.config.js:236`
  - `plugins/withLivePhotoMotionTranscoder.js:75`
  - `native/ios/LivePhotoMotionTranscoder.swift:5`
  - `services/livePhotoMotionTranscoder.ts:18`
- Problem: the app still copies a legacy native bridge while JS appears to call the local Expo module `NotoLivePhotoMotion`.
- Impact: extra native surface area and plugin fragility.
- Recommendation: confirm no generated native caller remains, then consolidate on the local Expo module and remove the legacy bridge/plugin.

## UI, Accessibility, and Performance Findings

### 21. Icon-only buttons need labels and state

- Evidence:
  - `components/ui/AppBackButton.tsx:17`
  - `components/ui/AppIconButton.tsx:30`
  - `components/notes/detail/NoteDetailEditToolbar.tsx:50`
  - `components/notes/detail/NoteDetailEditToolbar.tsx:68`
  - `components/notes/detail/NoteDetailEditToolbar.tsx:88`
  - `components/notes/detail/NoteDetailEditToolbar.tsx:123`
- Recommendation: make `accessibilityLabel` required for `AppIconButton`, add localized labels and `accessibilityState` for toggle/disabled toolbar buttons.

### 22. Loading buttons can lose their accessible name

- Evidence:
  - `components/ui/PrimaryButton.tsx:76`
- Recommendation: keep `accessibilityLabel={label}` and expose `accessibilityState={{ disabled, busy: loading }}` while showing the spinner.

### 23. Shared feed size estimate is not responsive after window changes

- Evidence:
  - `components/screens/shared/SharedFeedScreen.tsx:16`
- Recommendation: replace module-load `Dimensions.get('window')` with `useWindowDimensions()` and memoized estimates.

### 24. FlashList renderers fight memoization

- Evidence:
  - `components/screens/notes/NotesScreen.tsx:233`
  - `components/screens/notes/NotesScreen.tsx:564`
  - `components/screens/shared/SharedFeedScreen.tsx:186`
- Recommendation: use stable renderers and item press handlers, or include callback props in memo comparators.

### 25. Some user-facing labels bypass i18n/theme tokens

- Evidence:
  - `components/notes/NoteStickerCanvas.tsx:140`
  - `components/notes/NoteStickerCanvas.tsx:157`
  - `components/notes/NoteStickerCanvas.tsx:174`
  - `components/screens/shared/SharedFeedScreen.tsx:299`
  - `components/screens/shared/SharedFeedScreen.tsx:326`
- Recommendation: move hardcoded sticker control labels into `constants/locales/en.json` and `constants/locales/vi.json`; use semantic theme tokens such as `colors.onPrimary`.

## Simplification Opportunities

### 1. Break up the largest orchestration files

Largest current files include:

- `components/screens/HomeScreen.tsx`: 3027 lines
- `services/syncService.ts`: 3002 lines
- `services/database.ts`: 2544 lines
- `widgets/ios/LocketWidget.swift`: 2390 lines
- `components/notes/NoteDetailSheet.tsx`: 1962 lines
- `services/sharedFeedService.ts`: 1883 lines
- `services/noteStickers.ts`: 1762 lines
- `components/home/CaptureCard.tsx`: 1637 lines
- `components/map/MapCanvas.tsx`: 1539 lines

Highest-leverage extractions:

- Move Home save orchestration and media persistence into a dedicated hook/service.
- Split `syncService` into cursor state, remote note import/export, tombstones, remote media, and account cleanup.
- Split `NoteDetailSheet` into edit state, sticker/doodle persistence, export, delete/share actions, and purchase prompts.
- Move widget payload parsing/render preparation into shared schema-backed helpers where possible.

### 2. Centralize media references

Multiple systems need to know every note/shared-post media path: orphan cleanup, remote artifact cleanup, widgets, sync, and tests. A single helper like `collectNoteMediaReferences(row)` and `collectSharedPostMediaReferences(row)` would prevent dual-capture fields being forgotten in one path.

### 3. Clarify platform naming

`components/screens/MapScreen.tsx` exports `./MapScreen.ios`, and that iOS-named file contains Android branches. Rename it to `MapScreen.shared.tsx` or restore a thin Android wrapper so ownership matches behavior.

### 4. Reduce widget contract drift

Widget payload fields are hand-maintained across:

- `services/widget/contract.ts`
- `widgets/ios/LocketWidget.swift`
- `widgets/android/NotoWidgetModule.kt`
- `widgets/android/NotoWidgetProvider.kt`
- `widgets/LocketWidget.tsx`

Generate platform parsers/types from one schema, or add contract snapshot tests that fail when a field is added in one runtime but not the others.

### 5. Share platform screen row metadata

Settings/profile already have useful shared models, but platform files still duplicate icon maps and row shell logic. Keep native presentation separate, but move row metadata/adapters into shared modules to reduce drift.

## Tooling and Best Practices

- Add CI and branch protection for the verification commands listed above.
- Add `npm run expo:doctor` and keep the Expo dependency exclusion list short.
- Add a Deno/Supabase function typecheck script.
- Add a non-blocking dead-code/dependency script (`knip`, `ts-prune`, or similar) before enforcing it.
- Add focused coverage thresholds for `services/`, `hooks/state/`, `hooks/app/`, sync, widget contracts, and Supabase edge behavior.
- Consider `@typescript-eslint/no-explicit-any` as a warning with allowlists for native module and ref boundaries.
- Keep ignored root artifacts out of the repo folder where possible. Current local ignored artifacts include `.env`, `.env.local`, Firebase files, generated `ios/` and `android/`, and two 130 MB AABs.

## Suggested Fix Order

1. Make the repo green: hook deps, theme tokens, failing reminder recovery tests.
2. Patch media integrity for dual-capture columns and add regression tests.
3. Harden sticker asset registration and cleanup authority.
4. Move billing/quota enforcement server-side.
5. Fix delete-all remote sync pagination/tombstoning.
6. Rework Android widget rendering and iOS dual-camera queue serialization.
7. Add CI with typecheck, lint, theme audit, Jest, Expo doctor, dependency audit, and Supabase function checks.
8. Start simplification work around Home save orchestration, sync service boundaries, and widget schema drift.
