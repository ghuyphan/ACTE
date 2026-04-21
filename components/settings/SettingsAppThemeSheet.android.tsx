import React from 'react';
import { useTranslation } from 'react-i18next';
import type { AppThemeType } from '../../hooks/useTheme';
import { useTheme } from '../../hooks/useTheme';
import SettingsSelectionSheetAndroid from './SettingsSelectionSheet.android';
import { getAppThemeOptions } from './settingsSelectionOptions';

export default function SettingsAppThemeSheetAndroid({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { appTheme, setAppTheme } = useTheme();
  const appThemeOptions = getAppThemeOptions(t);

  return (
    <SettingsSelectionSheetAndroid
      title={t('settings.appTheme', 'App Theme')}
      options={appThemeOptions}
      selectedKey={appTheme}
      onSelect={(nextAppTheme) => setAppTheme(nextAppTheme as AppThemeType)}
      onClose={onClose}
    />
  );
}
