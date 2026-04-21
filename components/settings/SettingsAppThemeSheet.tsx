import React from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { getAppThemeOptions } from './settingsSelectionOptions';
import SettingsSelectionSheetIOS from './SettingsSelectionSheetIOS';

export default function SettingsAppThemeSheet() {
  const { t } = useTranslation();
  const { appTheme, setAppTheme } = useTheme();
  const appThemeOptions = getAppThemeOptions(t);

  return (
    <SettingsSelectionSheetIOS
      title={t('settings.appTheme', 'App Theme')}
      options={appThemeOptions}
      selectedKey={appTheme}
      onSelect={(selection) => {
        setAppTheme(selection);
      }}
      pickerVariant="wheel"
      pickerHeight={240}
    />
  );
}
