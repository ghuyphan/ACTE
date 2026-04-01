import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { Session } from '@supabase/supabase-js';
import { ReactNode } from 'react';
import { Platform } from 'react-native';

const mockAuthState = {
  hasSupabaseConfig: true,
  googleConfigured: true,
  googleSignInResult: { type: 'success', data: { idToken: 'token-123' } } as unknown,
  googleSignInError: null as { code?: string; message?: string } | null,
  emailSignInError: null as { code?: string; message?: string } | null,
  registerError: null as { code?: string; message?: string } | null,
  resetPasswordError: null as { code?: string; message?: string } | null,
  initialSession: null as Session | null,
  webClientId: 'client-id.apps.googleusercontent.com',
  iosClientId: 'ios-client-id.apps.googleusercontent.com',
};

function buildSession(overrides?: Partial<Session>): Session {
  return {
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: 1_900_000_000,
    user: {
      id: 'user-1',
      email: 'huy@example.com',
      user_metadata: {
        display_name: 'Huy',
        avatar_url: 'https://example.com/avatar.jpg',
      },
      app_metadata: {},
      aud: 'authenticated',
      created_at: '2026-03-10T00:00:00.000Z',
    } as Session['user'],
    ...overrides,
  };
}

const mockUpsertPublicUserProfile = jest.fn<Promise<void>, [unknown]>(async () => undefined);
const mockClearSharedFeedCache = jest.fn<Promise<void>, [string | null | undefined]>(async () => undefined);
const mockUnregisterCurrentSocialPushToken = jest.fn<Promise<void>, []>(async () => undefined);
const mockPurgeLocalAccountScope = jest.fn<Promise<void>, [string | null | undefined]>(async () => undefined);
const mockGetSession = jest.fn(async () => ({
  data: { session: mockAuthState.initialSession },
  error: null,
}));
const mockOnAuthStateChange = jest.fn((_callback: (event: string, session: Session | null) => void) => ({
  data: {
    subscription: {
      unsubscribe: jest.fn(),
    },
  },
}));
const mockSignInWithIdToken = jest.fn(async (_input?: unknown) => {
  return {
    data: { session: buildSession() },
    error: null,
  };
});
const mockSignInWithPassword = jest.fn(async ({ email }: { email: string; password: string }) => {
  if (mockAuthState.emailSignInError) {
    return { data: { session: null }, error: mockAuthState.emailSignInError };
  }

  return {
    data: {
      session: buildSession({
        user: {
          ...buildSession().user,
          email,
        } as Session['user'],
      }),
    },
    error: null,
  };
});
const mockSignUp = jest.fn(async ({ email, options }: { email: string; password: string; options?: { data?: Record<string, unknown> } }) => {
  if (mockAuthState.registerError) {
    return {
      data: { session: null, user: null },
      error: mockAuthState.registerError,
    };
  }

  return {
    data: {
      session: buildSession({
        user: {
          ...buildSession().user,
          email,
          user_metadata: {
            ...buildSession().user.user_metadata,
            ...(options?.data ?? {}),
          },
        } as Session['user'],
      }),
      user: {
        ...buildSession().user,
        email,
        user_metadata: {
          ...buildSession().user.user_metadata,
          ...(options?.data ?? {}),
        },
      },
    },
    error: null,
  };
});
const mockResetPasswordForEmail = jest.fn(async (_email?: string, _options?: unknown) => {
  if (mockAuthState.resetPasswordError) {
    return { error: mockAuthState.resetPasswordError };
  }

  return { error: null };
});
const mockSupabaseSignOut = jest.fn(async () => ({ error: null }));
const mockInvokeFunction = jest.fn<
  Promise<{ data: { success: boolean } | null; error: { message: string } | null }>,
  [string, unknown]
>(async () => ({
  data: { success: true },
  error: null,
}));
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
  get GOOGLE_IOS_CLIENT_ID() {
    return mockAuthState.iosClientId;
  },
  get isGoogleSigninConfigured() {
    return mockAuthState.googleConfigured;
  },
}));

jest.mock('../services/publicProfileService', () => ({
  upsertPublicUserProfile: (input: unknown) => mockUpsertPublicUserProfile(input),
}));

jest.mock('../services/sharedFeedCache', () => ({
  clearSharedFeedCache: (userUid?: string | null) => mockClearSharedFeedCache(userUid),
}));

jest.mock('../services/socialPushService', () => ({
  unregisterCurrentSocialPushToken: () => mockUnregisterCurrentSocialPushToken(),
}));

jest.mock('../services/accountCleanup', () => ({
  purgeLocalAccountScope: (ownerUid?: string | null) => mockPurgeLocalAccountScope(ownerUid),
}));

jest.mock('../services/geofenceService', () => ({
  clearGeofenceRegions: jest.fn(async () => undefined),
}));

const mockSupabaseClient = {
  auth: {
    getSession: () => mockGetSession(),
    onAuthStateChange: (callback: (event: string, session: Session | null) => void) =>
      mockOnAuthStateChange(callback),
    signInWithIdToken: (input: unknown) => mockSignInWithIdToken(input),
    signInWithPassword: (input: { email: string; password: string }) => mockSignInWithPassword(input),
    signUp: (input: { email: string; password: string; options?: { data?: Record<string, unknown> } }) =>
      mockSignUp(input),
    resetPasswordForEmail: (email: string, options: unknown) => mockResetPasswordForEmail(email, options),
    signOut: () => mockSupabaseSignOut(),
  },
  functions: {
    invoke: (name: string, input: unknown) => mockInvokeFunction(name, input),
  },
};

jest.mock('../utils/supabase', () => ({
  hasSupabaseConfig: () => mockAuthState.hasSupabaseConfig,
  getSupabase: () => (mockAuthState.hasSupabaseConfig ? mockSupabaseClient : null),
  getSupabaseErrorMessage: (error: unknown) =>
    typeof error === 'object' && error && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : error instanceof Error
        ? error.message
        : '',
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
    mockAuthState.hasSupabaseConfig = true;
    mockAuthState.googleConfigured = true;
    mockAuthState.googleSignInResult = { type: 'success', data: { idToken: 'token-123' } };
    mockAuthState.googleSignInError = null;
    mockAuthState.emailSignInError = null;
    mockAuthState.registerError = null;
    mockAuthState.resetPasswordError = null;
    mockAuthState.initialSession = null;
    mockAuthState.webClientId = 'client-id.apps.googleusercontent.com';
    mockAuthState.iosClientId = 'ios-client-id.apps.googleusercontent.com';
    mockInvokeFunction.mockResolvedValue({ data: { success: true }, error: null });
  });

  it('exposes email auth even when Google sign-in is not configured', async () => {
    mockAuthState.googleConfigured = false;

    const hook = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(hook.result.current.isReady).toBe(true);
    });

    expect(hook.result.current.isAuthAvailable).toBe(true);
    expect(hook.result.current.isGoogleAvailable).toBe(false);

    const result = await hook.result.current.signInWithEmail('huy@example.com', 'secret123');
    expect(result).toEqual({ status: 'success' });
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'huy@example.com',
      password: 'secret123',
    });
  });

  it('supports Android Google sign-in when Supabase and Google are configured', async () => {
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
      iosClientId: 'ios-client-id.apps.googleusercontent.com',
    });
    expect(mockGoogleHasPlayServices).toHaveBeenCalled();
    expect(mockGoogleSignIn).toHaveBeenCalled();
    expect(mockSignInWithIdToken).toHaveBeenCalledWith({
      provider: 'google',
      token: 'token-123',
    });
  });

  it('creates an email account and stores the display name in Supabase metadata', async () => {
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
    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'secret123',
      options: {
        data: {
          display_name: 'Huy',
          displayName: 'Huy',
        },
      },
    });
    expect(mockUpsertPublicUserProfile).toHaveBeenCalled();
  });

  it('sends reset-password emails through Supabase auth', async () => {
    const hook = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(hook.result.current.isReady).toBe(true);
    });

    const result = await hook.result.current.sendPasswordReset('reset@example.com');
    expect(result).toEqual({ status: 'success' });
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('reset@example.com', {
      redirectTo: undefined,
    });
  });

  it('maps common email/password auth errors to friendly messages', async () => {
    mockAuthState.emailSignInError = {
      code: 'invalid_credentials',
      message: 'Invalid login credentials',
    };

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

  it('purges local account data when signing out', async () => {
    mockAuthState.initialSession = buildSession();

    const hook = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(hook.result.current.isReady).toBe(true);
      expect(hook.result.current.user?.uid).toBe('user-1');
    });

    await act(async () => {
      await hook.result.current.signOut();
    });

    expect(mockUnregisterCurrentSocialPushToken).toHaveBeenCalled();
    expect(mockSupabaseSignOut).toHaveBeenCalled();
    expect(mockPurgeLocalAccountScope).toHaveBeenCalledWith('user-1');
    expect(hook.result.current.user).toBeNull();
  });

  it('requires a recent sign-in message from delete account when the backend rejects it', async () => {
    mockAuthState.initialSession = buildSession();
    mockInvokeFunction.mockResolvedValue({
      data: null,
      error: {
        message: 'Recent sign-in required. Sign in again before deleting your account.',
      },
    });

    const hook = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(hook.result.current.isReady).toBe(true);
      expect(hook.result.current.user?.uid).toBe('user-1');
    });

    let result!: { status: string; message?: string };
    await act(async () => {
      result = await hook.result.current.deleteAccount();
    });

    expect(result).toEqual({
      status: 'error',
      message: 'For your security, sign out and sign back in before deleting this account.',
    });
    expect(mockPurgeLocalAccountScope).not.toHaveBeenCalled();
  });
});
