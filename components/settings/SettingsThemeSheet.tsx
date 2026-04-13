import React from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { getThemeOptions } from './settingsSelectionOptions';
import SettingsSelectionSheetIOS from './SettingsSelectionSheetIOS';

export default function SettingsThemeSheet() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const themeOptions = getThemeOptions(t);

  return (
    <SettingsSelectionSheetIOS
      title={t('settings.theme', 'Theme')}
      options={themeOptions}
      selectedKey={theme}
      onSelect={(selection) => {
        setTheme(selection);
      }}
      pickerVariant="segmented"
    />
  );
}
