# Widget Maintenance Guide

This file is the shortcut for editing the widget without rereading the whole app.

## Read These Files First

If you only have a few minutes, read these in this order:

1. `services/widgetService.ts`
2. `widgets/LocketWidget.tsx`
3. `widgets/ios/LocketWidget.swift`
4. `__tests__/widgetService.test.ts`

Usually that is enough.

## What Each File Owns

### `services/widgetService.ts`

This is the widget data pipeline.

It owns:

- picking which note the widget should show
- getting current location if permission is already granted
- copying photo files into the iOS shared app-group container
- falling back from photo -> base64 -> latest valid text note
- calling `widget.updateSnapshot({ props })`

Current selection rule:

- if location permission is already granted and a note is within `500m`, show the nearest note
- otherwise show the latest note by `createdAt`

Current photo rule:

- for iOS, copy the selected photo into the shared container first
- if copy fails, try base64
- if that also fails, fallback to the latest valid text note

### `widgets/LocketWidget.tsx`

This is the Expo widget registration file and JS fallback view.

It owns:

- the widget name: `createWidget('LocketWidget', ...)`
- the JS-side prop shape
- the default snapshot payload at the bottom of the file
- a fallback visual implementation that should stay roughly aligned with native iOS

Important:

- the actual iOS runtime look is mostly controlled by Swift, not this file
- `backgroundImageUrl` is passed through here, but the real image rendering on iOS happens in Swift

### `widgets/ios/LocketWidget.swift`

This is the source of truth for the real iOS widget runtime.

It gets copied into `ios/ExpoWidgetsTarget/LocketWidget.swift` by `plugins/withCustomWidgetSwift.js` after `prebuild`.

It owns:

- reading the timeline written by Expo Widgets
- parsing the nested payload shape
- loading the shared-container photo file or base64 image
- the real Home Screen small/large widget layout
- the privacy-safe Lock Screen accessory layouts
- iOS-specific background behavior like `containerBackground(for: .widget)`

Important:

- the payload is nested, so parsing must handle `props.props`
- if this parser is wrong, the widget often falls back to idle text even when data exists
- the generated copy in `ios/ExpoWidgetsTarget/LocketWidget.swift` is git-ignored
- persistent changes belong in `widgets/ios/LocketWidget.swift`

### `__tests__/widgetService.test.ts`

This is the safety net for widget note selection and fallback behavior.

Update these tests when changing:

- nearby vs latest selection rules
- photo fallback behavior
- shared-container copy behavior assumptions

## How Data Gets Into the Widget

The widget does not read the database directly.

Flow:

1. App starts.
2. `app/_layout.tsx` calls `updateWidgetData()` after DB init.
3. Note mutations in `hooks/useNotesStore.tsx` also call `updateWidgetData()`.
4. `updateWidgetData()` builds widget props and writes them with `widget.updateSnapshot({ props })`.
5. Expo Widgets stores the timeline.
6. `widgets/ios/LocketWidget.swift` reads that timeline from shared defaults and renders it.

Mutation triggers already wired:

- create note
- update note
- delete note
- delete all notes
- app boot refresh

If you add a new note mutation path elsewhere, make sure it also calls `updateWidgetData()`.

## Which File To Edit For Common Changes

### Change widget layout or typography

Edit:

- `widgets/ios/LocketWidget.swift`
- then keep `widgets/LocketWidget.tsx` visually aligned

Lock Screen reminder:

- accessory families should stay glanceable and privacy-safe
- avoid showing full note text or photos there unless that becomes an explicit product decision

### Change which note gets shown

Edit:

- `services/widgetService.ts`
- `__tests__/widgetService.test.ts`

### Fix image not showing

Check in this order:

1. `services/widgetService.ts`
2. `widgets/ios/LocketWidget.swift`

Things to verify:

- photo was copied into the app-group shared container
- `backgroundImageUrl` points to the shared container, not the app sandbox photo path
- Swift can load the file path
- if file copy fails, base64 fallback still works

### Fix blank widget

Check:

1. Swift parser still reads nested `props.props`
2. `updateWidgetData()` is being called
3. the timeline exists in shared defaults
4. the widget was removed and re-added after a native/layout change

### Change widget name / registration / families

Edit:

- `widgets/LocketWidget.tsx`
- `app.json`

## Known Gotchas

### 1. iOS file is git-ignored

`ios/ExpoWidgetsTarget/LocketWidget.swift` is ignored by `.gitignore`.

That means:

- local native widget fixes can work on your machine
- those changes will be lost on the next `prebuild` unless they are copied back into `widgets/ios/LocketWidget.swift`

Always mention this explicitly when reporting widget work.

### 2. `props.props` nesting is real

The native timeline payload is nested.

If Swift reads only the top-level dictionary, the widget can look empty and fall back to idle content.

### 3. JS widget view is not the whole truth on iOS

For iOS, the real rendering behavior is in Swift.

If the JS widget looks correct but the real Home Screen widget does not, trust the Swift path first.

### 4. Photo files must be moved into the shared container

The widget extension cannot reliably read arbitrary photo paths from the app sandbox.

Use the shared app-group container path prepared in `services/widgetService.ts`.

### 5. iOS caches widget views aggressively

After changing layout or native parsing:

- rebuild the app
- remove the widget from the Home Screen
- add it back

Otherwise you can end up debugging stale UI.

### 6. Expo Widgets bundle copy fix is custom

`plugins/withExpoWidgetsBundleFix.js` adds a build phase to copy the Expo Widgets JS bundle correctly.

If widgets suddenly stop updating after native rebuilds, check that this plugin is still configured and still applies.

## Minimal Debug Checklist

When the widget is wrong, go through this order:

1. Confirm `updateWidgetData()` is called.
2. Confirm the selected note is the expected one.
3. Confirm the outgoing snapshot props look correct.
4. For photos, confirm the copied shared-container path exists.
5. Confirm Swift parser still reads nested props.
6. Rebuild iOS and re-add the widget.

## Recommended Commands

Use these after widget changes:

```bash
npm test -- --runInBand __tests__/widgetService.test.ts
npm run lint
npx tsc --noEmit
npx expo run:ios
```

## Current Behavior Snapshot

As of now:

- widget is display-only
- reminders and geofences stay app-owned, not widget-owned
- widget selection is `nearby -> latest`
- text widget style is minimal and centered
- photo widget uses shared-container image loading on iOS
- supported families are `systemSmall`, `systemLarge`, `accessoryInline`, `accessoryCircular`, and `accessoryRectangular`

## If You Need To Make A Fast Edit

Use this shortcut:

- visual-only change: edit Swift first, then TSX
- data/selection change: edit `widgetService.ts` first, then tests
- blank/photo bug: inspect shared-container copy + Swift parsing before touching UI
