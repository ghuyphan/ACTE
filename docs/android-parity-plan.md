# Android Parity Plan

Last updated: 2026-03-18

## Goal

Bring the Android build closer to the current iOS experience in both:

- UI polish
- interaction quality
- native feature reliability
- release readiness

This is a working plan, not a final audit. Items below are split between confirmed gaps we have already hit and areas that still need a full Android pass.

## Confirmed Current Gaps

### 1. A lot of the current UI is built around iOS-first components

Status:
- Several important surfaces are using iOS-native presentation and styling patterns first, with Android either getting a simpler fallback or needing separate treatment.

Examples already in the codebase:
- `expo-glass-effect` / `GlassView` is used heavily across headers, cards, pills, map controls, rooms screens, and onboarding.
- `@expo/ui/swift-ui` hosts and modifiers are used for several sheets and alerts.
- Some flows branch directly on `Platform.OS === 'ios'`.
- Some layout/styling logic is explicitly tuned around `isOlderIOS` and `isIOS26OrNewer`.

Why this matters:
- Android may render these surfaces differently, flatter, or inconsistently.
- Some screens may technically work on Android while still feeling like a fallback rather than a finished platform implementation.
- Parity work is not only bug fixing; it is also replacing iOS-specific visual assumptions with Android-safe design patterns.

Follow-up:
- Inventory every screen using `GlassView`, Swift UI hosts, and iOS-only branches.
- Decide which surfaces should keep a shared cross-platform design and which need Android-specific presentation.
- Replace "temporary fallback" styling with intentional Android components where needed.

### 2. Maps are disabled on Android for now

Status:
- Temporary fallback is in place instead of mounting `react-native-maps` on Android.

Why:
- The Google Maps Android API key is not configured yet, which causes a native crash when `MapView` mounts.

Follow-up:
- Add the Android Maps API key to native config.
- Re-enable the real map screen on Android.
- QA markers, clustering, recenter, nearby cards, and note opening on Android devices.

### 3. Theme parity is only partially native-aligned

Status:
- The React Native theme is working, but we stopped forcing the native `Appearance.setColorScheme` bridge because it crashed on Android when reset to system mode.

Why:
- Android bridge behavior for `setColorScheme(undefined/null)` caused a native crash.

Follow-up:
- Revisit whether native appearance syncing is actually needed.
- If needed, implement an Android-safe version instead of restoring the old call path.
- Verify status bar, navigation surfaces, dialogs, and system-following theme transitions on Android.

### 4. Notification channel behavior needed Android-specific handling

Status:
- The reminder channel was updated to avoid a bad `sound: 'default'` configuration and moved to `reminders-v2`.

Follow-up:
- QA reminder delivery, sound, vibration, and deep-link open behavior on a real Android device.
- Confirm upgrade behavior for existing installs using the old channel.

## Android Audit Workstreams

### A. Native Setup And Configuration

- Configure Google Maps Android API key and validate manifest setup.
- Review Android notification channel configuration and defaults.
- Verify RevenueCat Android keys and purchase flows.
- Recheck background location, notifications, camera, and photo permissions wording on Android.
- Confirm Expo config/plugins produce the expected Android native output after prebuild.

### B. Visual Parity

- Compare screen-by-screen spacing, typography, paddings, and alignment against iOS.
- Review tab bar height, icon alignment, safe area handling, and header spacing.
- Audit cards, borders, shadows, and elevation so Android does not feel flatter or heavier than iOS.
- Review glass-effect fallbacks and ensure Android alternatives still look intentional.
- Check sheet, modal, and alert styling for Android readability and polish.
- Validate dark mode and light mode across all major screens.

### B1. iOS-First UI Dependency Audit

Current high-risk patterns to audit:
- `expo-glass-effect` / `GlassView`
- `@expo/ui/swift-ui` `Host` / `Group` / `presentationDragIndicator` / `environment`
- `Platform.OS === 'ios'` branches that change interaction or layout
- `isOlderIOS` / `isIOS26OrNewer` branches that may leave Android with a less polished path

Known files and areas worth reviewing first:
- `components/home/HomeHeaderSearch.tsx`
- `components/home/CaptureCard.tsx`
- `components/home/SharedMomentsStrip.tsx`
- `components/home/SharedManageSheet.tsx`
- `components/map/MapFilterBar.tsx`
- `components/map/MapPreviewCard.tsx`
- `components/ui/GlassHeader.tsx`
- `components/ui/InfoPill.tsx`
- `components/ui/TransientStatusChip.tsx`
- `components/AppSheetAlert.tsx`
- `components/NoteDetailSheet.tsx`
- `app/auth/index.tsx`
- `app/auth/onboarding.tsx`
- `app/(tabs)/_layout.tsx`
- `app/(tabs)/settings.tsx`
- `app/rooms/create.tsx`
- `app/rooms/join.tsx`
- `app/rooms/share.tsx`
- `app/rooms/[id].tsx`
- `app/rooms/[id]/settings.tsx`
- `app/friends/join.tsx`

Questions to answer during this audit:
- Does Android get the same information hierarchy as iOS?
- Does Android get a real designed surface, or just a passive fallback?
- Are blur/glass materials readable on Android in both themes?
- Are sheet handles, corners, paddings, and keyboard behavior equally polished?
- Are there places where we should stop pretending to share one presentation model and instead build an Android-specific one?

### C. Interaction Parity

- Compare tap feedback, pressed states, and haptics behavior.
- Review gesture handling for sheets, lists, map interactions, and swipe actions.
- Audit animation timing and reduced-motion behavior on Android.
- Verify keyboard avoidance, input focus, and form flows.
- Check deep links from notifications and note-opening flows.

### D. Feature Reliability

- Notes CRUD: create, edit, favorite, delete, and reopen.
- Photo notes: camera, import, save, display, and edit paths.
- Geofence reminders: permission escalation, background monitoring, notification scheduling, and cooldown behavior.
- Widgets: confirm Android expectations if any Android widget scope is planned later.
- Auth and sync: sign in, sign out, offline recovery, and shared data flows.
- Subscription paths: offer loading, purchase, restore, signed-in linking, and signed-out behavior.

### E. Performance And Stability

- Watch for Android-only crashes during app startup and screen transitions.
- Check first render smoothness on lower-end Android devices.
- Measure map, feed, and note-detail interactions after Android map support is re-enabled.
- Audit image-heavy screens for memory pressure and jank.

## Recommended Rollout Order

### Phase 1: Unblock Core Android Usage

- Configure Google Maps API key.
- Re-enable Android map screen.
- QA reminders, note opening, and theme switching.
- Smoke test create/edit/delete/import flows.

### Phase 2: Visual Parity Pass

- Run a screen-by-screen Android vs iOS comparison.
- Fix spacing, elevation, glass fallbacks, and empty/loading/error states.
- Prioritize screens that currently depend most on iOS-first UI primitives.
- Capture before/after screenshots for key screens.

### Phase 3: Interaction And Native Reliability

- Tune gesture behavior, animations, and feedback.
- Validate permissions and settings recovery flows.
- Test on at least one physical Android device, not emulator only.

### Phase 4: Release Hardening

- Complete purchase QA.
- Complete notification/geofence QA.
- Run full Android smoke checklist before internal release.

## Recommended Architecture Direction

We should stop forcing one view layer to cover both platforms in areas where the native UI primitives are clearly different.

Recommended approach:

- Keep Expo Router route paths shared.
- Split the actual screen or component implementation by platform when needed.
- Keep hooks, stores, services, and business logic shared.
- Let only the presentation layer diverge.

Preferred pattern:

- Shared route entry file stays in `app/`.
- That route imports a platform-specific screen implementation.
- Example:
  - `app/(tabs)/map.tsx`
  - `components/screens/MapScreen.ios.tsx`
  - `components/screens/MapScreen.android.tsx`

Why this is better than the current approach:

- We keep one navigation structure and one set of route URLs.
- We avoid filling every screen with repeated `Platform.OS === 'ios'` branches.
- We can use iOS-native features where they shine without forcing Android into weak fallbacks.
- Android can get intentionally designed components instead of "best effort" approximations of Swift UI or glass materials.

Best candidates to split first:

- `app/(tabs)/_layout.tsx`
  - iOS: `NativeTabs`
  - Android: likely a standard JS tab navigator or an Android-appropriate tab shell
- settings screen and sheets
- auth sheet flows
- note detail sheet
- shared manage / friends join sheet flows
- home header search controls
- map screen presentation once Android maps are re-enabled

Important note:

- `@expo/ui/swift-ui` should be treated as iOS-first, not as a universal abstraction.
- `NativeTabs` in `expo-router/unstable-native-tabs` should also be evaluated platform-by-platform instead of assumed to be equally polished everywhere.
- `GlassView` should be treated as a design choice that may need Android-specific replacements, not a guaranteed parity layer.

## Suggested QA Checklist

- Onboarding and first-run flow
- Home feed load and empty states
- Create text note
- Create photo note from camera
- Import photo note from library
- Edit and delete note
- Favorite/unfavorite note
- Open note from list and notification
- Map filters, marker selection, clustering, recenter
- Settings language and theme changes
- Sign in / sign out
- Shared rooms and shared feed flows
- Subscription purchase / restore
- Background reminder delivery on device

## Definition Of Done

We can call Android "close to iOS parity" when:

- no Android-only startup crashes remain in normal flows
- map, reminders, notes, auth, and purchases all work on device
- light/dark themes feel consistent with iOS
- major screens have comparable spacing, hierarchy, and responsiveness
- iOS-first UI components no longer leave Android with obviously downgraded presentation
- there is no temporary Android-only fallback left for core product areas

## Notes

- Keep this file updated whenever we add a temporary Android workaround.
- When a temporary workaround is removed, replace it here with the permanent solution and QA notes.
- Pair this plan with `docs/android-release.md` for release-specific setup and testing.
