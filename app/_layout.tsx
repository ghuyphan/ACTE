import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import * as SystemUI from 'expo-system-ui';
import { SplashScreen, Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation, I18nextProvider } from 'react-i18next';
import { AppState, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import i18n, { i18nReady } from '../constants/i18n';
import { ActiveFeedTargetProvider } from '../hooks/useActiveFeedTarget';
import { ActiveNoteProvider } from '../hooks/useActiveNote';
import { AuthProvider, useAuth } from '../hooks/useAuth';
import { ConnectivityProvider, useConnectivity } from '../hooks/useConnectivity';
import { FeedFocusProvider } from '../hooks/useFeedFocus';
import { NotesProvider } from '../hooks/useNotes';
import { NoteDetailSheetProvider, useNoteDetailSheet } from '../hooks/useNoteDetailSheet';
import { SharedFeedProvider } from '../hooks/useSharedFeed';
import { SyncStatusProvider } from '../hooks/useSyncStatus';
import { SubscriptionProvider } from '../hooks/useSubscription';
import { ThemeProvider, useTheme } from '../hooks/useTheme';
import { AppAlertProvider } from '../components/ui/AppAlertProvider';
import { getDB } from '../services/database';
import { syncGeofenceRegions } from '../services/geofenceService';
import { configureNotificationChannels } from '../services/notificationService';
import { syncSocialPushRegistration } from '../services/socialPushService';
import { updateWidgetData } from '../services/widgetService';
import { runMediaCacheEviction } from '../services/mediaCacheManager';
import { getPersistentItem, getPersistentItemSync } from '../utils/appStorage';
import '../utils/backgroundGeofence';
import { scheduleOnIdle } from '../utils/scheduleOnIdle';

export { ErrorBoundary } from 'expo-router';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const HAS_LAUNCHED_KEY = 'settings.hasLaunched';

function resolveStartupTarget(hasLaunched: string | null) {
  return hasLaunched === 'true' ? '/' : '/auth/onboarding';
}

function AppContent() {
  const { colors, isDark, themeReady } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isOnline } = useConnectivity();
  const { openNoteDetail } = useNoteDetailSheet();
  const router = useRouter();
  const segments = useSegments();
  const notificationResponseListener = useRef<Notifications.EventSubscription | null>(null);
  const lastHandledNotificationIdRef = useRef<string | null>(null);
  const [initialUrlResolved, setInitialUrlResolved] = useState(false);
  const [hasInitialUrl, setHasInitialUrl] = useState(false);
  const [startupRedirectHandled, setStartupRedirectHandled] = useState(false);
  const [startupTarget, setStartupTarget] = useState<string | null>(() => {
    const hasLaunched = getPersistentItemSync(HAS_LAUNCHED_KEY);
    if (hasLaunched === undefined) {
      return null;
    }

    return resolveStartupTarget(hasLaunched);
  });
  const startupRedirectPending =
    !startupRedirectHandled &&
    initialUrlResolved &&
    !hasInitialUrl &&
    segments[0] === undefined &&
    Boolean(startupTarget);

  useEffect(() => {
    let cancelled = false;

    void Linking.getInitialURL()
      .then((initialUrl) => {
        if (cancelled) {
          return;
        }

        setHasInitialUrl(Boolean(initialUrl));
        setInitialUrlResolved(true);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setHasInitialUrl(false);
        setInitialUrlResolved(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (segments[0] === undefined || !hasInitialUrl) {
      return;
    }

    setHasInitialUrl(false);
  }, [hasInitialUrl, segments]);

  useEffect(() => {
    let startupIdleHandle: ReturnType<typeof scheduleOnIdle> | null = null;
    let startupTimeout: ReturnType<typeof setTimeout> | null = null;

    void configureNotificationChannels();

    getDB()
      .then(() => {
        startupIdleHandle = scheduleOnIdle(() => {
          startupTimeout = setTimeout(() => {
            updateWidgetData().catch((err) => console.warn('Widget init failed:', err));
            syncGeofenceRegions().catch((err) => console.warn('Geofence sync failed:', err));
            runMediaCacheEviction().catch((err) => console.warn('Cache eviction failed:', err));
          }, 400);
        });
      })
      .catch((err) => {
        console.error('Database init failed:', err);
      });

    return () => {
      startupIdleHandle?.cancel();
      if (startupTimeout) {
        clearTimeout(startupTimeout);
      }
    };
  }, []);

  useEffect(() => {
    if (startupTarget) {
      return;
    }

    let cancelled = false;

    void getPersistentItem(HAS_LAUNCHED_KEY)
      .then((hasLaunched) => {
        if (!cancelled) {
          setStartupTarget(resolveStartupTarget(hasLaunched));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStartupTarget('/');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [startupTarget]);

  useEffect(() => {
    if (startupRedirectHandled || !initialUrlResolved || !startupTarget) {
      return;
    }

    if (hasInitialUrl || segments[0] !== undefined) {
      setStartupRedirectHandled(true);
      return;
    }

    setStartupRedirectHandled(true);
    router.replace(startupTarget as '/' | '/auth/onboarding');
  }, [hasInitialUrl, initialUrlResolved, router, segments, startupRedirectHandled, startupTarget]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        return;
      }

      updateWidgetData({
        includeLocationLookup: true,
        includeSharedRefresh: Boolean(user && isOnline),
      }).catch((err) => console.warn('Widget background update failed:', err));
    });

    return () => {
      subscription.remove();
    };
  }, [isOnline, user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    updateWidgetData({
      includeLocationLookup: true,
      includeSharedRefresh: isOnline,
    }).catch((err) => console.warn('Widget data update failed:', err));
  }, [isOnline, user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    syncSocialPushRegistration(user).catch((error) => {
      console.warn('[social-push] Registration failed:', error);
    });
  }, [user]);

  useEffect(() => {
    void i18nReady
      .catch((error) => {
        console.error('i18n init failed:', error);
      });
  }, []);

  // Handle splash screen
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);

  useEffect(() => {
    if (!themeReady || !startupTarget || !initialUrlResolved || startupRedirectPending) {
      return;
    }

    let cancelled = false;
    requestAnimationFrame(() => {
      if (!cancelled) {
        void SplashScreen.hideAsync();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [initialUrlResolved, startupRedirectPending, startupTarget, themeReady]);

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
      const sharedPostId = response.notification.request.content.data?.sharedPostId;
      const route = response.notification.request.content.data?.route;
      if (noteId && typeof noteId === 'string') {
        openNoteDetail(noteId);
      } else if (sharedPostId && typeof sharedPostId === 'string') {
        router.push(`/shared/${sharedPostId}` as any);
      } else if (route && typeof route === 'string') {
        router.push(route as any);
      }

      try {
        await Notifications.clearLastNotificationResponseAsync();
      } catch {
        return;
      }
    },
    [openNoteDetail, router]
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
              headerTitle: t('profile.title', 'Profile'),
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
          <Stack.Screen
            name="(tabs)"
            options={{
              title: t('tabs.home', 'Home'),
            }}
          />
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
                  <ActiveNoteProvider>
                    <ActiveFeedTargetProvider>
                      <FeedFocusProvider>
                        <NotesProvider>
                          <SyncStatusProvider>
                            <SharedFeedProvider>
                              <NoteDetailSheetProvider>
                                <BottomSheetModalProvider>
                                  <AppAlertProvider />
                                  <AppContent />
                                </BottomSheetModalProvider>
                              </NoteDetailSheetProvider>
                            </SharedFeedProvider>
                          </SyncStatusProvider>
                        </NotesProvider>
                      </FeedFocusProvider>
                    </ActiveFeedTargetProvider>
                  </ActiveNoteProvider>
                </SubscriptionProvider>
              </AuthProvider>
            </ConnectivityProvider>
          </ThemeProvider>
        </I18nextProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
