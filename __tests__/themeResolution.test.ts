import { resolveThemePreference } from '../hooks/useTheme';

describe('theme resolution', () => {
  it('follows the system scheme when theme preference is system', () => {
    expect(resolveThemePreference('system', 'dark')).toBe('dark');
    expect(resolveThemePreference('system', 'light')).toBe('light');
  });

  it('honors explicit light and dark overrides', () => {
    expect(resolveThemePreference('dark', 'light')).toBe('dark');
    expect(resolveThemePreference('light', 'dark')).toBe('light');
  });
});
