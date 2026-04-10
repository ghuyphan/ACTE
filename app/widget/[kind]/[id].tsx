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

      if (kind === 'note') {
        focusFeedTargetFromExternalEntry({ kind: 'note', id });
        return;
      }

      if (kind === 'shared-post') {
        focusFeedTargetFromExternalEntry({ kind: 'shared-post', id });
        return;
      }

      resetToHome();
    }, [focusFeedTargetFromExternalEntry, id, kind, resetToHome])
  );

  return null;
}
