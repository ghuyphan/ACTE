
import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { SplashScreen, Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import i18n from '../constants/i18n';
import { ThemeProvider, useTheme } from '../hooks/useTheme';
import { getDB } from '../services/database';
import { updateWidgetData } from '../services/widgetService';
import '../utils/backgroundGeofence';
import '../widgets/LocketWidget';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { colors, isDark, themeReady } = useTheme();
  const [dbReady, setDbReady] = useState(false);
  const router = useRouter();
  const notificationResponseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    getDB()
      .then(() => {
        setDbReady(true);
        // Push latest note data to the widget on app launch
        updateWidgetData();
      })
      .catch((err) => {
        console.error('Database init failed:', err);
        setDbReady(true); // continue anyway so app isn't stuck
      });
  }, []);

  // Handle splash screen
  useEffect(() => {
    if (themeReady && dbReady) {
      SplashScreen.hideAsync();
    }
  }, [themeReady, dbReady]);

  // Handle notification tap deep-link
  useEffect(() => {
    notificationResponseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const noteId = response.notification.request.content.data?.noteId;
        if (noteId && typeof noteId === 'string') {
          router.push(`/note/${noteId}` as any);
        }
      });

    return () => {
      notificationResponseListener.current?.remove();
    };
  }, [router]);

  if (!dbReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const navTheme = isDark ? DarkTheme : DefaultTheme;
  // Override background colors to match our exact theme
  navTheme.colors.background = colors.background;
  navTheme.colors.card = colors.card;
  navTheme.colors.text = colors.text;
  navTheme.colors.border = colors.border;
  navTheme.colors.primary = colors.primary;

  return (
    <NavThemeProvider value={navTheme}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen
            name="auth/index"
            options={{
              headerShown: true,
              headerTransparent: true,
              headerTitle: '',
              headerTintColor: colors.text,
              headerBackButtonDisplayMode: 'minimal',
              headerBackButtonMenuEnabled: false,
            }}
          />
          <Stack.Screen name="auth/onboarding" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="note/[id]"
            options={{
              presentation: 'transparentModal',
              animation: 'none',
            }}
          />

        </Stack>
      </View>
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </I18nextProvider>
    </GestureHandlerRootView>
  );
}
