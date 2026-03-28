import { useCallback, useMemo, useRef, type ReactNode } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

const PREVIEW_HORIZONTAL_INSET = 14;
const DISMISS_DISTANCE = 58;
const DISMISS_TRAVEL = 92;

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
  const translateY = useRef(new Animated.Value(0)).current;

  const resetPosition = useCallback(() => {
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      speed: reduceMotionEnabled ? 100 : 22,
      bounciness: reduceMotionEnabled ? 0 : 4,
    }).start();
  }, [reduceMotionEnabled, translateY]);

  const finishDismiss = useCallback(() => {
    Animated.timing(translateY, {
      toValue: DISMISS_TRAVEL,
      duration: reduceMotionEnabled ? 0 : 160,
      useNativeDriver: true,
    }).start(({ finished }) => {
      translateY.setValue(0);

      if (finished) {
        onDismiss();
      }
    });
  }, [onDismiss, reduceMotionEnabled, translateY]);

  const handlePressDismiss = useCallback(() => {
    translateY.stopAnimation(() => {
      translateY.setValue(0);
      onDismiss();
    });
  }, [onDismiss, translateY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gestureState) =>
          gestureState.dy > 4 && gestureState.dy > Math.abs(gestureState.dx),
        onPanResponderMove: (_event, gestureState) => {
          translateY.setValue(Math.max(0, gestureState.dy));
        },
        onPanResponderRelease: (_event, gestureState) => {
          if (gestureState.dy >= DISMISS_DISTANCE || gestureState.vy >= 0.8) {
            finishDismiss();
            return;
          }

          resetPosition();
        },
        onPanResponderTerminate: resetPosition,
      }),
    [finishDismiss, resetPosition, translateY]
  );

  const animatedStyle = useMemo(
    () => ({
      opacity: translateY.interpolate({
        inputRange: [0, DISMISS_TRAVEL],
        outputRange: [1, 0.92],
        extrapolate: 'clamp',
      }),
      transform: [{ translateY }],
    }),
    [translateY]
  );

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
      {...panResponder.panHandlers}
    >
      <Pressable
        testID={dismissTestID}
        accessibilityRole="button"
        accessibilityLabel="Dismiss map preview"
        onPress={handlePressDismiss}
        style={styles.dismissHandlePressable}
      >
        <View style={[styles.dismissHandle, { backgroundColor: handleColor }]} />
      </Pressable>
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
  dismissHandlePressable: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    zIndex: 2,
    alignItems: 'center',
    paddingVertical: 6,
  },
  dismissHandle: {
    width: 42,
    height: 5,
    borderRadius: 999,
  },
});
