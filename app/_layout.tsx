import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import * as SystemUI from 'expo-system-ui';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { i18nReady } from '../constants/i18n';
import AppProviders from '../components/app/AppProviders';
import { useTheme } from '../hooks/useTheme';
import { useAppNotificationRouting } from '../hooks/app/useAppNotificationRouting';
import { useAppStartupBootstrap } from '../hooks/app/useAppStartupBootstrap';
import { useAppWidgetRefresh } from '../hooks/app/useAppWidgetRefresh';
import { useSocialPushRegistration } from '../hooks/app/useSocialPushRegistration';
import '../utils/backgroundGeofence';

export { ErrorBoundary } from 'expo-router';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { colors, isDark, themeReady } = useTheme();
  const { t } = useTranslation();
  const { startupError, startupTarget } = useAppStartupBootstrap();
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
    if (!themeReady || (!startupTarget && !startupError)) {
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
  }, [startupError, startupTarget, themeReady]);

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
        {startupError ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', textAlign: 'center' }}>
              {t('common.error', 'Something went wrong')}
            </Text>
            <Text style={{ color: colors.secondaryText, fontSize: 15, marginTop: 12, textAlign: 'center' }}>
              {t(
                'startup.databaseInitFailed',
                'Noto could not open its local database. Please restart the app and try again.'
              )}
            </Text>
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
