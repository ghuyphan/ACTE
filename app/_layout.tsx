import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import * as SystemUI from 'expo-system-ui';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import AppProviders from '../components/app/AppProviders';
import PrimaryButton from '../components/ui/PrimaryButton';
import { useHomeStartupReady } from '../hooks/app/useHomeStartupReady';
import { useNotesStore } from '../hooks/useNotes';
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
  const { initialLoadComplete } = useNotesStore();
  const { homeFeedReady } = useHomeStartupReady();
  const { t } = useTranslation();
  const {
    isDatabaseReady,
    isRecovering,
    startupRoute,
    isStartupRouteReady,
    resetStartupData,
    retryStartup,
    startupError,
  } = useAppStartupBootstrap();
  useAppWidgetRefresh({ enabled: isDatabaseReady });
  useAppNotificationRouting();
  useSocialPushRegistration();
  useAppSplashGate({
    isDatabaseReady,
    isStartupRouteReady,
    notesReady: initialLoadComplete,
    requiresHomeFeedReady: startupRoute === '/',
    homeFeedReady,
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

  const startupErrorMessage =
    startupError === 'database-reset-failed'
      ? t(
          'startup.databaseResetFailed',
          'Noto could not reset its local database. Please restart the app and try again.'
        )
      : t(
          'startup.databaseInitFailed',
          'Noto could not open its local database. Please restart the app and try again.'
        );

  return (
    <NavThemeProvider value={navTheme}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        {startupError ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', textAlign: 'center' }}>
              {t('common.error', 'Something went wrong')}
            </Text>
            <Text style={{ color: colors.secondaryText, fontSize: 15, marginTop: 12, textAlign: 'center' }}>
              {startupErrorMessage}
            </Text>
            <Text style={{ color: colors.secondaryText, fontSize: 13, marginTop: 12, textAlign: 'center' }}>
              {t(
                'startup.resetLocalDataHint',
                'Reset local data only if retrying does not help. Synced content can come back after sign-in.'
              )}
            </Text>
            <View style={{ width: '100%', maxWidth: 320, gap: 12, marginTop: 24 }}>
              <PrimaryButton
                label={t('startup.retryAction', 'Try again')}
                onPress={retryStartup}
                loading={isRecovering}
                disabled={isRecovering}
                testID="startup-retry-button"
              />
              <PrimaryButton
                label={t('startup.resetLocalDataAction', 'Reset local data')}
                onPress={handleResetStartupData}
                disabled={isRecovering}
                variant="secondary"
                testID="startup-reset-data-button"
              />
            </View>
            {isRecovering ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 }}>
                <ActivityIndicator color={colors.primary} />
                <Text style={{ color: colors.secondaryText, fontSize: 13, textAlign: 'center' }}>
                  {t('startup.recoveryInProgress', 'Trying to recover your local data...')}
                </Text>
              </View>
            ) : null}
          </View>
        ) : (
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
          <Stack.Screen
            name="notes/index"
            options={{
              headerShown: true,
              headerTransparent: false,
              headerShadowVisible: false,
              title: t('notes.viewAllTitle', 'All notes'),
              headerBackTitle: t('tabs.home', 'Home'),
              headerTintColor: colors.text,
              headerBackButtonDisplayMode: 'minimal',
              headerBackButtonMenuEnabled: false,
              headerStyle: {
                backgroundColor: colors.background,
              },
            }}
          />
          <Stack.Screen
            name="notes/stickers"
            options={{
              headerShown: true,
              headerTransparent: false,
              headerShadowVisible: false,
              title: t('notes.stickerLibrary.title', 'Your stickers & stamps'),
              headerTintColor: colors.text,
              headerBackButtonDisplayMode: 'minimal',
              headerBackButtonMenuEnabled: false,
              headerStyle: {
                backgroundColor: colors.background,
              },
            }}
          />
          <Stack.Screen name="shared/index" />
          <Stack.Screen
            name="shared/[id]"
            options={{
              presentation: 'transparentModal',
              animation: 'none',
            }}
          />
        </Stack>
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
