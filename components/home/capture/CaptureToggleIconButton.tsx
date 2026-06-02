import { Ionicons } from '@expo/vector-icons';
import { type ComponentProps, memo, type ReactNode, useEffect } from 'react';
import { View } from 'react-native';
import Reanimated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { styles } from './captureCardStyles';
import {
  CAPTURE_BUTTON_STATE_IN,
  CAPTURE_BUTTON_STATE_OUT,
  getCaptureTiming,
} from './captureMotion';
import {
  CaptureAnimatedPressable,
  type CaptureAnimatedPressableProps,
} from './CaptureAnimatedPressable';

type CaptureToggleIconButtonProps = Omit<CaptureAnimatedPressableProps, 'children'> & {
  active: boolean;
  activeIconName: ComponentProps<typeof Ionicons>['name'];
  inactiveIconName: ComponentProps<typeof Ionicons>['name'];
  renderActiveIcon?: (props: { color: string; progress: SharedValue<number>; size: number }) => ReactNode;
  renderInactiveIcon?: (props: { color: string; progress: SharedValue<number>; size: number }) => ReactNode;
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
  renderActiveIcon,
  renderInactiveIcon,
  activeBackgroundColor,
  inactiveBackgroundColor,
  activeBorderColor,
  inactiveBorderColor,
  activeIconColor,
  inactiveIconColor,
  iconSize = 20,
  style,
  activeScale = 1.035,
  activeTranslateY = -1.5,
  contentActiveScale = 1.06,
  contentActiveTranslateY = -0.5,
  accessibilityRole = 'button',
  accessibilityState,
  ...props
}: CaptureToggleIconButtonProps) {
  const reduceMotionEnabled = useReducedMotion();
  const activeProgress = useSharedValue(active ? 1 : 0);
  const inactiveProgress = useDerivedValue(() => 1 - activeProgress.value);

  useEffect(() => {
    const transition = reduceMotionEnabled
      ? getCaptureTiming(active ? CAPTURE_BUTTON_STATE_IN : CAPTURE_BUTTON_STATE_OUT, true)
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
      accessibilityRole={accessibilityRole}
      accessibilityState={{
        ...accessibilityState,
        disabled: props.disabled ?? accessibilityState?.disabled,
        selected: active,
      }}
      contentActiveScale={contentActiveScale}
      contentActiveTranslateY={contentActiveTranslateY}
      style={[style, animatedButtonStyle]}
    >
      <View style={styles.captureToggleIconWrap}>
        <Reanimated.View style={[styles.captureToggleIconLayer, animatedInactiveIconStyle]}>
          {renderInactiveIcon
            ? renderInactiveIcon({
                color: inactiveIconColor,
                progress: inactiveProgress,
                size: iconSize,
              })
            : <Ionicons name={inactiveIconName} size={iconSize} color={inactiveIconColor} />}
        </Reanimated.View>
        <Reanimated.View style={[styles.captureToggleIconLayer, animatedActiveIconStyle]}>
          {renderActiveIcon
            ? renderActiveIcon({
                color: activeIconColor,
                progress: activeProgress,
                size: iconSize,
              })
            : <Ionicons name={activeIconName} size={iconSize} color={activeIconColor} />}
        </Reanimated.View>
      </View>
    </CaptureAnimatedPressable>
  );
});
