# AGENTS.md

## Project Overview

Noto is an Expo SDK 55 / React Native app that stores location-linked text notes and photo memories. It uses Expo Router for navigation, SQLite for local persistence, optional Firebase Auth + Firestore sync, geofencing reminders, and an Expo widget with custom iOS Swift rendering.

## Repo Map

- `app/`: Expo Router routes and screen entry points.
- `app/(tabs)/`: Main tab screens: home feed/capture, map, settings, and native search.
- `app/auth/`: Onboarding, sign-in/register/reset, and profile/account screens.
- `app/note/`: Note detail modal route wrapper.
- `components/`: Reusable UI; `home/`, `map/`, and `ui/` hold most shared screen pieces.
- `hooks/`: App state and side-effect orchestration. There is no separate `store/`; shared state lives in providers like `useNotesStore`, `useAuth`, `useTheme`, and `useSyncStatus`.
- `hooks/map/`: Map-only domain/state logic.
- `services/`: Non-React app logic: SQLite CRUD, geofencing, Firebase sync, photo handling, widget updates.
- `constants/`: Theme tokens, i18n setup, auth constants, note radius defaults.
- `utils/`: Smaller helpers plus background geofence task registration and platform utilities.
- `widgets/`: Widget registration plus the real Swift source for the iOS widget.
- `plugins/`: Custom Expo config plugins for Firebase and widget/native build fixes.
- `assets/images/`: App icons and image assets.
- `docs/`: Focused maintenance docs, especially widget and release checklists.
- `__tests__/`: Jest coverage for hooks, services, screens, map logic, sync, and widgets.
- `ios/`, `android/`: Native projects are present and matter for widget/Firebase/plugin work.

## Important Entry Points

- `package.json`: `expo-router/entry` app entry and available scripts.
- `app/_layout.tsx`: Root providers, DB bootstrap, splash handling, notification deep-link handling, widget/geofence startup sync.
- `app/index.tsx`: First-launch gate that redirects to onboarding or tabs.
- `app/(tabs)/_layout.tsx`: Native tab layout and search-tab behavior.
- `app.json`: Expo config, native package IDs, Firebase service files, widgets, permissions, and custom plugins.
- `tsconfig.json`: Strict TS config and `@/*` path alias.
- `eslint.config.js`: Expo flat ESLint config with one parser workaround.
- `jest.config.js` / `jest.setup.ts`: Jest Expo setup and React Native mocks.
- `utils/firebase.ts`: Safe accessors for Firebase app/auth/firestore.
- `services/database.ts`: SQLite schema, migrations, note model, and sync queue.
- `services/syncService.ts`: Firestore sync pipeline.
- `services/geofenceService.ts`: Reminder permission checks and monitored region selection.
- `services/widgetService.ts`: Widget data pipeline and note selection rules.
- `GoogleService-Info.plist` / `google-services.json`: Native Firebase config.

## Commands

- `npm run start`: Start Expo dev server.
- `npm run ios`: Run the native iOS app.
- `npm run android`: Run the native Android app.
- `npm run web`: Start the web target.
- `npm run lint`: Run Expo/ESLint checks.
- `npm test`: Run Jest tests.
- `npx tsc --noEmit`: Typecheck the repo. This is used in `docs/release-checklist.md` but is not an npm script.
- `npm run reset-project`: Run the included reset helper script.

## Conventions

- Routing is file-based under `app/`. Add screens there, not in a separate navigation folder.
- Keep route files focused on composition and UI wiring; move reusable stateful logic into hooks and pure data/platform work into services.
- Use `useTheme()` and `constants/theme.ts` for colors/tokens. Avoid hardcoded colors in screens/components.
- Use `react-i18next` and update `constants/locales/en.json` and `constants/locales/vi.json` for new user-facing strings.
- Notes state should flow through `useNotesStore`; do not bypass it from screens for normal CRUD.
- Auth state should flow through `useAuth`; sync state through `useSyncStatus`.
- Widget refreshes are already wired into note mutations through `useNotesStore`; preserve that behavior when adding new mutation paths.
- Map-specific clustering/filtering logic belongs in `hooks/map/` and `components/map/`.

## Where To Add New Code

- New screen or route: `app/` under the appropriate route group.
- Reusable screen UI: `components/`, usually under `components/ui/`, `components/home/`, or `components/map/`.
- Reusable hook/provider: `hooks/`.
- Domain/data/native integration logic: `services/`.
- Small helper or platform utility: `utils/`.
- Theme/i18n/auth constants: `constants/`.
- Tests: `__tests__/` next to the feature area they cover in name.

## Warnings

- Treat `app.json`, `plugins/`, `ios/`, and `android/` as native-build-sensitive. Change them only when the task is explicitly about native config, widgets, or Firebase setup.
- `GoogleService-Info.plist`, `google-services.json`, and `constants/auth.ts` contain project-specific auth/config values. Do not rotate or replace them casually.
- Persistent widget changes belong in `widgets/ios/LocketWidget.swift`. The copy under `ios/ExpoWidgetsTarget/` is generated by the custom plugin flow.
- Be careful in `services/database.ts`, `services/syncService.ts`, and `utils/backgroundGeofence.ts`; they are core persistence/reminder paths with existing tests.
