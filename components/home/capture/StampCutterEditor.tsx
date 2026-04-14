import * as Haptics from '../../../hooks/useHaptics';
import { Canvas, Path as SkiaPath } from '@shopify/react-native-skia';
import { Image as ExpoImage } from 'expo-image';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { useTheme } from '../../../hooks/useTheme';
import type { NoteStickerPlacement, StickerStampStyle } from '../../../services/noteStickers';
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
} from '../../notes/stampFrameMetrics';
import { triggerCaptureCardHaptic } from './captureMotion';
import StampStylePicker from './StampStylePicker';
import StickerCreationOverlay from './StickerCreationOverlay';
import type {
  StickerCreationAnimatedStyle,
} from './StickerCreationOverlay';
import type { WindowRect } from './stickerCreationTypes';

const EDITOR_STAGE_MAX_WIDTH = 520;
const RESET_TRANSFORM: StampCutterTransform = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
};

type MeasurableView = View & {
  measureInWindow?: (callback: (x: number, y: number, width: number, height: number) => void) => void;
};

interface StampCutterEditorProps {
  visible: boolean;
  draft: StampCutterDraft | null;
  loading?: boolean;
  title: string;
  subtitle: string;
  cancelLabel: string;
  confirmLabel: string;
  classicStyleLabel: string;
  circleStyleLabel: string;
  onClose: () => void;
  onCompletePlacement: (payload: {
    placement: NoteStickerPlacement;
    sourceRect: WindowRect;
  }) => void;
  onConfirm: (payload: {
      viewportSize: { width: number; height: number };
      selectionRect: { x: number; y: number; width: number; height: number };
      transform: StampCutterTransform;
      stampStyle: StickerStampStyle;
  }) => NoteStickerPlacement | null | Promise<NoteStickerPlacement | null>;
}

function measureWindowRect(node: MeasurableView | null): Promise<WindowRect | null> {
  return new Promise((resolve) => {
    if (!node?.measureInWindow) {
      resolve(null);
      return;
    }

    let settled = false;
    const finish = (rect: WindowRect | null) => {
      if (settled) {
        return;
      }

      settled = true;
      resolve(rect);
    };
    const fallbackTimeout = setTimeout(() => {
      finish(null);
    }, 32);

    node.measureInWindow((x, y, width, height) => {
      clearTimeout(fallbackTimeout);

      if (width <= 0 || height <= 0) {
        finish(null);
        return;
      }

      finish({ x, y, width, height });
    });
  });
}

function StampCutterEditor({
  visible,
  draft,
  loading = false,
  title,
  subtitle,
  cancelLabel,
  confirmLabel,
  classicStyleLabel,
  circleStyleLabel,
  onClose,
  onCompletePlacement,
  onConfirm,
}: StampCutterEditorProps) {
  const { colors, isDark } = useTheme();
  const reduceMotionEnabled = useReducedMotion();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [stageAreaWindowRect, setStageAreaWindowRect] = useState<WindowRect | null>(null);
  const [stampStyle, setStampStyle] = useState<StickerStampStyle>('classic');
  const stageAreaRef = useRef<View | null>(null);
  const zoomValue = useSharedValue(1);
  const offsetXValue = useSharedValue(0);
  const offsetYValue = useSharedValue(0);
  const panStartXValue = useSharedValue(0);
  const panStartYValue = useSharedValue(0);
  const pinchStartZoomValue = useSharedValue(1);
  const pinchStartOffsetXValue = useSharedValue(0);
  const pinchStartOffsetYValue = useSharedValue(0);
  const activeGestureCountValue = useSharedValue(0);

  useEffect(() => {
    zoomValue.value = RESET_TRANSFORM.zoom;
    offsetXValue.value = RESET_TRANSFORM.offsetX;
    offsetYValue.value = RESET_TRANSFORM.offsetY;
    activeGestureCountValue.value = 0;
  }, [
    activeGestureCountValue,
    draft?.source.uri,
    offsetXValue,
    offsetYValue,
    visible,
    zoomValue,
  ]);

  const stageWidth = Math.min(windowWidth - 8, EDITOR_STAGE_MAX_WIDTH);
  const stageHeight = stageWidth / STAMP_CUTTER_OVERLAY_ASPECT_RATIO;
  const cropRect = useMemo(
    () => getStampCutterWindowRect({ width: stageWidth, height: stageHeight }, stampStyle),
    [stageHeight, stageWidth, stampStyle]
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
    () => getStampFrameMetrics(cropRect.width, cropRect.height, stampStyle),
    [cropRect.height, cropRect.width, stampStyle]
  );
  const stampPath = useMemo(() => createStampFramePath(stampMetrics), [stampMetrics]);
  const stampGuideBorderWidth = Math.max(1, stampMetrics.perforationRadius * 0.16);
  const stampGuideOutlineWidth = Math.max(2.2, stampMetrics.perforationRadius * 0.62);
  const interactionsDisabled = loading;

  useEffect(() => {
    if (!visible) {
      return;
    }

    setStampStyle('classic');
  }, [draft?.source.uri, visible]);

  const resolveSelectionWindowRect = useCallback(
    (nextStageAreaWindowRect: WindowRect | null | undefined) => {
      if (!nextStageAreaWindowRect) {
        return {
          x: (windowWidth - cropRect.width) / 2,
          y: (windowHeight - cropRect.height) / 2,
          width: cropRect.width,
          height: cropRect.height,
        };
      }

      const stageRect = {
        x: nextStageAreaWindowRect.x + (nextStageAreaWindowRect.width - stageWidth) / 2,
        y: nextStageAreaWindowRect.y + (nextStageAreaWindowRect.height - stageHeight) / 2,
        width: stageWidth,
        height: stageHeight,
      };

      return {
        x: stageRect.x + cropRect.x,
        y: stageRect.y + cropRect.y,
        width: cropRect.width,
        height: cropRect.height,
      };
    },
    [cropRect.height, cropRect.width, cropRect.x, cropRect.y, stageHeight, stageWidth, windowHeight, windowWidth]
  );

  const previewUri = draft?.source.uri ?? null;

  const measureStageAreaInWindow = useCallback(async () => {
    const nextRect = await measureWindowRect(stageAreaRef.current as MeasurableView | null);
    if (!nextRect) {
      return null;
    }

    setStageAreaWindowRect((current) => {
      if (
        current &&
        current.x === nextRect.x &&
        current.y === nextRect.y &&
        current.width === nextRect.width &&
        current.height === nextRect.height
      ) {
        return current;
      }

      return nextRect;
    });
    return nextRect;
  }, []);

  const scheduleStageAreaMeasurement = useCallback(() => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        void measureStageAreaInWindow();
      });
      return;
    }

    setTimeout(() => {
      void measureStageAreaInWindow();
    }, 0);
  }, [measureStageAreaInWindow]);

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
    if (interactionsDisabled) {
      return;
    }

    triggerCaptureCardHaptic(Haptics.ImpactFeedbackStyle.Light);
    animateToTransform(RESET_TRANSFORM);
  }, [animateToTransform, interactionsDisabled]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!interactionsDisabled)
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
    [beginInteractionWorklet, cropRect, finalizeInteractionWorklet, interactionsDisabled, offsetXValue, offsetYValue, panStartXValue, panStartYValue, sourceSize, viewportSize, zoomValue]
  );

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .enabled(!interactionsDisabled)
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
      cropRect,
      cropRectCenterX,
      cropRectCenterY,
      finalizeInteractionWorklet,
      interactionsDisabled,
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
      .enabled(!interactionsDisabled)
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
    cropRect,
    cropRectCenterX,
    cropRectCenterY,
    handleReset,
    interactionsDisabled,
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

  const handleConfirmCreation = useCallback(async () => {
    const payload = {
      viewportSize,
      selectionRect: cropRect,
      transform: normalizeStampCutterPreviewTransform(sourceSize, viewportSize, cropRect, {
        zoom: zoomValue.value,
        offsetX: offsetXValue.value,
        offsetY: offsetYValue.value,
        rotation: 0,
      }),
      stampStyle,
    };

    const placement = await onConfirm(payload);

    if (!placement) {
      return null;
    }

    const latestStageAreaWindowRect = await measureStageAreaInWindow();
    const sourceRect = resolveSelectionWindowRect(latestStageAreaWindowRect ?? stageAreaWindowRect);

    return {
      placement,
      sourceRect,
    };
  }, [
    cropRect,
    measureStageAreaInWindow,
    offsetXValue,
    offsetYValue,
    onConfirm,
    resolveSelectionWindowRect,
    sourceSize,
    stageAreaWindowRect,
    viewportSize,
    zoomValue,
    stampStyle,
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

  useEffect(() => {
    if (!visible) {
      return;
    }

    scheduleStageAreaMeasurement();
  }, [scheduleStageAreaMeasurement, stageHeight, stageWidth, visible]);

  if (!draft || !previewUri) {
    return null;
  }
  const previewSource = { uri: previewUri };

  const renderStage = ({
    busy,
    contentAnimatedStyle,
    focusAnimatedStyle,
  }: {
    busy: boolean;
    contentAnimatedStyle: StickerCreationAnimatedStyle;
    focusAnimatedStyle: StickerCreationAnimatedStyle;
  }) => (
    <View ref={stageAreaRef} style={styles.stageArea} onLayout={scheduleStageAreaMeasurement}>
      <View style={styles.stageStack}>
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
                style={[styles.gestureStage, contentAnimatedStyle]}
              >
                <View
                  pointerEvents="none"
                  style={[
                    styles.previewSurfaceBackground,
                    {
                      backgroundColor:
                        colors.background ??
                        (isDark ? 'rgba(15,12,10,0.96)' : 'rgba(250,245,236,0.96)'),
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
                    focusAnimatedStyle,
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
        <StampStylePicker
          value={stampStyle}
          disabled={busy}
          classicLabel={classicStyleLabel}
          circleLabel={circleStyleLabel}
          onChange={setStampStyle}
        />
      </View>
    </View>
  );

  return (
    <StickerCreationOverlay
      visible={visible}
      loading={loading}
      title={title}
      subtitle={subtitle}
      cancelLabel={cancelLabel}
      confirmLabel={confirmLabel}
      testIDPrefix="stamp-cutter"
      resetKey={previewUri}
      onClose={onClose}
      onReset={handleReset}
      onConfirm={handleConfirmCreation}
      onCompletePlacement={onCompletePlacement}
      renderStage={renderStage}
    />
  );
}

export default memo(StampCutterEditor);

const styles = StyleSheet.create({
  stageArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  stageStack: {
    alignItems: 'center',
    gap: 10,
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
});
