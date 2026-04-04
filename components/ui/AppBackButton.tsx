import React from 'react';
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
  return (
    <AppIconButton
      icon="chevron-back"
      onPress={onPress}
      size={size}
      style={style}
      testID={testID}
    />
  );
}
