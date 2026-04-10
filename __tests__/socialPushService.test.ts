const mockGetPermissionsAsync = jest.fn();
const mockRequestPermissionsAsync = jest.fn();
const mockGetExpoPushTokenAsync = jest.fn();
const mockRandomUUID = jest.fn();
const mockGetPersistentItem = jest.fn();
const mockRemovePersistentItem = jest.fn();
const mockSetPersistentItem = jest.fn();
const mockHasSupabaseConfig = jest.fn();
const mockGetSupabase = jest.fn();
const mockIsSupabaseSchemaMismatchError = jest.fn();

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    easConfig: {
      projectId: 'project-123',
    },
    expoConfig: {
      version: '1.0.0',
    },
  },
}));

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: (...args: unknown[]) => mockGetPermissionsAsync(...args),
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissionsAsync(...args),
  getExpoPushTokenAsync: (...args: unknown[]) => mockGetExpoPushTokenAsync(...args),
}));

jest.mock('expo-crypto', () => ({
  randomUUID: (...args: unknown[]) => mockRandomUUID(...args),
}));

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

jest.mock('../utils/appStorage', () => ({
  getPersistentItem: (...args: unknown[]) => mockGetPersistentItem(...args),
  removePersistentItem: (...args: unknown[]) => mockRemovePersistentItem(...args),
  setPersistentItem: (...args: unknown[]) => mockSetPersistentItem(...args),
}));

jest.mock('../utils/supabase', () => ({
  getSupabase: (...args: unknown[]) => mockGetSupabase(...args),
  getSupabaseErrorMessage: jest.fn(() => ''),
  hasSupabaseConfig: (...args: unknown[]) => mockHasSupabaseConfig(...args),
  isSupabaseSchemaMismatchError: (...args: unknown[]) => mockIsSupabaseSchemaMismatchError(...args),
}));

import { syncSocialPushRegistration } from '../services/socialPushService';

describe('syncSocialPushRegistration', () => {
  const rpc = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockHasSupabaseConfig.mockReturnValue(true);
    mockGetSupabase.mockReturnValue({ rpc });
    mockIsSupabaseSchemaMismatchError.mockReturnValue(false);
    mockRandomUUID.mockReturnValue('install-generated');
    mockGetPermissionsAsync.mockResolvedValue({
      status: 'denied',
      canAskAgain: true,
    });
    mockRequestPermissionsAsync.mockResolvedValue({
      status: 'denied',
      canAskAgain: true,
    });
    mockGetPersistentItem.mockImplementation(async (key: string) => {
      if (key === 'notification.socialPushRegistration.v1') {
        return null;
      }

      if (key === 'notification.socialPushInstallationId.v1') {
        return 'install-123';
      }

      return null;
    });
    mockRemovePersistentItem.mockResolvedValue(undefined);
    mockSetPersistentItem.mockResolvedValue(undefined);
    mockGetExpoPushTokenAsync.mockResolvedValue({
      data: 'ExponentPushToken[token]',
    });
    rpc.mockResolvedValue({ error: null });
  });

  it('does not try to register or prompt when notification permission is not granted', async () => {
    await syncSocialPushRegistration({
      id: 'user-1',
      uid: 'user-1',
      email: 'hello@example.com',
      displayName: 'Noto User',
      photoURL: null,
      providerData: [],
    });

    expect(mockGetPermissionsAsync).toHaveBeenCalled();
    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
    expect(mockGetExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('requests permission and registers when explicitly asked to do so', async () => {
    mockGetPermissionsAsync.mockResolvedValue({
      status: 'denied',
      canAskAgain: true,
    });
    mockRequestPermissionsAsync.mockResolvedValue({
      status: 'granted',
      canAskAgain: true,
    });

    await syncSocialPushRegistration(
      {
        id: 'user-1',
        uid: 'user-1',
        email: 'hello@example.com',
        displayName: 'Noto User',
        photoURL: null,
        providerData: [],
      },
      { requestPermission: true }
    );

    expect(mockRequestPermissionsAsync).toHaveBeenCalled();
    expect(mockGetExpoPushTokenAsync).toHaveBeenCalledWith({
      projectId: 'project-123',
    });
    expect(rpc).toHaveBeenCalledWith('register_push_token', {
      expo_push_token_input: 'ExponentPushToken[token]',
      platform_input: 'ios',
      app_version_input: '1.0.0',
      installation_id_input: 'install-123',
    });
  });

  it('registers the token when permission is already granted', async () => {
    mockGetPermissionsAsync.mockResolvedValue({
      status: 'granted',
      canAskAgain: true,
    });

    await syncSocialPushRegistration({
      id: 'user-1',
      uid: 'user-1',
      email: 'hello@example.com',
      displayName: 'Noto User',
      photoURL: null,
      providerData: [],
    });

    expect(mockGetExpoPushTokenAsync).toHaveBeenCalledWith({
      projectId: 'project-123',
    });
    expect(rpc).toHaveBeenCalledWith('register_push_token', {
      expo_push_token_input: 'ExponentPushToken[token]',
      platform_input: 'ios',
      app_version_input: '1.0.0',
      installation_id_input: 'install-123',
    });
    expect(mockSetPersistentItem).toHaveBeenCalled();
  });

  it('unregisters the previous token when the signed-in user changes', async () => {
    mockGetPermissionsAsync.mockResolvedValue({
      status: 'granted',
      canAskAgain: true,
    });
    mockGetPersistentItem.mockImplementation(async (key: string) => {
      if (key === 'notification.socialPushRegistration.v1') {
        return JSON.stringify({
          token: 'ExponentPushToken[old]',
          userId: 'user-1',
        });
      }

      if (key === 'notification.socialPushInstallationId.v1') {
        return 'install-123';
      }

      return null;
    });

    await syncSocialPushRegistration({
      id: 'user-2',
      uid: 'user-2',
      email: 'hello@example.com',
      displayName: 'New User',
      photoURL: null,
      providerData: [],
    });

    expect(rpc).toHaveBeenNthCalledWith(1, 'unregister_push_token', {
      expo_push_token_input: 'ExponentPushToken[old]',
    });
    expect(rpc).toHaveBeenNthCalledWith(2, 'register_push_token', {
      expo_push_token_input: 'ExponentPushToken[token]',
      platform_input: 'ios',
      app_version_input: '1.0.0',
      installation_id_input: 'install-123',
    });
  });

  it('unregisters and clears persisted tokens when the user signs out', async () => {
    mockGetPersistentItem.mockImplementation(async (key: string) => {
      if (key === 'notification.socialPushRegistration.v1') {
        return JSON.stringify({
          token: 'ExponentPushToken[old]',
          userId: 'user-1',
        });
      }

      if (key === 'notification.socialPushInstallationId.v1') {
        return 'install-123';
      }

      return null;
    });

    await syncSocialPushRegistration(null);

    expect(rpc).toHaveBeenCalledWith('unregister_push_token', {
      expo_push_token_input: 'ExponentPushToken[old]',
    });
    expect(mockRemovePersistentItem).toHaveBeenCalled();
  });

  it('keeps the persisted token when unregister fails during sign-out', async () => {
    mockGetPersistentItem.mockImplementation(async (key: string) => {
      if (key === 'notification.socialPushRegistration.v1') {
        return JSON.stringify({
          token: 'ExponentPushToken[old]',
          userId: 'user-1',
        });
      }

      if (key === 'notification.socialPushInstallationId.v1') {
        return 'install-123';
      }

      return null;
    });
    rpc.mockResolvedValueOnce({ error: new Error('network failed') });

    await expect(syncSocialPushRegistration(null)).rejects.toThrow('network failed');
    expect(mockRemovePersistentItem).not.toHaveBeenCalled();
  });

  it('ignores malformed persisted registration payloads', async () => {
    mockGetPermissionsAsync.mockResolvedValue({
      status: 'granted',
      canAskAgain: true,
    });
    mockGetPersistentItem.mockImplementation(async (key: string) => {
      if (key === 'notification.socialPushRegistration.v1') {
        return '{not-json';
      }

      if (key === 'notification.socialPushInstallationId.v1') {
        return 'install-123';
      }

      return null;
    });

    await syncSocialPushRegistration({
      id: 'user-1',
      uid: 'user-1',
      email: 'hello@example.com',
      displayName: 'Noto User',
      photoURL: null,
      providerData: [],
    });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('register_push_token', {
      expo_push_token_input: 'ExponentPushToken[token]',
      platform_input: 'ios',
      app_version_input: '1.0.0',
      installation_id_input: 'install-123',
    });
  });

  it('creates and persists a new installation id when one is missing', async () => {
    mockGetPermissionsAsync.mockResolvedValue({
      status: 'granted',
      canAskAgain: true,
    });
    mockGetPersistentItem.mockImplementation(async (key: string) => {
      if (key === 'notification.socialPushRegistration.v1') {
        return null;
      }

      if (key === 'notification.socialPushInstallationId.v1') {
        return null;
      }

      return null;
    });

    await syncSocialPushRegistration({
      id: 'user-1',
      uid: 'user-1',
      email: 'hello@example.com',
      displayName: 'Noto User',
      photoURL: null,
      providerData: [],
    });

    expect(rpc).toHaveBeenCalledWith('register_push_token', {
      expo_push_token_input: 'ExponentPushToken[token]',
      platform_input: 'ios',
      app_version_input: '1.0.0',
      installation_id_input: 'install-generated',
    });
    expect(mockSetPersistentItem).toHaveBeenCalledWith(
      'notification.socialPushInstallationId.v1',
      'install-generated'
    );
  });

  it('falls back to the legacy register_push_token rpc when the installation-aware rpc is not deployed yet', async () => {
    mockGetPermissionsAsync.mockResolvedValue({
      status: 'granted',
      canAskAgain: true,
    });

    const schemaMismatchError = new Error('schema cache missing register_push_token with 4 args');
    rpc
      .mockResolvedValueOnce({ error: schemaMismatchError })
      .mockResolvedValueOnce({ error: null });
    mockIsSupabaseSchemaMismatchError.mockImplementation((error: unknown) => error === schemaMismatchError);

    await syncSocialPushRegistration({
      id: 'user-1',
      uid: 'user-1',
      email: 'hello@example.com',
      displayName: 'Noto User',
      photoURL: null,
      providerData: [],
    });

    expect(rpc).toHaveBeenNthCalledWith(1, 'register_push_token', {
      expo_push_token_input: 'ExponentPushToken[token]',
      platform_input: 'ios',
      app_version_input: '1.0.0',
      installation_id_input: 'install-123',
    });
    expect(rpc).toHaveBeenNthCalledWith(2, 'register_push_token', {
      expo_push_token_input: 'ExponentPushToken[token]',
      platform_input: 'ios',
      app_version_input: '1.0.0',
    });
  });
});
