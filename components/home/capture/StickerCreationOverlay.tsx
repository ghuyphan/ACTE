import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '../../../hooks/useHaptics';
import {
  type ComponentProps,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
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
const ENTER_DURATION_MS = 240;
const ENTER_DURATION_REDUCED_MS = 140;
const EXIT_DURATION_MS = 140;
const EXIT_DURATION_REDUCED_MS = 80;

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
  const backdropOpacity = useSharedValue(1);
  const contentOpacity = useSharedValue(1);
  const contentScale = useSharedValue(1);
  const contentTranslateY = useSharedValue(0);
  const focusOpacity = useSharedValue(1);
  const headerOpacity = useSharedValue(1);
  const headerTranslateY = useSharedValue(0);
  const controlsOpacity = useSharedValue(1);
  const controlsTranslateY = useSharedValue(0);
  const busy = loading || animating;
  const exitDuration = reduceMotionEnabled
    ? EXIT_DURATION_REDUCED_MS
    : EXIT_DURATION_MS;
  const enterDuration = reduceMotionEnabled
    ? ENTER_DURATION_REDUCED_MS
    : ENTER_DURATION_MS;

  useEffect(() => {
    if (!visible) {
      setAnimating(false);
      return;
    }

    backdropOpacity.value = 0;
    contentOpacity.value = 0;
    contentScale.value = reduceMotionEnabled ? 0.994 : 0.96;
    contentTranslateY.value = reduceMotionEnabled ? 4 : 18;
    focusOpacity.value = 0;
    headerOpacity.value = 0;
    headerTranslateY.value = reduceMotionEnabled ? -4 : -12;
    controlsOpacity.value = 0;
    controlsTranslateY.value = reduceMotionEnabled ? 6 : 18;
    setAnimating(false);

    const primaryAnimationConfig = {
      duration: enterDuration,
      easing: Easing.out(Easing.cubic),
    };
    const secondaryAnimationConfig = {
      duration: reduceMotionEnabled ? enterDuration : enterDuration + 40,
      easing: Easing.out(Easing.cubic),
    };

    backdropOpacity.value = withTiming(1, primaryAnimationConfig);
    contentOpacity.value = withTiming(1, secondaryAnimationConfig);
    contentScale.value = withTiming(1, secondaryAnimationConfig);
    contentTranslateY.value = withTiming(0, secondaryAnimationConfig);
    focusOpacity.value = withTiming(1, secondaryAnimationConfig);
    headerOpacity.value = withTiming(1, primaryAnimationConfig);
    headerTranslateY.value = withTiming(0, primaryAnimationConfig);
    controlsOpacity.value = withTiming(1, secondaryAnimationConfig);
    controlsTranslateY.value = withTiming(0, secondaryAnimationConfig);
  }, [
    backdropOpacity,
    contentOpacity,
    contentScale,
    contentTranslateY,
    controlsOpacity,
    controlsTranslateY,
    enterDuration,
    focusOpacity,
    headerOpacity,
    headerTranslateY,
    reduceMotionEnabled,
    resetKey,
    visible,
  ]);

  const playExitAnimation = useCallback(async () => {
    const animationConfig = {
      duration: exitDuration,
      easing: Easing.out(Easing.cubic),
    };

    backdropOpacity.value = withTiming(0, animationConfig);
    contentOpacity.value = withTiming(0, animationConfig);
    contentScale.value = withTiming(reduceMotionEnabled ? 0.995 : 0.985, animationConfig);
    contentTranslateY.value = withTiming(reduceMotionEnabled ? 4 : 14, animationConfig);
    focusOpacity.value = withTiming(0, animationConfig);
    headerOpacity.value = withTiming(0, animationConfig);
    headerTranslateY.value = withTiming(reduceMotionEnabled ? 4 : 10, animationConfig);
    controlsOpacity.value = withTiming(0, animationConfig);
    controlsTranslateY.value = withTiming(reduceMotionEnabled ? 4 : 10, animationConfig);

    await delay(exitDuration);
  }, [
    backdropOpacity,
    contentOpacity,
    contentScale,
    contentTranslateY,
    controlsOpacity,
    controlsTranslateY,
    exitDuration,
    focusOpacity,
    headerOpacity,
    headerTranslateY,
    reduceMotionEnabled,
  ]);

  const playRestoreAnimation = useCallback(async () => {
    const restoreDuration = reduceMotionEnabled ? 120 : 220;
    const animationConfig = {
      duration: restoreDuration,
      easing: Easing.out(Easing.cubic),
    };

    backdropOpacity.value = withTiming(1, animationConfig);
    contentOpacity.value = withTiming(1, animationConfig);
    contentScale.value = withTiming(1, animationConfig);
    contentTranslateY.value = withTiming(0, animationConfig);
    focusOpacity.value = withTiming(1, animationConfig);
    headerOpacity.value = withTiming(1, animationConfig);
    headerTranslateY.value = withTiming(0, animationConfig);
    controlsOpacity.value = withTiming(1, animationConfig);
    controlsTranslateY.value = withTiming(0, animationConfig);

    await delay(restoreDuration);
  }, [
    backdropOpacity,
    contentOpacity,
    contentScale,
    contentTranslateY,
    controlsOpacity,
    controlsTranslateY,
    focusOpacity,
    headerOpacity,
    headerTranslateY,
    reduceMotionEnabled,
  ]);

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
    opacity: backdropOpacity.value,
  }));

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [
      { translateY: contentTranslateY.value },
      { scale: contentScale.value },
    ],
  }));

  const focusAnimatedStyle = useAnimatedStyle(() => ({
    opacity: focusOpacity.value,
  }));

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [{ translateY: headerTranslateY.value }],
  }));

  const controlsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: controlsOpacity.value,
    transform: [{ translateY: controlsTranslateY.value }],
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
  },
});
