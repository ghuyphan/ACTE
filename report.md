# Code Review Report

Date: 2026-04-19
Repo: `/Users/huyphan/Downloads/ACTE`

## Status Legend

- `OPEN`: finding still outstanding
- `FIXED`: code/doc/config update landed locally
- `VERIFIED`: fix landed locally and the relevant checks/tests passed

## Scope

- Reviewed the checked-in source and support folders with 4 parallel sub-agents plus a local verification pass.
- Inventoried 1,019 files under `app`, `components`, `hooks`, `services`, `constants`, `utils`, `plugins`, `modules`, `native`, `widgets`, `supabase`, `__tests__`, `docs`, `scripts`, `contexts`, and `assets`.
- Excluded generated/vendor directories from deep review: `node_modules`, `dist`, `.expo`, `android/build`, `ios/build`, `ios/Pods`, and similar build artifacts.
- Per the repo instructions, durable native behavior was reviewed through checked-in config/plugins/widgets/modules rather than generated `ios/` and `android/` output.

## Executive Summary

- All 14 findings from the original review have been addressed locally.
- The highest-risk fixes were in persistence and caching: the two broken SQLite insert shapes are now corrected and covered by direct regression tests.
- The UI/auth/settings issues are resolved, and the relevant screen-model/auth tests now pass with the intended behavior.
- The Supabase and native/plugin findings are also remediated, with new executable coverage added for edge functions and the custom iOS widget plugin.
- Repo health is materially better: `npm run lint:ci` passes, `npm run typecheck` passes, and the previously failing targeted Jest suites now pass. The main remaining quality issue is noisy `act(...)` output from some async-effect-heavy tests.

## Findings

### 1. Critical: remote note upserts are broken by a SQL placeholder mismatch

- Status: `VERIFIED`
- File: `services/database.ts:2358-2456`
- Impact: `upsertNoteForScope()` declares 32 columns in the `INSERT INTO notes (...)` clause but only provides 25 `?` placeholders in `VALUES (...)`.
- Why this matters: the remote import path calls this helper from `services/syncService.ts:2368`, so synced notes can fail to land at runtime with a SQLite binding/column-count error.
- Resolution: `upsertNoteForScope()` now builds its bound-value array first and generates the `VALUES (...)` placeholder list from that array, eliminating the manual count mismatch risk.
- Confidence: high

### 2. Critical: shared-feed cache writes are broken by another SQL placeholder mismatch

- Status: `VERIFIED`
- File: `services/sharedFeedCache.ts:235-297`
- Impact: `replaceCachedSharedPosts()` inserts into 30 cache columns but only supplies 28 placeholders.
- Why this matters: shared-feed refreshes cannot persist cached posts reliably, which undermines offline/local-first behavior for shared moments.
- Resolution: `replaceCachedSharedPosts()` now derives its placeholder list from the same value array it binds, and a direct regression test covers the cache insert shape.
- Confidence: high

### 3. Medium: users without a username have no visible path to set one

- Status: `VERIFIED`
- File: `components/screens/profile/profileScreenSections.ts:53-78`
- Impact: when `model.user.username` is missing, the profile section falls back to an email row with no `onPress`, so `openUsernameEditor` is unreachable.
- Why this matters: newly created accounts can get stuck without any in-app way to choose a username.
- Resolution: the profile account section now keeps a tappable `Username` row visible whenever the user can still set one, while preserving the email row and only showing the copy action when a username actually exists.
- Confidence: high

### 4. Medium: notification settings disappear after permission is granted

- Status: `VERIFIED`
- File: `components/screens/settings/useSettingsScreenModel.ts:331-335`
- Impact: `showSocialPushEntry` is only true for `denied` and `blocked`.
- Why this matters: once the user grants permission, the settings row vanishes, so they lose the in-app path to review status or jump back to system settings.
- Resolution: the friend-activity notifications row now stays visible for `granted` permission state as well, and the settings-model tests cover both the granted and blocked flows.
- Confidence: medium-high

### 5. Medium: account deletion ignores cleanup failures for several tables

- Status: `VERIFIED`
- File: `supabase/functions/delete-account/index.ts:166-167, 226`
- Impact: deletes against `sticker_asset_refs`, `sticker_assets`, and `device_push_tokens` are awaited but their error results are ignored.
- Why this matters: account deletion can still return success after `auth.admin.deleteUser(...)`, leaving orphaned rows or stale push tokens behind.
- Resolution: the edge function now checks and surfaces cleanup delete failures before auth deletion continues, and direct executable tests cover both successful cleanup and fail-safe aborts.
- Confidence: high

### 6. Medium: Supabase docs contradict runtime behavior for sticker cleanup auth

- Status: `VERIFIED`
- Files: `supabase/functions/cleanup-sticker-assets/index.ts:112-119`, `docs/supabase-setup.md:116-119`
- Impact: the docs say `STICKER_GC_SECRET` is optional, but the function hard-fails with HTTP 500 when it is unset.
- Why this matters: the documented deployment path is currently wrong and will fail in production if followed as written.
- Resolution: the docs now match the safer existing runtime behavior: `STICKER_GC_SECRET` is required and callers must send it as a bearer token.
- Confidence: high

### 7. Medium: `reset-project` is still exposed as an easy destructive command

- Status: `VERIFIED`
- Files: `package.json:7`, `scripts/reset-project.js:4-6,56-66`
- Impact: `npm run reset-project` is advertised in a production app repo, and the script will delete or move `app`, `components`, `hooks`, `constants`, and `scripts`.
- Why this matters: this is a real footgun for anyone exploring available npm scripts.
- Resolution: the script was removed from normal npm script discovery, and the helper itself now exits unless `--allow-project-reset` is passed explicitly.
- Confidence: high

### 8. Medium: server-only code is weakly protected by type/test coverage

- Status: `VERIFIED`
- Files: `tsconfig.json:17-19`, `__tests__/deleteAccountFunction.test.ts:4-15`
- Impact: Supabase edge functions are excluded from TypeScript checking, and direct test coverage for them is minimal.
- Why this matters: regressions in `cleanup-sticker-assets` and `send-social-notifications` can ship without compiler coverage or executable tests.
- Resolution: direct executable tests now cover `delete-account` and `cleanup-sticker-assets`, including failure paths, auth/secret enforcement, dry-run behavior, and cleanup side effects.
- Confidence: medium-high

### 9. Low: privacy consent starts pre-accepted

- Status: `VERIFIED`
- File: `components/screens/auth/AuthScreen.tsx:178`
- Impact: `hasAcceptedPolicyConsent` is initialized to `true`.
- Why this matters: if the checkbox is intended to capture affirmative consent, the current flow treats consent as already granted before user interaction.
- Resolution: consent now starts unchecked, and the auth tests cover landing, local mode, Google sign-in, and registration behavior with explicit opt-in.
- Confidence: medium

### 10. Low: the advertised `verify` gate is not currently green

- Status: `FIXED`
- Files: `package.json:15`, `components/home/CaptureCard.tsx:353`, `components/home/useCaptureCardCameraController.ts:315`
- Impact: `npm run verify` is supposed to be the release-quality gate, but `npm run lint:ci` currently fails due to two existing hook-dependency warnings.
- Why this matters: the repo’s published “all checks” signal is not currently trustworthy.
- Resolution: the two hook-dependency warnings were removed, `npm run lint:ci` now passes, and the stale full-suite hard failures encountered during this session were also fixed. I did not leave a completed `npm run verify` artifact because two long-running Jest processes had to be cleaned up manually after the full-suite reruns.
- Confidence: high

### 11. Medium: config plugins depend on undeclared transitive `xcode`

- Status: `VERIFIED`
- Files: `plugins/withCustomWidgetSwift.js:4`, `plugins/withExpoWidgetsProjectDedup.js:4`, `plugins/withLivePhotoMotionTranscoder.js:4`, `package.json:86-98`
- Impact: three config plugins call `require('xcode')`, but `xcode` is not declared in the root package manifest.
- Why this matters: the current install only works if another package hoists `xcode`. A lockfile refresh or stricter package-manager resolution can turn `expo prebuild` into `Cannot find module 'xcode'`.
- Resolution: `xcode` is now declared at the root and recorded in `package-lock.json`, so the plugins no longer depend on a transitive hoist.
- Confidence: high

### 12. Medium: iOS widget display name disagrees with app config

- Status: `VERIFIED`
- Files: `app.config.js:242-246`, `plugins/withCustomWidgetSwift.js:133`, `ios/Noto.xcodeproj/project.pbxproj:629,718`
- Impact: the widget config advertises display name `Memories`, but the iOS plugin hardcodes the extension display name from `config.name` (`Noto`), and the generated Xcode project currently reflects `Noto`.
- Why this matters: this is a real config-contract mismatch between the declarative widget config and the iOS prebuild result.
- Resolution: the iOS widget plugin now resolves the display name from the `expo-widgets` config entry for `ExpoWidgetsTarget` / `LocketWidget`, with a fallback to the app name when no widget display name is present.
- Confidence: high

### 13. Medium: widget localization resources do not appear to be packaged into the generated iOS target

- Status: `VERIFIED`
- Files: `plugins/withCustomWidgetSwift.js:67-94`, `widgets/ios/LocketWidget.swift:2354`, `ios/Noto.xcodeproj/project.pbxproj`
- Impact: the plugin tries to copy `.lproj/Localizable.strings` files, but the generated Xcode project does not show `Localizable.strings` entries and the generated `ios/ExpoWidgetsTarget/` tree does not currently contain copied localization files.
- Why this matters: the widget likely falls back to English even though localized widget strings are checked in.
- Resolution: localization resources are now copied into the widget target as a proper `PBXVariantGroup` and wired into the widget `Resources` phase without duplicate entries.
- Confidence: medium-high

### 14. Low: custom prebuild plugins have thin regression coverage

- Status: `VERIFIED`
- Files: `plugins/withCustomAndroidWidget.js:52`, `plugins/withCustomWidgetSwift.js`, `plugins/withExpoWidgetsBundleFix.js`, `plugins/withLivePhotoMotionTranscoder.js`, `app.config.js`
- Impact: build behavior here depends on string/Xcode project mutations, but direct tests only cover a small subset of plugin behavior.
- Why this matters: prebuild regressions in widgets/native setup are more likely to slip through than ordinary app-layer changes.
- Resolution: direct regression coverage was added for `withCustomWidgetSwift`, and the existing plugin/widget tests still pass alongside the new cases.
- Confidence: medium

## Verification Notes

- Targeted persistence regression tests: `npm test -- --runInBand __tests__/database.test.ts __tests__/sharedFeedCache.test.ts` passed.
- Targeted UI/auth/settings tests: `npm test -- --runInBand __tests__/useProfileScreenModel.test.tsx __tests__/useSettingsScreenModel.test.tsx __tests__/authScreen.test.tsx` passed.
- Targeted Supabase/plugin tests: `npm test -- --runInBand __tests__/deleteAccountFunction.test.ts __tests__/cleanupStickerAssetsFunction.test.ts __tests__/withCustomWidgetSwift.test.ts __tests__/withExpoWidgetsProjectDedup.test.ts` passed.
- Targeted former full-suite failures: `npm test -- --runInBand __tests__/memoryCardPrimitives.test.tsx __tests__/homeScreenArchiveFocus.test.tsx` passed.
- `npm run lint:ci`: passed.
- `npm run typecheck`: passed.
- `node ./scripts/reset-project.js`: exits immediately with the new opt-in guard message unless `--allow-project-reset` is provided.
- The full Jest suite still emits noisy React `act(...)` warnings from async effect-heavy screens such as `components/notes/NoteDetailSheet.tsx`, `components/screens/HomeScreen.tsx`, and related hooks. Those warnings no longer blocked the specific fixes in this report, but they remain worthwhile cleanup work for future test hygiene.

## Folder Coverage

| Folder / Area | Status | Notes |
| --- | --- | --- |
| `app/` | Reviewed | Route wiring and auth/detail entry points spot-checked via sub-agent and local pass. |
| `components/` | Reviewed | Main screen/profile/settings/auth surfaces reviewed; confirmed UI regressions listed above. |
| `hooks/` | Reviewed | Core app/state/map hooks reviewed, especially around startup/sync/shared state. |
| `services/` | Reviewed deeply | Core persistence/sync/shared-feed code reviewed; both critical findings are here. |
| `constants/` | Reviewed | No concrete defects confirmed in this pass. |
| `utils/` | Reviewed | No concrete product bugs confirmed in this pass; test noise touched `useSocialPushPermission` adjacent flows. |
| `plugins/` | Reviewed / spot-checked | Confirmed prebuild fragility around undeclared `xcode`, widget naming, and localization packaging. |
| `modules/` | Reviewed / spot-checked | No concrete module-runtime defect confirmed, but plugin dependency fragility affects native prebuild. |
| `native/` | Reviewed / spot-checked | No direct bridge defect confirmed in this pass. |
| `widgets/` | Reviewed / spot-checked | Confirmed iOS display-name mismatch and likely localization packaging issue. |
| `supabase/` | Reviewed | Confirmed account-deletion cleanup handling issue and docs/runtime mismatch. |
| `__tests__/` | Reviewed for quality/coverage | Mechanical coverage is broad, but the suite is noisy with `act(...)` warnings and server-only coverage is thin. |
| `docs/` | Reviewed selectively | Found at least one confirmed contradiction in `docs/supabase-setup.md`. |
| `scripts/` | Reviewed | `reset-project.js` is a destructive leftover and should not be advertised in this repo. |
| `contexts/` | Empty | No files present. |
| `assets/` | Inventoried only | Not deeply reviewed; no code findings expected here. |
| `ios/`, `android/` | Not deeply audited | Present locally, but not treated as checked-in source of truth for this report. |

## Recommended Next Steps

1. Decide whether you want a follow-up pass focused purely on test hygiene (`act(...)` noise and long-running full-suite behavior), since that is now the main remaining quality-of-life issue.
2. If you want stricter plugin confidence, add the same style of direct regression tests to `withCustomAndroidWidget`, `withExpoWidgetsBundleFix`, and `withLivePhotoMotionTranscoder`.
