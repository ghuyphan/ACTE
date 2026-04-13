import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import {
  getCachedStartupRoute,
  loadStartupRoute,
  type StartupIndexRoute,
} from '../services/startupRouting';
import { useTheme } from '../hooks/useTheme';

export default function Index() {
  const { colors } = useTheme();
  const [target, setTarget] = useState<StartupIndexRoute | null>(() => getCachedStartupRoute('index'));
  const resolvedTarget = target ?? getCachedStartupRoute('index');

  useEffect(() => {
    if (resolvedTarget) {
      return;
    }

    let cancelled = false;

    void loadStartupRoute('index').then((nextTarget) => {
      if (!cancelled) {
        setTarget(nextTarget);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [resolvedTarget]);

  if (!resolvedTarget) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.primary} size="small" />
      </View>
    );
  }

  return <Redirect href={resolvedTarget} />;
}
