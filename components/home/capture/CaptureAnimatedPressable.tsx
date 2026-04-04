import * as Haptics from 'expo-haptics';
import { type ReactNode, memo, useCallback, useEffect } from 'react';
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import {
  CAPTURE_BUTTON_PRESS_IN,
  CAPTURE_BUTTON_PRESS_OUT,
  CAPTURE_BUTTON_STATE_IN,
  CAPTURE_BUTTON_STATE_OUT,
  triggerCaptureCardHaptic,
} from './captureMotion';

const AnimatedPressable = Reanimated.createAnimatedComponent(Pressable);

export type CaptureAnimatedPressableProps = Omit<PressableProps, 'children' | 'style'> & {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  pressedScale?: number;
  active?: boolean;
  activeScale?: number;
  activeTranslateY?: number;
  disabledOpacity?: number;
  contentActiveScale?: number;
  contentActiveTranslateY?: number;
  childrenContainerStyle?: StyleProp<ViewStyle>;
  hapticStyle?: Haptics.ImpactFeedbackStyle | null;
};

export const CaptureAnimatedPressable = memo(function CaptureAnimatedPressable({
  children,
  disabled,
  active = false,
  activeScale = 1,
  activeTranslateY = 0,
  disabledOpacity = 0.45,
  contentActiveScale = 1,
  contentActiveTranslateY = 0,
  childrenContainerStyle,
  hapticStyle = Haptics.ImpactFeedbackStyle.Light,
  onPress,
  onPressIn,
  onPressOut,
  pressedScale = 0.97,
  style,
  ...props
}: CaptureAnimatedPressableProps) {
  const reduceMotionEnabled = useReducedMotion();
  const pressScale = useSharedValue(1);
  const activeProgress = useSharedValue(active ? 1 : 0);
  const disabledProgress = useSharedValue(disabled ? 1 : 0);

  useEffect(() => {
    const transition = reduceMotionEnabled
      ? { duration: 110, easing: CAPTURE_BUTTON_STATE_IN.easing }
      : active
        ? CAPTURE_BUTTON_STATE_IN
        : CAPTURE_BUTTON_STATE_OUT;
    activeProgress.value = withTiming(active ? 1 : 0, transition);
  }, [active, activeProgress, reduceMotionEnabled]);

  useEffect(() => {
    if (disabled) {
      pressScale.value = 1;
    }

    const transition = reduceMotionEnabled
      ? { duration: 110, easing: CAPTURE_BUTTON_STATE_IN.easing }
      : disabled
        ? CAPTURE_BUTTON_STATE_IN
        : CAPTURE_BUTTON_STATE_OUT;
    disabledProgress.value = withTiming(disabled ? 1 : 0, transition);
  }, [disabled, disabledProgress, pressScale, reduceMotionEnabled]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - disabledProgress.value * (1 - disabledOpacity),
    transform: [
      { translateY: activeTranslateY * activeProgress.value },
      {
        scale: pressScale.value * (1 + (activeScale - 1) * activeProgress.value),
      },
    ],
  }));

  const animatedChildrenStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: contentActiveTranslateY * activeProgress.value },
      { scale: 1 + (contentActiveScale - 1) * activeProgress.value },
    ],
  }));

  const handlePressIn = useCallback<NonNullable<PressableProps['onPressIn']>>(
    (event) => {
      if (!disabled) {
        pressScale.value = withTiming(pressedScale, CAPTURE_BUTTON_PRESS_IN);
      }
      onPressIn?.(event);
    },
    [disabled, onPressIn, pressScale, pressedScale]
  );

  const handlePressOut = useCallback<NonNullable<PressableProps['onPressOut']>>(
    (event) => {
      pressScale.value = reduceMotionEnabled
        ? withTiming(1, CAPTURE_BUTTON_PRESS_OUT)
        : withSpring(1, {
            stiffness: 520,
            damping: 34,
            mass: 0.38,
          });
      onPressOut?.(event);
    },
    [onPressOut, pressScale, reduceMotionEnabled]
  );

  const handlePress = useCallback<NonNullable<PressableProps['onPress']>>(
    (event) => {
      if (!disabled && hapticStyle != null) {
        triggerCaptureCardHaptic(hapticStyle);
      }
      onPress?.(event);
    },
    [disabled, hapticStyle, onPress]
  );

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
    >
      <Reanimated.View style={[styles.captureButtonContent, childrenContainerStyle, animatedChildrenStyle]}>
        {children}
      </Reanimated.View>
    </AnimatedPressable>
  );
});

const styles = StyleSheet.create({
  captureButtonContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
});
