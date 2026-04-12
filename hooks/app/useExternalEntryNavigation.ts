import { Href, usePathname, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Keyboard } from 'react-native';
import { useActiveFeedTarget } from '../useActiveFeedTarget';
import { useFeedFocus } from '../useFeedFocus';
import { useNoteDetailSheet } from '../useNoteDetailSheet';
import type { FeedFocusTarget } from '../state/useFeedFocus';

const HOME_ROUTE = '/(tabs)' as Href;
const HOME_PATHNAMES = new Set(['/', '/(tabs)']);

export function useExternalEntryNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const { peekActiveFeedTarget } = useActiveFeedTarget();
  const { requestFeedFocus } = useFeedFocus();
  const { closeNoteDetail } = useNoteDetailSheet();
  const isHomeVisible = HOME_PATHNAMES.has(pathname);

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

      if (isHomeVisible && activeTarget?.kind === target.kind && activeTarget.id === target.id) {
        return;
      }

      requestFeedFocus(target);

      if (!isHomeVisible) {
        router.dismissTo(HOME_ROUTE);
      }
    },
    [isHomeVisible, peekActiveFeedTarget, prepareForExternalNavigation, requestFeedFocus, router]
  );

  return {
    focusFeedTargetFromExternalEntry,
    prepareForExternalNavigation,
    resetToHome,
  };
}
