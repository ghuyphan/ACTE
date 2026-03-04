import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
import i18n from '../constants/i18n';
import { ThemeProvider, useTheme } from '../hooks/useTheme';
import { getDB } from '../services/database';
import { updateWidgetData } from '../services/widgetService';
import '../utils/backgroundGeofence';
import '../widgets/LocketWidget';

function AppContent() {
  const { colors, isDark } = useTheme();
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth/index" />
        <Stack.Screen name="auth/onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="note/[id]"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </I18nextProvider>
  );
}
