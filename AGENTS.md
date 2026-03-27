# AGENTS.md

## Project Overview

Noto is an Expo SDK 55 / React Native app for place-linked text notes and photo memories. The current app is local-first and uses SQLite for core persistence, with optional Supabase auth/sync, friend sharing, geofence reminders, widgets, and RevenueCat-backed `Noto Plus`.

## Repo Map

- `app/`: Expo Router routes and screen entry points.
- `app/(tabs)/`: Main app tabs for home/capture, map, search, and settings.
- `app/auth/`: Onboarding, auth entry, and profile/account screens.
- `app/notes/`: Notes grid that can mix local notes and shared posts.
- `app/shared/`: Shared moments list and shared post detail.
- `app/friends/`: Friend invite join flow.
- `app/widget/`: Widget deep-link entry points.
- `app/plus.tsx`: Subscription / purchase screen.
- `components/`: Reusable UI, with most shared pieces under `home/`, `map/`, `screens/`, and `ui/`.
- `hooks/`: Providers and shared app state such as notes, auth, theme, sync, connectivity, subscriptions, and shared feed.
- `hooks/map/`: Map-only domain and screen-state logic.
- `services/`: SQLite, sync, geofence, widget, media, search, and sharing logic.
- `constants/`: Theme tokens, i18n setup, note color defaults, radius defaults, and subscription config.
- `utils/`: Background tasks and smaller platform/storage helpers.
- `widgets/`: Expo widget registration and the checked-in Swift widget source.
- `plugins/`: Custom Expo config plugins for widget/native fixes.
- `assets/images/`: App icons, splash assets, and image resources.
- `docs/`: Short maintenance docs for release, Supabase, RevenueCat, and widget work.
- `__tests__/`: Jest coverage for hooks, services, screens, widgets, and map logic.
- `ios/`, `android/`: Generated local native folders that still matter for widget/auth/native debugging.

## Important Entry Points

- `package.json`: `expo-router/entry` app entry and supported scripts.
- `app/_layout.tsx`: Root providers, DB bootstrap, splash flow, notification routing, widget refresh, and geofence startup sync.
- `app/index.tsx`: First-launch redirect into onboarding or tabs.
- `app/(tabs)/_layout.tsx`: Native tab layout setup.
- `app.config.ts`: Expo config, permissions, widgets, Google Maps wiring, custom plugins, and native IDs.
- `services/database.ts`: SQLite schema, note model, local cache tables, and migrations.
- `services/sharedFeedService.ts`: Friend invites, shared post CRUD, and shared feed refresh logic.
- `services/syncService.ts`: Supabase sync pipeline.
- `services/geofenceService.ts`: Reminder permission checks and monitored region selection.
- `services/widgetService.ts`: Widget timeline building, candidate selection, and media bridging.
- `hooks/useNotesStore.tsx`: The main note mutation path.
- `hooks/useSharedFeedStore.tsx`: Shared feed state and sharing actions.
- `hooks/useSubscription.tsx`: RevenueCat subscription state and purchase actions.
- `widgets/ios/LocketWidget.swift`: Source of truth for real iOS widget rendering.

## Commands

- `npm run start`: Start the Expo dev server.
- `npm run ios`: Run the native iOS build.
- `npm run android`: Run the native Android build.
- `npm run web`: Start the web target.
- `npm run lint`: Run Expo/ESLint checks.
- `npm test`: Run Jest tests.
- `npx tsc --noEmit`: Run TypeScript typechecking.
- `npm run reset-project`: Run the bundled reset helper.

## Conventions

- Keep routing file-based under `app/`; do not add a separate navigation tree.
- Keep route files focused on composition and screen wiring; push reusable state into hooks and data/platform logic into services.
- Use `useTheme()` and `constants/theme.ts` rather than hardcoded colors.
- Add user-facing copy through `react-i18next` and update both `constants/locales/en.json` and `constants/locales/vi.json`.
- Normal note CRUD should flow through `useNotesStore`.
- Shared feed state and sharing actions should flow through `useSharedFeedStore`.
- Subscription state should flow through `useSubscription`.
- Widget refreshes are already wired to note mutations; preserve that behavior when adding new mutation paths.
- Map-specific clustering/filtering logic belongs in `hooks/map/` and `components/map/`.

## Where To Add New Code

- New route or screen entry: `app/` in the correct route group.
- Shared screen UI: `components/`, usually `components/ui/`, `components/home/`, `components/map/`, or `components/screens/`.
- Reusable state/provider logic: `hooks/`.
- Domain or integration logic: `services/`.
- Smaller helpers or platform utilities: `utils/`.
- Theme/i18n/subscription constants: `constants/`.
- Tests: `__tests__/`, named after the feature area.

## Warnings

- Treat `app.config.ts`, `plugins/`, `ios/`, and `android/` as native-build-sensitive.
- `ios/` and `android/` are git-ignored here, so durable native behavior should be expressed through checked-in config/plugins/source files.
- Persistent widget changes belong in `widgets/ios/LocketWidget.swift`; the copy under `ios/ExpoWidgetsTarget/` is generated.
- Be careful in `services/database.ts`, `services/syncService.ts`, `services/sharedFeedService.ts`, and `utils/backgroundGeofence.ts`; they are core persistence/reminder/social paths with existing tests.
- Auth and billing env values are project-specific. Do not rotate or replace them casually.
