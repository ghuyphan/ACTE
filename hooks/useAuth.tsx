import authModule, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { GOOGLE_WEB_CLIENT_ID, isGoogleSigninConfigured } from '../constants/auth';
import { getFirebaseAuth, hasFirebaseApp } from '../utils/firebase';

export interface AuthActionResult {
  status: 'success' | 'cancelled' | 'unavailable' | 'error';
  message?: string;
}

interface AuthContextValue {
  user: FirebaseAuthTypes.User | null;
  isReady: boolean;
  isAvailable: boolean;
  signIn: () => Promise<AuthActionResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function isSupportedPlatform() {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

function isAuthConfigured() {
  return isSupportedPlatform() && isGoogleSigninConfigured && hasFirebaseApp();
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
      isAvailable: isAuthConfigured(),
      signIn: async () => {
        if (!isSupportedPlatform()) {
          return {
            status: 'unavailable',
            message: 'Firebase Google sign-in is unavailable on this platform in the current build.',
          };
        }

        if (!isGoogleSigninConfigured) {
          return {
            status: 'unavailable',
            message: 'Google Sign-In is not configured in this build.',
          };
        }

        if (!hasFirebaseApp()) {
          return {
            status: 'unavailable',
            message: 'Firebase is not initialized yet. Rebuild the iOS app after updating GoogleService-Info.plist.',
          };
        }

        const firebaseAuth = getFirebaseAuth();
        if (!firebaseAuth) {
          return {
            status: 'unavailable',
            message: 'Firebase Authentication is unavailable in this build.',
          };
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
              message: 'Google Sign-In did not return an ID token. Update constants/auth.ts with your Firebase Web client ID.',
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
            if (code === statusCodes.IN_PROGRESS) {
              return {
                status: 'error',
                message: 'Sign-in is already in progress.',
              };
            }
            if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
              return {
                status: 'error',
                message: 'Google Play Services are unavailable on this device.',
              };
            }
            if (code === 'DEVELOPER_ERROR' || code === '10' || code === '12500') {
              return {
                status: 'error',
                message: 'Google Sign-In is not fully configured yet. Check your iOS bundle ID, reversed client ID, and Web client ID.',
              };
            }
          }

          return {
            status: 'error',
            message: 'Unable to sign in right now. Please try again later.',
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
