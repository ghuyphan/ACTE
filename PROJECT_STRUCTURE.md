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
├── constants/
│   └── locales/
├── docs/
├── hooks/
│   └── map/
├── plugins/
├── services/
├── supabase/
│   ├── functions/
│   └── migrations/
├── utils/
├── widgets/
│   └── ios/
├── __tests__/
├── android/
├── ios/
├── app.config.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Routes

- `app/_layout.tsx`: Root providers, DB bootstrap, splash handling, notifications, widget refresh, and geofence startup sync.
- `app/index.tsx`: First-launch redirect into onboarding or the main tabs.
- `app/(tabs)/index.tsx`: Home feed and capture flow.
- `app/(tabs)/map.tsx`: Map screen entry point.
- `app/(tabs)/search/index.tsx`: Native search tab entry point.
- `app/(tabs)/settings/index.tsx`: Settings screen entry point.
- `app/auth/index.tsx`: Landing, sign-in, register, and password-reset flow.
- `app/auth/onboarding.tsx`: First-run onboarding flow.
- `app/auth/profile.tsx`: Account/profile management.
- `app/note/[id].tsx`: Note detail route wrapper.
- `app/notes/index.tsx`: Combined notes and shared-posts grid.
- `app/shared/index.tsx`: Shared moments feed.
- `app/shared/[id].tsx`: Shared post detail screen.
- `app/friends/join.tsx`: Friend invite join surface.
- `app/widget/[kind]/[id].tsx`: Widget deep-link routing.
- `app/plus.tsx`: `Noto Plus` upsell and purchase UI.

## Major Directories

- `components/home/`: Capture card, notes feed, shared strip, and feed item helpers.
- `components/map/`: Map canvas, filters, cards, motion helpers, and overlay tokens.
- `components/screens/`: Larger screen implementations with iOS and Android splits.
- `components/ui/`: Generic building blocks such as buttons, headers, chips, and glass containers.
- `hooks/`: Providers and reusable stateful logic for notes, auth, theme, connectivity, shared feed, subscriptions, and sync.
- `hooks/map/`: Map-only domain and screen-state logic.
- `services/database.ts`: SQLite schema, migrations, note CRUD, and cache tables.
- `services/syncService.ts`: Supabase sync pipeline.
- `services/sharedFeedService.ts`: Friend invites, shared posts, and social feed reads/writes.
- `services/widgetService.ts`: Widget candidate selection, media preparation, and timeline updates.
- `services/geofenceService.ts`: Reminder permission checks and active region selection.
- `services/photoStorage.ts`: Local photo persistence and URI resolution.
- `services/remoteMedia.ts`: Supabase Storage upload, signed URL, and download helpers.
- `supabase/migrations/`: SQL history for notes, sharing, rooms, stickers, colors, and policy hardening.
- `supabase/functions/delete-account/`: Edge function for server-side account deletion.
- `widgets/LocketWidget.tsx`: Expo widget registration and JS fallback view.
- `widgets/ios/LocketWidget.swift`: Source of truth for the real iOS widget UI.

## Important Top-Level Files

- `package.json`: Dev/run/lint/test scripts and dependency versions.
- `app.config.ts`: Expo config, permissions, widget registration, Maps key wiring, and native IDs.
- `.env.example`: The supported public env var surface.
- `eslint.config.js`: Expo flat ESLint config.
- `jest.config.js` and `jest.setup.ts`: Jest Expo config and test mocks.
- `tsconfig.json`: Strict TypeScript config with the `@/*` alias.
- `assets/images/icon/`: PNG app icon exports used by `app.config.ts` for shared, Android, and web icons.
- `Untitled.icon`: iOS icon composer asset used by `app.config.ts`.

## Native Working Model

- `ios/` and `android/` exist locally for native/widget work but are git-ignored in this repo.
- Changes that must survive `prebuild` should go through `app.config.ts`, `plugins/`, or the checked-in sources under `widgets/`.
