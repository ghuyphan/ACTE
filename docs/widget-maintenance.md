# Widget Maintenance Guide

This is the shortest path back into the widget code.

## Read These Files First

1. `services/widgetService.ts`
2. `widgets/LocketWidget.tsx`
3. `widgets/ios/LocketWidget.swift`
4. `widgets/android/NotoWidgetProvider.kt`
5. `hooks/app/useAppWidgetRefresh.ts`
6. `plugins/withCustomAndroidWidget.js`
7. `plugins/withAndroidWidgetTypography.js`
8. `__tests__/widgetService.test.ts`

## What Each File Owns

### `services/widgetService.ts`

This is the widget data pipeline.

It owns:

- loading local notes and optional shared-feed candidates
- choosing timeline entries
- deduping repeats across recent slots
- preparing shared-container image assets for iOS
- pushing the iOS timeline or Android snapshot bridge update

Current behavior at a glance:

- iOS receives a `4` entry timeline
- entries advance in `6` hour slots
- Android receives the first resolved entry as a JSON snapshot
- candidates can come from nearby notes, favorites, photos, resurfaced older notes, shared posts, or latest notes
- the service keeps short history to avoid showing the same item too often

### `widgets/LocketWidget.tsx`

This is the Expo widget registration file and JS fallback view.

It owns:

- the widget registration name and prop contract
- the JS-side preview/fallback rendering
- the default sample payload used for development

### `widgets/ios/LocketWidget.swift`

This is the source of truth for the actual iOS widget runtime.

It owns:

- parsing the stored timeline payload
- loading shared-container images
- rendering the real Home Screen and Lock Screen widget layouts
- iOS-specific background and family behavior

Persistent iOS visual changes belong here, not in the generated native copy.

### `widgets/android/NotoWidgetProvider.kt`

This is the source of truth for the Android widget runtime.

It owns:

- parsing the bridged JSON snapshot
- binding snapshot data into Android `RemoteViews`
- image, gradient, doodle, sticker, and badge rendering for the Android widget
- per-size layout behavior and click intents back into the app

Persistent Android visual and binding changes belong here, not only in the generated `android/` copy.

### `plugins/withCustomAndroidWidget.js`

This plugin re-applies the checked-in Android widget source and layout patches during prebuild.

It owns:

- copying the checked-in provider source into the generated Android project
- patching widget layouts and drawable resources
- keeping prebuild output aligned with the checked-in Android widget implementation

### `plugins/withAndroidWidgetTypography.js`

This plugin normalizes Android widget typography to the app's Noto Sans font setup after prebuild.

### `__tests__/widgetService.test.ts`

This is the safety net for selection logic, media fallbacks, and timeline/snapshot output.

Update these tests when changing:

- candidate prioritization
- repeat-avoidance rules
- shared-content behavior
- image copy and fallback logic
- iOS timeline or Android snapshot bridge payload shape

## Data Flow

1. `app/_layout.tsx` wires startup through `hooks/app/useAppStartupBootstrap.ts`, `hooks/app/useAppWidgetRefresh.ts`, and the shared provider shell.
2. `useAppWidgetRefresh` refreshes widget data on launch, foreground, and auth/connectivity changes.
3. Note mutations in `hooks/state/useNotesStore.tsx` also refresh widget data. Import the public notes API from `hooks/useNotes.ts`; the state folder is the implementation detail.
4. `updateWidgetData()` builds widget props from local notes and optional shared-feed content.
5. iOS receives a timeline through `updateTimeline(...)`.
6. Android receives the first resolved entry through `NotoWidgetModule.updateSnapshot(...)`.
7. `widgets/ios/LocketWidget.swift` renders the iOS timeline and `widgets/android/NotoWidgetProvider.kt` renders the Android snapshot.

## Common Change Map

Change widget selection or rotation rules:

- edit `services/widgetService.ts`
- update `__tests__/widgetService.test.ts`

Change iOS widget visuals:

- edit `widgets/ios/LocketWidget.swift`
- keep `widgets/LocketWidget.tsx` roughly aligned for fallback/dev previews

Change Android widget visuals or binding:

- edit `widgets/android/NotoWidgetProvider.kt`
- update `plugins/withCustomAndroidWidget.js` or `plugins/withAndroidWidgetTypography.js` if the generated layout/resources also need to change

Fix image problems:

1. Check `services/widgetService.ts`
2. Check `widgets/ios/LocketWidget.swift`
3. Check `widgets/android/NotoWidgetProvider.kt`
4. Verify the file was copied into the iOS app-group container when applicable

Fix deep-link behavior:

1. Check `services/widgetService.ts`
2. Check `app/widget/[kind]/[id].tsx`

## Known Gotchas

### Generated native copies are disposable

The checked-in sources under `widgets/` are durable. Generated files under `ios/` or `android/` can be replaced by prebuild.

### Payload shape can be nested

The iOS payload path still needs to tolerate the nested bridge structure used by Expo Widgets.

### Shared media must be made extension-safe

The iOS widget cannot rely on arbitrary app-sandbox file paths. Shared photos and avatar assets must be copied into the app-group container first.

### Android is snapshot-based

Android currently renders a single resolved entry rather than the full iOS-style timeline.

### Plugins are part of the Android widget surface

If you change Android widget layouts, drawables, or provider wiring, update the supporting plugins so those changes survive prebuild.

### Native caches can mislead you

After changing native widget layout or parsing:

- rebuild the app
- remove the widget
- add it again

## Recommended Checks

```bash
npm test -- --runInBand __tests__/widgetService.test.ts
npm run lint
npm run typecheck
npm run ios
npm run android
```
