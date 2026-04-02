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
│   ├── home/
│   ├── map/
│   ├── notes/
│   ├── screens/
│   ├── settings/
│   ├── sheets/
│   └── ui/
├── constants/
│   └── locales/
├── docs/
├── hooks/
│   ├── app/
│   ├── state/
│   ├── map/
│   └── ui/
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

- `app/_layout.tsx`: Root providers, splash handling, and app-startup hook wiring.
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
- `components/notes/`: Note detail, memory-card, doodle, sticker, and note-surface primitives.
- `components/screens/`: Larger screen implementations, grouped by feature where needed.
- `components/settings/`: Settings-specific sheets and shared selection helpers.
- `components/sheets/`: Shared sheet scaffolding and bottom-sheet primitives.
- `components/ui/`: Generic building blocks such as buttons, headers, chips, and glass containers.
- `hooks/`: Cross-cutting hooks and compatibility re-export shims.
- `hooks/app/`: App-startup, notification routing, widget refresh, and social push registration.
- `hooks/map/`: Map-only domain and screen-state logic.
- `hooks/state/`: Provider-backed state like notes, active note selection, and feed focus.
- `hooks/ui/`: Sheet and presentation helpers.
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
- `hooks/state/useNotesStore.tsx`: Primary note mutation pipeline.
- `hooks/app/useAppStartupBootstrap.ts`: Startup bootstrap, sync, and notification/widget prep.
- `hooks/app/useAppNotificationRouting.ts`: Notification tap routing.
- `components/ui/AppAlertProvider.tsx`: Android native alert bridge.
- `assets/images/icon/`: PNG app icon exports used by `app.config.ts` for shared, Android, and web icons.
- `Untitled.icon`: iOS icon composer asset used by `app.config.ts`.

## Native Working Model

- `ios/` and `android/` exist locally for native/widget work but are git-ignored in this repo.
- Changes that must survive `prebuild` should go through `app.config.ts`, `plugins/`, or the checked-in sources under `widgets/`.
