import React from 'react';
import { useTranslation } from 'react-i18next';
import { setAppLanguage } from '../../constants/i18n';
import SettingsSelectionSheetAndroid from './SettingsSelectionSheet.android';
import { getLanguageOptions, resolveAppLanguageKey } from './settingsSelectionOptions';

export default function SettingsLanguageSheetAndroid({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const languageOptions = getLanguageOptions();

  return (
    <SettingsSelectionSheetAndroid
      title={t('settings.language', 'Language')}
      options={languageOptions}
      selectedKey={resolveAppLanguageKey(i18n.language)}
      onSelect={(language) => setAppLanguage(language)}
      onClose={onClose}
    />
  );
}
