function loadI18nModule(options?: {
  locales?: Array<{ languageCode?: string | null; languageTag?: string | null }>;
  storage?: Map<string, string>;
}) {
  const locales = options?.locales ?? [{ languageCode: 'en', languageTag: 'en-US' }];
  const storage = options?.storage ?? new Map<string, string>();

  jest.resetModules();
  jest.doMock('expo-localization', () => ({
    getLocales: jest.fn(() => locales),
  }));
  jest.doMock('../utils/appStorage', () => ({
    getPersistentItem: jest.fn(async (key: string) => storage.get(key) ?? null),
    multiSetPersistent: jest.fn(async (entries: Array<[string, string]>) => {
      entries.forEach(([key, value]) => {
        storage.set(key, value);
      });
    }),
  }));

  return {
    storage,
    module: require('../constants/i18n') as typeof import('../constants/i18n'),
  };
}

describe('i18n language resolution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('normalizes region-tagged languages to supported app locales', () => {
    const {
      module: { normalizeAppLanguage },
    } = loadI18nModule();

    expect(normalizeAppLanguage('vi-VN')).toBe('vi');
    expect(normalizeAppLanguage('en_US')).toBe('en');
    expect(normalizeAppLanguage('fr-FR')).toBe('en');
    expect(normalizeAppLanguage(undefined)).toBe('en');
  });

  it('prefers a stored language and normalizes it', async () => {
    const storage = new Map<string, string>([
      ['settings.lang', 'vi-VN'],
      ['settings.lang.source', 'user'],
    ]);
    const {
      module: { detectInitialLanguage },
    } = loadI18nModule({ storage });

    await expect(detectInitialLanguage()).resolves.toBe('vi');
  });

  it('falls back to the device locale when there is no stored preference', async () => {
    const {
      module: { detectInitialLanguage },
    } = loadI18nModule({
      locales: [{ languageCode: null, languageTag: 'vi-VN' }],
    });

    await expect(detectInitialLanguage()).resolves.toBe('vi');
  });

  it('ignores legacy auto-cached language values without an explicit user preference marker', async () => {
    const storage = new Map<string, string>([['settings.lang', 'en']]);
    const {
      module: { detectInitialLanguage },
    } = loadI18nModule({
      locales: [{ languageCode: 'vi', languageTag: 'vi-VN' }],
      storage,
    });

    await expect(detectInitialLanguage()).resolves.toBe('vi');
  });

  it('persists an explicit language choice for future launches', async () => {
    const { storage, module } = loadI18nModule();

    await module.i18nReady;
    await module.setAppLanguage('vi-VN');

    expect(storage.get('settings.lang')).toBe('vi');
    expect(storage.get('settings.lang.source')).toBe('user');
    expect(module.default.language).toBe('vi');
  });
});
