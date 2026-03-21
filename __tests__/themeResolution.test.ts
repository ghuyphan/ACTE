import { normalizeSystemColorScheme, resolveThemePreference } from '../hooks/useTheme';

describe('theme resolution', () => {
  it('keeps the last resolved system theme when iOS reports unspecified', () => {
    expect(normalizeSystemColorScheme('unspecified', 'dark')).toBe('dark');
    expect(normalizeSystemColorScheme(undefined, 'dark')).toBe('dark');
    expect(normalizeSystemColorScheme(null, 'light')).toBe('light');
  });

  it('follows the system scheme when theme preference is system', () => {
    expect(resolveThemePreference('system', 'dark')).toBe('dark');
    expect(resolveThemePreference('system', 'light')).toBe('light');
  });

  it('honors explicit light and dark overrides', () => {
    expect(resolveThemePreference('dark', 'light')).toBe('dark');
    expect(resolveThemePreference('light', 'dark')).toBe('light');
  });
});
