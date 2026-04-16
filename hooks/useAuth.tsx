import type { Session } from '@supabase/supabase-js';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import {
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
  isGoogleSigninConfigured,
} from '../constants/auth';
import i18n from '../constants/i18n';
import {
  LOCAL_NOTES_SCOPE,
  migrateLocalNotesScopeToUser,
  setActiveNotesScope,
} from '../services/database';
import { purgeLocalAccountScope } from '../services/accountCleanup';
import { updateOwnUsername, updateOwnPhotoURL, upsertPublicUserProfile } from '../services/publicProfileService';
import { clearSharedFeedCache } from '../services/sharedFeedCache';
import { unregisterCurrentSocialPushToken } from '../services/socialPushService';
import { AppUser, deriveUsernameCandidate, mapSupabaseUser } from '../utils/appUser';
import { getSupabase, getSupabaseErrorMessage, hasSupabaseConfig } from '../utils/supabase';

export interface AuthActionResult {
  status: 'success' | 'cancelled' | 'unavailable' | 'error';
  message?: string;
  shouldOpenHelpLink?: boolean;
  requiresEmailConfirmation?: boolean;
}

export interface EmailRegistrationInput {
  email: string;
  password: string;
  displayName?: string | null;
}

interface AuthContextValue {
  user: AppUser | null;
  isReady: boolean;
  isAuthAvailable: boolean;
  isGoogleAvailable: boolean;
  signInWithGoogle: () => Promise<AuthActionResult>;
  signInWithEmail: (email: string, password: string) => Promise<AuthActionResult>;
  registerWithEmail: (input: EmailRegistrationInput) => Promise<AuthActionResult>;
  sendPasswordReset: (email: string) => Promise<AuthActionResult>;
  updateUsername: (username: string) => Promise<AuthActionResult>;
  updateAvatar: (photoURL: string | null) => Promise<AuthActionResult>;
  deleteAccount: () => Promise<AuthActionResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function isSupportedPlatform() {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

function isSupabaseAuthAvailable() {
  return isSupportedPlatform() && hasSupabaseConfig();
}

function isGoogleAuthAvailable() {
  return isSupabaseAuthAvailable() && isGoogleSigninConfigured;
}

function getUnavailableResult(provider: 'auth' | 'google'): AuthActionResult {
  if (!isSupportedPlatform()) {
    return {
      status: 'unavailable',
      message: i18n.t(
        'auth.unavailablePlatform',
        'Account sign-in is unavailable on this platform in the current build.'
      ),
    };
  }

  if (!hasSupabaseConfig()) {
    return {
      status: 'unavailable',
      message: i18n.t('auth.unavailableFirebase', 'Account sign-in is unavailable right now.'),
    };
  }

  if (provider === 'google' && !isGoogleSigninConfigured) {
    return {
      status: 'unavailable',
      message: i18n.t('auth.googleUnavailable', 'Google sign-in is unavailable right now.'),
    };
  }

  return {
    status: 'unavailable',
    message: i18n.t('auth.unavailableGeneric', 'Account sign-in is unavailable right now.'),
  };
}

async function clearAuthenticatedUserState(
  currentUserUid: string | null,
  setUser: (nextUser: AppUser | null) => void,
  invalidateAuthSyncRequests: () => void
) {
  invalidateAuthSyncRequests();
  setActiveNotesScope(LOCAL_NOTES_SCOPE);
  setUser(null);
  await clearSharedFeedCache(currentUserUid).catch(() => undefined);
}

async function purgeAuthenticatedUserState(currentUserUid: string | null) {
  await purgeLocalAccountScope(currentUserUid).catch((error) => {
    console.warn('[auth] Failed to purge local account data:', error);
  });
}

function normalizeGoogleIdToken(response: unknown) {
  if (typeof response !== 'object' || !response) {
    return null;
  }

  if ('data' in response) {
    const data = (response as { data?: { idToken?: string | null } }).data;
    return data?.idToken ?? null;
  }

  if ('idToken' in response) {
    return (response as { idToken?: string | null }).idToken ?? null;
  }

  return null;
}

function isCancelledGoogleResponse(response: unknown) {
  return Boolean(
    typeof response === 'object' &&
      response &&
      'type' in response &&
      String((response as { type?: string }).type) === 'cancelled'
  );
}

function getAuthErrorCode(error: unknown) {
  if (typeof error === 'object' && error && 'code' in error) {
    return String((error as { code?: string }).code ?? '').trim();
  }

  return '';
}

function getAuthErrorDebugSuffix(error: unknown) {
  const code = getAuthErrorCode(error);
  const message = getSupabaseErrorMessage(error).trim();
  const details: string[] = [];

  if (code) {
    details.push(`code: ${code}`);
  }

  if (message && (!code || !message.toLowerCase().includes(code.toLowerCase()))) {
    details.push(message);
  }

  return details.length > 0 ? ` (${details.join(' | ')})` : '';
}

function mapAuthErrorMessage(error: unknown) {
  const code = getAuthErrorCode(error);
  const message = getSupabaseErrorMessage(error);
  const normalizedMessage = message.toLowerCase();

  if (
    code === 'email_address_invalid' ||
    normalizedMessage.includes('invalid email') ||
    normalizedMessage.includes('unable to validate email')
  ) {
    return i18n.t('auth.errorInvalidEmail', 'Enter a valid email address.');
  }

  if (
    code === 'invalid_credentials' ||
    normalizedMessage.includes('invalid login credentials') ||
    normalizedMessage.includes('email not confirmed')
  ) {
    return i18n.t('auth.errorWrongCredentials', 'The email or password is incorrect.');
  }

  if (
    code === 'user_already_exists' ||
    normalizedMessage.includes('already registered') ||
    normalizedMessage.includes('already been registered')
  ) {
    return i18n.t('auth.errorEmailInUse', 'That email is already being used by another account.');
  }

  if (normalizedMessage.includes('password should be at least')) {
    return i18n.t('auth.errorWeakPassword', 'Choose a password with at least 6 characters.');
  }

  if (
    code === 'over_request_rate_limit' ||
    normalizedMessage.includes('rate limit') ||
    normalizedMessage.includes('too many requests')
  ) {
    return i18n.t('auth.errorTooManyRequests', 'Too many attempts right now. Please try again in a bit.');
  }

  if (normalizedMessage.includes('network') || normalizedMessage.includes('fetch')) {
    return i18n.t('auth.errorNetwork', 'Check your connection and try again.');
  }

  if (code === statusCodes.IN_PROGRESS) {
    return i18n.t('auth.errorInProgress', 'Sign-in is already in progress.');
  }

  if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
    return i18n.t(
      'auth.errorPlayServices',
      'Google Play Services are unavailable on this device.'
    );
  }

  if (code === 'DEVELOPER_ERROR' || code === '10' || code === '12500') {
    return (
      i18n.t(
      'auth.errorGoogleConfig',
      'Google sign-in is not configured correctly for this build yet.'
      ) + getAuthErrorDebugSuffix(error)
    );
  }

  if (message) {
    return `${message}${code && !message.includes(code) ? ` (code: ${code})` : ''}`;
  }

  return i18n.t('auth.errorGeneric', 'Unable to sign in right now. Please try again later.');
}

function mapUsernameErrorMessage(error: unknown) {
  const code = getAuthErrorCode(error);
  const message = getSupabaseErrorMessage(error).toLowerCase();

  if (code === '23505' || message.includes('duplicate key') || message.includes('already exists')) {
    return i18n.t('profile.usernameTaken', 'That username is already taken.');
  }

  if (message.includes('only be changed once')) {
    return i18n.t('profile.usernameLocked', 'You can only change your username once.');
  }

  if (message.includes('20 characters or fewer')) {
    return i18n.t('profile.usernameTooLong', 'Use 20 characters or fewer.');
  }

  if (message.includes('lowercase letters, numbers, periods, or underscores')) {
    return i18n.t(
      'profile.usernameInvalid',
      'Use only lowercase letters, numbers, periods, or underscores.'
    );
  }

  if (message.includes('required')) {
    return i18n.t('profile.usernameRequired', 'Enter a username.');
  }

  return i18n.t('profile.usernameSaveFailed', 'We could not update your username right now.');
}

async function getErrorMessageFromResponseContext(error: unknown) {
  if (typeof error !== 'object' || !error || !('context' in error)) {
    return null;
  }

  const response = (error as {
    context?: {
      clone?: () => { json?: () => Promise<unknown>; text?: () => Promise<string> };
      json?: () => Promise<unknown>;
      text?: () => Promise<string>;
    };
  }).context;

  if (!response || typeof response !== 'object') {
    return null;
  }

  const readableResponse =
    typeof response.clone === 'function' ? response.clone() : response;

  try {
    if (typeof readableResponse.json === 'function') {
      const payload = await readableResponse.json();
      if (typeof payload === 'string' && payload.trim()) {
        return payload.trim();
      }

      if (
        typeof payload === 'object' &&
        payload &&
        'error' in payload &&
        typeof (payload as { error?: unknown }).error === 'string' &&
        (payload as { error: string }).error.trim()
      ) {
        return (payload as { error: string }).error.trim();
      }
    }
  } catch {
    // Fall back to text when the response body is not JSON.
  }

  try {
    if (typeof readableResponse.text === 'function') {
      const payload = await readableResponse.text();
      if (payload.trim()) {
        return payload.trim();
      }
    }
  } catch {
    // Ignore unreadable response bodies and fall back to the error message.
  }

  return null;
}

async function mapDeleteAccountErrorResult(error: unknown): Promise<AuthActionResult> {
  const responseMessage = await getErrorMessageFromResponseContext(error);
  const message = (responseMessage ?? getSupabaseErrorMessage(error)).trim();
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes('recent sign-in required') ||
    normalizedMessage.includes('sign in again before deleting')
  ) {
    return {
      status: 'error',
      message: i18n.t(
        'profile.deleteAccountRecentSignIn',
        'For your security, sign out and sign back in before deleting this account.'
      ),
    };
  }

  if (
    normalizedMessage.includes('delete account function is not configured') ||
    normalizedMessage.includes('account deletion is not configured') ||
    normalizedMessage.includes('function not found') ||
    normalizedMessage.includes('not found')
  ) {
    return {
      status: 'error',
      message: i18n.t(
        'profile.deleteAccountNotReady',
        'Account deletion is not configured for this build yet. Please contact support.'
      ),
      shouldOpenHelpLink: true,
    };
  }

  if (
    normalizedMessage.includes('edge function returned a non-2xx status code') ||
    normalizedMessage.includes('failed to send a request to the edge function') ||
    normalizedMessage.includes('relay error invoking the edge function')
  ) {
    return {
      status: 'error',
      message: i18n.t(
        'profile.deleteAccountFailed',
        'We could not delete your account right now. Please try again in a moment.'
      ),
    };
  }

  return {
    status: 'error',
    message:
      message ||
      i18n.t(
        'profile.deleteAccountFailed',
        'We could not delete your account right now. Please try again in a moment.'
      ),
  };
}

type SessionSyncFailureCode = 'none' | 'migration_failed';

const SESSION_SYNC_MIGRATION_FAILED = 'session-sync-migration-failed';

function createSessionSyncError(code: Exclude<SessionSyncFailureCode, 'none'>, cause?: unknown) {
  const error = new Error(SESSION_SYNC_MIGRATION_FAILED) as Error & {
    sessionSyncFailureCode?: Exclude<SessionSyncFailureCode, 'none'>;
    cause?: unknown;
  };
  error.sessionSyncFailureCode = code;
  error.cause = cause;
  return error;
}

function getSessionSyncFailureCode(error: unknown): SessionSyncFailureCode {
  if (
    typeof error === 'object' &&
    error &&
    'sessionSyncFailureCode' in error &&
    (error as { sessionSyncFailureCode?: unknown }).sessionSyncFailureCode === 'migration_failed'
  ) {
    return 'migration_failed';
  }

  return 'none';
}

function getSessionSyncFailureMessage(code: SessionSyncFailureCode) {
  if (code === 'migration_failed') {
    return i18n.t(
      'auth.localMigrationFailed',
      'We could not move your local notes into this account right now. Your notes are still on this device. Please try signing in again.'
    );
  }

  return i18n.t(
    'auth.continueFailed',
    'We could not finish setup right now. Please try again.'
  );
}

async function syncUserProfile(session: Session | null) {
  const user = mapSupabaseUser(session?.user);
  if (!user) {
    setActiveNotesScope(LOCAL_NOTES_SCOPE);
    return null;
  }

  try {
    await migrateLocalNotesScopeToUser(user.uid);
  } catch (error) {
    console.warn('[auth] Failed to migrate local notes scope:', error);
    throw createSessionSyncError('migration_failed', error);
  }

  setActiveNotesScope(user.uid);

  return user;
}

function mergeUserWithPublicProfile(user: AppUser, profile: {
  displayName: string | null;
  username: string | null;
  usernameSetAt: string | null;
  photoURL: string | null;
}) {
  return {
    ...user,
    displayName: profile.displayName ?? user.displayName,
    username: profile.username ?? user.username ?? null,
    usernameSetAt: profile.usernameSetAt ?? user.usernameSetAt ?? null,
    photoURL: profile.photoURL ?? user.photoURL ?? null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isReady, setIsReady] = useState(() => !isSupportedPlatform());
  const authLoadRequestIdRef = useRef(0);
  const authSessionSyncRequestIdRef = useRef(0);
  const inFlightSessionSyncRef = useRef<{
    key: string;
    promise: Promise<AppUser | null>;
  } | null>(null);
  const userRef = useRef<AppUser | null>(user);
  userRef.current = user;
  const sessionSyncFailureRef = useRef<SessionSyncFailureCode>('none');

  const invalidateAuthLoadRequests = useCallback(() => {
    authLoadRequestIdRef.current += 1;
    return authLoadRequestIdRef.current;
  }, []);

  const invalidateAuthSessionSyncRequests = useCallback(() => {
    authSessionSyncRequestIdRef.current += 1;
    return authSessionSyncRequestIdRef.current;
  }, []);

  const invalidateAuthRequests = useCallback(() => {
    invalidateAuthLoadRequests();
    return invalidateAuthSessionSyncRequests();
  }, [invalidateAuthLoadRequests, invalidateAuthSessionSyncRequests]);

  const applySignedOutState = useCallback(() => {
    setActiveNotesScope(LOCAL_NOTES_SCOPE);
    setUser(null);
    setIsReady(true);
  }, []);

  const getSessionSyncKey = useCallback((session: Session | null) => {
    const accessToken = session?.access_token?.trim();
    if (accessToken) {
      return `token:${accessToken}`;
    }

    const userId = session?.user?.id?.trim();
    if (userId) {
      return `user:${userId}`;
    }

    return 'signed-out';
  }, []);

  const reconcileUserProfile = useCallback(
    async (nextUser: AppUser | null, requestId: number) => {
      if (!nextUser) {
        return null;
      }

      try {
        const profile = await upsertPublicUserProfile({
          userUid: nextUser.id,
          displayName: nextUser.displayName,
          username: nextUser.username,
          email: nextUser.email,
          photoURL: nextUser.photoURL ?? undefined,
        });

        if (!profile || authSessionSyncRequestIdRef.current !== requestId) {
          return nextUser;
        }

        return mergeUserWithPublicProfile(nextUser, profile);
      } catch (error) {
        console.warn('[auth] Profile reconciliation failed:', error);
        return nextUser;
      }
    },
    []
  );

  const startAuthSessionSync = useCallback(
    async (session: Session | null, errorContext: string) => {
      const syncKey = getSessionSyncKey(session);
      if (inFlightSessionSyncRef.current?.key === syncKey) {
        return inFlightSessionSyncRef.current.promise;
      }

      const requestId = invalidateAuthSessionSyncRequests();
      sessionSyncFailureRef.current = 'none';

      const syncPromise = (async () => {
        try {
          if (authSessionSyncRequestIdRef.current !== requestId) {
            return null;
          }

          if (!session) {
            await unregisterCurrentSocialPushToken().catch(() => undefined);
          }

          if (authSessionSyncRequestIdRef.current !== requestId) {
            return null;
          }

          const nextUser = await syncUserProfile(session);
          if (authSessionSyncRequestIdRef.current !== requestId) {
            return null;
          }

          const reconciledUser = await reconcileUserProfile(nextUser, requestId);
          if (authSessionSyncRequestIdRef.current !== requestId) {
            return null;
          }

          setUser(reconciledUser);
          setIsReady(true);
          return reconciledUser;
        } catch (error) {
          console.warn(`[auth] Failed to ${errorContext}:`, error);
          if (authSessionSyncRequestIdRef.current !== requestId) {
            return null;
          }

          const syncFailureCode = getSessionSyncFailureCode(error);
          if (syncFailureCode !== 'none') {
            sessionSyncFailureRef.current = syncFailureCode;
            applySignedOutState();
            return null;
          }

          const fallbackUser = mapSupabaseUser(session?.user);
          setActiveNotesScope(fallbackUser?.uid ?? LOCAL_NOTES_SCOPE);
          setUser(fallbackUser);
          setIsReady(true);
          return fallbackUser;
        }
      })().finally(() => {
        if (
          inFlightSessionSyncRef.current?.key === syncKey &&
          inFlightSessionSyncRef.current.promise === syncPromise
        ) {
          inFlightSessionSyncRef.current = null;
        }
      });

      inFlightSessionSyncRef.current = {
        key: syncKey,
        promise: syncPromise,
      };

      return syncPromise;
    },
    [applySignedOutState, getSessionSyncKey, invalidateAuthSessionSyncRequests, reconcileUserProfile]
  );

  const reloadAuthSession = useCallback(
    async (
      errorContext: string,
      options?: {
        retryCount?: number;
      }
    ) => {
      const supabase = getSupabase();
      if (!isSupportedPlatform() || !supabase) {
        setIsReady(true);
        return null;
      }

      const requestId = invalidateAuthLoadRequests();
      const retryCount = options?.retryCount ?? 0;

      const loadSession = async (remainingRetries: number): Promise<AppUser | null> => {
        try {
          const { data, error } = await supabase.auth.getSession();
          if (error) {
            throw error;
          }

          if (authLoadRequestIdRef.current !== requestId) {
            return null;
          }

          return await startAuthSessionSync(data.session ?? null, errorContext);
        } catch (error) {
          console.warn(`[auth] Failed to ${errorContext}:`, error);
          if (authLoadRequestIdRef.current !== requestId) {
            return null;
          }

          if (!userRef.current && remainingRetries > 0) {
            return loadSession(remainingRetries - 1);
          }

          const fallbackUser = userRef.current;
          if (fallbackUser) {
            setActiveNotesScope(fallbackUser.uid);
            setUser(fallbackUser);
            setIsReady(true);
            return fallbackUser;
          }

          applySignedOutState();
          return null;
        }
      };

      return loadSession(retryCount);
    },
    [applySignedOutState, invalidateAuthLoadRequests, startAuthSessionSync]
  );

  useEffect(() => {
    if (!isSupportedPlatform() || !isGoogleSigninConfigured) {
      return;
    }

    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      iosClientId: GOOGLE_IOS_CLIENT_ID,
    });
  }, []);

  useEffect(() => {
    setActiveNotesScope(LOCAL_NOTES_SCOPE);

    const supabase = getSupabase();
    if (!isSupportedPlatform() || !supabase) {
      setIsReady(true);
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      invalidateAuthLoadRequests();
      void startAuthSessionSync(session, 'sync auth state');
    });

    void reloadAuthSession('load Supabase session', { retryCount: 1 });

    return () => {
      subscription.unsubscribe();
    };
  }, [invalidateAuthLoadRequests, reloadAuthSession, startAuthSessionSync]);

  useEffect(() => {
    if (!isSupportedPlatform() || !isSupabaseAuthAvailable()) {
      return;
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        return;
      }

      void reloadAuthSession('refresh Supabase session');
    });

    return () => {
      subscription.remove();
    };
  }, [reloadAuthSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isReady,
      isAuthAvailable: isSupabaseAuthAvailable(),
      isGoogleAvailable: isGoogleAuthAvailable(),
      signInWithGoogle: async () => {
        if (!isGoogleAuthAvailable()) {
          return getUnavailableResult('google');
        }

        const supabase = getSupabase();
        if (!supabase) {
          return getUnavailableResult('auth');
        }

        try {
          if (Platform.OS === 'android') {
            await GoogleSignin.hasPlayServices();
          }

          const response = await GoogleSignin.signIn().catch((error: unknown) => {
            console.warn('[auth] Google native sign-in failed:', {
              platform: Platform.OS,
              code: getAuthErrorCode(error),
              message: getSupabaseErrorMessage(error),
              error,
            });
            throw error;
          });
          if (isCancelledGoogleResponse(response)) {
            return { status: 'cancelled' };
          }

          const idToken = normalizeGoogleIdToken(response);
          if (!idToken) {
            return {
              status: 'error',
              message: i18n.t(
                'auth.errorMissingGoogleToken',
                'Google sign-in could not be completed. Please try again.'
              ),
            };
          }

          const { data, error } = await supabase.auth
            .signInWithIdToken({
              provider: 'google',
              token: idToken,
            })
            .catch((authError: unknown) => {
              console.warn('[auth] Supabase Google token exchange threw:', {
                code: getAuthErrorCode(authError),
                message: getSupabaseErrorMessage(authError),
                error: authError,
              });
              throw authError;
            });
          if (error) {
            console.warn('[auth] Supabase Google token exchange failed:', {
              code: getAuthErrorCode(error),
              message: getSupabaseErrorMessage(error),
              error,
            });
            throw error;
          }

          invalidateAuthLoadRequests();
          const nextUser = await startAuthSessionSync(data.session ?? null, 'sync auth state');
          if (data.session && !nextUser) {
            return {
              status: 'error',
              message: getSessionSyncFailureMessage(sessionSyncFailureRef.current),
            };
          }

          return { status: 'success' };
        } catch (error: unknown) {
          if (typeof error === 'object' && error && 'code' in error) {
            const code = String((error as { code?: string }).code);
            if (code === statusCodes.SIGN_IN_CANCELLED) {
              return { status: 'cancelled' };
            }
          }

          return {
            status: 'error',
            message: mapAuthErrorMessage(error),
          };
        }
      },
      signInWithEmail: async (email: string, password: string) => {
        if (!isSupabaseAuthAvailable()) {
          return getUnavailableResult('auth');
        }

        const supabase = getSupabase();
        if (!supabase) {
          return getUnavailableResult('auth');
        }

        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
          if (error) {
            throw error;
          }

          invalidateAuthLoadRequests();
          const nextUser = await startAuthSessionSync(data.session ?? null, 'sync auth state');
          if (data.session && !nextUser) {
            return {
              status: 'error',
              message: getSessionSyncFailureMessage(sessionSyncFailureRef.current),
            };
          }

          return { status: 'success' };
        } catch (error) {
          return {
            status: 'error',
            message: mapAuthErrorMessage(error),
          };
        }
      },
      registerWithEmail: async ({ email, password, displayName }) => {
        if (!isSupabaseAuthAvailable()) {
          return getUnavailableResult('auth');
        }

        const supabase = getSupabase();
        if (!supabase) {
          return getUnavailableResult('auth');
        }

        try {
          const trimmedName = displayName?.trim() || null;
          const usernameCandidate = deriveUsernameCandidate(email);
          const { data, error } = await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              data: {
                display_name: trimmedName,
                displayName: trimmedName,
                username: usernameCandidate,
              },
            },
          });
          if (error) {
            throw error;
          }

          invalidateAuthLoadRequests();
          const nextUser = await startAuthSessionSync(data.session ?? null, 'sync auth state');
          if (data.session && !nextUser) {
            return {
              status: 'error',
              message: getSessionSyncFailureMessage(sessionSyncFailureRef.current),
            };
          }

          if (!data.session) {
            return {
              status: 'success',
              message: i18n.t(
                'auth.registerEmailConfirmation',
                'Check your email to confirm your account before signing in.'
              ),
              requiresEmailConfirmation: true,
            };
          }
          return { status: 'success' };
        } catch (error) {
          return {
            status: 'error',
            message: mapAuthErrorMessage(error),
          };
        }
      },
      sendPasswordReset: async (email: string) => {
        if (!isSupabaseAuthAvailable()) {
          return getUnavailableResult('auth');
        }

        const supabase = getSupabase();
        if (!supabase) {
          return getUnavailableResult('auth');
        }

        try {
          const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
            redirectTo: undefined,
          });
          if (error) {
            throw error;
          }

          return { status: 'success' };
        } catch (error) {
          return {
            status: 'error',
            message: mapAuthErrorMessage(error),
          };
        }
      },
      updateUsername: async (username: string) => {
        if (!isSupabaseAuthAvailable()) {
          return getUnavailableResult('auth');
        }

        if (!user) {
          return {
            status: 'unavailable',
            message: i18n.t('profile.usernameUnavailable', 'Sign in to update your username.'),
          };
        }

        try {
          const profile = await updateOwnUsername({
            userUid: user.id,
            username,
          });

          setUser((currentUser) =>
            currentUser
              ? {
                  ...currentUser,
                  username: profile.username,
                  usernameSetAt: profile.usernameSetAt,
                }
              : currentUser
          );

          return { status: 'success' };
        } catch (error) {
          return {
            status: 'error',
            message: mapUsernameErrorMessage(error),
          };
        }
      },
      updateAvatar: async (photoURL: string | null) => {
        if (!isSupabaseAuthAvailable()) {
          return getUnavailableResult('auth');
        }

        if (!user) {
          return {
            status: 'unavailable',
            message: i18n.t('profile.avatarUnavailable', 'Sign in to update your avatar.'),
          };
        }

        try {
          const profile = await updateOwnPhotoURL({
            userUid: user.id,
            photoURL,
          });

          setUser((currentUser) =>
            currentUser
              ? {
                  ...currentUser,
                  photoURL: profile.photoURL,
                }
              : currentUser
          );

          return { status: 'success' };
        } catch (error) {
          return {
            status: 'error',
            message: i18n.t(
              'profile.avatarSaveFailed',
              'We could not update your avatar right now.'
            ),
          };
        }
      },
      deleteAccount: async () => {
        if (!isSupabaseAuthAvailable()) {
          return getUnavailableResult('auth');
        }

        const supabase = getSupabase();
        if (!supabase) {
          return getUnavailableResult('auth');
        }

        if (!user) {
          return {
            status: 'unavailable',
            message: i18n.t('profile.deleteAccountUnavailable', 'Sign in to delete this account.'),
          };
        }

        try {
          const { data, error } = await supabase.functions.invoke('delete-account', {
            body: {},
          });
          if (error) {
            throw error;
          }

          if (
            data &&
            typeof data === 'object' &&
            'success' in data &&
            (data as { success?: boolean }).success === false
          ) {
            throw new Error(
              typeof (data as { error?: unknown }).error === 'string'
                ? (data as { error?: string }).error
                : 'Could not delete this account right now.'
            );
          }

          try {
            await GoogleSignin.signOut();
          } catch {
            // Ignore Google sign-out failures after the account is already deleted.
          }

          await supabase.auth.signOut().catch(() => undefined);
          await unregisterCurrentSocialPushToken().catch(() => undefined);
          await clearAuthenticatedUserState(user.uid, setUser, invalidateAuthRequests);
          await purgeAuthenticatedUserState(user.uid);
          return { status: 'success' };
        } catch (error) {
          return mapDeleteAccountErrorResult(error);
        }
      },
      signOut: async () => {
        const supabase = getSupabase();
        const currentUserUid = user?.uid ?? null;
        let signOutError: unknown = null;

        try {
          await GoogleSignin.signOut();
        } catch {
          // Ignore Google sign-out failures and still clear the Supabase session.
        }

        try {
          if (supabase) {
            const { error } = await supabase.auth.signOut();
            if (error) {
              throw error;
            }
          }
        } catch (error) {
          signOutError = error;
        }

        if (signOutError) {
          throw signOutError;
        }

        await unregisterCurrentSocialPushToken().catch(() => undefined);
        await clearAuthenticatedUserState(currentUserUid, setUser, invalidateAuthRequests);
      },
    }),
    [invalidateAuthLoadRequests, invalidateAuthRequests, isReady, startAuthSessionSync, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
