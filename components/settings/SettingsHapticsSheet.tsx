import React from 'react';
import { useTranslation } from 'react-i18next';
import { useHaptics } from '../../hooks/useHaptics';
import { getHapticsOptions, type HapticsSettingValue } from './settingsSelectionOptions';
import SettingsSelectionSheetIOS from './SettingsSelectionSheetIOS';

export default function SettingsHapticsSheet() {
  const { t } = useTranslation();
  const { isEnabled, setIsEnabled } = useHaptics();
  const hapticsOptions = getHapticsOptions(t);

  return (
    <SettingsSelectionSheetIOS
      title={t('settings.haptics', 'Haptics')}
      options={hapticsOptions}
      selectedKey={isEnabled ? 'on' : 'off'}
      onSelect={(selection) => {
        void setIsEnabled((selection as HapticsSettingValue) === 'on');
      }}
      pickerVariant="segmented"
    />
  );
}
