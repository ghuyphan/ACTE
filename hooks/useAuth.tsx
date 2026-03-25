import type { Session } from '@supabase/supabase-js';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import {
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
  isGoogleSigninConfigured,
} from '../constants/auth';
import i18n from '../constants/i18n';
import { LOCAL_NOTES_SCOPE, setActiveNotesScope } from '../services/database';
import { upsertPublicUserProfile } from '../services/publicProfileService';
import { clearSharedFeedCache } from '../services/sharedFeedCache';
import { AppUser, mapSupabaseUser } from '../utils/appUser';
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

async function clearAuthenticatedUserState(currentUserUid: string | null, setUser: (nextUser: AppUser | null) => void) {
  await clearSharedFeedCache(currentUserUid).catch(() => undefined);
  setActiveNotesScope(LOCAL_NOTES_SCOPE);
  setUser(null);
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

function mapAuthErrorMessage(error: unknown) {
  const code =
    typeof error === 'object' && error && 'code' in error
      ? String((error as { code?: string }).code)
      : '';
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
    return i18n.t(
      'auth.errorGoogleConfig',
      'Google sign-in is not configured correctly for this build yet.'
    );
  }

  if (message) {
    return message;
  }

  return i18n.t('auth.errorGeneric', 'Unable to sign in right now. Please try again later.');
}

async function syncUserProfile(session: Session | null) {
  const user = mapSupabaseUser(session?.user);
  setActiveNotesScope(user?.uid ?? LOCAL_NOTES_SCOPE);
  if (!user) {
    return null;
  }

  // Fire and forget profile sync to unblock the rest of the application
  upsertPublicUserProfile({
    userUid: user.id,
    displayName: user.displayName,
    photoURL: user.photoURL,
  }).catch((err) => console.warn('[auth] Background profile sync failed:', err));

  return user;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isReady, setIsReady] = useState(() => !isSupportedPlatform());

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
    const supabase = getSupabase();
    if (!isSupportedPlatform() || !supabase) {
      setIsReady(true);
      return;
    }

    let active = true;

    void supabase.auth
      .getSession()
      .then(async ({ data, error }) => {
        if (error) {
          throw error;
        }

        const nextUser = await syncUserProfile(data.session ?? null);
        if (active) {
          setUser(nextUser);
          setIsReady(true);
        }
      })
      .catch((error) => {
        console.warn('[auth] Failed to load Supabase session:', error);
        if (active) {
          setUser(null);
          setIsReady(true);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncUserProfile(session)
        .then((nextUser) => {
          if (!active) {
            return;
          }

          setUser(nextUser);
          setIsReady(true);
        })
        .catch((error) => {
          console.warn('[auth] Failed to sync auth state:', error);
          if (active) {
            const fallbackUser = mapSupabaseUser(session?.user);
            setActiveNotesScope(fallbackUser?.uid ?? LOCAL_NOTES_SCOPE);
            setUser(fallbackUser);
            setIsReady(true);
          }
        });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

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

          const response = await GoogleSignin.signIn();
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

          const { data, error } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: idToken,
          });
          if (error) {
            throw error;
          }

          const nextUser = await syncUserProfile(data.session ?? null);
          setUser(nextUser);
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

          const nextUser = await syncUserProfile(data.session ?? null);
          setUser(nextUser);
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
          const { data, error } = await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              data: {
                display_name: trimmedName,
                displayName: trimmedName,
              },
            },
          });
          if (error) {
            throw error;
          }

          const nextUser = await syncUserProfile(data.session ?? null);
          setUser(nextUser ?? mapSupabaseUser(data.user));
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
          await clearAuthenticatedUserState(user.uid, setUser);
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

        await clearAuthenticatedUserState(user?.uid ?? null, setUser);
      },
    }),
    [isReady, user]
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
