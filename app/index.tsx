import { useRootNavigationState, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import {
  getCachedStartupRoute,
  loadStartupRoute,
  type StartupIndexRoute,
} from '../services/startupRouting';
import { useTheme } from '../hooks/useTheme';

export default function Index() {
  const { colors } = useTheme();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const [target, setTarget] = useState<StartupIndexRoute | null>(() => getCachedStartupRoute('index'));
  const resolvedTarget = target ?? getCachedStartupRoute('index');
  const hasNavigatedRef = useRef(false);

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

  useEffect(() => {
    if (!resolvedTarget || !rootNavigationState?.key || hasNavigatedRef.current) {
      return;
    }

    hasNavigatedRef.current = true;
    router.replace(resolvedTarget);
  }, [resolvedTarget, rootNavigationState?.key, router]);

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
