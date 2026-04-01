import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getPersistentItem, removePersistentItem, setPersistentItem } from '../utils/appStorage';
import { AppUser } from '../utils/appUser';
import { getSupabase, getSupabaseErrorMessage, hasSupabaseConfig } from '../utils/supabase';

const PUSH_REGISTRATION_STORAGE_KEY = 'notification.socialPushRegistration.v1';

type PersistedPushRegistration = {
  token: string;
  userId: string;
};

export type SocialNotificationEvent =
  | {
      type: 'friend_accepted';
      friendUserId: string;
    }
  | {
      type: 'shared_post_created';
      postId: string;
    };

type SocialNotificationResponse =
  | {
      success: true;
      recipients?: number;
      delivered?: number;
    }
  | {
      success: false;
      error: string;
    };

function isNativePlatform(platformOS = Platform.OS) {
  return platformOS === 'ios' || platformOS === 'android';
}

function getExpoProjectId() {
  const maybeExtra = Constants.expoConfig?.extra as
    | {
        eas?: {
          projectId?: string;
        };
      }
    | undefined;

  return Constants.easConfig?.projectId ?? maybeExtra?.eas?.projectId ?? '';
}

async function readPersistedRegistration(): Promise<PersistedPushRegistration | null> {
  try {
    const rawValue = await getPersistentItem(PUSH_REGISTRATION_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as Partial<PersistedPushRegistration>;
    if (
      typeof parsed?.token === 'string' &&
      parsed.token.trim() &&
      typeof parsed?.userId === 'string' &&
      parsed.userId.trim()
    ) {
      return {
        token: parsed.token.trim(),
        userId: parsed.userId.trim(),
      };
    }
  } catch {
    // Ignore malformed storage and refresh on next successful sync.
  }

  return null;
}

async function writePersistedRegistration(value: PersistedPushRegistration) {
  await setPersistentItem(PUSH_REGISTRATION_STORAGE_KEY, JSON.stringify(value));
}

function getAppVersion() {
  return Constants.expoConfig?.version?.trim() || null;
}

async function unregisterPushToken(token: string) {
  const supabase = getSupabase();
  if (!supabase || !token.trim()) {
    return;
  }

  const { error } = await supabase.rpc('unregister_push_token', {
    expo_push_token_input: token.trim(),
  });

  if (error) {
    throw error;
  }
}

export async function unregisterCurrentSocialPushToken() {
  const persisted = await readPersistedRegistration();
  if (!persisted) {
    return;
  }

  try {
    await unregisterPushToken(persisted.token);
  } finally {
    await removePersistentItem(PUSH_REGISTRATION_STORAGE_KEY).catch(() => undefined);
  }
}

export async function syncSocialPushRegistration(user: AppUser | null) {
  if (!isNativePlatform() || !hasSupabaseConfig()) {
    return;
  }

  const supabase = getSupabase();
  if (!supabase) {
    return;
  }

  const persisted = await readPersistedRegistration();

  if (!user) {
    if (persisted?.token) {
      await unregisterPushToken(persisted.token).catch(() => undefined);
    }
    await removePersistentItem(PUSH_REGISTRATION_STORAGE_KEY).catch(() => undefined);
    return;
  }

  const permissions = await Notifications.getPermissionsAsync();

  if (permissions.status !== 'granted') {
    if (persisted?.token) {
      await unregisterPushToken(persisted.token).catch(() => undefined);
      await removePersistentItem(PUSH_REGISTRATION_STORAGE_KEY).catch(() => undefined);
    }
    return;
  }

  const projectId = getExpoProjectId();
  if (!projectId) {
    console.warn('[social-push] Missing Expo project id; skipping push token registration.');
    return;
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
  const expoPushToken = tokenResponse.data?.trim() ?? '';

  if (!expoPushToken) {
    return;
  }

  if (persisted?.token && (persisted.token !== expoPushToken || persisted.userId !== user.uid)) {
    await unregisterPushToken(persisted.token).catch(() => undefined);
  }

  const { error } = await supabase.rpc('register_push_token', {
    expo_push_token_input: expoPushToken,
    platform_input: Platform.OS,
    app_version_input: getAppVersion(),
  });

  if (error) {
    throw error;
  }

  await writePersistedRegistration({
    token: expoPushToken,
    userId: user.uid,
  });
}

export async function sendSocialNotificationEvent(event: SocialNotificationEvent) {
  const supabase = getSupabase();
  if (!supabase) {
    return;
  }

  const { data, error } = await supabase.functions.invoke('send-social-notifications', {
    body: event,
  });

  if (error) {
    throw error;
  }

  if (
    data &&
    typeof data === 'object' &&
    'success' in data &&
    (data as SocialNotificationResponse).success === false
  ) {
    throw new Error(
      typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : 'Could not send this notification right now.'
    );
  }
}

export function getSocialPushErrorMessage(error: unknown) {
  return getSupabaseErrorMessage(error) || 'Social notifications are unavailable right now.';
}
