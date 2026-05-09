import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { ANDROID_SOCIAL_CHANNEL_ID } from '../services/notificationService';
import { getCachedSharedFeedSnapshot } from '../services/sharedFeedCache';
import { refreshSharedFeed } from '../services/sharedFeedService';
import { updateWidgetData } from '../services/widgetService';
import {
  extractSocialNotificationPayload,
  type SocialNotificationPayload,
} from './socialNotificationPresentation';
import { getSupabaseUser } from './supabase';

export const SOCIAL_PUSH_NOTIFICATION_TASK_NAME = 'BACKGROUND_SOCIAL_PUSH_NOTIFICATION_TASK';

let socialPushTaskRegistrationPromise: Promise<void> | null = null;

function isNotificationResponse(
  payload: Notifications.NotificationTaskPayload
): payload is Notifications.NotificationResponse {
  return 'actionIdentifier' in payload;
}

function parseNotificationTaskData(payload: Notifications.NotificationTaskPayload) {
  const rawData = isNotificationResponse(payload)
    ? payload.notification.request.content.data ?? {}
    : payload.data ?? {};
  return extractSocialNotificationPayload(rawData);
}

async function scheduleLocalSocialNotification(payload: SocialNotificationPayload) {
  const title = payload.notificationTitle;
  const body = payload.notificationBody;
  if (!title && !body) {
    return;
  }

  const content: Notifications.NotificationContentInput & { channelId?: string } = {
    title: title || null,
    body: body || null,
    sound: 'default',
    data: {
      route: payload.route,
      notificationType: payload.notificationType,
      notificationTitle: payload.notificationTitle,
      notificationBody: payload.notificationBody,
      sharedPostId: payload.sharedPostId,
      responseId: payload.responseId,
      actorDisplayName: payload.actorDisplayName,
      memoryType: payload.memoryType,
      placeName: payload.placeName,
    },
  };

  if (Platform.OS === 'android') {
    content.channelId = payload.notificationChannelId || ANDROID_SOCIAL_CHANNEL_ID;
  }

  await Notifications.scheduleNotificationAsync({
    content,
    trigger: null,
  });
}

export async function handleSocialPushNotificationTask(
  payload: Notifications.NotificationTaskPayload
) {
  const socialPayload = parseNotificationTaskData(payload);
  if (
    socialPayload.notificationType !== 'shared-post' ||
    !socialPayload.sharedPostId
  ) {
    return Notifications.BackgroundNotificationTaskResult.NoData;
  }

  const currentUser = await getSupabaseUser();
  if (!currentUser) {
    return Notifications.BackgroundNotificationTaskResult.NoData;
  }

  let snapshot;
  try {
    snapshot = await refreshSharedFeed(currentUser);
  } catch (error) {
    console.warn('[social-push] Refresh failed, falling back to cached shared feed:', error);
    snapshot = await getCachedSharedFeedSnapshot(currentUser.uid).catch((cacheError) => {
      console.warn('[social-push] Cached shared feed lookup failed:', cacheError);
      return null;
    });
  }

  if (!snapshot) {
    return Notifications.BackgroundNotificationTaskResult.NoData;
  }

  const hasMatchingSharedPost = snapshot.sharedPosts.some(
    (post) => post.id === socialPayload.sharedPostId && post.authorUid !== currentUser.id
  );

  if (!hasMatchingSharedPost) {
    return Notifications.BackgroundNotificationTaskResult.NoData;
  }

  const widgetResult = await updateWidgetData({
    includeLocationLookup: false,
    includeSharedRefresh: false,
    sharedPosts: snapshot.sharedPosts,
    preferredNoteId: socialPayload.sharedPostId,
  });

  if (
    !isNotificationResponse(payload) &&
    payload.notification === null
  ) {
    await scheduleLocalSocialNotification(socialPayload);
  }

  return widgetResult.status === 'failed'
    ? Notifications.BackgroundNotificationTaskResult.Failed
    : Notifications.BackgroundNotificationTaskResult.NewData;
}

if (
  typeof TaskManager.isTaskDefined !== 'function' ||
  !TaskManager.isTaskDefined(SOCIAL_PUSH_NOTIFICATION_TASK_NAME)
) {
  TaskManager.defineTask<Notifications.NotificationTaskPayload>(
    SOCIAL_PUSH_NOTIFICATION_TASK_NAME,
    async ({ data, error }) => {
      if (error || !data) {
        return Notifications.BackgroundNotificationTaskResult.Failed;
      }

      try {
        return await handleSocialPushNotificationTask(data);
      } catch (taskError) {
        console.warn('[social-push] Background social push task failed:', taskError);
        return Notifications.BackgroundNotificationTaskResult.Failed;
      }
    }
  );
}

export async function registerSocialPushBackgroundTaskAsync() {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return;
  }

  if (socialPushTaskRegistrationPromise) {
    return socialPushTaskRegistrationPromise;
  }

  socialPushTaskRegistrationPromise = (async () => {
    const isRegistered =
      typeof TaskManager.isTaskRegisteredAsync === 'function'
        ? await TaskManager.isTaskRegisteredAsync(SOCIAL_PUSH_NOTIFICATION_TASK_NAME)
        : false;

    if (!isRegistered) {
      await Notifications.registerTaskAsync(SOCIAL_PUSH_NOTIFICATION_TASK_NAME);
    }
  })().finally(() => {
    socialPushTaskRegistrationPromise = null;
  });

  return socialPushTaskRegistrationPromise;
}
