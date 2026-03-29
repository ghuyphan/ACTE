import React from 'react';
import { useTranslation } from 'react-i18next';
import { setAppLanguage } from '../constants/i18n';
import SettingsSelectionSheetAndroid from './SettingsSelectionSheet.android';

export default function SettingsLanguageSheetAndroid({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation();

  return (
    <SettingsSelectionSheetAndroid
      title={t('settings.language', 'Language')}
      options={[
        { key: 'en', label: 'English' },
        { key: 'vi', label: 'Tiếng Việt' },
      ]}
      selectedKey={i18n.language}
      onSelect={(language) => setAppLanguage(language)}
      onClose={onClose}
    />
  );
}
