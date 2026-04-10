import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '../../../hooks/useReducedMotion';

type PolaroidCaptureButtonProps = {
  color: string;
  isCapturing: boolean;
};

export default function PolaroidCaptureButton({
  color,
  isCapturing,
}: PolaroidCaptureButtonProps) {
  const reduceMotionEnabled = useReducedMotion();
  const captureProgress = useSharedValue(isCapturing ? 1 : 0);
  const flashProgress = useSharedValue(0);

  useEffect(() => {
    captureProgress.value = withTiming(isCapturing ? 1 : 0, {
      duration: reduceMotionEnabled ? 110 : 180,
      easing: Easing.out(Easing.cubic),
    });

    if (isCapturing) {
      flashProgress.value = reduceMotionEnabled
        ? withTiming(1, { duration: 110, easing: Easing.out(Easing.cubic) })
        : withRepeat(
            withSequence(
              withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }),
              withTiming(0.25, { duration: 260, easing: Easing.inOut(Easing.cubic) })
            ),
            -1,
            true
          );
      return;
    }

    flashProgress.value = withTiming(0, {
      duration: reduceMotionEnabled ? 110 : 160,
      easing: Easing.out(Easing.cubic),
    });
  }, [captureProgress, flashProgress, isCapturing, reduceMotionEnabled]);

  const downloadIconAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(captureProgress.value, [0, 1], [1, 0]),
    transform: [
      { translateY: interpolate(captureProgress.value, [0, 1], [0, -6]) },
      { scale: interpolate(captureProgress.value, [0, 1], [1, 0.84]) },
    ],
  }));
  const polaroidIconAnimatedStyle = useAnimatedStyle(() => ({
    opacity: captureProgress.value,
    transform: [
      { translateY: interpolate(captureProgress.value, [0, 1], [6, 0]) },
      { scale: interpolate(captureProgress.value, [0, 1], [0.84, 1]) },
    ],
  }));
  const flashAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flashProgress.value, [0, 1], [0, 0.2]),
    transform: [{ scale: interpolate(flashProgress.value, [0, 1], [0.9, 1.08]) }],
  }));

  return (
    <View style={styles.iconStack}>
      <Animated.View pointerEvents="none" style={[styles.captureFlash, flashAnimatedStyle]} />
      <Animated.View style={[styles.iconLayer, downloadIconAnimatedStyle]}>
        <Ionicons name="download-outline" size={20} color={color} />
      </Animated.View>
      <Animated.View style={[styles.iconLayer, polaroidIconAnimatedStyle]}>
        <Ionicons name="images-outline" size={18} color={color} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  iconStack: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLayer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureFlash: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
  },
});
