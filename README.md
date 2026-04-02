# Noto

Noto is an Expo SDK 55 / React Native app for saving place-linked text notes and photo memories. It is local-first, works offline with SQLite, and layers in optional Supabase account features, geofence reminders, friend sharing, widgets, and a native subscription flow.

## Highlights

- Save text and photo memories with place names and coordinates.
- Decorate notes with gradients, note colors, doodles, stickers, and mood emoji.
- Browse from the home feed, notes grid, map, shared feed, and native search tab.
- Share memories privately with friends through invite links and shared posts.
- Surface rotating personal or shared memories in the widget pipeline.
- Unlock unlimited photo memories and photo-library import with `Noto Plus`.

## Tech Stack

- Expo SDK 55 + React Native 0.83 + React 19
- Expo Router for file-based navigation
- SQLite for local persistence
- Supabase Auth + Postgres + Storage for optional account, sharing, and sync
- RevenueCat for native billing
- Expo Location, Notifications, Camera, Image Picker, and Widgets

## Quick Start

```bash
npm install
npm run start
```

Useful follow-up commands:

```bash
npm run ios
npm run android
npm run web
npm run lint
npx tsc --noEmit
npm test -- --runInBand
```

## Environment

Copy from [`.env.example`](./.env.example) and fill only what your build needs.

Supabase + Google auth:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`

Maps:

- `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY`

RevenueCat:

- `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID`
- `EXPO_PUBLIC_REVENUECAT_OFFERING_ID`

Legal / support links:

- `EXPO_PUBLIC_PRIVACY_POLICY_URL`
- `EXPO_PUBLIC_SUPPORT_URL`
- `EXPO_PUBLIC_ACCOUNT_DELETION_URL`
- `EXPO_PUBLIC_SUPPORT_EMAIL`

## Repo Guide

- `app/`: Expo Router routes, including tabs, auth, notes, shared, widget deep links, and the Plus screen.
- `components/`: Shared UI, with most feature pieces under `home/`, `map/`, `notes/`, `settings/`, `sheets/`, `screens/`, and `ui/`.
- `hooks/`: Providers and app state, grouped under `app/`, `state/`, `ui/`, `map/`, plus top-level cross-cutting hooks.
- `services/`: SQLite, sync, sharing, widget, media, search, notification, and geofence logic.
- `constants/`: Theme, i18n, note colors, radius defaults, and subscription configuration.
- `widgets/`: Expo widget registration plus the source Swift implementation.
- `docs/`: Short operational docs for releases, Supabase, RevenueCat, and widgets.
- `__tests__/`: Jest coverage for hooks, services, screens, widgets, and map logic.

See [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) for a fuller map.

Compatibility note:

- A few top-level hook and component files still exist as re-export shims while the feature folders settle. Prefer editing the grouped source files rather than adding new logic to compatibility wrappers.

## Native Notes

- `ios/` and `android/` are generated local native folders and are intentionally git-ignored here.
- Persistent widget changes belong in [`widgets/ios/LocketWidget.swift`](./widgets/ios/LocketWidget.swift), not the generated native copy.
- The shared app icon PNG exports live under `assets/images/icon/`, while iOS still uses `Untitled.icon`.

## Docs

- [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)
- [docs/release-checklist.md](./docs/release-checklist.md)
- [docs/android-release.md](./docs/android-release.md)
- [docs/supabase-setup.md](./docs/supabase-setup.md)
- [docs/revenuecat-setup.md](./docs/revenuecat-setup.md)
- [docs/fcm-setup.md](./docs/fcm-setup.md)
- [docs/widget-maintenance.md](./docs/widget-maintenance.md)
