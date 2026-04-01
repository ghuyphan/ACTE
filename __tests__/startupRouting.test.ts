const mockGetPersistentItem = jest.fn();
const mockGetPersistentItemSync = jest.fn();

jest.mock('../utils/appStorage', () => ({
  getPersistentItem: (...args: unknown[]) => mockGetPersistentItem(...args),
  getPersistentItemSync: (...args: unknown[]) => mockGetPersistentItemSync(...args),
}));

import {
  getCachedStartupRoute,
  getDefaultStartupRoute,
  HAS_LAUNCHED_KEY,
  loadStartupRoute,
  resolveStartupRoute,
} from '../services/startupRouting';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('startupRouting', () => {
  it('resolves onboarding when the launch flag is missing', () => {
    expect(resolveStartupRoute(null, 'entry')).toBe('/auth/onboarding');
    expect(resolveStartupRoute(null, 'index')).toBe('/auth/onboarding');
  });

  it('resolves signed-in startup targets consistently', () => {
    expect(resolveStartupRoute('true', 'entry')).toBe('/');
    expect(resolveStartupRoute('true', 'index')).toBe('/(tabs)');
  });

  it('reads cached startup routes when sync storage is available', () => {
    mockGetPersistentItemSync.mockReturnValue('true');

    expect(getCachedStartupRoute('entry')).toBe('/');
    expect(getCachedStartupRoute('index')).toBe('/(tabs)');
    expect(mockGetPersistentItemSync).toHaveBeenCalledWith(HAS_LAUNCHED_KEY);
  });

  it('returns null while sync storage is unresolved', () => {
    mockGetPersistentItemSync.mockReturnValue(undefined);
    expect(getCachedStartupRoute('entry')).toBeNull();
  });

  it('loads startup routes asynchronously', async () => {
    mockGetPersistentItem.mockResolvedValue('true');

    await expect(loadStartupRoute('entry')).resolves.toBe('/');
    await expect(loadStartupRoute('index')).resolves.toBe('/(tabs)');
  });

  it('falls back to the app route when async storage lookup fails', async () => {
    mockGetPersistentItem.mockRejectedValue(new Error('storage unavailable'));

    await expect(loadStartupRoute('entry')).resolves.toBe(getDefaultStartupRoute('entry'));
    await expect(loadStartupRoute('index')).resolves.toBe(getDefaultStartupRoute('index'));
  });
});
