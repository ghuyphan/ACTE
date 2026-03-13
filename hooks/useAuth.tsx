import authModule, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { GOOGLE_WEB_CLIENT_ID, isGoogleSigninConfigured } from '../constants/auth';
import i18n from '../constants/i18n';
import { getFirebaseAuth, hasFirebaseApp } from '../utils/firebase';

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
  user: FirebaseAuthTypes.User | null;
  isReady: boolean;
  isAuthAvailable: boolean;
  isGoogleAvailable: boolean;
  signInWithGoogle: () => Promise<AuthActionResult>;
  signInWithEmail: (email: string, password: string) => Promise<AuthActionResult>;
  registerWithEmail: (input: EmailRegistrationInput) => Promise<AuthActionResult>;
  sendPasswordReset: (email: string) => Promise<AuthActionResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function isSupportedPlatform() {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

function isFirebaseAuthAvailable() {
  return isSupportedPlatform() && hasFirebaseApp();
}

function isGoogleAuthAvailable() {
  return isFirebaseAuthAvailable() && isGoogleSigninConfigured;
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

  if (!hasFirebaseApp()) {
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

function mapAuthErrorMessage(error: unknown) {
  if (typeof error === 'object' && error && 'code' in error) {
    const code = String((error as { code?: string }).code);

    switch (code) {
      case 'auth/invalid-email':
        return i18n.t('auth.errorInvalidEmail', 'Enter a valid email address.');
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return i18n.t('auth.errorWrongCredentials', 'The email or password is incorrect.');
      case 'auth/email-already-in-use':
        return i18n.t('auth.errorEmailInUse', 'That email is already being used by another account.');
      case 'auth/weak-password':
        return i18n.t('auth.errorWeakPassword', 'Choose a password with at least 6 characters.');
      case 'auth/too-many-requests':
        return i18n.t('auth.errorTooManyRequests', 'Too many attempts right now. Please try again in a bit.');
      case 'auth/user-disabled':
        return i18n.t('auth.errorUserDisabled', 'This account has been disabled.');
      case 'auth/network-request-failed':
        return i18n.t('auth.errorNetwork', 'Check your connection and try again.');
      case 'auth/account-exists-with-different-credential':
      case 'auth/credential-already-in-use':
        return i18n.t(
          'auth.errorProviderConflict',
          'This email is already linked to a different sign-in method.'
        );
      default:
        break;
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
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return i18n.t('auth.errorGeneric', 'Unable to sign in right now. Please try again later.');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [isReady, setIsReady] = useState(() => !isSupportedPlatform());

  useEffect(() => {
    if (!isSupportedPlatform() || !isGoogleSigninConfigured) {
      return;
    }

    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
    });
  }, []);

  useEffect(() => {
    const firebaseAuth = getFirebaseAuth();
    if (!isSupportedPlatform() || !firebaseAuth) {
      setIsReady(true);
      return;
    }

    const unsubscribe = firebaseAuth.onAuthStateChanged((nextUser) => {
      setUser(nextUser);
      setIsReady(true);
    });

    return unsubscribe;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isReady,
      isAuthAvailable: isFirebaseAuthAvailable(),
      isGoogleAvailable: isGoogleAuthAvailable(),
      signInWithGoogle: async () => {
        if (!isGoogleAuthAvailable()) {
          return getUnavailableResult('google');
        }

        const firebaseAuth = getFirebaseAuth();
        if (!firebaseAuth) {
          return getUnavailableResult('auth');
        }

        try {
          if (Platform.OS === 'android') {
            await GoogleSignin.hasPlayServices();
          }

          const response = await GoogleSignin.signIn();

          if (response.type === 'cancelled') {
            return { status: 'cancelled' };
          }

          const idToken = response.data.idToken;
          if (!idToken) {
            return {
              status: 'error',
              message: i18n.t(
                'auth.errorMissingGoogleToken',
                'Google sign-in could not be completed. Please try again.'
              ),
            };
          }

          const credential = authModule.GoogleAuthProvider.credential(idToken);
          await firebaseAuth.signInWithCredential(credential);
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
        if (!isFirebaseAuthAvailable()) {
          return getUnavailableResult('auth');
        }

        const firebaseAuth = getFirebaseAuth();
        if (!firebaseAuth) {
          return getUnavailableResult('auth');
        }

        try {
          await firebaseAuth.signInWithEmailAndPassword(email.trim(), password);
          return { status: 'success' };
        } catch (error) {
          return {
            status: 'error',
            message: mapAuthErrorMessage(error),
          };
        }
      },
      registerWithEmail: async ({ email, password, displayName }) => {
        if (!isFirebaseAuthAvailable()) {
          return getUnavailableResult('auth');
        }

        const firebaseAuth = getFirebaseAuth();
        if (!firebaseAuth) {
          return getUnavailableResult('auth');
        }

        try {
          const credential = await firebaseAuth.createUserWithEmailAndPassword(email.trim(), password);
          const trimmedName = displayName?.trim();

          if (trimmedName) {
            await credential.user.updateProfile({ displayName: trimmedName });
            setUser(credential.user);
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
        if (!isFirebaseAuthAvailable()) {
          return getUnavailableResult('auth');
        }

        const firebaseAuth = getFirebaseAuth();
        if (!firebaseAuth) {
          return getUnavailableResult('auth');
        }

        try {
          await firebaseAuth.sendPasswordResetEmail(email.trim());
          return { status: 'success' };
        } catch (error) {
          return {
            status: 'error',
            message: mapAuthErrorMessage(error),
          };
        }
      },
      signOut: async () => {
        const firebaseAuth = getFirebaseAuth();

        try {
          await GoogleSignin.signOut();
        } catch {
          // Ignore Google sign-out failures and still clear the Firebase session.
        }

        if (firebaseAuth) {
          await firebaseAuth.signOut();
        }
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
