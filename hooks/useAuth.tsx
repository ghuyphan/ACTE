import authModule, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
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

const isAuthConfigured = isGoogleSigninConfigured && hasFirebaseApp();

if (isGoogleSigninConfigured) {
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [isReady, setIsReady] = useState(!isAuthConfigured);

  useEffect(() => {
    const firebaseAuth = getFirebaseAuth();
    if (!firebaseAuth) {
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
      isAvailable: isAuthConfigured,
      signIn: async () => {
        if (!isAuthConfigured) {
          return {
            status: 'unavailable',
            message: 'Authentication is not configured in this build.',
          };
        }

        const firebaseAuth = getFirebaseAuth();
        if (!firebaseAuth) {
          return {
            status: 'unavailable',
            message: 'Authentication is not configured in this build.',
          };
        }

        try {
          await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
          const response = await GoogleSignin.signIn();

          if ('type' in response && response.type === 'cancelled') {
            return { status: 'cancelled' };
          }

          const idToken = (response as { data?: { idToken?: string }; idToken?: string }).data?.idToken
            || (response as { data?: { idToken?: string }; idToken?: string }).idToken;

          if (!idToken) {
            return {
              status: 'error',
              message: 'Unable to complete sign-in. Please try again.',
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
          }

          return {
            status: 'error',
            message: 'Unable to sign in right now. Please try again later.',
          };
        }
      },
      signOut: async () => {
        const firebaseAuth = getFirebaseAuth();
        if (!firebaseAuth) {
          return;
        }

        try {
          await GoogleSignin.signOut();
        } catch {
          // Ignore Google sign-out failure and continue clearing Firebase session.
        }

        await firebaseAuth.signOut();
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
