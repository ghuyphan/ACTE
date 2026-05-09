import type * as Notifications from 'expo-notifications';

export type SocialNotificationPayload = {
  actorDisplayName?: string;
  memoryType?: string;
  notificationBody?: string;
  notificationChannelId?: string;
  notificationTitle?: string;
  notificationType?: string;
  placeName?: string;
  responseId?: string;
  route?: string;
  sharedPostId?: string;
};

type NotificationData = Record<string, unknown>;

let activeSharedChatPostId: string | null = null;

function asTrimmedString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

export function setActiveSharedChatPostId(postId: string | null) {
  activeSharedChatPostId = postId?.trim() || null;
}

export function getActiveSharedChatPostId() {
  return activeSharedChatPostId;
}

export function parseSocialNotificationData(data: NotificationData | undefined): NotificationData {
  const rawData = data ?? {};
  const dataString = asTrimmedString(rawData.dataString);
  if (!dataString) {
    return rawData;
  }

  try {
    const parsed = JSON.parse(dataString) as NotificationData;
    return {
      ...parsed,
      ...rawData,
    };
  } catch {
    return rawData;
  }
}

export function extractSocialNotificationPayload(
  data: NotificationData | undefined
): SocialNotificationPayload {
  const parsedData = parseSocialNotificationData(data);
  return {
    actorDisplayName: asTrimmedString(parsedData.actorDisplayName),
    memoryType: asTrimmedString(parsedData.memoryType),
    notificationBody: asTrimmedString(parsedData.notificationBody),
    notificationChannelId: asTrimmedString(parsedData.notificationChannelId),
    notificationTitle: asTrimmedString(parsedData.notificationTitle),
    notificationType: asTrimmedString(parsedData.notificationType),
    placeName: asTrimmedString(parsedData.placeName),
    responseId: asTrimmedString(parsedData.responseId),
    route: asTrimmedString(parsedData.route),
    sharedPostId: asTrimmedString(parsedData.sharedPostId),
  };
}

export function extractSocialNotificationPayloadFromNotification(
  notification: Notifications.Notification
) {
  const content = notification.request.content;
  const payload = extractSocialNotificationPayload(content.data);
  return {
    ...payload,
    notificationBody: payload.notificationBody || content.body || '',
    notificationTitle: payload.notificationTitle || content.title || '',
  };
}

export function isSocialNotificationType(notificationType: string | undefined) {
  return (
    notificationType === 'friend-accepted' ||
    notificationType === 'shared-post' ||
    notificationType === 'shared-response' ||
    notificationType === 'shared-response-reaction'
  );
}

export function shouldSuppressSocialNotificationPresentation(
  payload: Pick<SocialNotificationPayload, 'notificationType' | 'sharedPostId'>
) {
  return (
    payload.notificationType === 'shared-response' &&
    Boolean(payload.sharedPostId) &&
    payload.sharedPostId === getActiveSharedChatPostId()
  );
}

export function buildSharedChatRoute(
  sharedPostId: string,
  responseId?: string | null
) {
  const normalizedPostId = sharedPostId.trim();
  const normalizedResponseId = responseId?.trim() ?? '';
  if (!normalizedResponseId) {
    return `/shared/chat/${encodeURIComponent(normalizedPostId)}`;
  }

  return `/shared/chat/${encodeURIComponent(normalizedPostId)}?responseId=${encodeURIComponent(
    normalizedResponseId
  )}`;
}
