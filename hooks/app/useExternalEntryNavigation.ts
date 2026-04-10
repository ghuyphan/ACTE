import { Href, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Keyboard } from 'react-native';
import { useActiveFeedTarget } from '../useActiveFeedTarget';
import { useFeedFocus } from '../useFeedFocus';
import { useNoteDetailSheet } from '../useNoteDetailSheet';
import type { FeedFocusTarget } from '../state/useFeedFocus';

const HOME_ROUTE = '/(tabs)' as Href;

export function useExternalEntryNavigation() {
  const router = useRouter();
  const { peekActiveFeedTarget } = useActiveFeedTarget();
  const { requestFeedFocus } = useFeedFocus();
  const { closeNoteDetail } = useNoteDetailSheet();

  const prepareForExternalNavigation = useCallback(() => {
    Keyboard.dismiss();
    closeNoteDetail();
  }, [closeNoteDetail]);

  const resetToHome = useCallback(() => {
    prepareForExternalNavigation();
    router.dismissTo(HOME_ROUTE);
  }, [prepareForExternalNavigation, router]);

  const focusFeedTargetFromExternalEntry = useCallback(
    (target: FeedFocusTarget) => {
      prepareForExternalNavigation();
      const activeTarget = peekActiveFeedTarget();

      if (activeTarget?.kind === target.kind && activeTarget.id === target.id) {
        return;
      }

      requestFeedFocus(target);

      if (!activeTarget) {
        router.dismissTo(HOME_ROUTE);
      }
    },
    [peekActiveFeedTarget, prepareForExternalNavigation, requestFeedFocus, router]
  );

  return {
    focusFeedTargetFromExternalEntry,
    prepareForExternalNavigation,
    resetToHome,
  };
}
