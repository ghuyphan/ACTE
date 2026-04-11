import React from 'react';
import { useTranslation } from 'react-i18next';
import { useHaptics } from '../../hooks/useHaptics';
import SettingsSelectionSheetAndroid from './SettingsSelectionSheet.android';
import { getHapticsOptions } from './settingsSelectionOptions';

export default function SettingsHapticsSheetAndroid({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { isEnabled, setIsEnabled } = useHaptics();
  const hapticsOptions = getHapticsOptions(t);

  return (
    <SettingsSelectionSheetAndroid
      title={t('settings.haptics', 'Haptics')}
      options={hapticsOptions}
      selectedKey={isEnabled ? 'on' : 'off'}
      onSelect={(nextValue) => setIsEnabled(nextValue === 'on')}
      onClose={onClose}
    />
  );
}
