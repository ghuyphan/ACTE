import React from 'react';
import { useTranslation } from 'react-i18next';
import { type StyleProp, type ViewStyle } from 'react-native';
import AppIconButton from './AppIconButton';

export default function AppBackButton({
  onPress,
  size = 20,
  style,
  testID,
}: {
  onPress: () => void;
  size?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { t } = useTranslation();

  return (
    <AppIconButton
      icon="chevron-back"
      accessibilityLabel={t('common.back', 'Back')}
      onPress={onPress}
      size={size}
      style={style}
      testID={testID}
    />
  );
}
