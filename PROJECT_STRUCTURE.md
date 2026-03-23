# PROJECT_STRUCTURE.md

## High-Level Tree

```text
.
├── app/
│   ├── (tabs)/
│   ├── auth/
│   ├── friends/
│   └── note/
├── assets/
│   └── images/
├── components/
│   ├── home/
│   ├── map/
│   └── ui/
├── constants/
│   └── locales/
├── docs/
├── hooks/
│   └── map/
├── plugins/
├── services/
├── utils/
├── widgets/
│   └── ios/
├── __tests__/
├── android/
├── ios/
├── package.json
├── app.config.ts
├── tsconfig.json
├── eslint.config.js
├── jest.config.js
├── jest.setup.ts
├── supabase/
└── README.md
```

## Major Directories

- `app/`: Expo Router route tree and screen entry points.
- `app/(tabs)/`: Main app tabs for home, map, settings, and search.
- `app/auth/`: Onboarding plus account/auth flows.
- `app/friends/`: Friend invite acceptance and sharing entry points.
- `app/note/`: Note detail route wrapper for modal-style navigation.
- `assets/images/`: Icons, splash assets, and image resources.
- `components/`: Shared React Native UI components.
- `components/home/`: Home feed, capture, and search header UI.
- `components/map/`: Map canvas, filters, preview cards, and overlay tokens.
- `components/screens/`: Larger screen implementations, including platform-specific screen splits.
- `components/ui/`: Generic shared building blocks such as buttons and headers.
- `constants/`: Theme tokens, auth constants, note defaults, and i18n setup.
- `constants/subscription.ts`: Plus/free plan rules, RevenueCat env config, and photo-note limits.
- `constants/locales/`: Translation JSON files for English and Vietnamese.
- `docs/`: Short maintenance docs for widgets and release flows.
- `hooks/`: App-wide hooks/providers for notes, auth, theme, sync, geofence, and more.
- `hooks/useSharedFeed.tsx`: Friend graph and shared moments state for the home feed.
- `hooks/useSubscription.tsx`: RevenueCat subscription provider and entitlement state.
- `hooks/map/`: Map domain modeling and map screen state.
- `plugins/`: Custom Expo config plugins used during native generation/build setup.
- `services/`: Database, sync, geofence, photo, search, sharing, and widget business logic.
- `services/sharedFeedService.ts`: Friends, invites, and private shared-feed operations.
- `services/syncService.ts`: Supabase sync queue flush + snapshot upload/merge.
- `utils/`: Background task registration and smaller cross-cutting helpers.
- `utils/supabase.ts`: Supabase client bootstrap plus secure auth-session persistence.
- `widgets/`: Expo widget registration and JS-side widget definition.
- `widgets/ios/`: Source Swift widget implementation copied into the native target by a plugin.
- `__tests__/`: Jest tests for screens, hooks, services, map logic, and widgets.
- `android/`: Native Android project.
- `ios/`: Native iOS project and widget target.
- `supabase/`: SQL migrations and local project config for the hosted Supabase backend.

## Key Top-Level Files

- `package.json`: Dependencies plus dev/run/lint/test scripts; app entry is `expo-router/entry`.
- `app.config.ts`: Expo app config, plugins, permissions, widget registration, native identifiers, and env-backed Android Maps setup.
- `README.md`: Product overview, setup, and current Plus configuration notes.
- `supabase/config.toml`: Local Supabase project metadata for migrations and generated types.
- `docs/release-checklist.md`: Current manual release gate, including Plus validation.
- `tsconfig.json`: Strict TypeScript config with the `@/*` alias.
- `eslint.config.js`: Flat ESLint config based on `eslint-config-expo`.
- `jest.config.js`: Jest Expo preset and module mapping.
- `jest.setup.ts`: Test setup and React Native dependency mocks.
- `expo-env.d.ts`: Expo-generated type declarations used by the project.
