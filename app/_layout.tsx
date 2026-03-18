
import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import * as SystemUI from 'expo-system-ui';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import i18n from '../constants/i18n';
import { ENABLE_SHARED_ROOMS } from '../constants/features';
import { AuthProvider } from '../hooks/useAuth';
import { NotesProvider } from '../hooks/useNotes';
import { NoteDetailSheetProvider, useNoteDetailSheet } from '../hooks/useNoteDetailSheet';
import { RoomsProvider } from '../hooks/useRooms';
import { SharedFeedProvider } from '../hooks/useSharedFeed';
import { SyncStatusProvider } from '../hooks/useSyncStatus';
import { SubscriptionProvider } from '../hooks/useSubscription';
import { ThemeProvider, useTheme } from '../hooks/useTheme';
import { getDB } from '../services/database';
import { syncGeofenceRegions } from '../services/geofenceService';
import { configureNotificationChannels } from '../services/notificationService';
import { updateWidgetData } from '../services/widgetService';
import '../utils/backgroundGeofence';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { colors, isDark, themeReady } = useTheme();
  const { openNoteDetail } = useNoteDetailSheet();
  const [dbReady, setDbReady] = useState(false);
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

  // Handle splash screen
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);

  useEffect(() => {
    if (themeReady && dbReady) {
      SplashScreen.hideAsync();
    }
  }, [themeReady, dbReady]);

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
          <Stack.Screen
            name="auth/profile"
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
          {ENABLE_SHARED_ROOMS ? (
            <Stack.Screen
              name="rooms/create"
              options={{
                headerShown: true,
                title: i18n.t('rooms.createTitle', 'Create Room'),
                headerBackButtonDisplayMode: 'minimal',
                headerBackButtonMenuEnabled: false,
              }}
            />
          ) : null}
          {ENABLE_SHARED_ROOMS ? (
            <Stack.Screen
              name="rooms/join"
              options={{
                headerShown: true,
                title: i18n.t('rooms.joinTitle', 'Join Room'),
                headerBackButtonDisplayMode: 'minimal',
                headerBackButtonMenuEnabled: false,
              }}
            />
          ) : null}
          {ENABLE_SHARED_ROOMS ? (
            <Stack.Screen
              name="rooms/share"
              options={{
                headerShown: true,
                title: i18n.t('rooms.shareTitle', 'Share to Room'),
                headerBackButtonDisplayMode: 'minimal',
                headerBackButtonMenuEnabled: false,
              }}
            />
          ) : null}
          {ENABLE_SHARED_ROOMS ? (
            <Stack.Screen
              name="rooms/[id]"
              options={{
                headerShown: true,
                title: i18n.t('rooms.roomTitle', 'Room'),
                headerBackButtonDisplayMode: 'minimal',
                headerBackButtonMenuEnabled: false,
              }}
            />
          ) : null}
          {ENABLE_SHARED_ROOMS ? (
            <Stack.Screen
              name="rooms/[id]/settings"
              options={{
                headerShown: true,
                title: i18n.t('rooms.settingsTitle', 'Room Settings'),
                headerBackButtonDisplayMode: 'minimal',
                headerBackButtonMenuEnabled: false,
              }}
            />
          ) : null}
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
            <AuthProvider>
              <SubscriptionProvider>
                <NotesProvider>
                  <SyncStatusProvider>
                    <RoomsProvider>
                      <SharedFeedProvider>
                        <NoteDetailSheetProvider>
                          <AppContent />
                        </NoteDetailSheetProvider>
                      </SharedFeedProvider>
                    </RoomsProvider>
                  </SyncStatusProvider>
                </NotesProvider>
              </SubscriptionProvider>
            </AuthProvider>
          </ThemeProvider>
        </I18nextProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
