import type { Session } from '@supabase/supabase-js';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
  isGoogleSigninConfigured,
} from '../constants/auth';
import i18n from '../constants/i18n';
import {
  getPersistedActiveNotesScopeSync,
  LOCAL_NOTES_SCOPE,
  migrateLocalNotesScopeToUser,
  setActiveNotesScope,
} from '../services/database';
import { purgeLocalAccountScope } from '../services/accountCleanup';
import { updateOwnUsername, upsertPublicUserProfile } from '../services/publicProfileService';
import { clearSharedFeedCache } from '../services/sharedFeedCache';
import { unregisterCurrentSocialPushToken } from '../services/socialPushService';
import { AppUser, deriveUsernameCandidate, mapSupabaseUser } from '../utils/appUser';
import { getSupabase, getSupabaseErrorMessage, hasSupabaseConfig } from '../utils/supabase';

export interface AuthActionResult {
  status: 'success' | 'cancelled' | 'unavailable' | 'error';
  message?: string;
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

function getStoredNotesScope() {
  return getPersistedActiveNotesScopeSync() ?? LOCAL_NOTES_SCOPE;
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
  }

  setActiveNotesScope(user.uid);

  return user;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isReady, setIsReady] = useState(() => !isSupportedPlatform());
  const authSyncRequestIdRef = useRef(0);

  const invalidateAuthSyncRequests = useCallback(() => {
    authSyncRequestIdRef.current += 1;
    return authSyncRequestIdRef.current;
  }, []);

  const syncProfileInBackground = useCallback(
    async (nextUser: AppUser | null, requestId: number) => {
      if (!nextUser) {
        return;
      }

      try {
        const profile = await upsertPublicUserProfile({
          userUid: nextUser.id,
          displayName: nextUser.displayName,
          username: nextUser.username,
          email: nextUser.email,
          photoURL: nextUser.photoURL,
        });

        if (!profile || authSyncRequestIdRef.current !== requestId) {
          return;
        }

        setUser((currentUser) => {
          if (!currentUser || currentUser.uid !== nextUser.uid) {
            return currentUser;
          }

          if (
            currentUser.username === profile.username &&
            currentUser.usernameSetAt === profile.usernameSetAt
          ) {
            return currentUser;
          }

          return {
            ...currentUser,
            username: profile.username,
            usernameSetAt: profile.usernameSetAt,
          };
        });
      } catch (error) {
        console.warn('[auth] Background profile sync failed:', error);
      }
    },
    []
  );

  const syncAuthSession = useCallback(
    async (
      session: Session | null,
      errorContext: 'load Supabase session' | 'sync auth state',
      requestId = invalidateAuthSyncRequests()
    ) => {
      try {
        if (authSyncRequestIdRef.current !== requestId) {
          return null;
        }

        if (!session) {
          await unregisterCurrentSocialPushToken().catch(() => undefined);
        }

        if (authSyncRequestIdRef.current !== requestId) {
          return null;
        }

        const nextUser = await syncUserProfile(session);
        if (authSyncRequestIdRef.current !== requestId) {
          return null;
        }

        setUser(nextUser);
        setIsReady(true);
        void syncProfileInBackground(nextUser, requestId);
        return nextUser;
      } catch (error) {
        console.warn(`[auth] Failed to ${errorContext}:`, error);
        if (authSyncRequestIdRef.current !== requestId) {
          return null;
        }

        const fallbackUser = mapSupabaseUser(session?.user);
        setActiveNotesScope(fallbackUser?.uid ?? getStoredNotesScope());
        setUser(fallbackUser);
        setIsReady(true);
        void syncProfileInBackground(fallbackUser, requestId);
        return fallbackUser;
      }
    },
    [invalidateAuthSyncRequests, syncProfileInBackground]
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
    setActiveNotesScope(getStoredNotesScope());

    const supabase = getSupabase();
    if (!isSupportedPlatform() || !supabase) {
      setIsReady(true);
      return;
    }

    let active = true;

    void (async () => {
      const requestId = invalidateAuthSyncRequests();

      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          throw error;
        }

        if (!active || authSyncRequestIdRef.current !== requestId) {
          return;
        }

        await syncAuthSession(data.session ?? null, 'load Supabase session', requestId);
      } catch (error) {
        console.warn('[auth] Failed to load Supabase session:', error);
        if (active && authSyncRequestIdRef.current === requestId) {
          setUser(null);
          setActiveNotesScope(getStoredNotesScope());
          setIsReady(true);
        }
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncAuthSession(session, 'sync auth state');
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [invalidateAuthSyncRequests, syncAuthSession]);

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

          await syncAuthSession(data.session ?? null, 'sync auth state');
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

          await syncAuthSession(data.session ?? null, 'sync auth state');
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

          await syncAuthSession(data.session ?? null, 'sync auth state');
          if (!data.session) {
            setUser(mapSupabaseUser(data.user));
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
          await unregisterCurrentSocialPushToken().catch(() => undefined);
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
          await clearAuthenticatedUserState(user.uid, setUser, invalidateAuthSyncRequests);
          await purgeAuthenticatedUserState(user.uid);
          return { status: 'success' };
        } catch (error) {
          const message = getSupabaseErrorMessage(error);

          if (message.toLowerCase().includes('not found')) {
            return {
              status: 'error',
              message: i18n.t(
                'profile.deleteAccountNotReady',
                'Account deletion is not configured for this build yet. Please contact support.'
              ),
            };
          }

          if (message.toLowerCase().includes('recent sign-in required')) {
            return {
              status: 'error',
              message: i18n.t(
                'profile.deleteAccountRecentSignIn',
                'For your security, sign out and sign back in before deleting this account.'
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
      },
      signOut: async () => {
        const supabase = getSupabase();

        try {
          await unregisterCurrentSocialPushToken().catch(() => undefined);
          await GoogleSignin.signOut();
        } catch {
          // Ignore Google sign-out failures and still clear the Supabase session.
        }

        if (supabase) {
          const { error } = await supabase.auth.signOut();
          if (error) {
            throw error;
          }
        }

        await clearAuthenticatedUserState(user?.uid ?? null, setUser, invalidateAuthSyncRequests);
        await purgeAuthenticatedUserState(user?.uid ?? null);
      },
    }),
    [invalidateAuthSyncRequests, isReady, syncAuthSession, user]
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
