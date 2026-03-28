import { useCallback, useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { getMapCardEnter, getMapCardExit, mapMotionDurations, mapMotionEasing } from './mapMotion';

const PREVIEW_HORIZONTAL_INSET = 14;
const DISMISS_DISTANCE = 36;
const DISMISS_TRAVEL = 108;
const MAX_DRAG_TRAVEL = 120;
const DRAG_RESISTANCE_START = 54;
const DRAG_RESISTANCE_FACTOR = 0.38;
const DISMISS_VELOCITY = 640;
const HORIZONTAL_FAIL_OFFSET = 18;

function applyDragResistance(distance: number) {
  'worklet';

  if (distance <= 0) {
    return 0;
  }

  if (distance <= DRAG_RESISTANCE_START) {
    return distance;
  }

  return Math.min(
    DRAG_RESISTANCE_START + (distance - DRAG_RESISTANCE_START) * DRAG_RESISTANCE_FACTOR,
    MAX_DRAG_TRAVEL
  );
}

interface MapPreviewSheetProps {
  bottomOffset: number;
  shellTestID: string;
  dismissTestID: string;
  handleColor: string;
  onDismiss: () => void;
  reduceMotionEnabled: boolean;
  children: ReactNode;
}

export default function MapPreviewSheet({
  bottomOffset,
  shellTestID,
  dismissTestID,
  handleColor,
  onDismiss,
  reduceMotionEnabled,
  children,
}: MapPreviewSheetProps) {
  const translateY = useSharedValue(0);
  const dismissing = useSharedValue(false);

  const resetPosition = useCallback(() => {
    cancelAnimation(translateY);
    dismissing.value = false;

    if (reduceMotionEnabled) {
      translateY.value = 0;
      return;
    }

    translateY.value = withSpring(0, {
      damping: 24,
      stiffness: 280,
      mass: 0.82,
    });
  }, [dismissing, reduceMotionEnabled, translateY]);

  const finishDismiss = useCallback(() => {
    cancelAnimation(translateY);
    dismissing.value = true;

    if (reduceMotionEnabled) {
      translateY.value = 0;
      dismissing.value = false;
      onDismiss();
      return;
    }

    translateY.value = withTiming(
      DISMISS_TRAVEL,
      {
        duration: mapMotionDurations.standard,
        easing: mapMotionEasing.standard,
      },
      (finished) => {
        if (!finished) {
          dismissing.value = false;
          return;
        }

        translateY.value = 0;
        dismissing.value = false;
        runOnJS(onDismiss)();
      }
    );
  }, [dismissing, onDismiss, reduceMotionEnabled, translateY]);

  const handlePressDismiss = useCallback(() => {
    finishDismiss();
  }, [finishDismiss]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(true)
        .maxPointers(1)
        .minDistance(2)
        .activeOffsetY(4)
        .failOffsetX([-HORIZONTAL_FAIL_OFFSET, HORIZONTAL_FAIL_OFFSET])
        .shouldCancelWhenOutside(false)
        .onBegin(() => {
          cancelAnimation(translateY);
          dismissing.value = false;
        })
        .onUpdate((event) => {
          translateY.value = applyDragResistance(event.translationY);
        })
        .onEnd((event) => {
          const shouldDismiss =
            translateY.value >= DISMISS_DISTANCE ||
            (event.translationY > 12 && event.velocityY >= DISMISS_VELOCITY);

          if (shouldDismiss) {
            runOnJS(finishDismiss)();
            return;
          }

          runOnJS(resetPosition)();
        })
        .onFinalize(() => {
          if (!dismissing.value && translateY.value > 0) {
            runOnJS(resetPosition)();
          }
        }),
    [dismissing, finishDismiss, resetPosition, translateY]
  );

  const animatedStyle = useAnimatedStyle(() => {
    const progress = Math.min(translateY.value / DISMISS_TRAVEL, 1);

    return {
      opacity: interpolate(progress, [0, 1], [1, 0.92]),
      transform: [{ translateY: translateY.value }],
    };
  }, [translateY]);

  const handleAnimatedStyle = useAnimatedStyle(() => {
    const progress = Math.min(translateY.value / DISMISS_TRAVEL, 1);

    return {
      opacity: interpolate(progress, [0, 1], [1, 0.74]),
      transform: [{ scaleX: interpolate(progress, [0, 1], [1, 1.08]) }],
    };
  }, [translateY]);

  return (
    <Animated.View
      testID={shellTestID}
      entering={getMapCardEnter(reduceMotionEnabled)}
      exiting={getMapCardExit(reduceMotionEnabled)}
      style={[
        styles.wrapper,
        {
          bottom: bottomOffset,
        },
        animatedStyle,
      ]}
      pointerEvents="box-none"
    >
      <GestureDetector gesture={panGesture}>
        <View style={styles.handleGestureZone} pointerEvents="box-none">
          <Pressable
            testID={dismissTestID}
            accessibilityRole="button"
            accessibilityLabel="Dismiss map preview"
            onPress={handlePressDismiss}
            style={styles.dismissHandlePressable}
          >
            <Animated.View
              style={[
                styles.dismissHandle,
                { backgroundColor: handleColor },
                handleAnimatedStyle,
              ]}
            />
          </Pressable>
        </View>
      </GestureDetector>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: PREVIEW_HORIZONTAL_INSET,
    right: PREVIEW_HORIZONTAL_INSET,
    zIndex: 12,
  },
  handleGestureZone: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    height: 44,
  },
  dismissHandlePressable: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 18,
  },
  dismissHandle: {
    width: 42,
    height: 5,
    borderRadius: 999,
  },
});
