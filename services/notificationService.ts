import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import i18n from '../constants/i18n';
import { getPersistentItem, setPersistentItem } from '../utils/appStorage';

// Android channel sound settings are immutable after the channel is first created,
// so we version the id when fixing channel-level sound behavior.
export const ANDROID_REMINDER_CHANNEL_ID = 'reminders-v2';
export const ANDROID_SOCIAL_CHANNEL_ID = 'social-v1';
const REMINDER_VARIANT_CURSOR_STORAGE_KEY = 'notification.reminderVariantCursor.v1';

const DEFAULT_REMINDER_TITLES_WITH_LOCATION = {
  en: [
    'Back at {{location}}',
    '{{location}} remembers this one',
    'A saved note is waiting at {{location}}',
    'You just passed {{location}} again',
    '{{location}} has one of your stories',
  ],
  vi: [
    'Này, {{location}} quen không?',
    '{{location}} vẫn còn nhớ bạn',
    'Alo, {{location}} gọi',
    'Bạn vừa đi ngang {{location}}',
    '{{location}} có một ghi chú đang đợi bạn',
  ],
} as const;

const DEFAULT_REMINDER_TITLES_GENERIC = {
  en: [
    'A saved note is nearby',
    'Past you left a breadcrumb',
    'A little memory is nearby',
    'You just passed an old note',
    'Something you saved is waiting',
  ],
  vi: [
    'Alo, quá khứ gọi',
    'Bạn đang ở gần một ghi chú',
    'Có một mẩu ký ức ở gần đây',
    'Này, có gì đó đang đợi bạn',
    'Ghi chú cũ vừa vẫy tay',
  ],
} as const;

const DEFAULT_REMINDER_TEXT_BODIES = {
  en: [
    'A note from this place is waiting when you open Noto.',
    'Open Noto to see what you wanted to remember here.',
    'There is a saved note here if you want a quick reminder.',
    'A small memory from this place is ready when you are.',
    'Your past self left a note here for a reason.',
  ],
  vi: [
    'Có một ghi chú nhỏ đang đợi bạn mở lại.',
    'Một mẩu ký ức ở đây vừa gặp lại bạn.',
    'Mở Noto xem bạn từng để lại gì ở nơi này nhé.',
    'Có đôi dòng ngày trước đang chờ bạn.',
    'Nơi này vẫn giữ một ghi chú của bạn.',
  ],
} as const;

const DEFAULT_REMINDER_PHOTO_BODIES = {
  en: [
    'A memory from here is waiting.',
    'There is a photo memory from this place waiting for you.',
    'You left a little snapshot here.',
    'A saved moment from this place is ready to revisit.',
    'This place is holding on to one of your memories.',
  ],
  vi: [
    'Có một kỷ niệm từ nơi này đang chờ bạn.',
    'Nơi này còn giữ một khoảnh khắc của bạn.',
    'Bạn từng để lại một mẩu chuyện ở đây đó.',
    'Có một tấm ảnh cũ đang chờ được mở lại.',
    'Chỗ này vẫn còn nhớ một lần bạn đã ghé qua.',
  ],
} as const;

type ReminderNotificationContent = Notifications.NotificationContentInput & {
  channelId?: string;
};

type ReminderVariantLanguage = 'en' | 'vi';
type ReminderVariantCursorState = Record<string, number>;

function getReminderVariantLanguage(): ReminderVariantLanguage {
  const language = typeof i18n.language === 'string' ? i18n.language.toLowerCase() : '';
  return language.startsWith('vi') ? 'vi' : 'en';
}

function getTranslatedList(key: string, fallback: readonly string[]) {
  const translated = i18n.t(key, {
    returnObjects: true,
    defaultValue: [...fallback],
  });

  return Array.isArray(translated) && translated.every((item) => typeof item === 'string')
    ? translated
    : [...fallback];
}

function interpolateTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce((result, [key, value]) => {
    return result.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), value);
  }, template);
}

async function readReminderVariantCursorState() {
  try {
    const rawValue = await getPersistentItem(REMINDER_VARIANT_CURSOR_STORAGE_KEY);
    if (!rawValue) {
      return {};
    }

    const parsed = JSON.parse(rawValue) as ReminderVariantCursorState;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeReminderVariantCursorState(state: ReminderVariantCursorState) {
  try {
    await setPersistentItem(REMINDER_VARIANT_CURSOR_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore cursor persistence failures and fall back to the first variant.
  }
}

async function selectReminderVariant(scope: string, variants: string[]) {
  if (variants.length === 0) {
    return '';
  }

  const state = await readReminderVariantCursorState();
  const nextCursor = state[scope] ?? 0;
  const variant = variants[nextCursor % variants.length] ?? variants[0];

  state[scope] = nextCursor + 1;
  await writeReminderVariantCursorState(state);

  return variant;
}

function buildReminderVariantScope(parts: string[]) {
  return parts.join(':');
}

export async function buildNearbyReminderCopy(options: {
  noteType: 'text' | 'photo';
  locationName?: string | null;
  noteBody?: string | null;
}) {
  const language = getReminderVariantLanguage();
  const locationName = options.locationName?.trim() || '';
  const noteBody = options.noteBody?.trim() || '';
  const hasLocation = locationName.length > 0;

  const titleVariants = hasLocation
    ? getTranslatedList(
        'notification.titleVariantsWithLocation',
        DEFAULT_REMINDER_TITLES_WITH_LOCATION[language]
      ).map((template) => interpolateTemplate(template, { location: locationName }))
    : getTranslatedList('notification.titleVariantsGeneric', DEFAULT_REMINDER_TITLES_GENERIC[language]);

  const titleScope = buildReminderVariantScope([
    'title',
    language,
    hasLocation ? 'with-location' : 'generic',
  ]);
  const title =
    (await selectReminderVariant(titleScope, titleVariants)) ||
    (hasLocation ? locationName : i18n.t('notification.title'));

  if (noteBody) {
    return {
      title,
      body: noteBody,
    };
  }

  const bodyVariants =
    options.noteType === 'photo'
      ? getTranslatedList('notification.photoBodyVariants', DEFAULT_REMINDER_PHOTO_BODIES[language])
      : getTranslatedList('notification.textBodyVariants', DEFAULT_REMINDER_TEXT_BODIES[language]);

  const bodyScope = buildReminderVariantScope([
    'body',
    language,
    options.noteType,
    hasLocation ? 'with-location' : 'generic',
  ]);
  const body =
    (await selectReminderVariant(bodyScope, bodyVariants)) ||
    (options.noteType === 'photo' ? i18n.t('notification.photoBody') : i18n.t('notification.body'));

  return {
    title,
    body,
  };
}

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

  await Notifications.setNotificationChannelAsync(ANDROID_SOCIAL_CHANNEL_ID, {
    name: i18n.t('notification.socialChannelName', 'Friend activity'),
    description: i18n.t(
      'notification.socialChannelDescription',
      'Push notifications when friends accept invites or share moments with you.'
    ),
    importance: Notifications.AndroidImportance.HIGH,
    enableVibrate: true,
    showBadge: true,
    vibrationPattern: [0, 180, 120, 180],
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
    noteId?: string | null;
  },
  platformOS = Platform.OS
): Notifications.NotificationContentInput {
  const content: ReminderNotificationContent = {
    title,
    body,
    data: noteId ? { noteId } : {},
  };

  if (platformOS === 'android') {
    content.channelId = ANDROID_REMINDER_CHANNEL_ID;
  }

  return content;
}
