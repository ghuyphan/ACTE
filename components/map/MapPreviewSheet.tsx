import { useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const PREVIEW_HORIZONTAL_INSET = 14;
const DISMISS_DISTANCE = 36;
const DISMISS_TRAVEL = 108;
const MAX_DRAG_TRAVEL = 120;
const DRAG_RESISTANCE_START = 54;
const DRAG_RESISTANCE_FACTOR = 0.38;

function applyDragResistance(distance: number) {
  'worklet';

  if (distance < 0) {
    const rubberBandMax = 60;
    return -rubberBandMax * (1 - Math.exp(distance / 80));
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
  isVisible: boolean;
  onFullyClosed: () => void;
  bottomOffset: number;
  shellTestID: string;
  dismissTestID: string;
  handleColor: string;
  onDismiss: () => void;
  reduceMotionEnabled: boolean;
  children: ReactNode;
}

export default function MapPreviewSheet({
  isVisible,
  onFullyClosed,
  bottomOffset,
  shellTestID,
  dismissTestID,
  handleColor,
  onDismiss,
  reduceMotionEnabled,
  children,
}: MapPreviewSheetProps) {
  const translateY = useSharedValue(400);
  const dismissing = useSharedValue(false);

  useEffect(() => {
    if (isVisible) {
      dismissing.value = false;
      if (reduceMotionEnabled) {
        translateY.value = 0;
      } else {
        translateY.value = withSpring(0, {
          damping: 24,
          stiffness: 280,
          mass: 0.82,
        });
      }
    } else {
      if (!dismissing.value) {
        dismissing.value = true;
        if (reduceMotionEnabled) {
          scheduleOnRN(onFullyClosed);
        } else {
          translateY.value = withSpring(
            800,
            {
              damping: 20,
              stiffness: 160,
              mass: 0.8,
            },
            (finished) => {
              if (finished) {
                scheduleOnRN(onFullyClosed);
              }
            }
          );
        }
      }
    }
  }, [isVisible, dismissing, onFullyClosed, reduceMotionEnabled, translateY]);

  const resetPosition = useCallback(
    (velocity: number = 0) => {
      cancelAnimation(translateY);
      dismissing.value = false;

      if (reduceMotionEnabled) {
        translateY.value = 0;
        return;
      }

      translateY.value = withSpring(0, {
        damping: 18,
        stiffness: 160,
        mass: 0.8,
        velocity,
      });
    },
    [dismissing, reduceMotionEnabled, translateY]
  );

  const finishDismiss = useCallback(
    (velocity: number = 0) => {
      cancelAnimation(translateY);
      dismissing.value = true;

      if (reduceMotionEnabled) {
        translateY.value = 0;
        scheduleOnRN(onDismiss);
        scheduleOnRN(onFullyClosed);
        return;
      }

      translateY.value = withSpring(
        800, // 800 guarantees it physically falls fully out of the screen bounds
        {
          damping: 20,
          stiffness: 160,
          mass: 0.8,
          velocity,
        },
        (finished) => {
          scheduleOnRN(onDismiss);
          scheduleOnRN(onFullyClosed);
        }
      );
    },
    [dismissing, onDismiss, onFullyClosed, reduceMotionEnabled, translateY]
  );

  const handlePressDismiss = useCallback(() => {
    finishDismiss();
  }, [finishDismiss]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(true)
        .maxPointers(1)
        .activeOffsetY([-4, 4])
        .failOffsetX([-24, 24])
        .shouldCancelWhenOutside(false)
        .onBegin(() => {
          cancelAnimation(translateY);
          dismissing.value = false;
        })
        .onUpdate((event) => {
          translateY.value = applyDragResistance(event.translationY);
        })
        .onEnd((event) => {
          const projectedTranslation = event.translationY + event.velocityY * 0.1;
          const shouldDismiss =
            translateY.value >= DISMISS_DISTANCE ||
            projectedTranslation >= DISMISS_DISTANCE;

          if (shouldDismiss) {
            scheduleOnRN(finishDismiss, event.velocityY);
            return;
          }

          scheduleOnRN(resetPosition, event.velocityY);
        })
        .onFinalize(() => {
          if (!dismissing.value && translateY.value !== 0) {
            scheduleOnRN(resetPosition, 0);
          }
        }),
    [dismissing, finishDismiss, resetPosition, translateY]
  );

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  }, [translateY]);

  const handleAnimatedStyle = useAnimatedStyle(() => {
    const progress = Math.max(0, Math.min(translateY.value / DISMISS_TRAVEL, 1));

    return {
      transform: [{ scaleX: interpolate(progress, [0, 1], [1, 1.08]) }],
    };
  }, [translateY]);

  return (
    <Animated.View
      testID={shellTestID}
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
        <View pointerEvents="box-none">
          <View style={styles.handleGestureZone} pointerEvents="auto">
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
          {children}
        </View>
      </GestureDetector>
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
