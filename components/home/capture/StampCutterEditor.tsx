import { Ionicons } from '@expo/vector-icons';
import { Canvas, Path } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
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
  getStampCutterWindowRect,
  normalizeStampCutterTransform,
  STAMP_CUTTER_OVERLAY_ASPECT_RATIO,
  STAMP_CUTTER_MAX_ZOOM,
  STAMP_CUTTER_MIN_ZOOM,
  type StampCutterDraft,
  type StampCutterTransform,
} from '../../../services/stampCutter';
import {
  createStampFramePath,
  getStampFrameMetrics,
  STAMP_OUTLINE_COLOR,
  STAMP_PAPER_BORDER_COLOR,
} from '../../notes/stampFrameMetrics';
import PrimaryButton from '../../ui/PrimaryButton';
import { triggerCaptureCardHaptic } from './captureMotion';

const STAMP_CUTTER_OVERLAY_IMAGE = require('../../../assets/images/icon/stamp-cutter.png');
const SCREEN_HORIZONTAL_PADDING = 18;
const EDITOR_STAGE_MAX_WIDTH = 520;
const RESET_TRANSFORM: StampCutterTransform = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
};

function clamp(value: number, minValue: number, maxValue: number) {
  'worklet';

  return Math.min(maxValue, Math.max(minValue, value));
}

function normalizePreviewTransformWorklet(
  sourceSize: { width: number; height: number },
  cropSize: { width: number; height: number },
  transform: Partial<StampCutterTransform>
) {
  'worklet';

  const safeWidth = Math.max(1, sourceSize.width);
  const safeHeight = Math.max(1, sourceSize.height);
  const safeCropWidth = Math.max(1, cropSize.width);
  const safeCropHeight = Math.max(1, cropSize.height);
  const zoom = clamp(
    Number.isFinite(transform.zoom) ? transform.zoom ?? 1 : 1,
    STAMP_CUTTER_MIN_ZOOM,
    STAMP_CUTTER_MAX_ZOOM
  );
  const baseScale = Math.max(safeCropWidth / safeWidth, safeCropHeight / safeHeight);
  const imageWidth = safeWidth * baseScale * zoom;
  const imageHeight = safeHeight * baseScale * zoom;
  const maxOffsetX = Math.max(0, (imageWidth - safeCropWidth) / 2);
  const maxOffsetY = Math.max(0, (imageHeight - safeCropHeight) / 2);

  return {
    zoom,
    offsetX: clamp(
      Number.isFinite(transform.offsetX) ? transform.offsetX ?? 0 : 0,
      -maxOffsetX,
      maxOffsetX
    ),
    offsetY: clamp(
      Number.isFinite(transform.offsetY) ? transform.offsetY ?? 0 : 0,
      -maxOffsetY,
      maxOffsetY
    ),
  };
}

function resolveZoomPreviewTransformWorklet(
  sourceSize: { width: number; height: number },
  cropSize: { width: number; height: number },
  nextZoom: number,
  anchorX: number,
  anchorY: number,
  startTransform: StampCutterTransform
) {
  'worklet';

  const startNormalized = normalizePreviewTransformWorklet(sourceSize, cropSize, startTransform);
  const baseScale = Math.max(
    Math.max(1, cropSize.width) / Math.max(1, sourceSize.width),
    Math.max(1, cropSize.height) / Math.max(1, sourceSize.height)
  );
  const startImageWidth = Math.max(1, sourceSize.width) * baseScale * startNormalized.zoom;
  const startImageHeight = Math.max(1, sourceSize.height) * baseScale * startNormalized.zoom;
  const startLeft = (cropSize.width - startImageWidth) / 2 + startNormalized.offsetX;
  const startTop = (cropSize.height - startImageHeight) / 2 + startNormalized.offsetY;
  const relativeX =
    startImageWidth > 0 ? clamp((anchorX - startLeft) / startImageWidth, 0, 1) : 0.5;
  const relativeY =
    startImageHeight > 0 ? clamp((anchorY - startTop) / startImageHeight, 0, 1) : 0.5;
  const provisional = normalizePreviewTransformWorklet(sourceSize, cropSize, {
    zoom: nextZoom,
    offsetX: startTransform.offsetX,
    offsetY: startTransform.offsetY,
  });
  const provisionalImageWidth = Math.max(1, sourceSize.width) * baseScale * provisional.zoom;
  const provisionalImageHeight = Math.max(1, sourceSize.height) * baseScale * provisional.zoom;

  return normalizePreviewTransformWorklet(sourceSize, cropSize, {
    zoom: nextZoom,
    offsetX: anchorX - cropSize.width / 2 + (0.5 - relativeX) * provisionalImageWidth,
    offsetY: anchorY - cropSize.height / 2 + (0.5 - relativeY) * provisionalImageHeight,
  });
}

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
    cropSize: { width: number; height: number };
    transform: StampCutterTransform;
  }) => void | Promise<void>;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const StampGuideOverlay = memo(function StampGuideOverlay({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  const metrics = useMemo(() => getStampFrameMetrics(width, height), [height, width]);
  const stampPath = useMemo(() => createStampFramePath(metrics), [metrics]);
  const stampOutlineWidth = Math.max(2.4, metrics.perforationRadius * 0.66);
  const stampBorderWidth = Math.max(1, metrics.perforationRadius * 0.18);

  return (
    <Canvas pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <Path
        path={stampPath}
        color={STAMP_OUTLINE_COLOR}
        style="stroke"
        strokeWidth={stampOutlineWidth}
      />
      <Path
        path={stampPath}
        color={STAMP_PAPER_BORDER_COLOR}
        style="stroke"
        strokeWidth={stampBorderWidth}
      />
    </Canvas>
  );
});

function StampCutterEditor({
  visible,
  draft,
  loading = false,
  title,
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
  const panStartXValue = useSharedValue(0);
  const panStartYValue = useSharedValue(0);
  const pinchStartZoomValue = useSharedValue(1);
  const pinchStartOffsetXValue = useSharedValue(0);
  const pinchStartOffsetYValue = useSharedValue(0);

  useEffect(() => {
    zoomValue.value = RESET_TRANSFORM.zoom;
    offsetXValue.value = RESET_TRANSFORM.offsetX;
    offsetYValue.value = RESET_TRANSFORM.offsetY;
    cutProgress.value = 0;
    setCutAnimating(false);
  }, [cutProgress, draft?.source.uri, offsetXValue, offsetYValue, visible, zoomValue]);

  const overlayWidth = Math.min(windowWidth - 8, EDITOR_STAGE_MAX_WIDTH);
  const overlayHeight = overlayWidth / STAMP_CUTTER_OVERLAY_ASPECT_RATIO;
  const cropRect = useMemo(
    () => getStampCutterWindowRect({ width: overlayWidth, height: overlayHeight }),
    [overlayHeight, overlayWidth]
  );
  const sourceSize = useMemo(
    () => ({
      width: Math.max(1, draft?.width ?? 1),
      height: Math.max(1, draft?.height ?? 1),
    }),
    [draft?.height, draft?.width]
  );
  const baseScale = useMemo(
    () =>
      normalizeStampCutterTransform(sourceSize, cropRect, {
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
      }).baseScale,
    [cropRect, sourceSize]
  );
  const busy = loading || cutAnimating;
  const baseImageWidth = sourceSize.width * baseScale;
  const baseImageHeight = sourceSize.height * baseScale;
  const previewBaseLeft = (cropRect.width - baseImageWidth) / 2;
  const previewBaseTop = (cropRect.height - baseImageHeight) / 2;

  const animateToTransform = useCallback(
    (nextTransform: StampCutterTransform) => {
      const config = reduceMotionEnabled
        ? { duration: 120 }
        : {
            damping: 18,
            stiffness: 220,
            mass: 0.7,
          };
      zoomValue.value = reduceMotionEnabled
        ? withTiming(nextTransform.zoom, config)
        : withSpring(nextTransform.zoom, config);
      offsetXValue.value = reduceMotionEnabled
        ? withTiming(nextTransform.offsetX, config)
        : withSpring(nextTransform.offsetX, config);
      offsetYValue.value = reduceMotionEnabled
        ? withTiming(nextTransform.offsetY, config)
        : withSpring(nextTransform.offsetY, config);
    },
    [offsetXValue, offsetYValue, reduceMotionEnabled, zoomValue]
  );

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
          panStartXValue.value = offsetXValue.value;
          panStartYValue.value = offsetYValue.value;
        })
        .onUpdate((event) => {
          const nextTransform = normalizePreviewTransformWorklet(sourceSize, cropRect, {
            zoom: zoomValue.value,
            offsetX: panStartXValue.value + event.translationX,
            offsetY: panStartYValue.value + event.translationY,
          });
          offsetXValue.value = nextTransform.offsetX;
          offsetYValue.value = nextTransform.offsetY;
        }),
    [busy, cropRect, offsetXValue, offsetYValue, panStartXValue, panStartYValue, sourceSize, zoomValue]
  );

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .enabled(!busy)
        .shouldCancelWhenOutside(false)
        .onBegin((event) => {
          pinchStartZoomValue.value = zoomValue.value;
          pinchStartOffsetXValue.value = offsetXValue.value;
          pinchStartOffsetYValue.value = offsetYValue.value;
        })
        .onUpdate((event) => {
          const nextTransform = resolveZoomPreviewTransformWorklet(
            sourceSize,
            cropRect,
            pinchStartZoomValue.value * event.scale,
            event.focalX,
            event.focalY,
            {
              zoom: pinchStartZoomValue.value,
              offsetX: pinchStartOffsetXValue.value,
              offsetY: pinchStartOffsetYValue.value,
            }
          );
          zoomValue.value = nextTransform.zoom;
          offsetXValue.value = nextTransform.offsetX;
          offsetYValue.value = nextTransform.offsetY;
        }),
    [busy, cropRect, offsetXValue, offsetYValue, pinchStartOffsetXValue, pinchStartOffsetYValue, pinchStartZoomValue, sourceSize, zoomValue]
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
          };

          if (currentTransform.zoom > 1.25) {
            runOnJS(handleReset)();
            return;
          }

          const nextTransform = resolveZoomPreviewTransformWorklet(
            sourceSize,
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
          });
        });
    },
    [animateToTransform, busy, cropRect, handleReset, offsetXValue, offsetYValue, sourceSize, zoomValue]
  );

  const gesture = useMemo(
    () =>
      doubleTapGesture
        ? Gesture.Simultaneous(panGesture, pinchGesture, doubleTapGesture)
        : Gesture.Simultaneous(panGesture, pinchGesture),
    [doubleTapGesture, panGesture, pinchGesture]
  );

  const runConfirm = async () => {
    if (busy) {
      return;
    }

    const payload = {
      cropSize: {
        width: cropRect.width,
        height: cropRect.height,
      },
      transform: {
        zoom: zoomValue.value,
        offsetX: offsetXValue.value,
        offsetY: offsetYValue.value,
      },
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

  const stageAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(cutProgress.value, [0, 1], [1, 0.985]) },
      { translateY: interpolate(cutProgress.value, [0, 1], [0, 4]) },
    ],
  }));

  const cutterAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(cutProgress.value, [0, 1], [0, 26]) },
      { scale: interpolate(cutProgress.value, [0, 1], [1, 0.992]) },
    ],
  }));

  const previewAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(cutProgress.value, [0, 1], [1, 0.97]) },
    ],
  }));

  const previewImageAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: offsetXValue.value },
        { translateY: offsetYValue.value },
        { scale: zoomValue.value },
      ],
    };
  }, [offsetXValue, offsetYValue, zoomValue]);

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
              stageAnimatedStyle,
              {
                width: overlayWidth,
              },
            ]}
          >
            <View
              style={[
                styles.overlayFrame,
                {
                  width: overlayWidth,
                  height: overlayHeight,
                },
              ]}
            >
              <GestureDetector gesture={gesture}>
                <View
                  collapsable={false}
                  pointerEvents={busy ? 'none' : 'auto'}
                  style={[
                    styles.cropWindow,
                    {
                      left: cropRect.x,
                      top: cropRect.y,
                      width: cropRect.width,
                      height: cropRect.height,
                    },
                  ]}
                >
                  <Reanimated.View style={[styles.cropGestureSurface, previewAnimatedStyle]}>
                    <Reanimated.Image
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
                      source={{ uri: draft.source.uri }}
                      resizeMode="cover"
                    />
                    <StampGuideOverlay width={cropRect.width} height={cropRect.height} />
                  </Reanimated.View>
                </View>
              </GestureDetector>

              <Reanimated.View pointerEvents="none" style={[styles.overlayImageWrap, cutterAnimatedStyle]}>
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
          <View style={[styles.actionBar, { borderColor, backgroundColor: actionBarBackground }]}>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onClose}
            style={({ pressed }) => [
              styles.secondaryButton,
              {
                borderColor: `${borderColor}`,
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
    return content;
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {content}
    </Modal>
  );
}

export default memo(StampCutterEditor);

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
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
  cropWindow: {
    position: 'absolute',
    overflow: 'hidden',
  },
  cropGestureSurface: {
    width: '100%',
    height: '100%',
  },
  previewImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  overlayImageWrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  overlayImage: {
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
