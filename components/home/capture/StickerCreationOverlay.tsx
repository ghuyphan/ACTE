import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '../../../hooks/useHaptics';
import {
  type ComponentProps,
  type ReactNode,
  useCallback,
  useContext,
  useLayoutEffect,
  useState,
} from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Reanimated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { Radii, Typography } from '../../../constants/theme';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { useTheme } from '../../../hooks/useTheme';
import PrimaryButton from '../../ui/PrimaryButton';
import { triggerCaptureCardHaptic } from './captureMotion';
import type {
  StickerCreationCompletePayload,
} from './stickerCreationTypes';

const SCREEN_HORIZONTAL_PADDING = 18;
const ENTER_DURATION_MS = 320;
const ENTER_DURATION_REDUCED_MS = 180;
const EXIT_DURATION_MS = 180;
const EXIT_DURATION_REDUCED_MS = 110;
const ENTER_EASING = Easing.bezier(0.22, 1, 0.36, 1);
const EXIT_EASING = Easing.bezier(0.4, 0, 0.2, 1);

export type StickerCreationAnimatedStyle = ComponentProps<typeof Reanimated.View>['style'];

export interface StickerCreationStageRenderProps {
  busy: boolean;
  contentAnimatedStyle: StickerCreationAnimatedStyle;
  focusAnimatedStyle: StickerCreationAnimatedStyle;
}

interface StickerCreationOverlayProps {
  visible: boolean;
  loading?: boolean;
  title: string;
  subtitle: string;
  cancelLabel: string;
  confirmLabel: string;
  testIDPrefix?: string;
  resetKey?: string | number | null;
  onClose: () => void;
  onReset?: () => void;
  onConfirm: () => Promise<StickerCreationCompletePayload | null>;
  onCompletePlacement: (payload: StickerCreationCompletePayload) => void;
  renderStage: (props: StickerCreationStageRenderProps) => ReactNode;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextFrame() {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(resolve);
      return;
    }

    setTimeout(resolve, 0);
  });
}

function StickerCreationOverlay({
  visible,
  loading = false,
  title,
  subtitle,
  cancelLabel,
  confirmLabel,
  testIDPrefix = 'sticker-creation',
  resetKey = null,
  onClose,
  onReset,
  onConfirm,
  onCompletePlacement,
  renderStage,
}: StickerCreationOverlayProps) {
  const { colors, isDark } = useTheme();
  const reduceMotionEnabled = useReducedMotion();
  const safeAreaInsets = useContext(SafeAreaInsetsContext);
  const insets = safeAreaInsets ?? { top: 0, right: 0, bottom: 0, left: 0 };
  const [animating, setAnimating] = useState(false);
  const overlayProgress = useSharedValue(1);
  const busy = loading || animating;
  const exitDuration = reduceMotionEnabled
    ? EXIT_DURATION_REDUCED_MS
    : EXIT_DURATION_MS;
  const enterDuration = reduceMotionEnabled
    ? ENTER_DURATION_REDUCED_MS
    : ENTER_DURATION_MS;

  useLayoutEffect(() => {
    if (!visible) {
      overlayProgress.value = 0;
      setAnimating(false);
      return;
    }

    overlayProgress.value = 0;
    setAnimating(false);

    const animationConfig = {
      duration: enterDuration,
      easing: ENTER_EASING,
    };

    overlayProgress.value = withTiming(1, animationConfig);
  }, [
    enterDuration,
    overlayProgress,
    reduceMotionEnabled,
    resetKey,
    visible,
  ]);

  const playExitAnimation = useCallback(async () => {
    const animationConfig = {
      duration: exitDuration,
      easing: EXIT_EASING,
    };

    overlayProgress.value = withTiming(0, animationConfig);

    await delay(exitDuration);
  }, [exitDuration, overlayProgress]);

  const playRestoreAnimation = useCallback(async () => {
    const restoreDuration = reduceMotionEnabled ? 120 : 220;
    const animationConfig = {
      duration: restoreDuration,
      easing: ENTER_EASING,
    };

    overlayProgress.value = withTiming(1, animationConfig);

    await delay(restoreDuration);
  }, [overlayProgress, reduceMotionEnabled]);

  const runConfirm = useCallback(async () => {
    if (busy) {
      return;
    }

    setAnimating(true);

    try {
      triggerCaptureCardHaptic(Haptics.ImpactFeedbackStyle.Medium);
      const completePayload = await onConfirm();

      if (!completePayload) {
        setAnimating(false);
        return;
      }

      onCompletePlacement({
        ...completePayload,
        entryDelayMs: reduceMotionEnabled ? 0 : exitDuration + 32,
      });
      await nextFrame();
      await playExitAnimation();
      triggerCaptureCardHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      await nextFrame();
      setAnimating(false);
      onClose();
    } catch (error) {
      console.warn('[stickers] creation overlay transition failed', error);
      await playRestoreAnimation();
      setAnimating(false);
    }
  }, [
    busy,
    onClose,
    onCompletePlacement,
    onConfirm,
    exitDuration,
    playExitAnimation,
    playRestoreAnimation,
    reduceMotionEnabled,
  ]);

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      overlayProgress.value,
      [0, 1],
      [0, 1],
      Extrapolation.CLAMP
    ),
  }));

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      overlayProgress.value,
      [0, 0.18, 1],
      [0, 0.28, 1],
      Extrapolation.CLAMP
    ),
    transform: [
      {
        translateY: interpolate(
          overlayProgress.value,
          [0, 1],
          [reduceMotionEnabled ? 6 : 20, 0],
          Extrapolation.CLAMP
        ),
      },
      {
        scale: interpolate(
          overlayProgress.value,
          [0, 1],
          [reduceMotionEnabled ? 0.992 : 0.965, 1],
          Extrapolation.CLAMP
        ),
      },
    ],
  }));

  const focusAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      overlayProgress.value,
      [0, 0.22, 1],
      [0, 0.18, 1],
      Extrapolation.CLAMP
    ),
  }));

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      overlayProgress.value,
      [0, 0.45, 1],
      [0, 0.75, 1],
      Extrapolation.CLAMP
    ),
    transform: [{
      translateY: interpolate(
        overlayProgress.value,
        [0, 1],
        [reduceMotionEnabled ? -4 : -10, 0],
        Extrapolation.CLAMP
      ),
    }],
  }));

  const controlsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      overlayProgress.value,
      [0, 0.28, 1],
      [0, 0.2, 1],
      Extrapolation.CLAMP
    ),
    transform: [{
      translateY: interpolate(
        overlayProgress.value,
        [0, 1],
        [reduceMotionEnabled ? 6 : 16, 0],
        Extrapolation.CLAMP
      ),
    }],
  }));

  const textColor = colors.text ?? '#1C1C1E';
  const borderColor = colors.border ?? 'rgba(255,255,255,0.12)';
  const buttonFill = isDark ? 'rgba(24,20,18,0.68)' : 'rgba(255,251,246,0.88)';
  const actionBarBackground = isDark ? 'rgba(18,14,12,0.88)' : 'rgba(255,250,244,0.96)';
  const topInset = insets.top + 8;
  const bottomInset = Math.max(insets.bottom, 14);

  const content = (
    <View style={styles.screen}>
      <Reanimated.View
        pointerEvents="none"
        style={[
          styles.editorBackdrop,
          {
            backgroundColor:
              colors.background ?? (isDark ? 'rgba(15,12,10,0.96)' : 'rgba(250,245,236,0.96)'),
          },
          backdropAnimatedStyle,
        ]}
      />

      <Reanimated.View style={[styles.header, { paddingTop: topInset }, headerAnimatedStyle]}>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onClose}
          style={({ pressed }) => [
            styles.headerButton,
            {
              backgroundColor: buttonFill,
              borderColor,
              opacity: busy ? 0.5 : 1,
            },
            pressed && !busy ? styles.headerButtonPressed : null,
          ]}
          testID={`${testIDPrefix}-cancel`}
        >
          <Ionicons name="close" size={18} color={textColor} />
        </Pressable>

        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, { color: textColor }]}>{title}</Text>
        </View>

        {onReset ? (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onReset}
            style={({ pressed }) => [
              styles.resetButton,
              {
                backgroundColor: buttonFill,
                borderColor,
                opacity: busy ? 0.5 : 1,
              },
              pressed && !busy ? styles.headerButtonPressed : null,
            ]}
            testID={`${testIDPrefix}-reset`}
          >
            <Ionicons name="refresh" size={16} color={textColor} />
          </Pressable>
        ) : (
          <View style={styles.headerButtonSpacer} />
        )}
      </Reanimated.View>

      {renderStage({ busy, contentAnimatedStyle, focusAnimatedStyle })}

      <Reanimated.View
        style={[styles.controlsArea, { paddingBottom: bottomInset }, controlsAnimatedStyle]}
      >
        <Text style={[styles.subtitle, { color: colors.secondaryText ?? textColor }]}>
          {subtitle}
        </Text>
        <View style={[styles.actionBar, { borderColor, backgroundColor: actionBarBackground }]}>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onClose}
            style={({ pressed }) => [
              styles.secondaryButton,
              {
                borderColor,
                backgroundColor: colors.card ?? '#FFFFFF',
                opacity: busy ? 0.5 : 1,
              },
              pressed && !busy ? styles.headerButtonPressed : null,
            ]}
          >
            <Text style={[styles.secondaryButtonLabel, { color: textColor }]}>{cancelLabel}</Text>
          </Pressable>
          <PrimaryButton
            label={confirmLabel}
            onPress={() => {
              void runConfirm();
            }}
            loading={busy}
            style={styles.confirmButton}
            testID={`${testIDPrefix}-confirm`}
          />
        </View>
      </Reanimated.View>
    </View>
  );

  return (
    <Modal
      animationType="none"
      hardwareAccelerated
      navigationBarTranslucent
      onRequestClose={() => {
        if (!busy) {
          onClose();
        }
      }}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <GestureHandlerRootView style={styles.gestureRoot}>{content}</GestureHandlerRootView>
    </Modal>
  );
}

export default StickerCreationOverlay;

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
  },
  gestureRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
  },
  editorBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    zIndex: 3,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: Radii.md + 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonSpacer: {
    width: 44,
    height: 44,
  },
  headerButtonPressed: {
    transform: [{ scale: 0.97 }],
  },
  headerTitleWrap: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...Typography.pill,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  resetButton: {
    width: 44,
    height: 44,
    borderRadius: Radii.md + 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlsArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
    zIndex: 3,
  },
  subtitle: {
    ...Typography.body,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 12,
  },
  actionBar: {
    borderRadius: Radii.card,
    borderWidth: 1,
    padding: 8,
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: Radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryButtonLabel: {
    ...Typography.button,
    fontSize: 15,
  },
  confirmButton: {
    flex: 1,
    minHeight: 48,
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
});
