import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { styles } from './captureCardStyles';
import { GlassView } from '../../ui/GlassView';
import { isOlderIOS } from '../../../utils/platform';
import {
  CaptureAnimatedPressable,
  type CaptureAnimatedPressableProps,
} from './CaptureAnimatedPressable';

export type CaptureGlassActionButtonProps = Omit<CaptureAnimatedPressableProps, 'children'> & {
  iconName: ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  glassColorScheme: 'light' | 'dark';
  fallbackColor: string;
  borderColor: string;
  iconSize?: number;
};

export const CaptureGlassActionButton = memo(function CaptureGlassActionButton({
  iconName,
  iconColor,
  glassColorScheme,
  fallbackColor,
  borderColor,
  iconSize = 18,
  style,
  ...props
}: CaptureGlassActionButtonProps) {
  return (
    <CaptureAnimatedPressable
      {...props}
      childrenContainerStyle={styles.secondaryActionButtonContent}
      style={[
        styles.secondaryActionButton,
        {
          borderColor,
        },
        style,
      ]}
    >
      {isOlderIOS ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: fallbackColor,
            },
          ]}
        />
      ) : null}
      <GlassView
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        glassEffectStyle="regular"
        colorScheme={glassColorScheme}
        fallbackColor={fallbackColor}
      />
      <Ionicons name={iconName} size={iconSize} color={iconColor} />
    </CaptureAnimatedPressable>
  );
});
