import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

const mockAuthState = {
  configured: true,
  hasFirebaseApp: true,
  googleSignInResult: { type: 'success', data: { idToken: 'token-123' } },
  googleSignInError: null as { code?: string } | null,
  initialUser: null as unknown,
  webClientId: 'client-id.apps.googleusercontent.com',
};

const mockOnAuthStateChanged = jest.fn((callback: (user: unknown) => void) => {
  callback(mockAuthState.initialUser);
  return () => undefined;
});
const mockSignInWithCredential = jest.fn(async () => undefined);
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
          signOut: mockFirebaseSignOut,
        }
      : null,
}));

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: (...args: unknown[]) => mockGoogleConfigure(...args),
    hasPlayServices: (...args: unknown[]) => mockGoogleHasPlayServices(...args),
    signIn: (...args: unknown[]) => mockGoogleSignIn(...args),
    signOut: (...args: unknown[]) => mockGoogleSignOut(...args),
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

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

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
    mockAuthState.initialUser = null;
    mockAuthState.webClientId = 'client-id.apps.googleusercontent.com';
  });

  it('reports unavailable when Google Sign-In is not configured', async () => {
    setPlatformOS('android');
    mockAuthState.configured = false;

    const hook = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(hook.result.current.isReady).toBe(true);
    });

    const result = await hook.result.current.signIn();
    expect(result).toEqual(
      expect.objectContaining({
        status: 'unavailable',
        message: 'Google Sign-In is not configured in this build.',
      })
    );
  });

  it('supports Android sign-in when Firebase and Google are configured', async () => {
    setPlatformOS('android');

    const hook = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(hook.result.current.isReady).toBe(true);
      expect(hook.result.current.isAvailable).toBe(true);
    });

    let result!: { status: string; message?: string };
    await act(async () => {
      result = await hook.result.current.signIn();
    });

    expect(result.status).toBe('success');
    expect(mockGoogleConfigure).toHaveBeenCalledWith({
      webClientId: 'client-id.apps.googleusercontent.com',
    });
    expect(mockGoogleHasPlayServices).toHaveBeenCalled();
    expect(mockGoogleSignIn).toHaveBeenCalled();
    expect(mockSignInWithCredential).toHaveBeenCalledWith('credential:token-123');
  });

  it('returns cancelled when Google Sign-In is cancelled before credential exchange', async () => {
    mockAuthState.googleSignInResult = { type: 'cancelled' };

    const hook = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(hook.result.current.isReady).toBe(true);
    });

    const result = await hook.result.current.signIn();
    expect(result).toEqual({ status: 'cancelled' });
  });

  it('returns unavailable on unsupported platforms', async () => {
    setPlatformOS('web');

    const hook = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(hook.result.current.isReady).toBe(true);
      expect(hook.result.current.isAvailable).toBe(false);
    });

    const result = await hook.result.current.signIn();
    expect(result).toEqual(
      expect.objectContaining({
        status: 'unavailable',
      })
    );
  });
});
