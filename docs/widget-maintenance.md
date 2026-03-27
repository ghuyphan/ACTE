# Widget Maintenance Guide

This is the shortest path back into the widget code.

## Read These Files First

1. `services/widgetService.ts`
2. `widgets/LocketWidget.tsx`
3. `widgets/ios/LocketWidget.swift`
4. `__tests__/widgetService.test.ts`

## What Each File Owns

### `services/widgetService.ts`

This is the widget data pipeline.

It owns:

- loading local notes and optional shared-feed candidates
- choosing timeline entries
- deduping repeats across recent slots
- preparing shared-container image assets for iOS
- pushing the iOS timeline or Android snapshot

Current behavior at a glance:

- iOS receives a `4` entry timeline
- entries advance in `6` hour slots
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

Persistent changes belong here, not in the generated native copy.

### `__tests__/widgetService.test.ts`

This is the safety net for selection logic, media fallbacks, and timeline output.

Update these tests when changing:

- candidate prioritization
- repeat-avoidance rules
- shared-content behavior
- image copy and fallback logic

## Data Flow

1. `app/_layout.tsx` initializes the DB and schedules a widget refresh.
2. Note mutations in `hooks/useNotesStore.tsx` also refresh widget data.
3. `updateWidgetData()` builds timeline props from local notes and optional shared-feed content.
4. Expo Widgets stores the payload.
5. `widgets/ios/LocketWidget.swift` reads the payload and renders it.

## Common Change Map

Change widget selection or rotation rules:

- edit `services/widgetService.ts`
- update `__tests__/widgetService.test.ts`

Change widget visuals:

- edit `widgets/ios/LocketWidget.swift`
- keep `widgets/LocketWidget.tsx` roughly aligned for fallback/dev previews

Fix image problems:

1. Check `services/widgetService.ts`
2. Check `widgets/ios/LocketWidget.swift`
3. Verify the file was copied into the shared app-group container

Fix deep-link behavior:

1. Check `services/widgetService.ts`
2. Check `app/widget/[kind]/[id].tsx`

## Known Gotchas

### Generated native copy is disposable

`ios/ExpoWidgetsTarget/LocketWidget.swift` is generated. Durable edits must be copied back into `widgets/ios/LocketWidget.swift`.

### Payload shape can be nested

The iOS payload path still needs to tolerate the nested bridge structure used by Expo Widgets.

### Shared media must be made extension-safe

The widget cannot rely on arbitrary app-sandbox file paths. Shared photos and avatar assets must be copied into the app-group container first.

### Android is snapshot-based

Android currently receives the first resolved entry as a snapshot rather than the full iOS-style timeline.

### Native caches can mislead you

After changing native widget layout or parsing:

- rebuild the app
- remove the widget
- add it again

## Recommended Checks

```bash
npm test -- --runInBand __tests__/widgetService.test.ts
npm run lint
npx tsc --noEmit
npm run ios
```
