import { act, renderHook, waitFor } from '@testing-library/react-native';
import { ReactNode } from 'react';
import { Platform } from 'react-native';

const mockAuthState = {
  configured: true,
  hasFirebaseApp: true,
  googleSignInResult: { type: 'success', data: { idToken: 'token-123' } },
  googleSignInError: null as { code?: string } | null,
  emailSignInError: null as { code?: string } | null,
  registerError: null as { code?: string } | null,
  resetPasswordError: null as { code?: string } | null,
  initialUser: null as unknown,
  webClientId: 'client-id.apps.googleusercontent.com',
};

const mockOnAuthStateChanged = jest.fn((callback: (user: unknown) => void) => {
  callback(mockAuthState.initialUser);
  return () => undefined;
});
const mockSignInWithCredential = jest.fn(async () => undefined);
const mockSignInWithEmailAndPassword = jest.fn(async () => {
  if (mockAuthState.emailSignInError) {
    throw mockAuthState.emailSignInError;
  }
});
const mockUpdateProfile = jest.fn(async () => undefined);
const mockCreateUserWithEmailAndPassword = jest.fn(async () => {
  if (mockAuthState.registerError) {
    throw mockAuthState.registerError;
  }

  return {
    user: {
      updateProfile: (profile: unknown) => mockUpdateProfile(profile),
    },
  };
});
const mockSendPasswordResetEmail = jest.fn(async () => {
  if (mockAuthState.resetPasswordError) {
    throw mockAuthState.resetPasswordError;
  }
});
const mockFirebaseSignOut = jest.fn(async () => undefined);
const mockGoogleConfigure = jest.fn();
const mockGoogleHasPlayServices = jest.fn(async () => undefined);
const mockGoogleSignIn = jest.fn(async () => {
  if (mockAuthState.googleSignInError) {
    throw mockAuthState.googleSignInError;
  }

  return mockAuthState.googleSignInResult;
});
const mockGoogleSignOut = jest.fn(async () => undefined);

jest.mock('../constants/auth', () => ({
  get GOOGLE_WEB_CLIENT_ID() {
    return mockAuthState.webClientId;
  },
  get isGoogleSigninConfigured() {
    return mockAuthState.configured;
  },
}));

jest.mock('../utils/firebase', () => ({
  hasFirebaseApp: () => mockAuthState.hasFirebaseApp,
  getFirebaseAuth: () =>
    mockAuthState.hasFirebaseApp
      ? {
          onAuthStateChanged: mockOnAuthStateChanged,
          signInWithCredential: mockSignInWithCredential,
          signInWithEmailAndPassword: mockSignInWithEmailAndPassword,
          createUserWithEmailAndPassword: mockCreateUserWithEmailAndPassword,
          sendPasswordResetEmail: mockSendPasswordResetEmail,
          signOut: mockFirebaseSignOut,
        }
      : null,
}));

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: (config: unknown) => mockGoogleConfigure(config),
    hasPlayServices: () => mockGoogleHasPlayServices(),
    signIn: () => mockGoogleSignIn(),
    signOut: () => mockGoogleSignOut(),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  },
}));

jest.mock('@react-native-firebase/auth', () => ({
  __esModule: true,
  default: {
    GoogleAuthProvider: {
      credential: (idToken: string) => `credential:${idToken}`,
    },
  },
}));

import { AuthProvider, useAuth } from '../hooks/useAuth';

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

function setPlatformOS(nextOS: 'ios' | 'android' | 'web') {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    get: () => nextOS,
  });
}

describe('useAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setPlatformOS('ios');
    mockAuthState.configured = true;
    mockAuthState.hasFirebaseApp = true;
    mockAuthState.googleSignInResult = { type: 'success', data: { idToken: 'token-123' } };
    mockAuthState.googleSignInError = null;
    mockAuthState.emailSignInError = null;
    mockAuthState.registerError = null;
    mockAuthState.resetPasswordError = null;
    mockAuthState.initialUser = null;
    mockAuthState.webClientId = 'client-id.apps.googleusercontent.com';
  });

  it('exposes email auth even when Google sign-in is not configured', async () => {
    mockAuthState.configured = false;

    const hook = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(hook.result.current.isReady).toBe(true);
    });

    expect(hook.result.current.isAuthAvailable).toBe(true);
    expect(hook.result.current.isGoogleAvailable).toBe(false);

    const result = await hook.result.current.signInWithEmail('huy@example.com', 'secret123');
    expect(result).toEqual({ status: 'success' });
    expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith('huy@example.com', 'secret123');
  });

  it('supports Android Google sign-in when Firebase and Google are configured', async () => {
    setPlatformOS('android');

    const hook = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(hook.result.current.isReady).toBe(true);
      expect(hook.result.current.isGoogleAvailable).toBe(true);
    });

    let result!: { status: string; message?: string };
    await act(async () => {
      result = await hook.result.current.signInWithGoogle();
    });

    expect(result.status).toBe('success');
    expect(mockGoogleConfigure).toHaveBeenCalledWith({
      webClientId: 'client-id.apps.googleusercontent.com',
    });
    expect(mockGoogleHasPlayServices).toHaveBeenCalled();
    expect(mockGoogleSignIn).toHaveBeenCalled();
    expect(mockSignInWithCredential).toHaveBeenCalledWith('credential:token-123');
  });

  it('creates an email account and updates the display name', async () => {
    const hook = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(hook.result.current.isReady).toBe(true);
    });

    let result!: { status: string; message?: string };
    await act(async () => {
      result = await hook.result.current.registerWithEmail({
        email: 'new@example.com',
        password: 'secret123',
        displayName: 'Huy',
      });
    });

    expect(result).toEqual({ status: 'success' });
    expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalledWith('new@example.com', 'secret123');
    expect(mockUpdateProfile).toHaveBeenCalledWith({ displayName: 'Huy' });
  });

  it('sends reset-password emails through Firebase auth', async () => {
    const hook = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(hook.result.current.isReady).toBe(true);
    });

    const result = await hook.result.current.sendPasswordReset('reset@example.com');
    expect(result).toEqual({ status: 'success' });
    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith('reset@example.com');
  });

  it('maps common email/password auth errors to friendly messages', async () => {
    mockAuthState.emailSignInError = { code: 'auth/wrong-password' };

    const hook = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(hook.result.current.isReady).toBe(true);
    });

    const result = await hook.result.current.signInWithEmail('huy@example.com', 'bad-password');
    expect(result).toEqual(
      expect.objectContaining({
        status: 'error',
        message: 'The email or password is incorrect.',
      })
    );
  });

  it('returns unavailable on unsupported platforms', async () => {
    setPlatformOS('web');

    const hook = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(hook.result.current.isReady).toBe(true);
      expect(hook.result.current.isAuthAvailable).toBe(false);
      expect(hook.result.current.isGoogleAvailable).toBe(false);
    });

    const result = await hook.result.current.signInWithGoogle();
    expect(result).toEqual(
      expect.objectContaining({
        status: 'unavailable',
      })
    );
  });
});
