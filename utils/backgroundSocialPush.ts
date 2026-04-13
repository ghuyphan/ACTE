import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { ANDROID_SOCIAL_CHANNEL_ID } from '../services/notificationService';
import { refreshSharedFeed } from '../services/sharedFeedService';
import { updateWidgetData } from '../services/widgetService';
import { getSupabaseUser } from './supabase';

export const SOCIAL_PUSH_NOTIFICATION_TASK_NAME = 'BACKGROUND_SOCIAL_PUSH_NOTIFICATION_TASK';

type SocialNotificationPayload = {
  notificationType?: string;
  sharedPostId?: string;
  route?: string;
  notificationTitle?: string;
  notificationBody?: string;
  notificationChannelId?: string;
};

let socialPushTaskRegistrationPromise: Promise<void> | null = null;

function isNotificationResponse(
  payload: Notifications.NotificationTaskPayload
): payload is Notifications.NotificationResponse {
  return 'actionIdentifier' in payload;
}

function asTrimmedString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function parseNotificationTaskData(payload: Notifications.NotificationTaskPayload) {
  const rawData = isNotificationResponse(payload)
    ? payload.notification.request.content.data ?? {}
    : payload.data ?? {};
  const dataString = typeof rawData.dataString === 'string' ? rawData.dataString : '';

  if (!dataString) {
    return rawData;
  }

  try {
    const parsed = JSON.parse(dataString) as Record<string, unknown>;
    return {
      ...parsed,
      ...rawData,
    };
  } catch {
    return rawData;
  }
}

function extractSocialNotificationPayload(
  payload: Notifications.NotificationTaskPayload
): SocialNotificationPayload {
  const data = parseNotificationTaskData(payload);
  return {
    notificationType: asTrimmedString(data.notificationType),
    sharedPostId: asTrimmedString(data.sharedPostId),
    route: asTrimmedString(data.route),
    notificationTitle: asTrimmedString(data.notificationTitle),
    notificationBody: asTrimmedString(data.notificationBody),
    notificationChannelId: asTrimmedString(data.notificationChannelId),
  };
}

async function scheduleAndroidSocialNotification(payload: SocialNotificationPayload) {
  const title = payload.notificationTitle;
  const body = payload.notificationBody;
  if (!title && !body) {
    return;
  }

  const content: Notifications.NotificationContentInput & { channelId?: string } = {
    title: title || null,
    body: body || null,
    sound: 'default',
    channelId: payload.notificationChannelId || ANDROID_SOCIAL_CHANNEL_ID,
    data: {
      route: payload.route,
      sharedPostId: payload.sharedPostId,
    },
  };

  await Notifications.scheduleNotificationAsync({
    content,
    trigger: null,
  });
}

export async function handleSocialPushNotificationTask(
  payload: Notifications.NotificationTaskPayload
) {
  const socialPayload = extractSocialNotificationPayload(payload);
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

  const snapshot = await refreshSharedFeed(currentUser);
  const hasMatchingSharedPost = snapshot.sharedPosts.some(
    (post) => post.id === socialPayload.sharedPostId && post.authorUid !== currentUser.id
  );

  if (!hasMatchingSharedPost) {
    return Notifications.BackgroundNotificationTaskResult.NoData;
  }

  const widgetResult = await updateWidgetData({
    includeLocationLookup: false,
    includeSharedRefresh: false,
    preferredNoteId: socialPayload.sharedPostId,
  });

  if (
    Platform.OS === 'android' &&
    !isNotificationResponse(payload) &&
    payload.notification === null
  ) {
    await scheduleAndroidSocialNotification(socialPayload);
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
