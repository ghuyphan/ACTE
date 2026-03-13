# PROJECT_STRUCTURE.md

## High-Level Tree

```text
.
├── app/
│   ├── (tabs)/
│   ├── auth/
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
├── app.json
├── tsconfig.json
├── eslint.config.js
├── jest.config.js
├── jest.setup.ts
├── GoogleService-Info.plist
├── google-services.json
├── README.md
└── SKILL.md
```

## Major Directories

- `app/`: Expo Router route tree and screen entry points.
- `app/(tabs)/`: Main app tabs for home, map, settings, and search.
- `app/auth/`: Onboarding plus account/auth flows.
- `app/note/`: Note detail route wrapper for modal-style navigation.
- `assets/images/`: Icons, splash assets, and image resources.
- `components/`: Shared React Native UI components.
- `components/home/`: Home feed, capture, and search header UI.
- `components/map/`: Map canvas, filters, preview cards, and overlay tokens.
- `components/ui/`: Generic shared building blocks such as buttons and headers.
- `constants/`: Theme tokens, auth constants, note defaults, and i18n setup.
- `constants/locales/`: Translation JSON files for English and Vietnamese.
- `docs/`: Short maintenance docs for widgets and releases.
- `hooks/`: App-wide hooks/providers for notes, auth, theme, sync, geofence, and more.
- `hooks/map/`: Map domain modeling and map screen state.
- `plugins/`: Custom Expo config plugins used during native generation/build setup.
- `services/`: Database, sync, geofence, photo, search, and widget business logic.
- `utils/`: Background task registration and smaller cross-cutting helpers.
- `widgets/`: Expo widget registration and JS-side widget definition.
- `widgets/ios/`: Source Swift widget implementation copied into the native target by a plugin.
- `__tests__/`: Jest tests for screens, hooks, services, map logic, and widgets.
- `android/`: Native Android project.
- `ios/`: Native iOS project and widget target.

## Key Top-Level Files

- `package.json`: Dependencies plus dev/run/lint/test scripts; app entry is `expo-router/entry`.
- `app.json`: Expo app config, plugins, permissions, widget registration, and native identifiers.
- `tsconfig.json`: Strict TypeScript config with the `@/*` alias.
- `eslint.config.js`: Flat ESLint config based on `eslint-config-expo`.
- `jest.config.js`: Jest Expo preset and module mapping.
- `jest.setup.ts`: Test setup and React Native dependency mocks.
- `GoogleService-Info.plist`: iOS Firebase config file.
- `google-services.json`: Android Firebase config file.
- `README.md`: Human-oriented product and setup overview.
- `SKILL.md`: Existing repo-specific AI/developer guidance.
- `expo-env.d.ts`: Expo-generated type declarations used by the project.
