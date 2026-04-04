import { Ionicons } from '@expo/vector-icons';
import { type ComponentProps, memo, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Reanimated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { CAPTURE_BUTTON_STATE_IN, CAPTURE_BUTTON_STATE_OUT } from './captureMotion';
import {
  CaptureAnimatedPressable,
  type CaptureAnimatedPressableProps,
} from './CaptureAnimatedPressable';

type CaptureToggleIconButtonProps = Omit<CaptureAnimatedPressableProps, 'children'> & {
  active: boolean;
  activeIconName: ComponentProps<typeof Ionicons>['name'];
  inactiveIconName: ComponentProps<typeof Ionicons>['name'];
  activeBackgroundColor: string;
  inactiveBackgroundColor: string;
  activeBorderColor: string;
  inactiveBorderColor: string;
  activeIconColor: string;
  inactiveIconColor: string;
  iconSize?: number;
};

export const CaptureToggleIconButton = memo(function CaptureToggleIconButton({
  active,
  activeIconName,
  inactiveIconName,
  activeBackgroundColor,
  inactiveBackgroundColor,
  activeBorderColor,
  inactiveBorderColor,
  activeIconColor,
  inactiveIconColor,
  iconSize = 17,
  style,
  activeScale = 1.035,
  activeTranslateY = -1.5,
  contentActiveScale = 1.06,
  contentActiveTranslateY = -0.5,
  ...props
}: CaptureToggleIconButtonProps) {
  const reduceMotionEnabled = useReducedMotion();
  const activeProgress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    const transition = reduceMotionEnabled
      ? { duration: 110, easing: CAPTURE_BUTTON_STATE_IN.easing }
      : active
        ? CAPTURE_BUTTON_STATE_IN
        : CAPTURE_BUTTON_STATE_OUT;
    activeProgress.value = withTiming(active ? 1 : 0, transition);
  }, [active, activeProgress, reduceMotionEnabled]);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      activeProgress.value,
      [0, 1],
      [inactiveBackgroundColor, activeBackgroundColor]
    ),
    borderColor: interpolateColor(
      activeProgress.value,
      [0, 1],
      [inactiveBorderColor, activeBorderColor]
    ),
  }));

  const animatedInactiveIconStyle = useAnimatedStyle(() => ({
    opacity: 1 - activeProgress.value,
    transform: [{ translateY: Math.round(activeProgress.value * 3) }],
  }));

  const animatedActiveIconStyle = useAnimatedStyle(() => ({
    opacity: activeProgress.value,
    transform: [{ translateY: Math.round((1 - activeProgress.value) * -3) }],
  }));

  return (
    <CaptureAnimatedPressable
      {...props}
      active={active}
      activeScale={activeScale}
      activeTranslateY={activeTranslateY}
      contentActiveScale={contentActiveScale}
      contentActiveTranslateY={contentActiveTranslateY}
      style={[style, animatedButtonStyle]}
    >
      <View style={styles.captureToggleIconWrap}>
        <Reanimated.View style={[styles.captureToggleIconLayer, animatedInactiveIconStyle]}>
          <Ionicons name={inactiveIconName} size={iconSize} color={inactiveIconColor} />
        </Reanimated.View>
        <Reanimated.View style={[styles.captureToggleIconLayer, animatedActiveIconStyle]}>
          <Ionicons name={activeIconName} size={iconSize} color={activeIconColor} />
        </Reanimated.View>
      </View>
    </CaptureAnimatedPressable>
  );
});

const styles = StyleSheet.create({
  captureToggleIconWrap: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureToggleIconLayer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
