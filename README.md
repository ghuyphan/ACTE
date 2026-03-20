# Noto

Noto is an Expo SDK 55 React Native app for saving text notes and photo memories tied to real places. It is local-first, location-aware, and includes private sharing flows, room-based collaboration, geofence reminders, Firebase sync, and widget support.

## What The App Does

- Save text notes or photo notes with your current location and place name.
- Revisit notes from the home feed or the map.
- Get geofence-based reminders when you return to saved places.
- Sync notes with Firebase when signed in, while still working offline with SQLite.
- Share moments privately with connected friends.
- Create rooms, invite people, and post shared memories together.
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
- Firebase Auth + Firestore for optional account + sync
- RevenueCat for native subscription/entitlement handling
- Expo Camera, Image Picker, Location, Notifications, Haptics, and Widgets
- React Native Reanimated and Expo glass-effect for UI motion and visual treatment

## Important Paths

- `app/`: file-based routes and screen entry points
- `app/(tabs)/`: home, map, rooms, settings, and search tabs
- `app/auth/`: onboarding and auth/account flows
- `app/friends/`: friend invite and join flows
- `app/rooms/`: room creation, join, detail, and settings flows
- `components/home/`: capture, feed, and search UI
- `components/map/`: map canvas, filters, preview cards, and overlays
- `components/screens/`: platform-specific screen implementations
- `hooks/`: app providers and side-effect orchestration
- `hooks/useSubscription.tsx`: RevenueCat entitlement state
- `services/database.ts`: SQLite schema and note persistence
- `services/roomService.ts`: room creation, invites, membership, and room posts
- `services/sharedFeedService.ts`: friend graph and shared moments feed
- `services/syncService.ts`: Firestore sync pipeline
- `services/widgetService.ts`: widget selection and payload generation
- `widgets/ios/LocketWidget.swift`: source of truth for the iOS widget UI
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

Firebase:

- `GoogleService-Info.plist`
- `google-services.json`

RevenueCat for Plus:

- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_PLUS_ENTITLEMENT_ID` optional, defaults to `plus`
- `EXPO_PUBLIC_REVENUECAT_PLUS_OFFERING_ID` optional

## Quality Checks

```bash
npm run lint
npx tsc --noEmit
npm test -- --runInBand
```
