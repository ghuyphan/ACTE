import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import i18n from '../constants/i18n';

// Android channel sound settings are immutable after the channel is first created,
// so we version the id when fixing channel-level sound behavior.
export const ANDROID_REMINDER_CHANNEL_ID = 'reminders-v2';

type ReminderNotificationContent = Notifications.NotificationContentInput & {
  channelId?: string;
};

export async function configureNotificationChannels(platformOS = Platform.OS) {
  if (platformOS !== 'android' || typeof Notifications.setNotificationChannelAsync !== 'function') {
    return;
  }

  await Notifications.setNotificationChannelAsync(ANDROID_REMINDER_CHANNEL_ID, {
    name: i18n.t('notification.channelName', 'Nearby reminders'),
    description: i18n.t(
      'notification.channelDescription',
      'Location-based reminders for notes you saved in Noto.'
    ),
    importance: Notifications.AndroidImportance.HIGH,
    enableVibrate: true,
    showBadge: false,
    vibrationPattern: [0, 250, 200, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

export function buildReminderNotificationContent(
  {
    title,
    body,
    noteId,
  }: {
    title: string;
    body: string;
    noteId: string;
  },
  platformOS = Platform.OS
): Notifications.NotificationContentInput {
  const content: ReminderNotificationContent = {
    title,
    body,
    data: { noteId },
  };

  if (platformOS === 'android') {
    content.channelId = ANDROID_REMINDER_CHANNEL_ID;
  }

  return content;
}
