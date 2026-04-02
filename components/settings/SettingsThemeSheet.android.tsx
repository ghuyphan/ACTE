import React from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import SettingsSelectionSheetAndroid from './SettingsSelectionSheet.android';
import { getThemeOptions } from './settingsSelectionOptions';

export default function SettingsThemeSheetAndroid({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const themeOptions = getThemeOptions(t);

  return (
    <SettingsSelectionSheetAndroid
      title={t('settings.theme', 'Theme')}
      options={themeOptions}
      selectedKey={theme}
      onSelect={(nextTheme) => setTheme(nextTheme as 'system' | 'light' | 'dark')}
      onClose={onClose}
    />
  );
}
