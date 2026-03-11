import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin, statusCodes, type User as GoogleUser } from '@react-native-google-signin/google-signin';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { GOOGLE_WEB_CLIENT_ID, isGoogleSigninConfigured } from '../constants/auth';

export interface AuthActionResult {
  status: 'success' | 'cancelled' | 'unavailable' | 'error';
  message?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  givenName: string | null;
  familyName: string | null;
  provider: 'google';
}

interface AuthContextValue {
  user: AuthUser | null;
  isReady: boolean;
  isAvailable: boolean;
  signIn: () => Promise<AuthActionResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const AUTH_STORAGE_KEY = 'auth.user';

const isAuthConfigured = isGoogleSigninConfigured;

if (isAuthConfigured) {
  try {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
    });
  } catch {
    // Leave the SDK unconfigured and surface the error when sign-in is attempted.
  }
}

function mapGoogleUser(googleUser: GoogleUser): AuthUser {
  return {
    id: googleUser.user.id,
    email: googleUser.user.email,
    displayName: googleUser.user.name,
    photoURL: googleUser.user.photo,
    givenName: googleUser.user.givenName,
    familyName: googleUser.user.familyName,
    provider: 'google',
  };
}

async function persistUser(user: AuthUser | null) {
  if (!user) {
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }

  await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(!isAuthConfigured);

  useEffect(() => {
    let isMounted = true;

    const restoreUser = async () => {
      if (!isAuthConfigured) {
        if (isMounted) {
          setIsReady(true);
        }
        return;
      }

      try {
        const currentGoogleUser = GoogleSignin.getCurrentUser();
        if (currentGoogleUser) {
          const nextUser = mapGoogleUser(currentGoogleUser);
          await persistUser(nextUser);
          if (isMounted) {
            setUser(nextUser);
          }
          return;
        }

        const storedUser = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
        if (!storedUser) {
          return;
        }

        try {
          const nextUser = JSON.parse(storedUser) as AuthUser;
          if (isMounted) {
            setUser(nextUser);
          }
        } catch {
          await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
        }
      } finally {
        if (isMounted) {
          setIsReady(true);
        }
      }
    };

    void restoreUser();

    return () => {
      isMounted = false;
    };
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
            message: 'Google Sign-In is not configured in this build.',
          };
        }

        try {
          if (Platform.OS === 'android') {
            await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
          }

          const response = await GoogleSignin.signIn();

          if (response.type === 'cancelled') {
            return { status: 'cancelled' };
          }

          const nextUser = mapGoogleUser(response.data);
          setUser(nextUser);
          await persistUser(nextUser);
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
                message: 'Google Sign-In is not fully configured for this development build yet.',
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
        try {
          await GoogleSignin.signOut();
        } catch {
          // Ignore Google sign-out failures and still clear the local session.
        }

        setUser(null);
        await persistUser(null);
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
