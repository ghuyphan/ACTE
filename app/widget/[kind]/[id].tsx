import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { useExternalEntryNavigation } from '../../../hooks/app/useExternalEntryNavigation';

export default function WidgetFocusRoute() {
  const { kind, id } = useLocalSearchParams<{ kind?: string; id?: string }>();
  const { focusFeedTargetFromExternalEntry, resetToHome } = useExternalEntryNavigation();

  useFocusEffect(
    useCallback(() => {
      if (!id || typeof id !== 'string') {
        resetToHome();
        return;
      }

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

      focusFeedTargetFromExternalEntry(target);
    }, [focusFeedTargetFromExternalEntry, id, kind, resetToHome])
  );

  return null;
}
