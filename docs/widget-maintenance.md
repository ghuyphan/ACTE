# Widget Maintenance Guide

This is the fastest way back into the current widget system.

## Read These Files First

1. `services/widgetService.ts`
2. `services/widget/contract.ts`
3. `services/widget/selection.ts`
4. `services/widget/media.ts`
5. `services/widget/platform.ts`
6. `services/widget/history.ts`
7. `hooks/app/useAppWidgetRefresh.ts`
8. `hooks/useSharedFeedStore.tsx`
9. `widgets/LocketWidget.tsx`
10. `widgets/ios/LocketWidget.swift`
11. `widgets/android/NotoWidgetProvider.kt`
12. `__tests__/widgetService.test.ts`
13. `__tests__/widgetContractParity.test.ts`

## What Each File Owns

### `services/widgetService.ts`

This is now the orchestrator, not the entire widget system.

It owns:

- request dedupe, debounce, and in-flight coalescing
- loading notes from the active scope
- optional shared-feed refresh lookup
- optional location lookup and caching
- building the final timeline from ordered selections
- reusing the last delivered payload when a refresh collapses to idle
- returning explicit refresh outcomes such as `updated`, `skipped_unchanged`, or `failed`

### `services/widget/contract.ts`

This is the shared widget payload contract.

It owns:

- the `WidgetProps` and `WidgetTimelineEntry` types
- the canonical payload field list
- bridge sanitization and payload signatures
- contract helpers used by storage and native delivery

### `services/widget/selection.ts`

This is the metadata-first selection layer.

It owns:

- converting notes and shared posts into widget candidates
- ranking nearby, photo, shared, and latest candidates
- fallback conversion from photo candidates to text candidates
- ordered selections before any photo or avatar staging work happens

### `services/widget/media.ts`

This is the asset staging layer.

It owns:

- preparing only the selected candidate's photo, sticker, and avatar assets
- copying assets into extension-safe locations when needed
- versioned widget asset filenames
- cleanup of stale sibling staged files after an asset changes

### `services/widget/platform.ts`

This is the platform bridge layer.

It owns:

- iOS timeline delivery
- Android snapshot delivery
- platform-specific delivery signatures
- bridge warning normalization

### `services/widget/history.ts`

This is the recent-history cache.

It owns:

- loading and saving recently delivered candidate keys
- helping the service avoid repeating the same candidate too aggressively across refreshes

### `hooks/app/useAppWidgetRefresh.ts`

This is the app-level refresh wiring.

It owns:

- startup refresh
- foreground refresh
- auth and connectivity regain refreshes
- language-driven content refreshes
- gating widget refresh until app startup is ready

### `hooks/useSharedFeedStore.tsx`

This is the shared-content widget trigger inside the feed pipeline.

It owns:

- scheduling a widget refresh after shared-feed snapshots are committed and persisted

### Native widget files

`widgets/ios/LocketWidget.swift` is still the durable source of truth for actual iOS rendering and payload parsing.

`widgets/android/NotoWidgetProvider.kt` is still the durable source of truth for actual Android rendering and snapshot parsing.

`widgets/LocketWidget.tsx` is the Expo registration file plus JS fallback/dev preview.

## Current Behavior At A Glance

- Selection is metadata-first. The service ranks candidates before it touches the filesystem or downloads shared media.
- iOS receives a `4` entry timeline in `6` hour slots.
- Android receives the first resolved entry as a snapshot.
- Timeline slots try to show distinct candidates first, then repeat the last renderable candidate only when needed.
- Recent candidate history is persisted and used to deprioritize recently shown items on later slots.
- Photo, sticker, and avatar staging happens on demand for the chosen candidate and fallback candidate only.
- Refreshes report explicit outcomes instead of silently pretending success.

## Data Flow

1. `app/_layout.tsx` enables widget refresh only after startup bootstrap has prepared the app.
2. `useAppWidgetRefresh` schedules lightweight startup refreshes and richer foreground/session/content refreshes.
3. Note mutations in `hooks/state/useNotesStore.tsx` still schedule widget updates.
4. Shared-feed writes in `hooks/useSharedFeedStore.tsx` also schedule widget updates.
5. `updateWidgetData()` loads notes, optional shared content, and optional location.
6. `selection.ts` ranks candidates using note and shared-post metadata.
7. `media.ts` stages only the selected candidate's assets.
8. `platform.ts` pushes the iOS timeline or Android snapshot.
9. Native widget files parse and render the delivered payload.

## Common Change Map

Change selection or rotation rules:

- edit `services/widget/selection.ts`
- update `__tests__/widgetService.test.ts`

Change payload fields:

- edit `services/widget/contract.ts`
- update native parsers if needed
- run `__tests__/widgetContractParity.test.ts`

Change photo, sticker, or avatar staging:

- edit `services/widget/media.ts`
- update `__tests__/widgetService.test.ts`

Change refresh scheduling:

- edit `hooks/app/useAppWidgetRefresh.ts`
- edit `hooks/useSharedFeedStore.tsx` if shared-feed behavior changes
- update `__tests__/useAppWidgetRefresh.test.tsx` and store tests

Change iOS visuals:

- edit `widgets/ios/LocketWidget.swift`
- keep `widgets/LocketWidget.tsx` roughly aligned for preview/fallback behavior

Change Android visuals or snapshot binding:

- edit `widgets/android/NotoWidgetProvider.kt`
- update `plugins/withCustomAndroidWidget.js` or `plugins/withAndroidWidgetTypography.js` if generated resources also need to change

## Known Gotchas

### Generated native copies are disposable

The durable widget source lives under `widgets/` and the supporting plugins. Generated `ios/` and `android/` copies can be replaced by prebuild.

### The iOS bridge payload can still be nested

The Swift parser still needs to tolerate the Expo Widgets nested `props.props` bridge shape.

### Android is still snapshot-based

Android renders the first resolved entry, not the full iOS timeline.

### Versioned staged filenames are intentional

Stable filenames now key off the asset identity and version instead of a rotating slot token. If staging changes, preserve cleanup of stale sibling files or the app-group folder will grow forever.

### A refresh may intentionally skip delivery

`skipped_duplicate_request`, `queued`, `skipped_unchanged`, and `skipped_platform` are normal outcomes and should not be treated as silent failures.

### The service may reuse the last delivered payload

If source content exists but the current refresh cannot build a renderable widget entry, the service reuses the last non-idle payload instead of replacing it with empty idle content.

## Recommended Checks

```bash
npm test -- widgetService.test.ts useAppWidgetRefresh.test.ts useSharedFeedStore.test.ts widgetContractParity.test.ts
npm run typecheck
npm run ios
npm run android
```
