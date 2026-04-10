import * as Notifications from 'expo-notifications';
import { useRootNavigationState, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { useExternalEntryNavigation } from './useExternalEntryNavigation';

export function useAppNotificationRouting() {
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const {
    focusFeedTargetFromExternalEntry,
    prepareForExternalNavigation,
  } = useExternalEntryNavigation();
  const notificationResponseListener = useRef<Notifications.EventSubscription | null>(null);
  const lastHandledNotificationIdRef = useRef<string | null>(null);
  const isNavigationReady = Boolean(rootNavigationState?.key);

  const handleNotificationResponse = useCallback(
    async (response: Notifications.NotificationResponse | null) => {
      if (!response) {
        return;
      }

      const notificationId = response.notification.request.identifier;
      if (lastHandledNotificationIdRef.current === notificationId) {
        return;
      }
      lastHandledNotificationIdRef.current = notificationId;

      const noteId = response.notification.request.content.data?.noteId;
      const sharedPostId = response.notification.request.content.data?.sharedPostId;
      const route = response.notification.request.content.data?.route;
      if (noteId && typeof noteId === 'string') {
        focusFeedTargetFromExternalEntry({ kind: 'note', id: noteId });
      } else if (sharedPostId && typeof sharedPostId === 'string') {
        focusFeedTargetFromExternalEntry({ kind: 'shared-post', id: sharedPostId });
      } else if (route && typeof route === 'string') {
        prepareForExternalNavigation();
        router.push(route as any);
      }

      try {
        await Notifications.clearLastNotificationResponseAsync();
      } catch {
        return;
      }
    },
    [focusFeedTargetFromExternalEntry, prepareForExternalNavigation, router]
  );

  useEffect(() => {
    if (!isNavigationReady) {
      return;
    }

    let cancelled = false;

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!cancelled) {
        void handleNotificationResponse(response);
      }
    });

    notificationResponseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        void handleNotificationResponse(response);
      });

    return () => {
      cancelled = true;
      notificationResponseListener.current?.remove();
    };
  }, [handleNotificationResponse, isNavigationReady]);
}
