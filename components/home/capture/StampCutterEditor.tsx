import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { memo, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Reanimated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Layout, Radii, Typography } from '../../../constants/theme';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { useTheme } from '../../../hooks/useTheme';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import {
  getStampCutterBaseScale,
  getStampCutterWindowRect,
  normalizeStampCutterPreviewTransform,
  resolveStampCutterPreviewZoomTransform,
  snapStampCutterRotation,
  STAMP_CUTTER_OVERLAY_ASPECT_RATIO,
  type StampCutterDraft,
  type StampCutterTransform,
} from '../../../services/stampCutter';
import PrimaryButton from '../../ui/PrimaryButton';
import { triggerCaptureCardHaptic } from './captureMotion';

const STAMP_CUTTER_OVERLAY_IMAGE = require('../../../assets/images/icon/stamp-cutter.png');
const SCREEN_HORIZONTAL_PADDING = 18;
const EDITOR_STAGE_MAX_WIDTH = 520;
const RESET_TRANSFORM: StampCutterTransform = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
};

interface StampCutterEditorProps {
  visible: boolean;
  draft: StampCutterDraft | null;
  loading?: boolean;
  title: string;
  subtitle: string;
  cancelLabel: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: (payload: {
    viewportSize: { width: number; height: number };
    selectionRect: { x: number; y: number; width: number; height: number };
    transform: StampCutterTransform;
  }) => void | Promise<void>;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function StampCutterEditor({
  visible,
  draft,
  loading = false,
  title,
  subtitle,
  cancelLabel,
  confirmLabel,
  onClose,
  onConfirm,
}: StampCutterEditorProps) {
  const { colors, isDark } = useTheme();
  const reduceMotionEnabled = useReducedMotion();
  const safeAreaInsets = useContext(SafeAreaInsetsContext);
  const insets = safeAreaInsets ?? { top: 0, right: 0, bottom: 0, left: 0 };
  const { width: windowWidth } = useWindowDimensions();
  const [cutAnimating, setCutAnimating] = useState(false);
  const cutProgress = useSharedValue(0);
  const zoomValue = useSharedValue(1);
  const offsetXValue = useSharedValue(0);
  const offsetYValue = useSharedValue(0);
  const rotationValue = useSharedValue(0);
  const panStartXValue = useSharedValue(0);
  const panStartYValue = useSharedValue(0);
  const pinchStartZoomValue = useSharedValue(1);
  const pinchStartOffsetXValue = useSharedValue(0);
  const pinchStartOffsetYValue = useSharedValue(0);
  const rotationStartValue = useSharedValue(0);
  const activeGestureCountValue = useSharedValue(0);

  useEffect(() => {
    zoomValue.value = RESET_TRANSFORM.zoom;
    offsetXValue.value = RESET_TRANSFORM.offsetX;
    offsetYValue.value = RESET_TRANSFORM.offsetY;
    rotationValue.value = RESET_TRANSFORM.rotation;
    activeGestureCountValue.value = 0;
    cutProgress.value = 0;
    setCutAnimating(false);
  }, [activeGestureCountValue, cutProgress, draft?.source.uri, offsetXValue, offsetYValue, rotationValue, visible, zoomValue]);

  const stageWidth = Math.min(windowWidth - 8, EDITOR_STAGE_MAX_WIDTH);
  const stageHeight = stageWidth / STAMP_CUTTER_OVERLAY_ASPECT_RATIO;
  const cropRect = useMemo(
    () => getStampCutterWindowRect({ width: stageWidth, height: stageHeight }),
    [stageHeight, stageWidth]
  );
  const viewportSize = useMemo(
    () => ({
      width: stageWidth,
      height: stageHeight,
    }),
    [stageHeight, stageWidth]
  );
  const sourceSize = useMemo(
    () => ({
      width: Math.max(1, draft?.width ?? 1),
      height: Math.max(1, draft?.height ?? 1),
    }),
    [draft?.height, draft?.width]
  );
  const baseScale = useMemo(
    () => getStampCutterBaseScale(sourceSize, viewportSize),
    [sourceSize, viewportSize]
  );
  const busy = loading || cutAnimating;
  const baseImageWidth = sourceSize.width * baseScale;
  const baseImageHeight = sourceSize.height * baseScale;
  const previewBaseLeft = (viewportSize.width - baseImageWidth) / 2;
  const previewBaseTop = (viewportSize.height - baseImageHeight) / 2;

  const animateToTransform = useCallback(
    (nextTransform: StampCutterTransform) => {
      const normalizedTransform = normalizeStampCutterPreviewTransform(
        sourceSize,
        viewportSize,
        cropRect,
        nextTransform
      );
      const config = reduceMotionEnabled
        ? { duration: 120 }
        : {
            damping: 24,
            stiffness: 170,
            mass: 0.85,
          };
      zoomValue.value = reduceMotionEnabled
        ? withTiming(normalizedTransform.zoom, config)
        : withSpring(normalizedTransform.zoom, config);
      offsetXValue.value = reduceMotionEnabled
        ? withTiming(normalizedTransform.offsetX, config)
        : withSpring(normalizedTransform.offsetX, config);
      offsetYValue.value = reduceMotionEnabled
        ? withTiming(normalizedTransform.offsetY, config)
        : withSpring(normalizedTransform.offsetY, config);
      rotationValue.value = reduceMotionEnabled
        ? withTiming(normalizedTransform.rotation, config)
        : withSpring(normalizedTransform.rotation, config);
    },
    [cropRect, offsetXValue, offsetYValue, reduceMotionEnabled, rotationValue, sourceSize, viewportSize, zoomValue]
  );

  const beginInteractionWorklet = useCallback(() => {
    'worklet';

    activeGestureCountValue.value += 1;
  }, [activeGestureCountValue]);

  const finalizeInteractionWorklet = useCallback(() => {
    'worklet';

    activeGestureCountValue.value = Math.max(0, activeGestureCountValue.value - 1);
    if (activeGestureCountValue.value > 0) {
      return;
    }

    const snappedRotation = snapStampCutterRotation(rotationValue.value);
    if (snappedRotation === rotationValue.value) {
      return;
    }

    if (reduceMotionEnabled) {
      rotationValue.value = withTiming(snappedRotation, { duration: 120 });
      return;
    }

    rotationValue.value = withSpring(snappedRotation, {
      damping: 24,
      stiffness: 170,
      mass: 0.85,
    });
  }, [activeGestureCountValue, reduceMotionEnabled, rotationValue]);

  const handleReset = useCallback(() => {
    if (busy) {
      return;
    }

    triggerCaptureCardHaptic(Haptics.ImpactFeedbackStyle.Light);
    animateToTransform(RESET_TRANSFORM);
  }, [animateToTransform, busy]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!busy)
        .maxPointers(1)
        .minDistance(1)
        .shouldCancelWhenOutside(false)
        .onBegin(() => {
          beginInteractionWorklet();
          panStartXValue.value = offsetXValue.value;
          panStartYValue.value = offsetYValue.value;
        })
        .onUpdate((event) => {
          const nextTransform = normalizeStampCutterPreviewTransform(
            sourceSize,
            viewportSize,
            cropRect,
            {
              zoom: zoomValue.value,
              offsetX: panStartXValue.value + event.translationX,
              offsetY: panStartYValue.value + event.translationY,
              rotation: rotationValue.value,
            }
          );
          offsetXValue.value = nextTransform.offsetX;
          offsetYValue.value = nextTransform.offsetY;
        })
        .onFinalize(() => {
          finalizeInteractionWorklet();
        }),
    [beginInteractionWorklet, busy, cropRect, finalizeInteractionWorklet, offsetXValue, offsetYValue, panStartXValue, panStartYValue, rotationValue, sourceSize, viewportSize, zoomValue]
  );

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .enabled(!busy)
        .shouldCancelWhenOutside(false)
        .onBegin(() => {
          beginInteractionWorklet();
          pinchStartZoomValue.value = zoomValue.value;
          pinchStartOffsetXValue.value = offsetXValue.value;
          pinchStartOffsetYValue.value = offsetYValue.value;
        })
        .onUpdate((event) => {
          const nextTransform = resolveStampCutterPreviewZoomTransform(
            sourceSize,
            viewportSize,
            cropRect,
            pinchStartZoomValue.value * event.scale,
            event.focalX,
            event.focalY,
            {
              zoom: pinchStartZoomValue.value,
              offsetX: pinchStartOffsetXValue.value,
              offsetY: pinchStartOffsetYValue.value,
              rotation: rotationValue.value,
            }
          );
          zoomValue.value = nextTransform.zoom;
          offsetXValue.value = nextTransform.offsetX;
          offsetYValue.value = nextTransform.offsetY;
        })
        .onFinalize(() => {
          finalizeInteractionWorklet();
        }),
    [beginInteractionWorklet, busy, cropRect, finalizeInteractionWorklet, offsetXValue, offsetYValue, pinchStartOffsetXValue, pinchStartOffsetYValue, pinchStartZoomValue, rotationValue, sourceSize, viewportSize, zoomValue]
  );

  const rotationGesture = useMemo(
    () =>
      Gesture.Rotation()
        .enabled(!busy)
        .shouldCancelWhenOutside(false)
        .onBegin(() => {
          beginInteractionWorklet();
          rotationStartValue.value = rotationValue.value;
        })
        .onUpdate((event) => {
          const nextTransform = normalizeStampCutterPreviewTransform(
            sourceSize,
            viewportSize,
            cropRect,
            {
              zoom: zoomValue.value,
              offsetX: offsetXValue.value,
              offsetY: offsetYValue.value,
              rotation: rotationStartValue.value + (event.rotation * 180) / Math.PI,
            }
          );
          rotationValue.value = nextTransform.rotation ?? 0;
          offsetXValue.value = nextTransform.offsetX;
          offsetYValue.value = nextTransform.offsetY;
        })
        .onFinalize(() => {
          finalizeInteractionWorklet();
        }),
    [beginInteractionWorklet, busy, cropRect, finalizeInteractionWorklet, offsetXValue, offsetYValue, rotationStartValue, rotationValue, sourceSize, viewportSize, zoomValue]
  );

  const doubleTapGesture = useMemo(
    () => {
      if (typeof Gesture.Tap !== 'function') {
        return null;
      }

      return Gesture.Tap()
        .enabled(!busy)
        .numberOfTaps(2)
        .maxDistance(12)
        .onEnd((event) => {
          const currentTransform = {
            zoom: zoomValue.value,
            offsetX: offsetXValue.value,
            offsetY: offsetYValue.value,
            rotation: rotationValue.value,
          };

          if (currentTransform.zoom > 1.25) {
            runOnJS(handleReset)();
            return;
          }

          const nextTransform = resolveStampCutterPreviewZoomTransform(
            sourceSize,
            viewportSize,
            cropRect,
            currentTransform.zoom * 1.8,
            event.x,
            event.y,
            currentTransform
          );
          runOnJS(triggerCaptureCardHaptic)(Haptics.ImpactFeedbackStyle.Light);
          runOnJS(animateToTransform)({
            zoom: nextTransform.zoom,
            offsetX: nextTransform.offsetX,
            offsetY: nextTransform.offsetY,
            rotation: snapStampCutterRotation(nextTransform.rotation),
          });
        });
    },
    [animateToTransform, busy, cropRect, handleReset, offsetXValue, offsetYValue, rotationValue, sourceSize, viewportSize, zoomValue]
  );

  const gesture = useMemo(
    () =>
      doubleTapGesture
        ? Gesture.Simultaneous(panGesture, pinchGesture, rotationGesture, doubleTapGesture)
        : Gesture.Simultaneous(panGesture, pinchGesture, rotationGesture),
    [doubleTapGesture, panGesture, pinchGesture, rotationGesture]
  );

  const runConfirm = async () => {
    if (busy) {
      return;
    }

    const payload = {
      viewportSize,
      selectionRect: cropRect,
      transform: normalizeStampCutterPreviewTransform(sourceSize, viewportSize, cropRect, {
        zoom: zoomValue.value,
        offsetX: offsetXValue.value,
        offsetY: offsetYValue.value,
        rotation: snapStampCutterRotation(rotationValue.value),
      }),
    };

    setCutAnimating(true);

    try {
      triggerCaptureCardHaptic(Haptics.ImpactFeedbackStyle.Medium);
      cutProgress.value = withTiming(1, {
        duration: reduceMotionEnabled ? 80 : 180,
        easing: Easing.out(Easing.cubic),
      });

      await delay(reduceMotionEnabled ? 70 : 120);
      triggerCaptureCardHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      await delay(reduceMotionEnabled ? 40 : 110);
      await onConfirm(payload);
    } finally {
      cutProgress.value = withTiming(0, {
        duration: reduceMotionEnabled ? 90 : 220,
        easing: Easing.out(Easing.cubic),
      });
      setCutAnimating(false);
    }
  };

  const cutterAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(cutProgress.value, [0, 1], [0, 26]) },
      { scale: interpolate(cutProgress.value, [0, 1], [1, 0.992]) },
    ],
  }));

  const previewImageAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { rotateZ: `${rotationValue.value}deg` },
        { scale: zoomValue.value },
        // Keep panning in viewport coordinates so the preview matches export cropping.
        { translateX: offsetXValue.value },
        { translateY: offsetYValue.value },
      ],
    };
  }, [offsetXValue, offsetYValue, rotationValue, zoomValue]);

  const flashAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(cutProgress.value, [0, 0.8, 1], [0, isDark ? 0.08 : 0.14, 0]),
  }));

  if (!visible || !draft) {
    return null;
  }

  const textColor = colors.text ?? '#1C1C1E';
  const borderColor = colors.border ?? 'rgba(255,255,255,0.12)';
  const buttonFill = isDark ? 'rgba(24,20,18,0.68)' : 'rgba(255,251,246,0.88)';
  const actionBarBackground = isDark ? 'rgba(18,14,12,0.88)' : 'rgba(255,250,244,0.96)';
  const topInset = insets.top + 8;
  const bottomInset = Math.max(insets.bottom, 14);

  const content = (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topInset }]}>
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
          testID="stamp-cutter-cancel"
        >
          <Ionicons name="close" size={18} color={textColor} />
        </Pressable>

        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, { color: textColor }]}>{title}</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={handleReset}
          style={({ pressed }) => [
            styles.resetButton,
            {
              backgroundColor: buttonFill,
              borderColor,
              opacity: busy ? 0.5 : 1,
            },
            pressed && !busy ? styles.headerButtonPressed : null,
          ]}
          testID="stamp-cutter-reset"
        >
          <Ionicons name="refresh" size={16} color={textColor} />
        </Pressable>
      </View>

      <View style={styles.stageArea}>
        <Reanimated.View
          style={[
            styles.stageShell,
            {
              width: stageWidth,
            },
          ]}
        >
          <View
            style={[
              styles.overlayFrame,
              {
                width: stageWidth,
                height: stageHeight,
              },
            ]}
          >
            <GestureDetector gesture={gesture}>
              <View
                collapsable={false}
                pointerEvents={busy ? 'none' : 'auto'}
                style={styles.gestureStage}
              >
                <View
                  pointerEvents="none"
                  style={[
                    styles.previewSurfaceBackground,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.35)',
                    },
                  ]}
                />
                <Reanimated.View
                  style={[
                    styles.previewImage,
                    {
                      width: baseImageWidth,
                      height: baseImageHeight,
                      left: previewBaseLeft,
                      top: previewBaseTop,
                    },
                    previewImageAnimatedStyle,
                  ]}
                >
                  <ExpoImage
                    source={{ uri: draft.source.uri }}
                    style={styles.previewImageFill}
                    contentFit="cover"
                    transition={0}
                  />
                </Reanimated.View>
              </View>
            </GestureDetector>

            <Reanimated.View pointerEvents="none" style={[styles.overlayImage, cutterAnimatedStyle]}>
              <Image
                source={STAMP_CUTTER_OVERLAY_IMAGE}
                style={styles.overlayImage}
                resizeMode="contain"
              />
            </Reanimated.View>

            <Reanimated.View pointerEvents="none" style={[styles.flashOverlay, flashAnimatedStyle]} />

            {busy ? (
              <View style={styles.loadingOverlay} pointerEvents="none">
                <ActivityIndicator size="large" color={textColor} />
              </View>
            ) : null}
          </View>
        </Reanimated.View>
      </View>

      <View style={[styles.controlsArea, { paddingBottom: bottomInset }]}>
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
                backgroundColor: colors.card,
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
            testID="stamp-cutter-confirm"
          />
        </View>
      </View>
    </View>
  );

  if (Platform.OS === 'web') {
    return <GestureHandlerRootView style={styles.gestureRoot}>{content}</GestureHandlerRootView>;
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.gestureRoot}>{content}</GestureHandlerRootView>
    </Modal>
  );
}

export default memo(StampCutterEditor);

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
  },
  gestureRoot: {
    flex: 1,
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
  stageArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  stageShell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayFrame: {
    position: 'relative',
  },
  gestureStage: {
    ...StyleSheet.absoluteFillObject,
  },
  previewSurfaceBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  previewImage: {
    position: 'absolute',
  },
  previewImageFill: {
    width: '100%',
    height: '100%',
  },
  overlayImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFF8ED',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
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
    minHeight: Layout.buttonHeight,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  secondaryButtonLabel: {
    ...Typography.button,
    letterSpacing: 0.2,
  },
  confirmButton: {
    flex: 1.25,
  },
});
