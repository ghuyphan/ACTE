import * as Notifications from 'expo-notifications';
import { useRootNavigationState, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { useFeedFocus } from '../useFeedFocus';

export function useAppNotificationRouting() {
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const { requestFeedFocus } = useFeedFocus();
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
        // Match the widget flow: focus the feed item after the app tree is mounted
        // instead of presenting a bottom sheet from the startup notification effect.
        requestFeedFocus({ kind: 'note', id: noteId });
        router.replace(`/widget/note/${encodeURIComponent(noteId)}` as any);
      } else if (sharedPostId && typeof sharedPostId === 'string') {
        requestFeedFocus({ kind: 'shared-post', id: sharedPostId });
        router.replace(`/widget/shared-post/${encodeURIComponent(sharedPostId)}` as any);
      } else if (route && typeof route === 'string') {
        router.push(route as any);
      }

      try {
        await Notifications.clearLastNotificationResponseAsync();
      } catch {
        return;
      }
    },
    [requestFeedFocus, router]
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
