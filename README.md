# Charmly - Location-Based Memory Tracker

Charmly is a React Native iOS/Android application built with [Expo](https://expo.dev) that allows users to capture, store, and revisit memories (text and photos) linked to specific geographic locations.

## 🌟 Key Features

- **Location-Based Memories:** Capture text notes or photos, automatically tagged with your current location and reverse-geocoded place names.
- **Interactive Map View:** Browse all your saved memories geographically on an interactive map.
- **Home Screen Widgets:** Features a custom iOS/Android widget (similar to Locket) that displays your recent memories directly on your device's home screen.
  - Widget maintainer shortcut: see `docs/widget-maintenance.md`
- **Background Geofencing:** Keeps track of your locations and can notify you when you are near past memories.
- **Firebase Authentication:** Secure user authentication with Google Sign-In support.
- **Offline-First & Fast:** Uses local SQLite database for blazing-fast access to your journal entries.
- **Sleek UI/UX:** Fully responsive design with Dark/Light mode support, smooth bottom-sheet interactions, and haptic feedback.
- **Multilingual:** Internationalization (i18n) support out of the box.

## 🛠️ Tech Stack

- **Framework:** [React Native](https://reactnative.dev) + [Expo](https://expo.dev) + [Expo Router](https://docs.expo.dev/router/introduction/)
- **Navigation:** File-based routing with `@react-navigation`
- **Authentication:** Firebase Auth (`@react-native-firebase/auth`) + Google Sign-In
- **Database / Storage:** `expo-sqlite` & `@react-native-async-storage`
- **Native Device Features:** 
  - `expo-camera` (Photo capture)
  - `expo-location` (GPS & Geofencing)
  - `expo-widgets` (Home screen widgets)
  - `expo-haptics` (Tactile feedback)
  - `expo-notifications` (Push notifications & deep linking)
- **UI & Animations:** `expo-glass-effect`, `react-native-reanimated`, `react-native-gesture-handler`

## 📂 Project Structure

For developers looking to contribute or understand the codebase quickly, here is the high-level directory structure:

```text
├── app/                  # Expo Router navigation (Screens)
│   ├── (tabs)/           # Main tab screens (Home Feed, Map, Settings)
│   ├── auth/             # Login, Sign-up, Onboarding screens
│   ├── note/             # Note details modal screen
│   ├── settings-*.tsx    # Native liquid glass bottom sheet modals
│   └── _layout.tsx       # Root layout, theme providers, & app init
├── components/           # Reusable React components
│   ├── ui/               # Generic UI elements
│   ├── TextMemoryCard.tsx# UI for text-based memories
│   └── ImageMemoryCard.tsx # UI for photo-based memories
├── constants/            # Theming, Colors, Typography, i18n configs
├── hooks/                # Custom React Hooks (useNotes, useGeofence, useTheme)
├── services/             # Core business logic
│   ├── database.ts       # SQLite DB initialization and queries
│   └── widgetService.ts  # Logic for pushing data to native widgets
├── utils/                # Helper functions (e.g., backgroundGeofence.ts)
├── widgets/              # Expo Widgets code (LocketWidget.tsx)
└── package.json          # Project dependencies & scripts
```

## 🚀 Getting Started

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start the development server**
   ```bash
   npx expo start
   ```

3. **Run on a device or emulator:**
   - In the terminal output, you can press `i` to open iOS simulator or `a` to open Android emulator.
   - Alternatively, scan the QR code using the Expo Go app.

---
*Built with ❤️ using Expo.*
