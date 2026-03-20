jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageCode: 'en', languageTag: 'en-US' }]),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import i18n, { detectInitialLanguage, normalizeAppLanguage, setAppLanguage } from '../constants/i18n';

describe('i18n language resolution', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    (getLocales as jest.Mock).mockReturnValue([{ languageCode: 'en', languageTag: 'en-US' }]);
  });

  it('normalizes region-tagged languages to supported app locales', () => {
    expect(normalizeAppLanguage('vi-VN')).toBe('vi');
    expect(normalizeAppLanguage('en_US')).toBe('en');
    expect(normalizeAppLanguage('fr-FR')).toBe('en');
    expect(normalizeAppLanguage(undefined)).toBe('en');
  });

  it('prefers a stored language and normalizes it', async () => {
    await AsyncStorage.setItem('settings.lang', 'vi-VN');
    await AsyncStorage.setItem('settings.lang.source', 'user');

    await expect(detectInitialLanguage()).resolves.toBe('vi');
  });

  it('falls back to the device locale when there is no stored preference', async () => {
    (getLocales as jest.Mock).mockReturnValue([{ languageCode: null, languageTag: 'vi-VN' }]);

    await expect(detectInitialLanguage()).resolves.toBe('vi');
  });

  it('ignores legacy auto-cached language values without an explicit user preference marker', async () => {
    await AsyncStorage.setItem('settings.lang', 'en');
    (getLocales as jest.Mock).mockReturnValue([{ languageCode: 'vi', languageTag: 'vi-VN' }]);

    await expect(detectInitialLanguage()).resolves.toBe('vi');
  });

  it('persists an explicit language choice for future launches', async () => {
    await setAppLanguage('vi-VN');

    await expect(AsyncStorage.getItem('settings.lang')).resolves.toBe('vi');
    await expect(AsyncStorage.getItem('settings.lang.source')).resolves.toBe('user');
    expect(i18n.language).toBe('vi');
  });
});
