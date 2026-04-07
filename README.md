# Noto

Noto is an Expo SDK 55 / React Native app for saving place-linked text notes and photo memories. It is local-first, works offline with SQLite, and layers in optional Supabase account features, friend sharing, social push notifications, geofence reminders, widgets, live photo support, and a native `Noto Plus` subscription flow.

## Highlights

- Save text and photo memories with place names and coordinates.
- Decorate notes with gradients, note colors, doodles, stickers, stamps, and mood emoji.
- Browse from the home feed, notes grid, map, shared feed, monthly recap, and native search tab.
- Share memories privately with friends through invites and shared posts.
- Surface rotating personal or shared memories in the iOS timeline widget and Android snapshot widget.
- Unlock unlimited photo memories and photo-library import with `Noto Plus`.

## Tech Stack

- Expo SDK 55 + React Native 0.83 + React 19
- Expo Router for file-based navigation
- SQLite for local persistence
- Supabase Auth + Postgres + Storage + Edge Functions for optional account, sharing, push, and sync
- RevenueCat for native billing
- Expo Location, Notifications, Widgets, Camera, Image Picker, and custom native modules for live photo / subject cutout work

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
npm run typecheck
npm test -- --runInBand
npm run update:preview
npm run update:production
```

## Environment

Copy from [`.env.example`](./.env.example) and fill only what your build needs.

App/runtime env:

- `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY`
- `EXPO_PUBLIC_EAS_PROJECT_ID`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
- `EXPO_PUBLIC_ENABLE_PLACE_REMINDERS`
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID`
- `EXPO_PUBLIC_REVENUECAT_OFFERING_ID`
- `EXPO_PUBLIC_PRIVACY_POLICY_URL`
- `EXPO_PUBLIC_SUPPORT_URL`
- `EXPO_PUBLIC_ACCOUNT_DELETION_URL`
- `EXPO_PUBLIC_SUPPORT_EMAIL`

RevenueCat production template:

```env
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=
EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=Noto Pro
EXPO_PUBLIC_REVENUECAT_OFFERING_ID=default
```

- Set both public SDK keys for the native platforms you ship or test.
- iOS keys start with `appl_`; Android keys start with `goog_`.
- Mirror those RevenueCat vars into each EAS environment you use for billing QA, not only `production`.
- Keep the entitlement value aligned with the exact RevenueCat entitlement identifier. If the dashboard identifier differs from `Noto Pro`, set that exact value here instead.

Android release signing env:

- `ACTE_UPLOAD_STORE_FILE`
- `ACTE_UPLOAD_STORE_PASSWORD`
- `ACTE_UPLOAD_KEY_ALIAS`
- `ACTE_UPLOAD_KEY_PASSWORD`

Native push credential file paths can also be injected for EAS builds through `GOOGLE_SERVICES_JSON` and `GOOGLE_SERVICE_INFO_PLIST`.

Production note:

- [`app.config.js`](./app.config.js) fails production builds when required metadata is missing. Production builds need `EXPO_PUBLIC_EAS_PROJECT_ID`, the Android Maps key, a privacy policy URL, and either support/account-deletion URLs or a support email.

## Repo Guide

- `app/`: Expo Router routes, including tabs, auth, note detail, shared routes, widget deep links, and the Plus screen.
- `components/`: Shared UI, with most feature pieces under `app/`, `friends/`, `home/`, `map/`, `navigation/`, `notes/`, `screens/`, `settings/`, `shared/`, `sheets/`, and `ui/`.
- `hooks/`: Providers and app state, grouped under `app/`, `state/`, `ui/`, `map/`, plus top-level public hook surfaces and compatibility re-export shims.
- `services/`: SQLite, sync, sharing, widget, notification, search, recap, live photo, sticker, and media logic.
- `constants/`: Theme, i18n, note colors, note radius, experiments, and subscription configuration.
- `plugins/`: Expo config plugins for widget customization, Android release hardening, and native fixes.
- `supabase/`: SQL migrations plus edge functions for delete-account, sticker asset cleanup, and social push delivery.
- `modules/`: Local Expo modules for live photo motion handling and subject cutout.
- `native/`: Checked-in native bridge sources that back custom module behavior.
- `widgets/`: Expo widget registration plus the checked-in iOS and Android widget sources.
- `docs/`: Operational docs for release, Android release, Supabase, RevenueCat, FCM/push, and widget maintenance.
- `__tests__/`: Jest coverage for hooks, services, screens, widgets, and map logic.

See [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) for a fuller map.

Compatibility note:

- A few top-level hook and component files still exist as re-export shims while the grouped source folders settle. Prefer editing the grouped source files rather than adding new logic to compatibility wrappers.

## Native Notes

- `ios/` and `android/` may exist locally for native/widget debugging, but both folders are git-ignored in this repo.
- Persistent widget changes belong in [`widgets/ios/LocketWidget.swift`](./widgets/ios/LocketWidget.swift) and [`widgets/android/NotoWidgetProvider.kt`](./widgets/android/NotoWidgetProvider.kt), plus the supporting plugins under [`plugins/`](./plugins/).
- The shared app icon PNG exports live under `assets/images/icon/`, while iOS still uses `Untitled.icon`.
- Durable native behavior should be expressed through [`app.config.js`](./app.config.js), [`plugins/`](./plugins/), [`modules/`](./modules/), [`native/`](./native/), and [`widgets/`](./widgets/), not by editing generated native output only.

## Docs

- [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)
- [docs/release-checklist.md](./docs/release-checklist.md)
- [docs/android-release.md](./docs/android-release.md)
- [docs/supabase-setup.md](./docs/supabase-setup.md)
- [docs/revenuecat-setup.md](./docs/revenuecat-setup.md)
- [docs/fcm-setup.md](./docs/fcm-setup.md)
- [docs/widget-maintenance.md](./docs/widget-maintenance.md)
