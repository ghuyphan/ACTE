# Project Context & AI Agent Skills
This file (`SKILL.md`) serves as a comprehensive guide and context rule sheet for any subsequent AI agents (or human developers) working on **ACTE**. Follow these exact best practices when iterating or adding features to this repository.

## 1. 🏗️ Tech Stack
- **Framework:** React Native + Expo (SDK 55) + Expo Router
- **Routing:** File-based routing via `app/` directory (`expo-router`)
- **Language:** TypeScript (`.ts`, `.tsx`)
- **UI Components:** Manual styles via `StyleSheet` + custom theming (no Tailwind by default)
- **Local DB:** `expo-sqlite`
- **Global Auth:** `@react-native-firebase/auth` & Google Sign-In

## 2. 🎨 Theming & Styling
- **Do NOT hardcode colors.** Always rely on the custom `useTheme()` hook located in `hooks/useTheme.tsx`.
- Specifically, deconstruct `const { colors, isDark } = useTheme();` and use properties like `colors.background`, `colors.text`, `colors.primary`, `colors.border`, etc., to assign to `StyleSheet` styles or inline `backgroundColor` props.
- **Glass Effects:** Use the `GlassView` component (or `expo-glass-effect`) for overlays instead of manual opacity hacks. Ensure you flip the scheme with `isDark ? 'dark' : 'light'` when needed.
- **Insets:** Always rely on `useSafeAreaInsets` for margins/paddings on screens that render full bleed (Native Stack handles headers automatically now, but if drawing floating components over a map, respect top/bottom insets).

## 3. 🌍 Internationalization (i18n)
- **Do NOT hardcode English UI text.**
- Always use `react-i18next`: 
  ```tsx
  const { t } = useTranslation();
  <Text>{t('screen_prefix.key_name', 'Default English Fallback')}</Text>
  ```
- Make sure to update language JSON files if adding new substantial strings.

## 4. 🗄️ State Management & Data Flow
- **Direct Database Access:** We use a raw SQLite approach (`services/database.ts`). Data operations should be abstracted via hooks (e.g., `useNotes()` in `hooks/useNotes.ts` or standalone services like `getDB()`).
- **Context/Hooks over Redux:** Rely heavily on custom react hooks to encapsulate complex local logic (`useGeofence.ts`, `useNotes.ts`, `useTheme.ts`).
- **Widgets Sync:** Whenever a note is Added, Updated, or Deleted, make sure to call `updateWidgetData()` from `services/widgetService.ts` so the iOS/Android HomeScreen Widgets stay in sync with the database.

## 5. 📍 Native Features & Permissions
- **Haptics:** Liberally use `expo-haptics` (`Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)`) when user presses buttons or changes states.
- **Location:** If a feature requires GPS coordinates, handle `Location.requestForegroundPermissionsAsync` gracefully. Fallback to default locations or gracefully degrade the UI if permission is denied.

## 6. 📂 File Structure Conventions
- `app/` → Screens. Keep UI clean here, move complex logic to hooks.
- `app/(tabs)/` → Main index screens (Home Feed, Map, Settings).
- `components/` → Resusable, pure presentation components (e.g., `TextMemoryCard.tsx`).
- `hooks/` → Reusable custom hooks holding React state and side effects.
- `services/` → Logic that doesn't rely strictly on React lifecycles (DB operations, Widgets data parsing).

*Follow these principles to ensure consistency, fast iterations, and a cohesive user experience across ACTE.*
