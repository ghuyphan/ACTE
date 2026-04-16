import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import * as SystemUI from 'expo-system-ui';
import { SplashScreen } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import AppProviders from '../components/app/AppProviders';
import RootStackNavigator from '../components/app/RootStackNavigator';
import StartupErrorView from '../components/app/StartupErrorView';
import {
  createSolidBackScreenOptions,
  createTransparentBackScreenOptions,
} from '../components/app/rootStackOptions';
import { useNotesStore } from '../hooks/useNotes';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { useAppSplashGate } from '../hooks/app/useAppSplashGate';
import { useAppNotificationRouting } from '../hooks/app/useAppNotificationRouting';
import { useAppStartupBootstrap } from '../hooks/app/useAppStartupBootstrap';
import { useAppWidgetRefresh } from '../hooks/app/useAppWidgetRefresh';
import { useSocialPushRegistration } from '../hooks/app/useSocialPushRegistration';
import { showAppAlert } from '../utils/alert';
import '../utils/backgroundGeofence';
import '../utils/backgroundSocialPush';

export { ErrorBoundary } from 'expo-router';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { colors, isDark, themeReady } = useTheme();
  const { isReady: authReady } = useAuth();
  const { phase: notesPhase } = useNotesStore();
  const { t } = useTranslation();
  const {
    isDatabaseReady,
    isRecovering,
    isStartupRouteReady,
    resetStartupData,
    retryStartup,
    startupError,
  } = useAppStartupBootstrap();
  useAppWidgetRefresh({ enabled: isDatabaseReady });
  useAppNotificationRouting();
  useSocialPushRegistration();
  useAppSplashGate({
    authReady,
    isDatabaseReady,
    isStartupRouteReady,
    notesReady: notesPhase === 'ready' || notesPhase === 'refreshing',
    startupError,
    themeReady,
  });

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);

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

  const handleResetStartupData = useCallback(() => {
    if (isRecovering) {
      return;
    }

    showAppAlert(
      t('startup.resetLocalDataTitle', 'Reset local data?'),
      t(
        'startup.resetLocalDataBody',
        'This removes memories saved only on this device so Noto can rebuild its local database.'
      ),
      [
        {
          text: t('common.cancel', 'Cancel'),
          style: 'cancel',
        },
        {
          text: t('startup.resetLocalDataConfirm', 'Reset local data'),
          style: 'destructive',
          onPress: () => {
            void resetStartupData();
          },
        },
      ]
    );
  }, [isRecovering, resetStartupData, t]);

  const settingsTitle = t('settings.title', 'Settings');
  const homeTitle = t('tabs.home', 'Home');
  const rootScreenOptions = useMemo(
    () => ({
      authEntry: createTransparentBackScreenOptions(colors, {
        backTitle: settingsTitle,
      }),
      profile: createTransparentBackScreenOptions(colors, {
        title: t('profile.title', 'Profile'),
        backTitle: settingsTitle,
      }),
      plus: createTransparentBackScreenOptions(colors, {
        backTitle: settingsTitle,
      }),
      notesIndex: createSolidBackScreenOptions(colors, {
        title: t('notes.viewAllTitle', 'All notes'),
        backTitle: homeTitle,
      }),
      stickerLibrary: createSolidBackScreenOptions(colors, {
        title: t('notes.stickerLibrary.title', 'Your stickers & stamps'),
      }),
    }),
    [colors, homeTitle, settingsTitle, t]
  );

  return (
    <NavThemeProvider value={navTheme}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        {startupError ? (
          <StartupErrorView
            colors={colors}
            isRecovering={isRecovering}
            onRetry={retryStartup}
            onResetLocalData={handleResetStartupData}
            startupError={startupError}
          />
        ) : (
          <RootStackNavigator homeTitle={homeTitle} rootScreenOptions={rootScreenOptions} />
        )}
      </View>
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <AppProviders>
          <AppContent />
        </AppProviders>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
