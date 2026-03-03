import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
import i18n from '../constants/i18n';
import { ThemeProvider, useTheme } from '../hooks/useTheme';
import { getDB } from '../services/database';
import '../utils/backgroundGeofence';
import '../widgets/LocketWidget';

function AppContent() {
  const { colors } = useTheme();
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    getDB()
      .then(() => setDbReady(true))
      .catch((err) => {
        console.error('Database init failed:', err);
        setDbReady(true); // continue anyway so app isn't stuck
      });
  }, []);

  if (!dbReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
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
  );
}

export default function RootLayout() {
  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <StatusBar style="auto" />
        <AppContent />
      </ThemeProvider>
    </I18nextProvider>
  );
}
