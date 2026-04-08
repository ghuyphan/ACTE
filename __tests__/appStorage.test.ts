describe('appStorage', () => {
  const processEnv = process.env as NodeJS.ProcessEnv & { NODE_ENV?: string };
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.resetModules();
    processEnv.NODE_ENV = 'production';
  });

  afterAll(() => {
    processEnv.NODE_ENV = originalNodeEnv;
  });

  it('migrates legacy AsyncStorage values into MMKV on read', async () => {
    const asyncGetItem = jest.fn(async () => 'legacy-value');
    const asyncRemoveItem = jest.fn(async () => undefined);
    const mmkvGetString = jest.fn(() => undefined);
    const mmkvSet = jest.fn();

    jest.doMock('@react-native-async-storage/async-storage', () => ({
      __esModule: true,
      default: {
        getItem: asyncGetItem,
        setItem: jest.fn(),
        removeItem: asyncRemoveItem,
      },
    }));
    jest.doMock('react-native-mmkv', () => ({
      MMKV: jest.fn(() => ({
        getString: mmkvGetString,
        set: mmkvSet,
        delete: jest.fn(),
      })),
    }));

    let getPersistentItem!: typeof import('../utils/appStorage').getPersistentItem;
    jest.isolateModules(() => {
      ({ getPersistentItem } = require('../utils/appStorage'));
    });
    await expect(getPersistentItem('legacy.key')).resolves.toBe('legacy-value');

    expect(asyncGetItem).toHaveBeenCalledWith('legacy.key');
    expect(mmkvSet).toHaveBeenCalledWith('legacy.key', 'legacy-value');
    expect(asyncRemoveItem).toHaveBeenCalledWith('legacy.key');
  });

  it('returns undefined from sync reads when MMKV is unavailable', () => {
    jest.doMock('@react-native-async-storage/async-storage', () => ({
      __esModule: true,
      default: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
    }));
    jest.doMock('react-native-mmkv', () => {
      throw new Error('mmkv unavailable');
    });

    let getPersistentItemSync!: typeof import('../utils/appStorage').getPersistentItemSync;
    jest.isolateModules(() => {
      ({ getPersistentItemSync } = require('../utils/appStorage'));
    });
    expect(getPersistentItemSync('missing.key')).toBeUndefined();
  });
});
