# Noto

Noto is an Expo SDK 55 React Native app for saving text notes and photo memories tied to real places. It is local-first, location-aware, and includes private sharing with friends, geofence reminders, Supabase sync, and widget support.

## What The App Does

- Save text notes or photo notes with your current location and place name.
- Revisit notes from the home feed or the map.
- Get geofence-based reminders when you return to saved places.
- Sync notes with Supabase when signed in, while still working offline with SQLite.
- Share moments privately with connected friends.
- Show recent or nearby notes in the Home Screen widget flow.
- Offer a `Noto Plus` plan that unlocks more photo notes and importing from the Photos library.

## Current Product Notes

- Free plan:
  - unlimited text notes
  - limited photo notes
  - camera capture for photo notes
- Plus plan:
  - expanded photo-note capacity
  - import from Photos library
  - purchase and restore flow via RevenueCat on supported native builds
- If RevenueCat is not configured, the app safely stays in free mode and shows Plus as unavailable.

## Tech Stack

- Expo + React Native + Expo Router
- SQLite for local persistence
- Supabase Auth + Postgres + Storage for optional account + sync
- RevenueCat for native subscription/entitlement handling
- Expo Camera, Image Picker, Location, Notifications, Haptics, and Widgets
- React Native Reanimated and Expo glass-effect for UI motion and visual treatment

## Important Paths

- `app/`: file-based routes and screen entry points
- `app/(tabs)/`: home, map, settings, and search tabs
- `app/auth/`: onboarding and auth/account flows
- `app/friends/`: friend invite and join flows
- `components/home/`: capture, feed, and search UI
- `components/map/`: map canvas, filters, preview cards, and overlays
- `components/screens/`: platform-specific screen implementations
- `hooks/`: app providers and side-effect orchestration
- `hooks/useSubscription.tsx`: RevenueCat entitlement state
- `services/database.ts`: SQLite schema and note persistence
- `services/sharedFeedService.ts`: friend graph and shared moments feed
- `services/syncService.ts`: Supabase sync pipeline
- `services/widgetService.ts`: widget selection and payload generation
- `widgets/ios/LocketWidget.swift`: source of truth for the iOS widget UI
- `app.config.ts`: Expo app config and env-backed native settings
- `docs/release-checklist.md`: manual ship checklist
- `docs/widget-maintenance.md`: widget maintenance shortcut

See [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) for a fuller repo map.

## Getting Started

1. Install dependencies

```bash
npm install
```

2. Start Expo

```bash
npx expo start
```

3. Run iOS locally

```bash
npx expo run:ios
```

## Optional Configuration

Supabase + Google sign-in:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`

RevenueCat for Plus:

- `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_PLUS_ENTITLEMENT_ID` optional, defaults to `plus`
- `EXPO_PUBLIC_REVENUECAT_PLUS_OFFERING_ID` optional

Store listing / legal links:

- `EXPO_PUBLIC_PRIVACY_POLICY_URL`
- `EXPO_PUBLIC_SUPPORT_URL`
- `EXPO_PUBLIC_ACCOUNT_DELETION_URL`
- `EXPO_PUBLIC_SUPPORT_EMAIL`

See [docs/supabase-setup.md](./docs/supabase-setup.md) for the SQL migration, bucket policies, and dashboard setup checklist.

## Quality Checks

```bash
npm run lint
npx tsc --noEmit
npm test -- --runInBand
```
