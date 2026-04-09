import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Canvas, Path as SkiaPath } from '@shopify/react-native-skia';
import { Image as ExpoImage } from 'expo-image';
import { memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Reanimated, {
  cancelAnimation,
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { STICKER_ARTBOARD_FRAME } from '../../../constants/doodleLayout';
import { Radii, Typography } from '../../../constants/theme';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { useTheme } from '../../../hooks/useTheme';
import type { NoteStickerPlacement } from '../../../services/noteStickers';
import {
  getStampCutterBaseScale,
  getStampCutterWindowRect,
  normalizeStampCutterPreviewTransform,
  resolveStampCutterPreviewZoomTransform,
  STAMP_CUTTER_OVERLAY_ASPECT_RATIO,
  type StampCutterDraft,
  type StampCutterTransform,
} from '../../../services/stampCutter';
import {
  createStampFramePath,
  getStampFrameMetrics,
  STAMP_OUTLINE_COLOR,
  STAMP_PAPER_BORDER_COLOR,
  STAMP_PAPER_COLOR,
} from '../../notes/stampFrameMetrics';
import { getStickerPlacementWindowRect } from '../../notes/stickerPlacementLayout';
import PrimaryButton from '../../ui/PrimaryButton';
import { CARD_SIZE } from './captureCardStyles';
import { triggerCaptureCardHaptic } from './captureMotion';

const SCREEN_HORIZONTAL_PADDING = 18;
const EDITOR_STAGE_MAX_WIDTH = 520;
const STICKER_MINIMUM_BASE_SIZE = 68;
const EXTRACTION_DURATION_MS = 220;
const EXTRACTION_DURATION_REDUCED_MS = 120;
const FLIGHT_DURATION_MS = 400;
const FLIGHT_DURATION_REDUCED_MS = 240;
const PROCESSING_HOLD_MS = 140;
const PROCESSING_HOLD_REDUCED_MS = 60;
const PROCESSING_FLOAT_DURATION_MS = 1200;
const RESET_TRANSFORM: StampCutterTransform = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
};

interface WindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface StampCutterEditorProps {
  visible: boolean;
  draft: StampCutterDraft | null;
  loading?: boolean;
  title: string;
  subtitle: string;
  cancelLabel: string;
  confirmLabel: string;
  captureAreaRect?: WindowRect | null;
  onClose: () => void;
  onCompletePlacement: (placement: NoteStickerPlacement) => void;
  onConfirm: (payload: {
    viewportSize: { width: number; height: number };
    selectionRect: { x: number; y: number; width: number; height: number };
    transform: StampCutterTransform;
  }) => NoteStickerPlacement | null | Promise<NoteStickerPlacement | null>;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveStickerArtboardRect(captureAreaRect: WindowRect) {
  const cardScale =
    captureAreaRect.height > 0 ? Math.max(captureAreaRect.height / CARD_SIZE, 0.01) : 1;
  const cardWidth = CARD_SIZE * cardScale;
  const cardHeight = CARD_SIZE * cardScale;
  const cardX = captureAreaRect.x + (captureAreaRect.width - cardWidth) / 2;
  const cardY = captureAreaRect.y + (captureAreaRect.height - cardHeight) / 2;

  return {
    x: cardX + STICKER_ARTBOARD_FRAME.left * cardScale,
    y: cardY + STICKER_ARTBOARD_FRAME.top * cardScale,
    width:
      cardWidth - (STICKER_ARTBOARD_FRAME.left + STICKER_ARTBOARD_FRAME.right) * cardScale,
    height:
      cardHeight - (STICKER_ARTBOARD_FRAME.top + STICKER_ARTBOARD_FRAME.bottom) * cardScale,
  };
}

function resolvePlacementTargetRect(
  placement: NoteStickerPlacement,
  captureAreaRect: WindowRect | null | undefined
): WindowRect | null {
  if (!captureAreaRect) {
    return null;
  }

  const targetRect = getStickerPlacementWindowRect(
    placement,
    resolveStickerArtboardRect(captureAreaRect),
    1,
    STICKER_MINIMUM_BASE_SIZE
  );

  return {
    x: targetRect.x,
    y: targetRect.y,
    width: targetRect.width,
    height: targetRect.height,
  };
}

function StampCutterEditor({
  visible,
  draft,
  loading = false,
  title,
  subtitle,
  cancelLabel,
  confirmLabel,
  captureAreaRect = null,
  onClose,
  onCompletePlacement,
  onConfirm,
}: StampCutterEditorProps) {
  const { colors, isDark } = useTheme();
  const reduceMotionEnabled = useReducedMotion();
  const safeAreaInsets = useContext(SafeAreaInsetsContext);
  const insets = safeAreaInsets ?? { top: 0, right: 0, bottom: 0, left: 0 };
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [cutAnimating, setCutAnimating] = useState(false);
  const [stageAreaRect, setStageAreaRect] = useState<WindowRect | null>(null);
  const pendingPlacementRef = useRef<NoteStickerPlacement | null>(null);
  const zoomValue = useSharedValue(1);
  const offsetXValue = useSharedValue(0);
  const offsetYValue = useSharedValue(0);
  const panStartXValue = useSharedValue(0);
  const panStartYValue = useSharedValue(0);
  const pinchStartZoomValue = useSharedValue(1);
  const pinchStartOffsetXValue = useSharedValue(0);
  const pinchStartOffsetYValue = useSharedValue(0);
  const activeGestureCountValue = useSharedValue(0);
  const backdropOpacity = useSharedValue(1);
  const backgroundOpacity = useSharedValue(1);
  const backgroundScale = useSharedValue(1);
  const guideOpacity = useSharedValue(1);
  const headerOpacity = useSharedValue(1);
  const headerTranslateY = useSharedValue(0);
  const controlsOpacity = useSharedValue(1);
  const controlsTranslateY = useSharedValue(0);
  const detachedOpacity = useSharedValue(0);
  const detachedTranslateX = useSharedValue(0);
  const detachedTranslateY = useSharedValue(0);
  const detachedScale = useSharedValue(1);
  const detachedShadowOpacity = useSharedValue(0);
  const processingFloatProgress = useSharedValue(0);
  const processingIndicatorOpacity = useSharedValue(0);

  useEffect(() => {
    zoomValue.value = RESET_TRANSFORM.zoom;
    offsetXValue.value = RESET_TRANSFORM.offsetX;
    offsetYValue.value = RESET_TRANSFORM.offsetY;
    activeGestureCountValue.value = 0;
    backdropOpacity.value = 1;
    backgroundOpacity.value = 1;
    backgroundScale.value = 1;
    guideOpacity.value = 1;
    headerOpacity.value = 1;
    headerTranslateY.value = 0;
    controlsOpacity.value = 1;
    controlsTranslateY.value = 0;
    detachedOpacity.value = 0;
    detachedTranslateX.value = 0;
    detachedTranslateY.value = 0;
    detachedScale.value = 1;
    detachedShadowOpacity.value = 0;
    processingIndicatorOpacity.value = 0;
    cancelAnimation(processingFloatProgress);
    processingFloatProgress.value = 0;
    pendingPlacementRef.current = null;
    setCutAnimating(false);
  }, [
    activeGestureCountValue,
    backdropOpacity,
    backgroundOpacity,
    backgroundScale,
    controlsOpacity,
    controlsTranslateY,
    detachedOpacity,
    detachedScale,
    detachedShadowOpacity,
    detachedTranslateX,
    detachedTranslateY,
    draft?.source.uri,
    guideOpacity,
    headerOpacity,
    headerTranslateY,
    offsetXValue,
    offsetYValue,
    processingFloatProgress,
    processingIndicatorOpacity,
    visible,
    zoomValue,
  ]);

  const stageWidth = Math.min(windowWidth - 8, EDITOR_STAGE_MAX_WIDTH);
  const stageHeight = stageWidth / STAMP_CUTTER_OVERLAY_ASPECT_RATIO;
  const cropRect = useMemo(
    () => getStampCutterWindowRect({ width: stageWidth, height: stageHeight }),
    [stageHeight, stageWidth]
  );
  const cropRectCenterX = cropRect.x + cropRect.width / 2;
  const cropRectCenterY = cropRect.y + cropRect.height / 2;
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
  const previewMetrics = useMemo(() => {
    const baseScale = getStampCutterBaseScale(sourceSize, viewportSize);
    const baseImageWidth = sourceSize.width * baseScale;
    const baseImageHeight = sourceSize.height * baseScale;

    return {
      baseImageWidth,
      baseImageHeight,
      previewBaseLeft: (viewportSize.width - baseImageWidth) / 2,
      previewBaseTop: (viewportSize.height - baseImageHeight) / 2,
    };
  }, [sourceSize, viewportSize]);
  const stampMetrics = useMemo(
    () => getStampFrameMetrics(cropRect.width, cropRect.height),
    [cropRect.height, cropRect.width]
  );
  const stampPath = useMemo(() => createStampFramePath(stampMetrics), [stampMetrics]);
  const stampGuideBorderWidth = Math.max(1, stampMetrics.perforationRadius * 0.16);
  const stampGuideOutlineWidth = Math.max(2.2, stampMetrics.perforationRadius * 0.62);
  const busy = loading || cutAnimating;
  const extractionDuration = reduceMotionEnabled
    ? EXTRACTION_DURATION_REDUCED_MS
    : EXTRACTION_DURATION_MS;
  const flightDuration = reduceMotionEnabled
    ? FLIGHT_DURATION_REDUCED_MS
    : FLIGHT_DURATION_MS;
  const processingHoldDuration = reduceMotionEnabled
    ? PROCESSING_HOLD_REDUCED_MS
    : PROCESSING_HOLD_MS;

  const stageLocalRect = useMemo(() => {
    if (!stageAreaRect) {
      return null;
    }

    return {
      x: stageAreaRect.x + (stageAreaRect.width - stageWidth) / 2,
      y: stageAreaRect.y + (stageAreaRect.height - stageHeight) / 2,
      width: stageWidth,
      height: stageHeight,
    };
  }, [stageAreaRect, stageHeight, stageWidth]);

  const detachedBaseRect = useMemo(() => {
    if (!stageLocalRect) {
      return {
        x: (windowWidth - cropRect.width) / 2,
        y: (windowHeight - cropRect.height) / 2,
        width: cropRect.width,
        height: cropRect.height,
      };
    }

    return {
      x: stageLocalRect.x + cropRect.x,
      y: stageLocalRect.y + cropRect.y,
      width: cropRect.width,
      height: cropRect.height,
    };
  }, [cropRect.height, cropRect.width, cropRect.x, cropRect.y, stageLocalRect, windowHeight, windowWidth]);
  const previewUri = draft?.source.uri ?? null;

  const animateToTransform = useCallback(
    (nextTransform: StampCutterTransform) => {
      const normalizedTransform = normalizeStampCutterPreviewTransform(
        sourceSize,
        viewportSize,
        cropRect,
        {
          ...nextTransform,
          rotation: 0,
        }
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
    },
    [cropRect, offsetXValue, offsetYValue, reduceMotionEnabled, sourceSize, viewportSize, zoomValue]
  );

  const beginInteractionWorklet = useCallback(() => {
    'worklet';

    activeGestureCountValue.value += 1;
  }, [activeGestureCountValue]);

  const finalizeInteractionWorklet = useCallback(() => {
    'worklet';

    activeGestureCountValue.value = Math.max(0, activeGestureCountValue.value - 1);
  }, [activeGestureCountValue]);

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
              rotation: 0,
            }
          );
          offsetXValue.value = nextTransform.offsetX;
          offsetYValue.value = nextTransform.offsetY;
        })
        .onFinalize(() => {
          finalizeInteractionWorklet();
        }),
    [beginInteractionWorklet, busy, cropRect, finalizeInteractionWorklet, offsetXValue, offsetYValue, panStartXValue, panStartYValue, sourceSize, viewportSize, zoomValue]
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
            cropRectCenterX,
            cropRectCenterY,
            {
              zoom: pinchStartZoomValue.value,
              offsetX: pinchStartOffsetXValue.value,
              offsetY: pinchStartOffsetYValue.value,
              rotation: 0,
            }
          );
          zoomValue.value = nextTransform.zoom;
          offsetXValue.value = nextTransform.offsetX;
          offsetYValue.value = nextTransform.offsetY;
        })
        .onFinalize(() => {
          finalizeInteractionWorklet();
        }),
    [
      beginInteractionWorklet,
      busy,
      cropRect,
      cropRectCenterX,
      cropRectCenterY,
      finalizeInteractionWorklet,
      offsetXValue,
      offsetYValue,
      pinchStartOffsetXValue,
      pinchStartOffsetYValue,
      pinchStartZoomValue,
      sourceSize,
      viewportSize,
      zoomValue,
    ]
  );

  const doubleTapGesture = useMemo(() => {
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
          rotation: 0,
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
          cropRectCenterX,
          cropRectCenterY,
          currentTransform
        );
        runOnJS(triggerCaptureCardHaptic)(Haptics.ImpactFeedbackStyle.Light);
        runOnJS(animateToTransform)({
          zoom: nextTransform.zoom,
          offsetX: nextTransform.offsetX,
          offsetY: nextTransform.offsetY,
          rotation: 0,
        });
      });
  }, [
    animateToTransform,
    busy,
    cropRect,
    cropRectCenterX,
    cropRectCenterY,
    handleReset,
    offsetXValue,
    offsetYValue,
    sourceSize,
    viewportSize,
    zoomValue,
  ]);

  const gesture = useMemo(
    () =>
      doubleTapGesture
        ? Gesture.Simultaneous(panGesture, pinchGesture, doubleTapGesture)
        : Gesture.Simultaneous(panGesture, pinchGesture),
    [doubleTapGesture, panGesture, pinchGesture]
  );

  const startProcessingFloat = useCallback(() => {
    if (reduceMotionEnabled) {
      return;
    }

    processingFloatProgress.value = 0;
    processingFloatProgress.value = withRepeat(
      withTiming(1, {
        duration: PROCESSING_FLOAT_DURATION_MS,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );
  }, [processingFloatProgress, reduceMotionEnabled]);

  const stopProcessingFloat = useCallback(() => {
    cancelAnimation(processingFloatProgress);
    processingFloatProgress.value = 0;
  }, [processingFloatProgress]);

  const playExtractionAnimation = useCallback(async () => {
    const animationConfig = {
      duration: extractionDuration,
      easing: Easing.out(Easing.cubic),
    };

    backdropOpacity.value = withTiming(reduceMotionEnabled ? 0.18 : 0.08, animationConfig);
    backgroundOpacity.value = withTiming(0, animationConfig);
    backgroundScale.value = withTiming(0.95, animationConfig);
    guideOpacity.value = withTiming(0, animationConfig);
    headerOpacity.value = withTiming(0, animationConfig);
    headerTranslateY.value = withTiming(reduceMotionEnabled ? 6 : 14, animationConfig);
    controlsOpacity.value = withTiming(0, animationConfig);
    controlsTranslateY.value = withTiming(reduceMotionEnabled ? 8 : 18, animationConfig);
    detachedOpacity.value = withTiming(1, animationConfig);
    detachedScale.value = withTiming(reduceMotionEnabled ? 1.02 : 1.06, animationConfig);
    detachedTranslateY.value = withTiming(reduceMotionEnabled ? -4 : -12, animationConfig);
    detachedShadowOpacity.value = withTiming(reduceMotionEnabled ? 0.16 : 0.28, animationConfig);

    await delay(extractionDuration);
  }, [
    backdropOpacity,
    backgroundOpacity,
    backgroundScale,
    controlsOpacity,
    controlsTranslateY,
    detachedOpacity,
    detachedScale,
    detachedShadowOpacity,
    detachedTranslateY,
    extractionDuration,
    guideOpacity,
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

    stopProcessingFloat();
    processingIndicatorOpacity.value = withTiming(0, {
      duration: reduceMotionEnabled ? 60 : 100,
      easing: Easing.out(Easing.cubic),
    });
    backdropOpacity.value = withTiming(1, animationConfig);
    backgroundOpacity.value = withTiming(1, animationConfig);
    backgroundScale.value = withTiming(1, animationConfig);
    guideOpacity.value = withTiming(1, animationConfig);
    headerOpacity.value = withTiming(1, animationConfig);
    headerTranslateY.value = withTiming(0, animationConfig);
    controlsOpacity.value = withTiming(1, animationConfig);
    controlsTranslateY.value = withTiming(0, animationConfig);
    detachedOpacity.value = withTiming(0, animationConfig);
    detachedTranslateX.value = withTiming(0, animationConfig);
    detachedTranslateY.value = withTiming(0, animationConfig);
    detachedScale.value = withTiming(1, animationConfig);
    detachedShadowOpacity.value = withTiming(0, animationConfig);

    await delay(restoreDuration);
  }, [
    backdropOpacity,
    backgroundOpacity,
    backgroundScale,
    controlsOpacity,
    controlsTranslateY,
    detachedOpacity,
    detachedScale,
    detachedShadowOpacity,
    detachedTranslateX,
    detachedTranslateY,
    guideOpacity,
    headerOpacity,
    headerTranslateY,
    processingIndicatorOpacity,
    reduceMotionEnabled,
    stopProcessingFloat,
  ]);

  const playFlightAnimation = useCallback(
    async (placement: NoteStickerPlacement) => {
      const resolvedArtboardRect = captureAreaRect
        ? resolveStickerArtboardRect(captureAreaRect)
        : null;
      const expectedRenderRect = resolvedArtboardRect
        ? getStickerPlacementWindowRect(
            placement,
            resolvedArtboardRect,
            1,
            STICKER_MINIMUM_BASE_SIZE
          )
        : null;
      const targetRect =
        expectedRenderRect ?? resolvePlacementTargetRect(placement, captureAreaRect) ?? detachedBaseRect;
      const originCenterX = detachedBaseRect.x + detachedBaseRect.width / 2;
      const originCenterY = detachedBaseRect.y + detachedBaseRect.height / 2;
      const targetCenterX = targetRect.x + targetRect.width / 2;
      const targetCenterY = targetRect.y + targetRect.height / 2;
      const targetScale = Math.max(0.3, targetRect.width / Math.max(detachedBaseRect.width, 1));

      stopProcessingFloat();
      processingIndicatorOpacity.value = withTiming(0, {
        duration: reduceMotionEnabled ? 50 : 90,
        easing: Easing.out(Easing.cubic),
      });

      const animationConfig = {
        duration: flightDuration,
        easing: Easing.out(Easing.cubic),
      };

      detachedTranslateX.value = withTiming(targetCenterX - originCenterX, animationConfig);
      detachedTranslateY.value = withTiming(targetCenterY - originCenterY, animationConfig);
      detachedScale.value = withTiming(targetScale, animationConfig);
      detachedShadowOpacity.value = withTiming(reduceMotionEnabled ? 0.08 : 0.12, animationConfig);
      backdropOpacity.value = withTiming(0, animationConfig);

      await delay(flightDuration);
    },
    [
      backdropOpacity,
      captureAreaRect,
      detachedBaseRect,
      detachedScale,
      detachedShadowOpacity,
      detachedTranslateX,
      detachedTranslateY,
      flightDuration,
      processingIndicatorOpacity,
      reduceMotionEnabled,
      stopProcessingFloat,
    ]
  );

  const completeFlight = useCallback(() => {
    const placement = pendingPlacementRef.current;
    pendingPlacementRef.current = null;
    setCutAnimating(false);

    if (placement) {
      onCompletePlacement(placement);
      triggerCaptureCardHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    }

    onClose();
  }, [onClose, onCompletePlacement]);

  const runConfirm = useCallback(async () => {
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
        rotation: 0,
      }),
    };

    pendingPlacementRef.current = null;
    setCutAnimating(true);

    try {
      triggerCaptureCardHaptic(Haptics.ImpactFeedbackStyle.Medium);
      await playExtractionAnimation();
      processingIndicatorOpacity.value = withTiming(1, {
        duration: reduceMotionEnabled ? 60 : 120,
        easing: Easing.out(Easing.cubic),
      });
      startProcessingFloat();

      const confirmPromise = (async () => onConfirm(payload))();
      await delay(processingHoldDuration);
      const placement = await confirmPromise;

      if (!placement) {
        await playRestoreAnimation();
        setCutAnimating(false);
        return;
      }

      pendingPlacementRef.current = placement;
      await playFlightAnimation(placement);
      completeFlight();
    } catch (error) {
      console.warn('[stickers] stamp cutter transition failed', error);
      await playRestoreAnimation();
      setCutAnimating(false);
    }
  }, [
    busy,
    completeFlight,
    cropRect,
    offsetXValue,
    offsetYValue,
    onConfirm,
    playExtractionAnimation,
    playFlightAnimation,
    playRestoreAnimation,
    processingHoldDuration,
    processingIndicatorOpacity,
    reduceMotionEnabled,
    sourceSize,
    startProcessingFloat,
    viewportSize,
    zoomValue,
  ]);

  const stagePreviewImageAnimatedStyle = useAnimatedStyle(() => {
    const width = previewMetrics.baseImageWidth * zoomValue.value;
    const height = previewMetrics.baseImageHeight * zoomValue.value;

    return {
      width,
      height,
      left: (viewportSize.width - width) / 2 + offsetXValue.value,
      top: (viewportSize.height - height) / 2 + offsetYValue.value,
    };
  }, [
    offsetXValue,
    offsetYValue,
    previewMetrics.baseImageHeight,
    previewMetrics.baseImageWidth,
    viewportSize.height,
    viewportSize.width,
    zoomValue,
  ]);

  const cutPreviewImageAnimatedStyle = useAnimatedStyle(() => {
    const width = previewMetrics.baseImageWidth * zoomValue.value;
    const height = previewMetrics.baseImageHeight * zoomValue.value;
    const stageLeft = (viewportSize.width - width) / 2 + offsetXValue.value;
    const stageTop = (viewportSize.height - height) / 2 + offsetYValue.value;

    return {
      width,
      height,
      left: stageLeft - cropRect.x,
      top: stageTop - cropRect.y,
    };
  }, [
    cropRect.x,
    cropRect.y,
    offsetXValue,
    offsetYValue,
    previewMetrics.baseImageHeight,
    previewMetrics.baseImageWidth,
    viewportSize.height,
    viewportSize.width,
    zoomValue,
  ]);

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const stageBackgroundAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backgroundOpacity.value,
    transform: [{ scale: backgroundScale.value }],
  }));

  const guideAnimatedStyle = useAnimatedStyle(() => ({
    opacity: guideOpacity.value,
  }));

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [{ translateY: headerTranslateY.value }],
  }));

  const controlsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: controlsOpacity.value,
    transform: [{ translateY: controlsTranslateY.value }],
  }));

  const detachedStampAnimatedStyle = useAnimatedStyle(() => {
    const floatOffset = reduceMotionEnabled
      ? 0
      : interpolate(processingFloatProgress.value, [0, 0.5, 1], [0, -6, 0]);

    return {
      opacity: detachedOpacity.value,
      shadowOpacity: detachedShadowOpacity.value,
      shadowRadius: 12 + detachedShadowOpacity.value * 24,
      elevation: 6 + Math.round(detachedShadowOpacity.value * 12),
      transform: [
        { translateX: detachedTranslateX.value },
        { translateY: detachedTranslateY.value + floatOffset },
        { scale: detachedScale.value },
      ],
    };
  }, [
    detachedOpacity,
    detachedScale,
    detachedShadowOpacity,
    detachedTranslateX,
    detachedTranslateY,
    processingFloatProgress,
    reduceMotionEnabled,
  ]);

  const processingIndicatorAnimatedStyle = useAnimatedStyle(() => ({
    opacity: processingIndicatorOpacity.value,
    transform: [
      {
        translateY: interpolate(processingFloatProgress.value, [0, 0.5, 1], [0, -4, 0]),
      },
    ],
  }));

  const handleStageAreaLayout = useCallback(
    (event: { nativeEvent: { layout: WindowRect } }) => {
      const { x, y, width, height } = event.nativeEvent.layout;
      setStageAreaRect({ x, y, width, height });
    },
    []
  );

  if (!visible || !draft || !previewUri) {
    return null;
  }
  const previewSource = { uri: previewUri };

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
      </Reanimated.View>

      <View style={styles.stageArea} onLayout={handleStageAreaLayout}>
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
              <Reanimated.View
                collapsable={false}
                pointerEvents={busy ? 'none' : 'auto'}
                style={[styles.gestureStage, stageBackgroundAnimatedStyle]}
              >
                <View
                  pointerEvents="none"
                  style={[
                    styles.previewSurfaceBackground,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.04)'
                        : 'rgba(255,255,255,0.35)',
                    },
                  ]}
                />
                <Reanimated.View
                  style={[
                    styles.previewImage,
                    stagePreviewImageAnimatedStyle,
                  ]}
                >
                  <ExpoImage
                    source={previewSource}
                    style={styles.previewImageFill}
                    contentFit="cover"
                    transition={0}
                  />
                </Reanimated.View>
                <Reanimated.View
                  pointerEvents="none"
                  style={[
                    styles.stampGuide,
                    {
                      left: cropRect.x,
                      top: cropRect.y,
                      width: cropRect.width,
                      height: cropRect.height,
                    },
                    guideAnimatedStyle,
                  ]}
                >
                  <View style={styles.stampGuideViewport}>
                    <Reanimated.View
                      style={[
                        styles.previewImage,
                        cutPreviewImageAnimatedStyle,
                      ]}
                    >
                      <ExpoImage
                        source={previewSource}
                        style={styles.previewImageFill}
                        contentFit="cover"
                        transition={0}
                      />
                    </Reanimated.View>
                  </View>
                  <Canvas style={styles.stampGuideCanvas} testID="stamp-cutter-live-outline">
                    <SkiaPath
                      path={stampPath}
                      color={STAMP_OUTLINE_COLOR}
                      style="stroke"
                      strokeWidth={stampGuideOutlineWidth}
                    />
                    <SkiaPath
                      path={stampPath}
                      color={STAMP_PAPER_BORDER_COLOR}
                      style="stroke"
                      strokeWidth={stampGuideBorderWidth}
                    />
                  </Canvas>
                </Reanimated.View>
              </Reanimated.View>
            </GestureDetector>
          </View>
        </Reanimated.View>
      </View>

      <Reanimated.View
        pointerEvents="none"
        style={[
          styles.detachedStampLayer,
          {
            left: detachedBaseRect.x,
            top: detachedBaseRect.y,
            width: detachedBaseRect.width,
            height: detachedBaseRect.height,
          },
          detachedStampAnimatedStyle,
        ]}
      >
        <View
          style={[
            styles.detachedStampPaper,
            {
              backgroundColor: STAMP_PAPER_COLOR,
              borderColor,
              borderRadius: Math.max(stampMetrics.borderRadius, 18),
              shadowColor: isDark ? '#000000' : 'rgba(76,57,31,0.42)',
            },
          ]}
        >
          <View style={styles.detachedStampViewport}>
            <Reanimated.View
              style={[
                styles.previewImage,
                cutPreviewImageAnimatedStyle,
              ]}
            >
              <ExpoImage
                source={previewSource}
                style={styles.previewImageFill}
                contentFit="cover"
                transition={0}
              />
            </Reanimated.View>
          </View>
          <Canvas style={styles.detachedStampOverlay}>
            <SkiaPath
              path={stampPath}
              color={STAMP_OUTLINE_COLOR}
              style="stroke"
              strokeWidth={stampGuideOutlineWidth}
            />
            <SkiaPath
              path={stampPath}
              color={STAMP_PAPER_BORDER_COLOR}
              style="stroke"
              strokeWidth={stampGuideBorderWidth}
            />
          </Canvas>
        </View>
        <Reanimated.View
          style={[
            styles.processingBadge,
            {
              backgroundColor: buttonFill,
              borderColor,
            },
            processingIndicatorAnimatedStyle,
          ]}
        >
          <ActivityIndicator size="small" color={textColor} />
        </Reanimated.View>
      </Reanimated.View>

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
            loading={loading && cutAnimating}
            style={styles.confirmButton}
            testID="stamp-cutter-confirm"
          />
        </View>
      </Reanimated.View>
    </View>
  );

  if (Platform.OS === 'web') {
    return <GestureHandlerRootView style={styles.gestureRoot}>{content}</GestureHandlerRootView>;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={() => {
        if (!busy) {
          onClose();
        }
      }}
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
  stampGuide: {
    position: 'absolute',
  },
  stampGuideViewport: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  stampGuideCanvas: {
    width: '100%',
    height: '100%',
  },
  detachedStampLayer: {
    position: 'absolute',
    zIndex: 5,
    alignItems: 'center',
  },
  detachedStampPaper: {
    width: '100%',
    height: '100%',
    borderWidth: 1,
    overflow: 'hidden',
  },
  detachedStampViewport: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  detachedStampOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  processingBadge: {
    position: 'absolute',
    bottom: -44,
    minWidth: 42,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
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
