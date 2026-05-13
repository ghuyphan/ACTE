# Architecture Boundaries

This repo keeps Expo Router files thin and pushes feature behavior into screen, hook, and service layers. Use these boundaries when moving code or adding new features.

## Routes

- `app/` owns file-based navigation, route params, redirects, and route-level composition.
- Route files should import screen implementations and pass route context down. Avoid adding reusable state, persistence, or feature logic directly in route files.
- New routes belong in the matching route group under `app/`; do not add a separate navigation tree.

## Screens And UI

- `components/screens/<feature>/` owns screen-level orchestration for a feature.
- `components/screens/MapScreen.tsx` is the map screen shell; `components/screens/MapScreen.shared.tsx` owns shared map UI used by the shell.
- Shared feature UI belongs in grouped component folders such as `components/home/`, `components/map/`, `components/notes/`, `components/settings/`, `components/shared/`, and `components/sheets/`.
- Generic reusable primitives belong in `components/ui/`.
- Keep platform-specific screen files thin. Move common layout and behavior into shared screen components or feature components.

## Hooks

- Public hook imports should use the top-level `hooks/*` surfaces when they exist.
- Implementation details belong in grouped folders: `hooks/app/` for startup and app lifecycle, `hooks/state/` for provider-backed stores, `hooks/map/` for map-only state, and `hooks/ui/` for presentation and sheet state.
- Compatibility re-export shims should stay logic-free until call sites have moved.

## Services

- `services/` owns persistence, sync, media, notification, widget, search, recap, sharing, and geofence domain logic.
- Normal note mutations should flow through `hooks/state/useNotesStore.tsx`, with durable storage behavior kept in services.
- Shared feed state and sharing actions should flow through `hooks/useSharedFeedStore.tsx` and `services/sharedFeedService.ts`.
- Social push token registration and sends should stay behind `services/socialPushService.ts` and the app-level hooks that wrap it.
- Widget refreshes are wired to note mutations; preserve that behavior when adding mutation paths.

## Diagnostics

- App-wide timing and lifecycle diagnostics belong in `utils/appDiagnostics.ts`.
- Use `traceAppAsync` or `startAppSpan` around hot-path async work such as startup, note mutations, sync, capture saves, media work, and widget refreshes.
- Keep diagnostics metadata non-personal: prefer counts, modes, booleans, result statuses, and coarse feature flags over note text, emails, usernames, coordinates, or file paths.
- `utils/startupTrace.ts` is a compatibility wrapper for startup-specific call sites. New generic instrumentation should import `utils/appDiagnostics.ts` directly.
- Diagnostics are quiet in tests and enabled for development builds or when `EXPO_PUBLIC_NOTO_DIAGNOSTICS=1` is set. A sink can be registered later to forward structured events to an analytics or crash-reporting service without changing call sites.

## Native And Generated Work

- Durable native behavior belongs in `app.config.js`, `plugins/`, `modules/`, `native/`, and `widgets/`.
- `ios/` and `android/` may exist locally for debugging, but generated native folders and local Android build output are ignored.
- Persistent iOS widget changes belong in `widgets/ios/LocketWidget.swift`; persistent Android widget changes belong in `widgets/android/NotoWidgetProvider.kt`.

## Placeholder Directories

The following empty directories are intentional placeholders or migration staging areas and should not be deleted only because they are empty:

- `contexts/`
- `app/feed-return/[kind]/`
- `components/screens/app/`
- `test-support/`
- `widgets/android/values/`
