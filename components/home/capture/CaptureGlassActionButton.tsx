import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { GlassView } from '../../ui/GlassView';
import { isOlderIOS } from '../../../utils/platform';
import {
  CaptureAnimatedPressable,
  type CaptureAnimatedPressableProps,
} from './CaptureAnimatedPressable';

const SIDE_ACTION_SIZE = 46;

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

const styles = StyleSheet.create({
  secondaryActionButton: {
    width: SIDE_ACTION_SIZE,
    height: SIDE_ACTION_SIZE,
    borderRadius: SIDE_ACTION_SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionButtonContent: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
});
