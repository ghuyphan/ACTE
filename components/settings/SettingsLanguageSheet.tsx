import React from 'react';
import { useTranslation } from 'react-i18next';
import { setAppLanguage } from '../../constants/i18n';
import SettingsSelectionSheetIOS from './SettingsSelectionSheetIOS';
import {
  getLanguageOptions,
  resolveAppLanguageKey,
} from './settingsSelectionOptions';

export default function SettingsLanguageSheet() {
  const { t, i18n } = useTranslation();
  const languageOptions = getLanguageOptions();

  return (
    <SettingsSelectionSheetIOS
      title={t('settings.language', 'Language')}
      options={languageOptions}
      selectedKey={resolveAppLanguageKey(i18n.language)}
      onSelect={(selection) => {
        void setAppLanguage(selection);
      }}
      pickerVariant="wheel"
      pickerHeight={160}
    />
  );
}
