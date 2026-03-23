import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import * as SystemUI from 'expo-system-ui';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation, I18nextProvider } from 'react-i18next';
import { ActivityIndicator, AppState, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import i18n, { i18nReady } from '../constants/i18n';
import { AuthProvider, useAuth } from '../hooks/useAuth';
import { ConnectivityProvider, useConnectivity } from '../hooks/useConnectivity';
import { FeedFocusProvider } from '../hooks/useFeedFocus';
import { NotesProvider } from '../hooks/useNotes';
import { NoteDetailSheetProvider, useNoteDetailSheet } from '../hooks/useNoteDetailSheet';
import { SharedFeedProvider } from '../hooks/useSharedFeed';
import { SyncStatusProvider } from '../hooks/useSyncStatus';
import { SubscriptionProvider } from '../hooks/useSubscription';
import { ThemeProvider, useTheme } from '../hooks/useTheme';
import { getDB } from '../services/database';
import { syncGeofenceRegions } from '../services/geofenceService';
import { configureNotificationChannels } from '../services/notificationService';
import { updateWidgetData } from '../services/widgetService';
import '../utils/backgroundGeofence';

export { ErrorBoundary } from 'expo-router';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { colors, isDark, themeReady } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isOnline } = useConnectivity();
  const { openNoteDetail } = useNoteDetailSheet();
  const [dbReady, setDbReady] = useState(false);
  const [localeReady, setLocaleReady] = useState(i18n.isInitialized);
  const notificationResponseListener = useRef<Notifications.EventSubscription | null>(null);
  const lastHandledNotificationIdRef = useRef<string | null>(null);

  useEffect(() => {
    let startupTimeout: ReturnType<typeof setTimeout> | null = null;

    void configureNotificationChannels();

    getDB()
      .then(() => {
        setDbReady(true);
        startupTimeout = setTimeout(() => {
          void updateWidgetData();
          void syncGeofenceRegions();
        }, 250);
      })
      .catch((err) => {
        console.error('Database init failed:', err);
        setDbReady(true); // continue anyway so app isn't stuck
      });

    return () => {
      if (startupTimeout) {
        clearTimeout(startupTimeout);
      }
    };
  }, []);

  useEffect(() => {
    if (!dbReady || !localeReady) {
      return;
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        return;
      }

      void updateWidgetData({
        includeLocationLookup: true,
        includeSharedRefresh: Boolean(user && isOnline),
      });
    });

    return () => {
      subscription.remove();
    };
  }, [dbReady, isOnline, localeReady, user]);

  useEffect(() => {
    if (!dbReady || !localeReady || !user) {
      return;
    }

    void updateWidgetData({
      includeLocationLookup: true,
      includeSharedRefresh: isOnline,
    });
  }, [dbReady, isOnline, localeReady, user]);

  useEffect(() => {
    let cancelled = false;

    void i18nReady
      .catch((error) => {
        console.error('i18n init failed:', error);
      })
      .finally(() => {
        if (!cancelled) {
          setLocaleReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Handle splash screen
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);

  useEffect(() => {
    if (themeReady && dbReady && localeReady) {
      SplashScreen.hideAsync();
    }
  }, [themeReady, dbReady, localeReady]);

  const handleNotificationResponse = useCallback(
    async (response: Notifications.NotificationResponse | null) => {
      if (!response) {
        return;
      }

      const notificationId = response.notification.request.identifier;
      if (lastHandledNotificationIdRef.current === notificationId) {
        return;
      }
      lastHandledNotificationIdRef.current = notificationId;

      const noteId = response.notification.request.content.data?.noteId;
      if (noteId && typeof noteId === 'string') {
        openNoteDetail(noteId);
      }

      try {
        await Notifications.clearLastNotificationResponseAsync();
      } catch {
        return;
      }
    },
    [openNoteDetail]
  );

  // Handle notification tap deep-link
  useEffect(() => {
    let cancelled = false;

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!cancelled) {
        void handleNotificationResponse(response);
      }
    });

    notificationResponseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        void handleNotificationResponse(response);
      });

    return () => {
      cancelled = true;
      notificationResponseListener.current?.remove();
    };
  }, [handleNotificationResponse]);

  if (!dbReady || !localeReady) {
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
              headerBackTitle: t('settings.title', 'Settings'),
              headerTintColor: colors.text,
              headerBackButtonDisplayMode: 'minimal',
              headerBackButtonMenuEnabled: false,
            }}
          />
          <Stack.Screen
            name="auth/profile"
            options={{
              headerShown: true,
              headerTransparent: true,
              headerTitle: '',
              headerBackTitle: t('settings.title', 'Settings'),
              headerTintColor: colors.text,
              headerBackButtonDisplayMode: 'minimal',
              headerBackButtonMenuEnabled: false,
            }}
          />
          <Stack.Screen
            name="plus"
            options={{
              headerShown: true,
              headerTransparent: true,
              headerTitle: '',
              headerBackTitle: t('settings.title', 'Settings'),
              headerTintColor: colors.text,
              headerBackButtonDisplayMode: 'minimal',
              headerBackButtonMenuEnabled: false,
            }}
          />
          <Stack.Screen name="auth/onboarding" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="friends/join"
            options={{
              headerShown: false,
              presentation: 'transparentModal',
              animation: 'fade',
            }}
          />
          <Stack.Screen
            name="note/[id]"
            options={{
              presentation: 'transparentModal',
              animation: 'none',
            }}
          />
          <Stack.Screen name="notes/index" />
          <Stack.Screen name="shared/index" />
          <Stack.Screen
            name="shared/[id]"
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
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <I18nextProvider i18n={i18n}>
          <ThemeProvider>
            <ConnectivityProvider>
              <AuthProvider>
                <SubscriptionProvider>
                  <FeedFocusProvider>
                    <NotesProvider>
                      <SyncStatusProvider>
                        <SharedFeedProvider>
                          <NoteDetailSheetProvider>
                            <BottomSheetModalProvider>
                              <AppContent />
                            </BottomSheetModalProvider>
                          </NoteDetailSheetProvider>
                        </SharedFeedProvider>
                      </SyncStatusProvider>
                    </NotesProvider>
                  </FeedFocusProvider>
                </SubscriptionProvider>
              </AuthProvider>
            </ConnectivityProvider>
          </ThemeProvider>
        </I18nextProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
