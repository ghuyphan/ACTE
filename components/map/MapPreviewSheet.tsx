import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const translateY = useSharedValue(400);
  const dismissing = useSharedValue(false);
  const closeSequenceRef = useRef(0);
  const closeFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseFallback = useCallback(() => {
    if (closeFallbackTimerRef.current) {
      clearTimeout(closeFallbackTimerRef.current);
      closeFallbackTimerRef.current = null;
    }
  }, []);

  const invalidateCloseSequence = useCallback(() => {
    closeSequenceRef.current += 1;
    clearCloseFallback();
  }, [clearCloseFallback]);

  const scheduleCloseFallback = useCallback(
    (callback: () => void, delay: number) => {
      const sequence = closeSequenceRef.current;
      clearCloseFallback();
      closeFallbackTimerRef.current = setTimeout(() => {
        if (closeSequenceRef.current !== sequence) {
          return;
        }
        closeSequenceRef.current += 1;
        closeFallbackTimerRef.current = null;
        callback();
      }, delay);
    },
    [clearCloseFallback]
  );

  useEffect(() => {
    return () => {
      clearCloseFallback();
    };
  }, [clearCloseFallback]);

  useEffect(() => {
    if (isVisible) {
      invalidateCloseSequence();
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
          closeSequenceRef.current += 1;
          scheduleCloseFallback(onFullyClosed, 260);
          const sequence = closeSequenceRef.current;
          translateY.value = withSpring(
            800,
            {
              damping: 20,
              stiffness: 160,
              mass: 0.8,
            },
            (finished) => {
              if (finished && closeSequenceRef.current === sequence) {
                clearCloseFallback();
                scheduleOnRN(onFullyClosed);
              }
            }
          );
        }
      }
    }
  }, [
    clearCloseFallback,
    dismissing,
    invalidateCloseSequence,
    isVisible,
    onFullyClosed,
    reduceMotionEnabled,
    scheduleCloseFallback,
    translateY,
  ]);

  const resetPosition = useCallback(
    (velocity: number = 0) => {
      cancelAnimation(translateY);
      invalidateCloseSequence();
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
    [dismissing, invalidateCloseSequence, reduceMotionEnabled, translateY]
  );

  const finishDismiss = useCallback(
    (velocity: number = 0) => {
      cancelAnimation(translateY);
      dismissing.value = true;

      if (reduceMotionEnabled) {
        translateY.value = 0;
        onDismiss();
        onFullyClosed();
        return;
      }

      onDismiss();
      closeSequenceRef.current += 1;
      scheduleCloseFallback(onFullyClosed, 260);
      const sequence = closeSequenceRef.current;
      translateY.value = withSpring(
        800, // 800 guarantees it physically falls fully out of the screen bounds
        {
          damping: 20,
          stiffness: 160,
          mass: 0.8,
          velocity,
        },
        (finished) => {
          if (finished && closeSequenceRef.current === sequence) {
            clearCloseFallback();
            scheduleOnRN(onFullyClosed);
          }
        }
      );
    },
    [clearCloseFallback, dismissing, onDismiss, onFullyClosed, reduceMotionEnabled, scheduleCloseFallback, translateY]
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
              accessibilityLabel={t('map.dismissPreview', 'Dismiss map preview')}
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
