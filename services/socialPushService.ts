import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getPersistentItem, removePersistentItem, setPersistentItem } from '../utils/appStorage';
import { AppUser } from '../utils/appUser';
import {
  getSupabase,
  getSupabaseErrorMessage,
  hasSupabaseConfig,
  isSupabaseSchemaMismatchError,
} from '../utils/supabase';

const PUSH_REGISTRATION_STORAGE_KEY = 'notification.socialPushRegistration.v1';
const PUSH_INSTALLATION_ID_STORAGE_KEY = 'notification.socialPushInstallationId.v1';

type PersistedPushRegistration = {
  token: string;
  userId: string;
};

type SyncSocialPushRegistrationOptions = {
  requestPermission?: boolean;
};

export type SocialPushPermissionStatus =
  | 'granted'
  | 'denied'
  | 'blocked'
  | 'skipped';

export type SocialPushRegistrationStatus =
  | 'registered'
  | 'denied'
  | 'blocked'
  | 'skipped';

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

async function getPushInstallationId() {
  const existingInstallationId = (await getPersistentItem(PUSH_INSTALLATION_ID_STORAGE_KEY))?.trim() ?? '';
  if (existingInstallationId) {
    return existingInstallationId;
  }

  const nextInstallationId =
    typeof Crypto.randomUUID === 'function'
      ? Crypto.randomUUID()
      : `push-install-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  await setPersistentItem(PUSH_INSTALLATION_ID_STORAGE_KEY, nextInstallationId);
  return nextInstallationId;
}

function getAppVersion() {
  return Constants.expoConfig?.version?.trim() || null;
}

async function getSocialPushPermissions(options: { requestPermission?: boolean } = {}) {
  if (!isNativePlatform()) {
    return null;
  }

  let permissions = await Notifications.getPermissionsAsync();

  if (
    permissions.status !== 'granted' &&
    options.requestPermission &&
    permissions.canAskAgain !== false
  ) {
    permissions = await Notifications.requestPermissionsAsync();
  }

  return permissions;
}

export async function requestSocialPushPermission(): Promise<SocialPushPermissionStatus> {
  const permissions = await getSocialPushPermissions({ requestPermission: true });

  if (!permissions) {
    return 'skipped';
  }

  if (permissions.status === 'granted') {
    return 'granted';
  }

  return permissions.canAskAgain === false ? 'blocked' : 'denied';
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

async function clearPersistedRegistrationAfterSuccessfulUnregister(token: string) {
  await unregisterPushToken(token);
  await removePersistentItem(PUSH_REGISTRATION_STORAGE_KEY);
}

async function registerPushTokenWithCompatibilityFallback(
  supabase: NonNullable<ReturnType<typeof getSupabase>>,
  expoPushToken: string,
  installationId: string | null
) {
  const baseArgs = {
    expo_push_token_input: expoPushToken,
    platform_input: Platform.OS,
    app_version_input: getAppVersion(),
  };

  const nextArgs = installationId
    ? {
        ...baseArgs,
        installation_id_input: installationId,
      }
    : baseArgs;

  const nextResult = await supabase.rpc('register_push_token', nextArgs);
  if (!nextResult.error || !isSupabaseSchemaMismatchError(nextResult.error) || !installationId) {
    return nextResult;
  }

  return supabase.rpc('register_push_token', baseArgs);
}

export async function unregisterCurrentSocialPushToken() {
  const persisted = await readPersistedRegistration();
  if (!persisted) {
    return;
  }

  await clearPersistedRegistrationAfterSuccessfulUnregister(persisted.token);
}

export async function syncSocialPushRegistration(
  user: AppUser | null,
  options: SyncSocialPushRegistrationOptions = {}
): Promise<SocialPushRegistrationStatus> {
  if (!isNativePlatform() || !hasSupabaseConfig()) {
    return 'skipped';
  }

  const supabase = getSupabase();
  if (!supabase) {
    return 'skipped';
  }

  const persisted = await readPersistedRegistration();

  if (!user) {
    if (persisted?.token) {
      await clearPersistedRegistrationAfterSuccessfulUnregister(persisted.token);
      return 'skipped';
    }
    return 'skipped';
  }

  const permissions = await getSocialPushPermissions({
    requestPermission: options.requestPermission,
  });

  if (!permissions) {
    return 'skipped';
  }

  if (permissions.status !== 'granted') {
    if (persisted?.token) {
      await clearPersistedRegistrationAfterSuccessfulUnregister(persisted.token);
    }
    return permissions.canAskAgain === false ? 'blocked' : 'denied';
  }

  const projectId = getExpoProjectId();
  if (!projectId) {
    console.warn('[social-push] Missing Expo project id; skipping push token registration.');
    return 'skipped';
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
  const expoPushToken = tokenResponse.data?.trim() ?? '';

  if (!expoPushToken) {
    return 'skipped';
  }

  const installationId = await getPushInstallationId();

  if (persisted?.token && (persisted.token !== expoPushToken || persisted.userId !== user.uid)) {
    await clearPersistedRegistrationAfterSuccessfulUnregister(persisted.token);
  }

  const { error } = await registerPushTokenWithCompatibilityFallback(
    supabase,
    expoPushToken,
    installationId
  );

  if (error) {
    throw error;
  }

  await writePersistedRegistration({
    token: expoPushToken,
    userId: user.uid,
  });

  return 'registered';
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

  if (
    data &&
    typeof data === 'object' &&
    'success' in data &&
    (data as SocialNotificationResponse).success === true
  ) {
    const response = data as Extract<SocialNotificationResponse, { success: true }>;
    if ((response.recipients ?? 0) > 0 && (response.delivered ?? 0) === 0) {
      console.warn('[social-push] Notification request completed without any delivered devices.', {
        event,
        recipients: response.recipients ?? 0,
        delivered: response.delivered ?? 0,
      });
    }
  }
}

export function getSocialPushErrorMessage(error: unknown) {
  return getSupabaseErrorMessage(error) || 'Social notifications are unavailable right now.';
}
