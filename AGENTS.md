# AGENTS.md

## Project Overview

Noto is an Expo SDK 55 / React Native app for place-linked text notes and photo memories. The current app is local-first and uses SQLite for core persistence, with optional Supabase auth/sync, friend sharing, social push notifications, geofence reminders, widgets, live photo support, and RevenueCat-backed `Noto Plus`.

## Repo Map

- `app/`: Expo Router routes and screen entry points.
- `app/(tabs)/`: Main app tabs for home/capture, map, search, and settings.
- `app/auth/`: Onboarding, auth entry, and profile/account screens.
- `app/notes/`: Notes grid and recap entry point that can mix local notes and shared posts.
- `app/shared/`: Shared moments list and shared post detail.
- `app/friends/`: Friend invite join flow.
- `app/widget/`: Widget deep-link entry points.
- `app/plus.tsx`: Route entry for the subscription / purchase screen.
- `components/`: Reusable UI, with most feature-owned pieces under `app/`, `friends/`, `home/`, `map/`, `navigation/`, `notes/`, `screens/`, `settings/`, `shared/`, `sheets/`, and `ui/`.
- `components/app/`: App-wide composition such as provider wiring.
- `components/friends/`: Friend invite/join feature UI.
- `components/navigation/`: Platform-specific tab layout implementations.
- `hooks/`: Shared hooks and providers, grouped under `app/`, `map/`, `state/`, `ui/`, and top-level public import surfaces.
- `hooks/map/`: Map-only domain and screen-state logic.
- `services/`: SQLite, sync, geofence, widget, notification, recap, live photo, media, search, and sharing logic.
- `constants/`: Theme tokens, i18n setup, note color defaults, radius defaults, subscription config, and experiments.
- `utils/`: Background tasks and smaller platform/storage helpers.
- `plugins/`: Custom Expo config plugins for widget/native fixes and Android release hardening.
- `modules/`: Local Expo modules for live photo motion transcoding and subject cutout.
- `native/`: Checked-in native bridge source used by the custom modules.
- `widgets/`: Expo widget registration plus the checked-in iOS and Android widget source.
- `supabase/`: SQL migrations and edge functions for account cleanup, sticker cleanup, and social push delivery.
- `assets/images/`: App icons, splash assets, and image resources.
- `docs/`: Maintenance docs for release, Android release, Supabase, RevenueCat, FCM/push, and widget work.
- `__tests__/`: Jest coverage for hooks, services, screens, widgets, and map logic.
- `ios/`, `android/`: Generated local native folders that may exist for widget/auth/native debugging, but are git-ignored in this repo.

## Important Entry Points

- `package.json`: `expo-router/entry` app entry and supported scripts.
- `app/_layout.tsx`: Root Expo Router layout, splash flow, notification routing, and app-startup hook wiring.
- `app/index.tsx`: First-launch redirect into onboarding or tabs.
- `app/(tabs)/_layout.tsx`: Platform switch for the native tab layout.
- `components/app/AppProviders.tsx`: Root provider composition extracted from the app layout.
- `components/navigation/TabLayoutIOS.tsx`: iOS tab shell.
- `components/navigation/TabLayoutAndroid.tsx`: Android tab shell.
- `components/screens/auth/AuthScreen.tsx`: Landing, sign-in, register, and password-reset flow.
- `components/screens/notes/NotesScreen.tsx`: Combined notes and shared-posts grid plus recap entry points.
- `components/screens/search/SearchScreen.tsx`: Native search tab implementation.
- `components/screens/shared/SharedFeedScreen.tsx`: Shared moments feed implementation.
- `components/screens/friends/FriendJoinScreen.tsx`: Friend invite join implementation.
- `components/screens/plus/PlusScreen.tsx`: `Noto Plus` upsell and purchase UI.
- `components/screens/profile/ProfileScreen.ios.tsx` and `components/screens/profile/ProfileScreen.android.tsx`: Platform-specific profile/account UI.
- `components/screens/settings/SettingsScreen.ios.tsx` and `components/screens/settings/SettingsScreen.android.tsx`: Platform-specific settings UI.
- `components/screens/MapScreen.ios.tsx` and `components/screens/MapScreen.android.tsx`: Platform-specific map UI.
- `app.config.js`: Expo config, permissions, widgets, Google Maps wiring, build gating, custom plugins, and native IDs.
- `services/database.ts`: SQLite schema, note model, local cache tables, and migrations.
- `services/sharedFeedService.ts`: Friend invites, shared post CRUD, and shared feed refresh logic.
- `services/socialPushService.ts`: Expo push token registration and social notification invokes.
- `services/syncService.ts`: Supabase sync pipeline.
- `services/geofenceService.ts`: Reminder permission checks and monitored region selection.
- `services/widgetService.ts`: Widget timeline building, candidate selection, and media bridging.
- `services/monthlyRecap.ts`: Monthly recap aggregation logic.
- `hooks/app/useAppStartupBootstrap.ts`: DB bootstrap, startup sync, and early app setup.
- `hooks/app/useAppNotificationRouting.ts`: Notification open handling and deep-link routing.
- `hooks/app/useAppWidgetRefresh.ts`: App foreground and widget refresh wiring.
- `hooks/app/useSocialPushRegistration.ts`: Auth-aware social push registration.
- `hooks/state/useNotesStore.tsx`: The main note mutation path.
- `hooks/useNotes.ts`: Public notes hook/provider entry point.
- `hooks/useSharedFeedStore.tsx`: Shared feed state and sharing actions.
- `hooks/useSubscription.tsx`: RevenueCat subscription state and purchase actions.
- `widgets/ios/LocketWidget.swift`: Source of truth for real iOS widget rendering.
- `widgets/android/NotoWidgetProvider.kt`: Source of truth for Android widget rendering.

## Commands

- `npm run start`: Start the Expo dev server.
- `npm run ios`: Run the native iOS build.
- `npm run android`: Run the native Android build.
- `npm run web`: Start the web target.
- `npm run lint`: Run Expo/ESLint checks.
- `npm run typecheck`: Run TypeScript typechecking.
- `npm test`: Run Jest tests.
- `npm run update:preview`: Publish an OTA update to the preview channel.
- `npm run update:production`: Publish an OTA update to the production channel.
- `npm run reset-project`: Run the bundled reset helper.

## Conventions

- Keep routing file-based under `app/`; do not add a separate navigation tree.
- Keep route files focused on composition and screen wiring; push reusable state into hooks and data/platform logic into services.
- Use `useTheme()` and `constants/theme.ts` rather than hardcoded colors.
- Add user-facing copy through `react-i18next` and update both `constants/locales/en.json` and `constants/locales/vi.json`.
- Normal note CRUD should flow through `useNotesStore`.
- Prefer the grouped source folders (`hooks/app`, `hooks/state`, `hooks/ui`, top-level public `hooks/*`, `components/notes`, `components/settings`, `components/sheets`, `components/screens/<feature>`) when adding or moving feature code. Keep route files thin and keep top-level wrapper exports only for compatibility.
- Shared feed state and sharing actions should flow through `useSharedFeedStore`.
- Subscription state should flow through `useSubscription`.
- Widget refreshes are already wired to note mutations; preserve that behavior when adding new mutation paths.
- Map-specific clustering/filtering logic belongs in `hooks/map/` and `components/map/`.
- Social push token registration and notification sends should continue to flow through `services/socialPushService.ts` and the app-level hooks that already wrap it.

## Where To Add New Code

- New route entry: `app/` in the correct route group.
- New screen implementation: `components/screens/<feature>/`.
- Shared screen UI: `components/`, usually `components/ui/`, `components/home/`, `components/map/`, `components/notes/`, `components/settings/`, `components/sheets/`, or `components/screens/`.
- Reusable state/provider logic: `hooks/`, with startup logic in `hooks/app/`, store/provider state in `hooks/state/`, sheet/presentation state in `hooks/ui/`, and public import surfaces in top-level `hooks/*`.
- Domain or integration logic: `services/`.
- Smaller helpers or platform utilities: `utils/`.
- Theme/i18n/subscription constants: `constants/`.
- Supabase schema or edge work: `supabase/`.
- Custom native module work: `modules/` and `native/`.
- Tests: `__tests__/`, named after the feature area.

## Warnings

- Treat `app.config.js`, `plugins/`, `modules/`, `native/`, `ios/`, and `android/` as native-build-sensitive.
- `ios/` and `android/` are git-ignored here, so durable native behavior should be expressed through checked-in config/plugins/source files.
- Persistent iOS widget changes belong in `widgets/ios/LocketWidget.swift`; persistent Android widget changes belong in `widgets/android/NotoWidgetProvider.kt` plus the supporting plugins that re-apply those assets during prebuild.
- Be careful in `services/database.ts`, `services/syncService.ts`, `services/sharedFeedService.ts`, `services/socialPushService.ts`, and `utils/backgroundGeofence.ts`; they are core persistence/reminder/social paths with existing tests.
- Auth, push, and billing env values are project-specific. Do not rotate or replace them casually.
