import React from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';
import SettingsSelectionSheetAndroid from './SettingsSelectionSheet.android';

const OPTIONS: { key: 'system' | 'light' | 'dark'; labelKey: string; fallback: string }[] = [
  { key: 'system', labelKey: 'settings.system', fallback: 'System' },
  { key: 'light', labelKey: 'settings.light', fallback: 'Light' },
  { key: 'dark', labelKey: 'settings.dark', fallback: 'Dark' },
];

export default function SettingsThemeSheetAndroid({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  return (
    <SettingsSelectionSheetAndroid
      title={t('settings.theme', 'Theme')}
      options={OPTIONS.map((option) => ({
        key: option.key,
        label: t(option.labelKey, option.fallback),
      }))}
      selectedKey={theme}
      onSelect={(nextTheme) => setTheme(nextTheme as 'system' | 'light' | 'dark')}
      onClose={onClose}
    />
  );
}
