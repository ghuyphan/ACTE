import * as Notifications from 'expo-notifications';
import { useRootNavigationState, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { buildSharedChatRoute, parseSocialNotificationData } from '../../utils/socialNotificationPresentation';
import { useExternalEntryNavigation } from './useExternalEntryNavigation';

type NotificationData = Record<string, unknown>;

function getNotificationString(data: NotificationData, key: string) {
  const value = data[key];
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function parseNotificationData(data: NotificationData | undefined): NotificationData {
  return parseSocialNotificationData(data);
}

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

      const data = parseNotificationData(response.notification.request.content.data);
      const noteId = getNotificationString(data, 'noteId');
      const sharedPostId = getNotificationString(data, 'sharedPostId');
      const responseId = getNotificationString(data, 'responseId');
      const notificationType = getNotificationString(data, 'notificationType');
      const route = getNotificationString(data, 'route');
      if (notificationType === 'friend-accepted') {
        prepareForExternalNavigation();
        router.dismissTo(`/(tabs)?openSharedManageAt=${encodeURIComponent(notificationId)}` as any);
      } else if (notificationType === 'shared-response' && sharedPostId) {
        prepareForExternalNavigation();
        router.push(buildSharedChatRoute(sharedPostId, responseId) as any);
      } else if (route.startsWith('/shared/chat/')) {
        prepareForExternalNavigation();
        router.push(route as any);
      } else if (noteId) {
        focusFeedTargetFromExternalEntry({ kind: 'note', id: noteId });
      } else if (sharedPostId) {
        focusFeedTargetFromExternalEntry({ kind: 'shared-post', id: sharedPostId });
      } else if (route) {
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
