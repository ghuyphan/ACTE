import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { useExternalEntryNavigation } from '../../../hooks/app/useExternalEntryNavigation';
import { useAuth } from '../../../hooks/useAuth';
import { resolveFeedTarget } from '../../../services/feedTargetLookup';

export default function WidgetFocusRoute() {
  const { kind, id } = useLocalSearchParams<{ kind?: string; id?: string }>();
  const { focusFeedTargetFromExternalEntry, resetToHome } = useExternalEntryNavigation();
  const { user, isReady: authReady } = useAuth();

  useFocusEffect(
    useCallback(() => {
      if (!id || typeof id !== 'string') {
        resetToHome();
        return;
      }

      if (!authReady) {
        return undefined;
      }

      let cancelled = false;

      const target =
        kind === 'note'
          ? { kind: 'note' as const, id }
          : kind === 'shared-post'
            ? { kind: 'shared-post' as const, id }
            : null;

      if (!target) {
        resetToHome();
        return;
      }

      void (async () => {
        const resolvedTarget = await resolveFeedTarget(target, {
          sharedCacheUserUid: user?.uid ?? null,
        });

        if (cancelled) {
          return;
        }

        if (!resolvedTarget) {
          resetToHome();
          return;
        }

        focusFeedTargetFromExternalEntry(resolvedTarget);
      })();

      return () => {
        cancelled = true;
      };
    }, [authReady, focusFeedTargetFromExternalEntry, id, kind, resetToHome, user?.uid])
  );

  return null;
}
