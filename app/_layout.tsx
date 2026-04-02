import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import * as SystemUI from 'expo-system-ui';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { useTranslation, I18nextProvider } from 'react-i18next';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import i18n, { i18nReady } from '../constants/i18n';
import { ActiveFeedTargetProvider } from '../hooks/state/useActiveFeedTarget';
import { ActiveNoteProvider } from '../hooks/state/useActiveNote';
import { AuthProvider } from '../hooks/useAuth';
import { ConnectivityProvider } from '../hooks/useConnectivity';
import { FeedFocusProvider } from '../hooks/state/useFeedFocus';
import { NotesProvider } from '../hooks/useNotes';
import { NoteDetailSheetProvider } from '../hooks/ui/useNoteDetailSheet';
import { SharedFeedProvider } from '../hooks/useSharedFeed';
import { SyncStatusProvider } from '../hooks/useSyncStatus';
import { SubscriptionProvider } from '../hooks/useSubscription';
import { ThemeProvider, useTheme } from '../hooks/useTheme';
import { useAppNotificationRouting } from '../hooks/app/useAppNotificationRouting';
import { useAppStartupBootstrap } from '../hooks/app/useAppStartupBootstrap';
import { useAppWidgetRefresh } from '../hooks/app/useAppWidgetRefresh';
import { useSocialPushRegistration } from '../hooks/app/useSocialPushRegistration';
import { AppAlertProvider } from '../components/ui/AppAlertProvider';
import '../utils/backgroundGeofence';

export { ErrorBoundary } from 'expo-router';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { colors, isDark, themeReady } = useTheme();
  const { t } = useTranslation();
  const { initialUrlResolved, startupTarget } = useAppStartupBootstrap();
  useAppWidgetRefresh();
  useAppNotificationRouting();
  useSocialPushRegistration();

  useEffect(() => {
    void i18nReady
      .catch((error) => {
        console.error('i18n init failed:', error);
      });
  }, []);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);

  useEffect(() => {
    if (!themeReady || !startupTarget || !initialUrlResolved) {
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
  }, [initialUrlResolved, startupTarget, themeReady]);

  const navTheme = useMemo(() => {
    const baseTheme = isDark ? DarkTheme : DefaultTheme;
    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        background: colors.background,
        card: colors.card,
        text: colors.text,
        border: colors.border,
        primary: colors.primary,
      },
    };
  }, [colors.background, colors.border, colors.card, colors.primary, colors.text, isDark]);

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
