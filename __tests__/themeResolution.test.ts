import {
  getThemePalette,
  normalizeAppTheme,
  normalizeSystemColorScheme,
  resolveThemePreference,
} from '../hooks/useTheme';

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

  it('defaults the app theme style to default and maps the old pastel key forward', () => {
    expect(normalizeAppTheme(null)).toBe('default');
    expect(normalizeAppTheme('unknown')).toBe('default');
    expect(normalizeAppTheme('pastel')).toBe('cotton-candy');
    expect(normalizeAppTheme('berry')).toBe('berry');
    expect(normalizeAppTheme('classic')).toBe('default');
  });

  it('returns distinct palettes for the app theme variants', () => {
    expect(getThemePalette('default').light.primary).not.toBe(getThemePalette('cotton-candy').light.primary);
    expect(getThemePalette('matcha').light.gradient).not.toEqual(getThemePalette('berry').light.gradient);
    expect(getThemePalette('peach').dark.accent).not.toBe(getThemePalette('default').dark.accent);
  });
});
