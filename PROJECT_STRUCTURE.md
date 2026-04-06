# Project Structure

## Top-Level Tree

```text
.
├── app/
│   ├── (tabs)/
│   ├── auth/
│   ├── friends/
│   ├── note/
│   ├── notes/
│   ├── shared/
│   └── widget/
├── assets/
│   └── images/
├── components/
│   ├── app/
│   ├── friends/
│   ├── home/
│   ├── map/
│   ├── navigation/
│   ├── notes/
│   ├── screens/
│   ├── settings/
│   ├── shared/
│   ├── sheets/
│   └── ui/
├── constants/
│   └── locales/
├── docs/
├── hooks/
│   ├── app/
│   ├── map/
│   ├── state/
│   └── ui/
├── modules/
├── native/
├── plugins/
├── scripts/
├── services/
├── supabase/
│   ├── functions/
│   └── migrations/
├── utils/
├── widgets/
│   ├── android/
│   └── ios/
├── __tests__/
├── android/
├── ios/
├── app.config.js
├── package.json
├── tsconfig.json
└── README.md
```

## Routes

- `app/_layout.tsx`: Root providers, splash handling, notification/widget hook wiring, and the app shell stack.
- `app/index.tsx`: First-launch redirect into onboarding or the main tabs.
- `app/+not-found.tsx`: Expo Router not-found boundary.
- `app/(tabs)/_layout.tsx`: Platform switch for the native tab shell.
- `app/(tabs)/index.tsx`: Home feed and capture flow.
- `app/(tabs)/map.tsx`: Map screen entry point.
- `app/(tabs)/search/_layout.tsx`: Search tab wrapper.
- `app/(tabs)/search/index.tsx`: Thin route wrapper for the native search tab.
- `app/(tabs)/settings/_layout.tsx`: Settings tab wrapper.
- `app/(tabs)/settings/index.tsx`: Settings screen entry point.
- `app/auth/index.tsx`: Thin route wrapper for auth.
- `app/auth/onboarding.tsx`: First-run onboarding flow.
- `app/auth/profile.tsx`: Profile and account management route wrapper.
- `app/note/[id].tsx`: Note detail route wrapper.
- `app/notes/index.tsx`: Thin route wrapper for the notes grid / recap surface.
- `app/shared/index.tsx`: Thin route wrapper for the shared moments feed.
- `app/shared/[id].tsx`: Shared post detail route wrapper.
- `app/friends/join.tsx`: Thin route wrapper for the friend invite join flow.
- `app/widget/[kind]/[id].tsx`: Widget deep-link routing.
- `app/plus.tsx`: Thin route wrapper for the `Noto Plus` screen.

## Major Directories

- `components/app/`: App-wide composition such as provider wiring.
- `components/friends/`: Friend invite/join feature UI.
- `components/home/`: Capture card, notes feed, shared strip, and feed item helpers.
- `components/map/`: Map canvas, filters, preview cards, motion helpers, and overlay tokens.
- `components/navigation/`: Platform-specific tab layouts.
- `components/notes/`: Note detail, memory-card, doodle, sticker, and recap primitives.
- `components/screens/`: Screen implementations, grouped by feature.
- `components/shared/`: Shared-feed and shared-post feature UI.
- `components/settings/`: Settings-specific sheets and selection helpers.
- `components/sheets/`: Shared sheet scaffolding and bottom-sheet primitives.
- `components/ui/`: Generic building blocks such as buttons, headers, chips, alerts, and glass containers.
- `hooks/`: Public hook entry points plus compatibility re-export shims.
- `hooks/app/`: Startup, notification routing, widget refresh, home sharing, and social push registration.
- `hooks/map/`: Map-only domain and screen-state logic.
- `hooks/state/`: Provider-backed implementation details like notes, feed focus, and monthly recap state.
- `hooks/ui/`: Sheet, sticker, and presentation implementation details.
- `modules/`: Local Expo modules for live photo motion transcoding and subject cutout.
- `native/`: Checked-in native bridge sources used by the local Expo modules.
- `plugins/`: Expo config plugins that patch widgets, Android release behavior, and native build output.
- `services/database.ts`: SQLite schema, migrations, note CRUD, and cache tables.
- `services/syncService.ts`: Supabase sync pipeline.
- `services/sharedFeedService.ts`: Friend invites, shared posts, and shared feed reads/writes.
- `services/socialPushService.ts`: Expo push token registration, unregister, and notification invokes.
- `services/widgetService.ts`: Widget candidate selection, timeline generation, media preparation, and native bridge updates.
- `services/geofenceService.ts`: Reminder permission checks and active region selection.
- `services/monthlyRecap.ts`: Monthly recap aggregation logic for the notes recap view.
- `services/photoStorage.ts`: Local photo persistence and URI resolution.
- `services/livePhotoProcessing.ts`: Live photo pairing and processing helpers.
- `services/remoteMedia.ts`: Supabase Storage upload, signed URL, and download helpers.
- `supabase/migrations/`: SQL history for notes, sharing, push tokens, live photo columns, sticker assets, and policy hardening.
- `supabase/functions/`: Edge functions for delete-account, sticker asset cleanup, and social push delivery.
- `widgets/LocketWidget.tsx`: Expo widget registration and JS fallback view.
- `widgets/ios/LocketWidget.swift`: Source of truth for the iOS widget UI.
- `widgets/android/NotoWidgetProvider.kt`: Source of truth for the Android widget rendering and snapshot binding.

## Important Top-Level Files

- `package.json`: Dev, test, typecheck, and OTA update scripts plus dependency versions.
- `app.config.js`: Expo config, permissions, widget registration, Maps key wiring, build gating, and native IDs.
- `.env.example`: The supported public env var surface plus Android signing placeholders.
- `eslint.config.js`: Expo flat ESLint config.
- `jest.config.js` and `jest.setup.ts`: Jest Expo config and test mocks.
- `tsconfig.json`: Strict TypeScript config with the `@/*` alias.
- `components/app/AppProviders.tsx`: Root provider composition for the app shell.
- `components/navigation/TabLayoutIOS.tsx`: iOS tab shell.
- `components/navigation/TabLayoutAndroid.tsx`: Android tab shell.
- `components/screens/auth/AuthScreen.tsx`: Auth screen implementation.
- `components/screens/notes/NotesScreen.tsx`: Notes screen and recap implementation.
- `components/screens/search/SearchScreen.tsx`: Search screen implementation.
- `components/screens/shared/SharedFeedScreen.tsx`: Shared feed screen implementation.
- `components/screens/friends/FriendJoinScreen.tsx`: Friend join screen implementation.
- `components/screens/plus/PlusScreen.tsx`: Subscription screen implementation.
- `components/screens/profile/ProfileScreen.ios.tsx` and `components/screens/profile/ProfileScreen.android.tsx`: Platform-specific profile screens.
- `components/screens/settings/SettingsScreen.ios.tsx` and `components/screens/settings/SettingsScreen.android.tsx`: Platform-specific settings screens.
- `components/screens/MapScreen.ios.tsx` and `components/screens/MapScreen.android.tsx`: Platform-specific map screens.
- `hooks/state/useNotesStore.tsx`: Primary note mutation pipeline.
- `hooks/useNotes.ts`: Public notes hook/provider entry point.
- `hooks/app/useAppStartupBootstrap.ts`: Startup bootstrap, sync, and notification/widget prep.
- `hooks/app/useAppNotificationRouting.ts`: Notification tap routing.
- `hooks/app/useAppWidgetRefresh.ts`: App foreground and auth-aware widget refresh wiring.
- `hooks/app/useSocialPushRegistration.ts`: Auth-aware social push token registration.
- `components/ui/AppAlertProvider.tsx`: Android native alert bridge.
- `scripts/reset-project.js`: Project reset helper script.
- `assets/images/icon/`: PNG app icon exports used by `app.config.js` for shared, Android, and web icons.
- `Untitled.icon`: iOS icon composer asset still referenced by local native workflows.

## Native Working Model

- `ios/` and `android/` can exist locally for native/widget debugging, but both folders are git-ignored in this repo.
- Changes that must survive `prebuild` should go through `app.config.js`, `plugins/`, the checked-in widget sources under `widgets/`, or the checked-in custom module sources under `modules/` and `native/`.
