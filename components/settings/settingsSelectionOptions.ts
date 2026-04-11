import type { TFunction } from 'i18next';
import type { AppLanguageCode } from '../../constants/i18n';
import type { ThemeType } from '../../hooks/useTheme';

export type SettingsOption<Key extends string> = {
  key: Key;
  label: string;
};

export type HapticsSettingValue = 'on' | 'off';
export const THEME_SETTING_VALUES: ThemeType[] = ['system', 'light', 'dark'];
export const LANGUAGE_SETTING_VALUES: AppLanguageCode[] = ['en', 'vi'];
export const HAPTICS_SETTING_VALUES: HapticsSettingValue[] = ['on', 'off'];

const THEME_LABELS: Record<ThemeType, { key: string; fallback: string }> = {
  system: { key: 'settings.system', fallback: 'System' },
  light: { key: 'settings.light', fallback: 'Light' },
  dark: { key: 'settings.dark', fallback: 'Dark' },
};

const LANGUAGE_LABELS: Record<AppLanguageCode, string> = {
  en: 'English',
  vi: 'Tiếng Việt',
};

const HAPTICS_LABELS: Record<HapticsSettingValue, { key: string; fallback: string }> = {
  on: { key: 'settings.autoSyncOnShort', fallback: 'On' },
  off: { key: 'settings.autoSyncOff', fallback: 'Off' },
};

export function getThemeLabel(theme: ThemeType, t: TFunction): string {
  const label = THEME_LABELS[theme];
  return t(label.key, label.fallback);
}

export function getThemeOptions(t: TFunction): SettingsOption<ThemeType>[] {
  return THEME_SETTING_VALUES.map((key) => ({
    key,
    label: getThemeLabel(key, t),
  }));
}

export function getLanguageLabel(language: AppLanguageCode): string {
  return LANGUAGE_LABELS[language];
}

export function getLanguageOptions(): SettingsOption<AppLanguageCode>[] {
  return LANGUAGE_SETTING_VALUES.map((key) => ({
    key,
    label: getLanguageLabel(key),
  }));
}

export function getHapticsLabel(value: HapticsSettingValue, t: TFunction): string {
  const label = HAPTICS_LABELS[value];
  return t(label.key, label.fallback);
}

export function getHapticsOptions(t: TFunction): SettingsOption<HapticsSettingValue>[] {
  return HAPTICS_SETTING_VALUES.map((key) => ({
    key,
    label: getHapticsLabel(key, t),
  }));
}

export function resolveAppLanguageKey(language: string | null | undefined): AppLanguageCode {
  const normalized = language?.trim().toLowerCase().replace(/_/g, '-');

  if (normalized?.startsWith('vi')) {
    return 'vi';
  }

  return 'en';
}
