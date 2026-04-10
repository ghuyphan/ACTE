import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const PREVIEW_HORIZONTAL_INSET = 14;
const DISMISS_DISTANCE = 36;
const DISMISS_TRAVEL = 108;
const MAX_DRAG_TRAVEL = 120;
const DRAG_RESISTANCE_START = 54;
const DRAG_RESISTANCE_FACTOR = 0.38;
const EXPAND_TRANSLATE_FACTOR = 0.32;

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
  allowDragDismiss?: boolean;
  allowExpand?: boolean;
  handleVisible?: boolean;
  isExpanded?: boolean;
  previewProgress?: SharedValue<number>;
  previewGestureRange?: number;
  expansionProgress?: SharedValue<number>;
  expansionGestureRange?: number;
  onPeek?: () => void;
  onExpand?: () => void;
  onCollapse?: () => void;
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
  allowDragDismiss = true,
  allowExpand = false,
  handleVisible = true,
  isExpanded = false,
  previewProgress,
  previewGestureRange = 1,
  expansionProgress,
  expansionGestureRange = 1,
  onPeek,
  onExpand,
  onCollapse,
  children,
}: MapPreviewSheetProps) {
  const { t } = useTranslation();
  const translateY = useSharedValue(400);
  const dismissing = useSharedValue(false);
  const handleVisibility = useSharedValue(handleVisible ? 1 : 0);
  const didHandleGestureEnd = useSharedValue(false);
  const panStartPreviewProgress = useSharedValue(0);
  const panStartExpansionProgress = useSharedValue(0);
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

  const finalizeCloseSequence = useCallback(
    (sequence: number) => {
      if (closeSequenceRef.current !== sequence) {
        return;
      }

      clearCloseFallback();
      onFullyClosed();
    },
    [clearCloseFallback, onFullyClosed]
  );

  useEffect(() => {
    return () => {
      clearCloseFallback();
    };
  }, [clearCloseFallback]);

  useEffect(() => {
    if (reduceMotionEnabled) {
      handleVisibility.value = handleVisible ? 1 : 0;
      return;
    }

    handleVisibility.value = withTiming(handleVisible ? 1 : 0, {
      duration: 130,
    });
  }, [handleVisibility, handleVisible, reduceMotionEnabled]);

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
    } else if (!dismissing.value) {
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
              scheduleOnRN(finalizeCloseSequence, sequence);
            }
          }
        );
      }
    }
  }, [
    clearCloseFallback,
    dismissing,
    finalizeCloseSequence,
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
        800,
        {
          damping: 20,
          stiffness: 160,
          mass: 0.8,
          velocity,
        },
        (finished) => {
          if (finished && closeSequenceRef.current === sequence) {
            scheduleOnRN(finalizeCloseSequence, sequence);
          }
        }
      );
    },
    [dismissing, finalizeCloseSequence, onDismiss, onFullyClosed, reduceMotionEnabled, scheduleCloseFallback, translateY]
  );

  const handlePressDismiss = useCallback(() => {
    finishDismiss();
  }, [finishDismiss]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(allowDragDismiss || allowExpand)
        .maxPointers(1)
        .activeOffsetY([-4, 4])
        .failOffsetX([-24, 24])
        .shouldCancelWhenOutside(false)
        .onBegin(() => {
          cancelAnimation(translateY);
          dismissing.value = false;
          didHandleGestureEnd.value = false;
          panStartPreviewProgress.value = previewProgress?.value ?? 0;
          panStartExpansionProgress.value = expansionProgress?.value ?? (isExpanded ? 1 : 0);
        })
        .onUpdate((event) => {
          if (allowExpand && previewProgress && expansionProgress) {
            const peekRange = Math.max(previewGestureRange, 1);
            const expandRange = Math.max(expansionGestureRange, 1);
            const startTotal =
              panStartPreviewProgress.value * peekRange +
              panStartExpansionProgress.value * expandRange;
            const nextTotal = Math.max(
              0,
              Math.min(peekRange + expandRange, startTotal - event.translationY)
            );

            previewProgress.value = Math.max(0, Math.min(1, nextTotal / peekRange));
            expansionProgress.value =
              nextTotal <= peekRange
                ? 0
                : Math.max(0, Math.min(1, (nextTotal - peekRange) / expandRange));

            const extraDismissDrag =
              nextTotal <= 0 && event.translationY > startTotal
                ? event.translationY - startTotal
                : 0;

            translateY.value =
              extraDismissDrag > 0 ? applyDragResistance(extraDismissDrag) : 0;
            return;
          }

          if (allowExpand && expansionProgress) {
            const dragRange = Math.max(expansionGestureRange, 1);
            const startProgress = panStartExpansionProgress.value;
            const nextProgress = Math.max(
              0,
              Math.min(1, startProgress - event.translationY / dragRange)
            );

            expansionProgress.value = nextProgress;

            const extraDismissDrag =
              nextProgress <= 0 && event.translationY > startProgress * dragRange
                ? event.translationY - startProgress * dragRange
                : 0;

            translateY.value =
              extraDismissDrag > 0 ? applyDragResistance(extraDismissDrag) : 0;
            return;
          }

          if (allowExpand && isExpanded) {
            translateY.value = applyDragResistance(Math.max(0, event.translationY));
            return;
          }

          if (allowExpand && event.translationY < 0) {
            translateY.value = event.translationY * EXPAND_TRANSLATE_FACTOR;
            return;
          }

          translateY.value = applyDragResistance(event.translationY);
        })
        .onEnd((event) => {
          didHandleGestureEnd.value = true;

          if (allowExpand && previewProgress && expansionProgress) {
            const peekRange = Math.max(previewGestureRange, 1);
            const expandRange = Math.max(expansionGestureRange, 1);
            const projectedTotal = Math.max(
              0,
              Math.min(
                peekRange + expandRange,
                previewProgress.value * peekRange +
                  expansionProgress.value * expandRange -
                  event.velocityY * 0.18
              )
            );
            const expandThreshold = peekRange + expandRange * 0.45;
            const peekThreshold = peekRange * 0.5;

            if (projectedTotal >= expandThreshold) {
              previewProgress.value = withSpring(1);
              expansionProgress.value = withSpring(1);
              scheduleOnRN(onExpand ?? (() => {}));
              scheduleOnRN(resetPosition, 0);
              return;
            }

            if (projectedTotal >= peekThreshold) {
              previewProgress.value = withSpring(1);
              expansionProgress.value = withSpring(0);
              scheduleOnRN(onPeek ?? (() => {}));
              scheduleOnRN(resetPosition, 0);
              return;
            }

            previewProgress.value = withSpring(0);
            expansionProgress.value = withSpring(0);
            scheduleOnRN(onCollapse ?? (() => {}));
            scheduleOnRN(resetPosition, event.velocityY);
            return;
          }

          if (allowExpand && expansionProgress) {
            const dragRange = Math.max(expansionGestureRange, 1);
            const projectedProgress = Math.max(
              0,
              Math.min(1, expansionProgress.value - event.velocityY / dragRange * 0.18)
            );
            const shouldExpand = projectedProgress >= 0.5;

            if (shouldExpand) {
              scheduleOnRN(onExpand ?? (() => {}));
              scheduleOnRN(resetPosition, 0);
              return;
            }

            const projectedDismissDrag =
              Math.max(0, event.translationY - panStartExpansionProgress.value * dragRange) +
              event.velocityY * 0.1;
            const shouldDismiss =
              allowDragDismiss &&
              expansionProgress.value <= 0 &&
              projectedDismissDrag >= DISMISS_DISTANCE;

            if (shouldDismiss) {
              scheduleOnRN(finishDismiss, event.velocityY);
              return;
            }

            scheduleOnRN(onCollapse ?? (() => {}));
            scheduleOnRN(resetPosition, 0);
            return;
          }

          const shouldExpand =
            allowExpand &&
            !isExpanded &&
            (event.translationY <= -22 || event.velocityY <= -280);
          if (shouldExpand) {
            scheduleOnRN(onExpand ?? (() => {}));
            scheduleOnRN(resetPosition, 0);
            return;
          }

          const shouldCollapse =
            allowExpand &&
            isExpanded &&
            (event.translationY >= 22 || event.velocityY >= 240);
          if (shouldCollapse) {
            scheduleOnRN(onCollapse ?? (() => {}));
            scheduleOnRN(resetPosition, 0);
            return;
          }

          const projectedTranslation = event.translationY + event.velocityY * 0.1;
          const shouldDismiss =
            allowDragDismiss &&
            !isExpanded &&
            (translateY.value >= DISMISS_DISTANCE || projectedTranslation >= DISMISS_DISTANCE);

          if (shouldDismiss) {
            scheduleOnRN(finishDismiss, event.velocityY);
            return;
          }

          scheduleOnRN(resetPosition, event.velocityY);
        })
        .onFinalize(() => {
          if (didHandleGestureEnd.value || dismissing.value) {
            return;
          }

          if (allowExpand && previewProgress && expansionProgress) {
            const peekRange = Math.max(previewGestureRange, 1);
            const expandRange = Math.max(expansionGestureRange, 1);
            const totalProgress =
              previewProgress.value * peekRange + expansionProgress.value * expandRange;
            const expandThreshold = peekRange + expandRange * 0.45;
            const peekThreshold = peekRange * 0.5;

            if (totalProgress >= expandThreshold) {
              previewProgress.value = withSpring(1);
              expansionProgress.value = withSpring(1);
              scheduleOnRN(onExpand ?? (() => {}));
            } else if (totalProgress >= peekThreshold) {
              previewProgress.value = withSpring(1);
              expansionProgress.value = withSpring(0);
              scheduleOnRN(onPeek ?? (() => {}));
            } else {
              previewProgress.value = withSpring(0);
              expansionProgress.value = withSpring(0);
              scheduleOnRN(onCollapse ?? (() => {}));
            }

            scheduleOnRN(resetPosition, 0);
            return;
          }

          if (allowExpand && expansionProgress) {
            const shouldExpand = expansionProgress.value >= 0.5;
            expansionProgress.value = withSpring(shouldExpand ? 1 : 0);
            scheduleOnRN((shouldExpand ? onExpand : onCollapse) ?? (() => {}));
            scheduleOnRN(resetPosition, 0);
            return;
          }

          if (translateY.value !== 0) {
            scheduleOnRN(resetPosition, 0);
          }
        }),
    [
      allowDragDismiss,
      allowExpand,
      didHandleGestureEnd,
      dismissing,
      expansionGestureRange,
      expansionProgress,
      finishDismiss,
      isExpanded,
      onPeek,
      onCollapse,
      onExpand,
      panStartPreviewProgress,
      panStartExpansionProgress,
      previewGestureRange,
      previewProgress,
      resetPosition,
      translateY,
    ]
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const handleAnimatedStyle = useAnimatedStyle(() => {
    const progress = Math.max(0, Math.min(translateY.value / DISMISS_TRAVEL, 1));

    return {
      opacity: handleVisibility.value,
      transform: [
        { scaleX: interpolate(progress, [0, 1], [1, 1.08]) },
        { scale: interpolate(handleVisibility.value, [0, 1], [0.94, 1]) },
        { translateY: interpolate(handleVisibility.value, [0, 1], [-4, 0]) },
      ],
    };
  });

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
      <View pointerEvents="box-none">
        <GestureDetector gesture={panGesture}>
          <View
            style={styles.handleGestureZone}
            pointerEvents={handleVisible ? 'auto' : 'none'}
          >
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
        </GestureDetector>
        <View pointerEvents="box-none">
          {children}
        </View>
      </View>
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
    height: 52,
  },
  dismissHandlePressable: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 24,
  },
  dismissHandle: {
    width: 42,
    height: 5,
    borderRadius: 999,
  },
});
