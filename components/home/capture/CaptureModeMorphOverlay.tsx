import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Reanimated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Layout } from '../../../constants/theme';

export type CaptureModeMorphRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CaptureModeMorphTransition = {
  id: number;
  direction: 'open' | 'close';
  from: CaptureModeMorphRect;
  to: CaptureModeMorphRect;
};

interface CaptureModeMorphOverlayProps {
  colors: {
    background: string;
    border: string;
  };
  reduceMotionEnabled: boolean;
  transition: CaptureModeMorphTransition | null;
  onFinished: (id: number) => void;
}

function lerp(start: number, end: number, progress: number) {
  'worklet';
  return start + (end - start) * progress;
}

function CaptureModeMorphOverlay({
  colors,
  reduceMotionEnabled,
  transition,
  onFinished,
}: CaptureModeMorphOverlayProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!transition) {
      progress.value = 0;
      return;
    }

    progress.value = 0;
    progress.value = withTiming(
      1,
      {
        duration: reduceMotionEnabled ? 120 : 420,
        easing: reduceMotionEnabled
          ? Easing.out(Easing.cubic)
          : Easing.bezier(0.2, 0.92, 0.18, 1),
      },
      (finished) => {
        if (finished) {
          runOnJS(onFinished)(transition.id);
        }
      }
    );
  }, [onFinished, progress, reduceMotionEnabled, transition]);

  const shellStyle = useAnimatedStyle(() => {
    if (!transition) {
      return {
        opacity: 0,
      };
    }

    const easedProgress = Math.min(1, Math.max(0, progress.value));
    const width = lerp(transition.from.width, transition.to.width, easedProgress);
    const height = lerp(transition.from.height, transition.to.height, easedProgress);
    const fromCenterX = transition.from.x + transition.from.width / 2;
    const fromCenterY = transition.from.y + transition.from.height / 2;
    const toCenterX = transition.to.x + transition.to.width / 2;
    const toCenterY = transition.to.y + transition.to.height / 2;
    const centerX = lerp(fromCenterX, toCenterX, easedProgress);
    const centerY = lerp(fromCenterY, toCenterY, easedProgress);
    const radius = lerp(
      Math.min(transition.from.height / 2, Layout.cardRadius),
      Math.min(transition.to.height / 2, Layout.cardRadius),
      easedProgress
    );

    return {
      opacity: interpolate(easedProgress, [0, 0.04, 0.94, 1], [0, 1, 1, 0]),
      left: centerX - width / 2,
      top: centerY - height / 2,
      width,
      height,
      borderRadius: radius,
    };
  }, [transition]);

  if (!transition) {
    return null;
  }

  return (
    <View pointerEvents="auto" style={StyleSheet.absoluteFill}>
      <Reanimated.View
        style={[
          styles.shell,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
          },
          shellStyle,
        ]}
      />
    </View>
  );
}

export default memo(CaptureModeMorphOverlay);

const styles = StyleSheet.create({
  shell: {
    position: 'absolute',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Layout.cardRadius,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
