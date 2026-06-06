describe('sensitiveStorage', () => {
  const processEnv = process.env as NodeJS.ProcessEnv & { NODE_ENV?: string };
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.resetModules();
    processEnv.NODE_ENV = 'production';
  });

  afterAll(() => {
    processEnv.NODE_ENV = originalNodeEnv;
  });

  it('creates encrypted MMKV with a SecureStore-held key and migrates legacy values', async () => {
    const secureGetItem = jest.fn(async () => null);
    const secureSetItem = jest.fn(async () => undefined);
    const mmkvGetString = jest.fn(() => undefined);
    const mmkvSet = jest.fn();
    const createMMKV = jest.fn(() => ({
      getString: mmkvGetString,
      set: mmkvSet,
      remove: jest.fn(),
    }));
    const getPersistentItem = jest.fn(async () => 'legacy-secret');
    const removePersistentItem = jest.fn(async () => undefined);

    jest.doMock('react-native', () => ({
      Platform: { OS: 'ios' },
    }));
    jest.doMock('expo-secure-store', () => ({
      getItemAsync: secureGetItem,
      setItemAsync: secureSetItem,
      deleteItemAsync: jest.fn(),
    }));
    jest.doMock('expo-crypto', () => ({
      getRandomBytesAsync: jest.fn(async () => Uint8Array.from({ length: 16 }, (_, index) => index)),
    }));
    jest.doMock('react-native-mmkv', () => ({
      createMMKV,
    }));
    jest.doMock('../utils/appStorage', () => ({
      getPersistentItem,
      removePersistentItem,
      setPersistentItem: jest.fn(),
    }));

    let getSensitiveItem!: typeof import('../utils/sensitiveStorage').getSensitiveItem;
    jest.isolateModules(() => {
      ({ getSensitiveItem } = require('../utils/sensitiveStorage'));
    });

    await expect(getSensitiveItem('private.key')).resolves.toBe('legacy-secret');

    expect(secureGetItem).toHaveBeenCalledWith('noto.sensitive-storage.encryption-key.v1');
    expect(secureSetItem).toHaveBeenCalledWith(
      'noto.sensitive-storage.encryption-key.v1',
      '000102030405060708090a0b0c0d0e0f'
    );
    expect(createMMKV).toHaveBeenCalledWith({
      id: 'noto-sensitive-storage',
      encryptionKey: '000102030405060708090a0b0c0d0e0f',
      encryptionType: 'AES-256',
    });
    expect(mmkvSet).toHaveBeenCalledWith('private.key', 'legacy-secret');
    expect(removePersistentItem).toHaveBeenCalledWith('private.key');
  });

  it('reads encrypted values without consulting legacy storage', async () => {
    const getPersistentItem = jest.fn();

    jest.doMock('react-native', () => ({
      Platform: { OS: 'android' },
    }));
    jest.doMock('expo-secure-store', () => ({
      getItemAsync: jest.fn(async () => 'existing-encryption-key'),
      setItemAsync: jest.fn(),
      deleteItemAsync: jest.fn(),
    }));
    jest.doMock('expo-crypto', () => ({
      getRandomBytesAsync: jest.fn(),
    }));
    jest.doMock('react-native-mmkv', () => ({
      createMMKV: jest.fn(() => ({
        getString: jest.fn(() => 'encrypted-value'),
        set: jest.fn(),
        remove: jest.fn(),
      })),
    }));
    jest.doMock('../utils/appStorage', () => ({
      getPersistentItem,
      removePersistentItem: jest.fn(),
      setPersistentItem: jest.fn(),
    }));

    let getSensitiveItem!: typeof import('../utils/sensitiveStorage').getSensitiveItem;
    jest.isolateModules(() => {
      ({ getSensitiveItem } = require('../utils/sensitiveStorage'));
    });

    await expect(getSensitiveItem('private.key')).resolves.toBe('encrypted-value');
    expect(getPersistentItem).not.toHaveBeenCalled();
  });

  it('removes encrypted values with the MMKV v4 remove API', async () => {
    const mmkvRemove = jest.fn(() => true);
    const removePersistentItem = jest.fn(async () => undefined);

    jest.doMock('react-native', () => ({
      Platform: { OS: 'android' },
    }));
    jest.doMock('expo-secure-store', () => ({
      getItemAsync: jest.fn(async () => 'existing-encryption-key'),
      setItemAsync: jest.fn(),
      deleteItemAsync: jest.fn(),
    }));
    jest.doMock('expo-crypto', () => ({
      getRandomBytesAsync: jest.fn(),
    }));
    jest.doMock('react-native-mmkv', () => ({
      createMMKV: jest.fn(() => ({
        getString: jest.fn(),
        set: jest.fn(),
        remove: mmkvRemove,
      })),
    }));
    jest.doMock('../utils/appStorage', () => ({
      getPersistentItem: jest.fn(),
      removePersistentItem,
      setPersistentItem: jest.fn(),
    }));

    let removeSensitiveItem!: typeof import('../utils/sensitiveStorage').removeSensitiveItem;
    jest.isolateModules(() => {
      ({ removeSensitiveItem } = require('../utils/sensitiveStorage'));
    });

    await removeSensitiveItem('private.key');

    expect(mmkvRemove).toHaveBeenCalledWith('private.key');
    expect(removePersistentItem).toHaveBeenCalledWith('private.key');
  });
});
