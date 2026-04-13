import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getPersistentItem, removePersistentItem, setPersistentItem } from '../utils/appStorage';
import { AppUser } from '../utils/appUser';
import {
  getSupabaseAnonKey,
  getSupabaseUrl,
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

function isFunctionsHttpStatus(error: unknown, status: number) {
  if (typeof error !== 'object' || !error || !('context' in error)) {
    return false;
  }

  const context = (error as { context?: { status?: unknown } }).context;
  return Number(context?.status) === status;
}

async function invokeSocialNotificationByFetch(options: {
  accessToken: string;
  event: SocialNotificationEvent;
}) {
  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase function endpoint is not configured.');
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/send-social-notifications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${options.accessToken}`,
    },
    body: JSON.stringify(options.event),
  });

  const responseText = await response.text();
  let data: SocialNotificationResponse | null = null;

  try {
    data = responseText ? (JSON.parse(responseText) as SocialNotificationResponse) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : responseText || `Edge function returned ${response.status}.`
    );
  }

  return data;
}

async function getFreshSupabaseAccessToken(
  supabase: NonNullable<ReturnType<typeof getSupabase>>
) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw sessionError;
  }

  const currentSession = sessionData.session;
  const expiresAtMs = (currentSession?.expires_at ?? 0) * 1000;
  const shouldRefresh = !currentSession?.access_token || expiresAtMs <= Date.now() + 60_000;

  if (!shouldRefresh) {
    return currentSession.access_token;
  }

  const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) {
    throw refreshError;
  }

  return refreshedData.session?.access_token ?? null;
}

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
    console.warn('[social-push] Supabase client unavailable; skipping social notification event.', {
      type: event.type,
    });
    return;
  }

  const accessToken = await getFreshSupabaseAccessToken(supabase).catch((sessionError) => {
    console.warn('[social-push] Failed to load a fresh Supabase access token before invoking edge function.', {
      type: event.type,
      sessionError,
    });
    return null;
  });

  const functionsClient = supabase.functions;
  if (accessToken) {
    functionsClient.setAuth(accessToken);
  }

  const { data, error } = await functionsClient.invoke('send-social-notifications', {
    body: event,
    headers: accessToken
      ? {
          Authorization: `Bearer ${accessToken}`,
        }
      : undefined,
  });

  if (error && isFunctionsHttpStatus(error, 401) && accessToken) {
    console.warn('[social-push] Functions client returned 401; retrying edge function with direct fetch.', {
      type: event.type,
    });

    const fetchedData = await invokeSocialNotificationByFetch({
      accessToken,
      event,
    });

    console.log('[social-push] direct fetch send-social-notifications response:', {
      type: event.type,
      success:
        fetchedData &&
        typeof fetchedData === 'object' &&
        'success' in fetchedData &&
        typeof (fetchedData as { success?: unknown }).success === 'boolean'
          ? (fetchedData as { success: boolean }).success
          : null,
    });

    if (
      fetchedData &&
      typeof fetchedData === 'object' &&
      'success' in fetchedData &&
      fetchedData.success === false
    ) {
      throw new Error(
        typeof fetchedData.error === 'string'
          ? fetchedData.error
          : 'Could not send this notification right now.'
      );
    }

    return;
  }

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
        type: event.type,
        recipients: response.recipients ?? 0,
        delivered: response.delivered ?? 0,
      });
    }
  }
}

export function getSocialPushErrorMessage(error: unknown) {
  return getSupabaseErrorMessage(error) || 'Social notifications are unavailable right now.';
}
