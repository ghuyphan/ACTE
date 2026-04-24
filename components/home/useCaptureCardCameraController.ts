import { Skia } from '@shopify/react-native-skia';
import type { TFunction } from 'i18next';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { Gesture } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  Easing,
  interpolateColor,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { Camera, CameraDevice } from 'react-native-vision-camera';
import { Layout } from '../../constants/theme';
import type { ThemeColors } from '../../hooks/useTheme';
import {
  formatCameraZoomFactor,
  getBackCameraLensZoomSpec,
  resolveCameraZoomState,
  type BackCameraLens,
  type BackCameraLensZoomConfig,
} from '../../services/cameraZoom';
import { LIVE_PHOTO_MAX_DURATION_SECONDS } from '../../services/livePhotoProcessing';

const CAMERA_AUTO_RECOVERY_ATTEMPTS = 1;
const CAMERA_START_TIMEOUT_MS = 2400;
const CAMERA_ZOOM_PINCH_EXPONENT = 0.85;
const CAMERA_LENS_SWITCH_OUT_HYSTERESIS = 0.94;
const CAMERA_ZOOM_LABEL_VISIBLE_MS = 1100;
const CAMERA_TRANSITION_FADE_IN_MS = 110;
const CAMERA_TRANSITION_READY_SOFTEN_MS = 120;
const CAMERA_TRANSITION_READY_SOFTEN_OPACITY = 0.32;
const CAMERA_TRANSITION_FADE_OUT_MS = 140;
const CAMERA_SWITCH_MASK_OPACITY = 0.78;
const CAMERA_SWITCH_FADE_IN_MS = 80;
const CAMERA_SWITCH_READY_SOFTEN_MS = 90;
const CAMERA_SWITCH_READY_SOFTEN_OPACITY = 0.18;
const CAMERA_FOCUS_RING_VISIBLE_MS = 640;
const CAMERA_FOCUS_RING_FADE_IN_MS = 170;
const CAMERA_FOCUS_RING_SETTLE_MS = 110;
const CAMERA_FOCUS_RING_FADE_OUT_MS = 300;
const SHUTTER_CORE_SIZE = 58;

function clamp(value: number, minValue: number, maxValue: number) {
  return Math.min(maxValue, Math.max(minValue, value));
}

interface UseCaptureCardCameraControllerOptions {
  captureMode: 'text' | 'camera';
  capturedPhoto: string | null;
  cameraRef: RefObject<Camera | null>;
  cameraDevice?: CameraDevice;
  cameraSessionKey: number;
  permissionGranted: boolean;
  isCameraPreviewActive: boolean;
  isCameraRevealAllowed: boolean;
  backCameraLens: BackCameraLens;
  availableBackCameraLenses?: BackCameraLens[];
  backCameraLensZoomConfig?: BackCameraLensZoomConfig;
  facing: 'back' | 'front';
  cameraInstructionText?: string | null;
  isLivePhotoCaptureInProgress: boolean;
  allowShutterLongPress?: boolean;
  interactionsDisabled: boolean;
  reduceMotionEnabled: boolean;
  shutterScale: SharedValue<number>;
  colors: Pick<ThemeColors, 'primary' | 'border'>;
  t: TFunction;
  cardSize: number;
  livePhotoRingStrokeWidth: number;
  onCameraGestureActiveChange?: (active: boolean) => void;
  onChangeBackCameraLens?: (nextLens: BackCameraLens) => void;
  onToggleFacing: () => void;
  onTakePicture: () => void;
  onShutterPressOut: () => void;
  onStartLivePhotoCapture: () => void;
}

type PendingBackCameraLensChange = {
  lens: BackCameraLens;
  mode: 'manual' | 'pinch';
  zoomFactor?: number;
};

type RearZoomLensOption = {
  lens: BackCameraLens;
  anchor: number;
  min: number;
  max: number;
};

function getSortedRearZoomLensOptions(
  availableBackCameraLenses: BackCameraLens[],
  backCameraLens: BackCameraLens,
  backCameraLensZoomConfig: BackCameraLensZoomConfig | undefined
): RearZoomLensOption[] {
  const lenses = availableBackCameraLenses.includes(backCameraLens)
    ? availableBackCameraLenses
    : [...availableBackCameraLenses, backCameraLens];
  const uniqueLenses = Array.from(new Set(lenses));

  return uniqueLenses
    .map((lens) => {
      const spec = getBackCameraLensZoomSpec(backCameraLensZoomConfig, lens);
      return {
        lens,
        anchor: spec.anchor,
        min: spec.min,
        max: spec.max,
      };
    })
    .filter((option) => (
      Number.isFinite(option.anchor) &&
      Number.isFinite(option.min) &&
      Number.isFinite(option.max) &&
      option.anchor > 0 &&
      option.min > 0 &&
      option.max >= option.min
    ))
    .sort((first, second) => first.anchor - second.anchor);
}

function getBackCameraLensForLogicalZoom(
  requestedZoomFactor: number,
  activeLens: BackCameraLens,
  lensOptions: RearZoomLensOption[]
) {
  if (lensOptions.length === 0) {
    return activeLens;
  }

  const activeIndex = lensOptions.findIndex((option) => option.lens === activeLens);
  let targetIndex = activeIndex >= 0
    ? activeIndex
    : lensOptions.findIndex((option) => requestedZoomFactor < option.anchor);

  if (targetIndex < 0) {
    targetIndex = lensOptions.length - 1;
  }

  while (
    targetIndex < lensOptions.length - 1 &&
    requestedZoomFactor >= lensOptions[targetIndex + 1]!.anchor
  ) {
    targetIndex += 1;
  }

  while (
    targetIndex > 0 &&
    requestedZoomFactor < lensOptions[targetIndex]!.anchor * CAMERA_LENS_SWITCH_OUT_HYSTERESIS
  ) {
    targetIndex -= 1;
  }

  return lensOptions[targetIndex]?.lens ?? activeLens;
}

export function useCaptureCardCameraController({
  captureMode,
  capturedPhoto,
  cameraRef,
  cameraDevice,
  cameraSessionKey,
  permissionGranted,
  isCameraPreviewActive,
  isCameraRevealAllowed,
  backCameraLens,
  availableBackCameraLenses = [backCameraLens],
  backCameraLensZoomConfig,
  facing,
  cameraInstructionText = null,
  isLivePhotoCaptureInProgress,
  allowShutterLongPress = true,
  interactionsDisabled,
  reduceMotionEnabled,
  shutterScale,
  colors,
  t,
  cardSize,
  livePhotoRingStrokeWidth,
  onCameraGestureActiveChange,
  onChangeBackCameraLens,
  onToggleFacing,
  onTakePicture,
  onShutterPressOut,
  onStartLivePhotoCapture,
}: UseCaptureCardCameraControllerOptions) {
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraUnavailable, setCameraUnavailable] = useState(false);
  const [livePhotoCountdownSeconds, setLivePhotoCountdownSeconds] = useState(
    LIVE_PHOTO_MAX_DURATION_SECONDS
  );
  const [livePhotoRingProgress, setLivePhotoRingProgress] = useState(0);
  const [cameraIssueDetail, setCameraIssueDetail] = useState<string | null>(null);
  const [cameraRetryNonce, setCameraRetryNonce] = useState(0);
  const [cameraActivationNonce, setCameraActivationNonce] = useState(0);
  const [cameraZoomFactor, setCameraZoomFactor] = useState(() =>
    facing === 'back'
      ? getBackCameraLensZoomSpec(backCameraLensZoomConfig, backCameraLens).anchor
      : 1
  );
  const [showCameraZoomBadge, setShowCameraZoomBadge] = useState(false);
  const [cameraFocusPoint, setCameraFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const shutterLongPressTriggeredRef = useRef(false);
  const cameraAutoRecoveryCountRef = useRef(0);
  const cameraZoomFactorRef = useRef(cameraZoomFactor);
  const cameraPinchZoomStartRef = useRef(cameraZoomFactor);
  const cameraPinchScaleStartRef = useRef(1);
  const cameraGestureLockCountRef = useRef(0);
  const cameraSwitchInFlightRef = useRef(false);
  const cameraZoomBadgeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingBackCameraLensChangeRef = useRef<PendingBackCameraLensChange | null>(null);
  const previousBackCameraLensRef = useRef(backCameraLens);
  const previousFacingRef = useRef(facing);
  const cameraHintVisibility = useSharedValue(Boolean(cameraInstructionText) && !capturedPhoto ? 1 : 0);
  const cameraTransitionMaskOpacity = useSharedValue(0);
  const cameraFocusRingOpacity = useSharedValue(0);
  const cameraFocusRingScale = useSharedValue(1.08);
  const livePhotoVisualProgress = useSharedValue(isLivePhotoCaptureInProgress ? 1 : 0);
  const livePhotoHaloProgress = useSharedValue(0);
  const showCameraInstructionHint = Boolean(cameraInstructionText) && !capturedPhoto;
  const shouldPrepareCameraPreview =
    captureMode === 'camera' &&
    !capturedPhoto &&
    permissionGranted;
  const shouldShowCameraCard = captureMode === 'camera' && !capturedPhoto;
  const shouldRenderCameraPreview = shouldPrepareCameraPreview && Boolean(cameraDevice);
  const canShowLiveCameraPreview = shouldRenderCameraPreview && isCameraPreviewActive;
  const previousCanShowLiveCameraPreviewRef = useRef(canShowLiveCameraPreview);
  const previousShouldRenderCameraPreviewRef = useRef(shouldRenderCameraPreview);
  const livePhotoProgressPath = useMemo(() => {
    const livePhotoCardProgressInset = livePhotoRingStrokeWidth / 2;
    const path = Skia.Path.Make();
    const left = livePhotoCardProgressInset;
    const top = livePhotoCardProgressInset;
    const right = cardSize - livePhotoCardProgressInset;
    const bottom = cardSize - livePhotoCardProgressInset;
    const radius = Math.max(Layout.cardRadius - livePhotoCardProgressInset, 0);

    path.moveTo(right - radius, top);
    if (typeof path.rArcTo === 'function') {
      path.rArcTo(radius, radius, 0, true, false, radius, radius);
    } else {
      path.quadTo(right, top, right, top + radius);
    }
    path.lineTo(right, bottom - radius);
    if (typeof path.rArcTo === 'function') {
      path.rArcTo(radius, radius, 0, true, false, -radius, radius);
    } else {
      path.quadTo(right, bottom, right - radius, bottom);
    }
    path.lineTo(left + radius, bottom);
    if (typeof path.rArcTo === 'function') {
      path.rArcTo(radius, radius, 0, true, false, -radius, -radius);
    } else {
      path.quadTo(left, bottom, left, bottom - radius);
    }
    path.lineTo(left, top + radius);
    if (typeof path.rArcTo === 'function') {
      path.rArcTo(radius, radius, 0, true, false, radius, -radius);
    } else {
      path.quadTo(left, top, left + radius, top);
    }
    path.lineTo(right - radius, top);

    return path;
  }, [cardSize, livePhotoRingStrokeWidth]);

  const clearCameraZoomBadgeTimeout = useCallback(() => {
    if (cameraZoomBadgeTimeoutRef.current) {
      clearTimeout(cameraZoomBadgeTimeoutRef.current);
      cameraZoomBadgeTimeoutRef.current = null;
    }
  }, []);

  const beginCameraGestureLock = useCallback(() => {
    cameraGestureLockCountRef.current += 1;
    if (cameraGestureLockCountRef.current === 1) {
      onCameraGestureActiveChange?.(true);
    }
  }, [onCameraGestureActiveChange]);

  const endCameraGestureLock = useCallback(() => {
    if (cameraGestureLockCountRef.current <= 0) {
      cameraGestureLockCountRef.current = 0;
      onCameraGestureActiveChange?.(false);
      return;
    }

    cameraGestureLockCountRef.current -= 1;
    if (cameraGestureLockCountRef.current === 0) {
      onCameraGestureActiveChange?.(false);
    }
  }, [onCameraGestureActiveChange]);

  const scheduleHideCameraZoomBadge = useCallback(() => {
    clearCameraZoomBadgeTimeout();
    cameraZoomBadgeTimeoutRef.current = setTimeout(() => {
      setShowCameraZoomBadge(false);
      cameraZoomBadgeTimeoutRef.current = null;
    }, CAMERA_ZOOM_LABEL_VISIBLE_MS);
  }, [clearCameraZoomBadgeTimeout]);

  const setCameraZoomState = useCallback(
    (nextZoomFactor: number, { showBadge = false }: { showBadge?: boolean } = {}) => {
      const normalizedZoomFactor =
        Number.isFinite(nextZoomFactor) && nextZoomFactor > 0 ? nextZoomFactor : 1;
      cameraZoomFactorRef.current = normalizedZoomFactor;
      setCameraZoomFactor((current) =>
        Math.abs(current - normalizedZoomFactor) < 0.001 ? current : normalizedZoomFactor
      );

      if (showBadge) {
        setShowCameraZoomBadge(true);
        scheduleHideCameraZoomBadge();
        return;
      }

      clearCameraZoomBadgeTimeout();
      setShowCameraZoomBadge(false);
    },
    [clearCameraZoomBadgeTimeout, scheduleHideCameraZoomBadge]
  );

  const updateCameraZoomFactor = useCallback(
    (nextZoomFactor: number) => {
      setCameraZoomState(nextZoomFactor, { showBadge: true });
    },
    [setCameraZoomState]
  );

  const resetCameraZoom = useCallback(
    ({ showBadge = false }: { showBadge?: boolean } = {}) => {
      const defaultZoomFactor =
        facing === 'back'
          ? getBackCameraLensZoomSpec(backCameraLensZoomConfig, backCameraLens).anchor
          : 1;
      setCameraZoomState(defaultZoomFactor, { showBadge });
    },
    [backCameraLens, backCameraLensZoomConfig, facing, setCameraZoomState]
  );

  const showCameraFocusRing = useCallback(
    (x: number, y: number) => {
      cancelAnimation(cameraFocusRingOpacity);
      cancelAnimation(cameraFocusRingScale);
      setCameraFocusPoint({ x, y });
      cameraFocusRingScale.value = 0.82;
      cameraFocusRingOpacity.value = 0;
      cameraFocusRingScale.value = withSequence(
        withTiming(1.04, {
          duration: reduceMotionEnabled ? 0 : CAMERA_FOCUS_RING_FADE_IN_MS,
          easing: Easing.out(Easing.cubic),
        }),
        withTiming(0.98, {
          duration: reduceMotionEnabled ? 0 : CAMERA_FOCUS_RING_SETTLE_MS,
          easing: Easing.out(Easing.quad),
        }),
        withDelay(
          reduceMotionEnabled ? 0 : CAMERA_FOCUS_RING_VISIBLE_MS,
          withTiming(1.06, {
            duration: reduceMotionEnabled ? 0 : CAMERA_FOCUS_RING_FADE_OUT_MS,
            easing: Easing.out(Easing.cubic),
          })
        )
      );
      cameraFocusRingOpacity.value = withSequence(
        withTiming(1, {
          duration: reduceMotionEnabled ? 0 : CAMERA_FOCUS_RING_FADE_IN_MS,
          easing: Easing.out(Easing.cubic),
        }),
        withDelay(
          reduceMotionEnabled ? 0 : CAMERA_FOCUS_RING_VISIBLE_MS,
          withTiming(0, {
            duration: reduceMotionEnabled ? 0 : CAMERA_FOCUS_RING_FADE_OUT_MS,
            easing: Easing.out(Easing.cubic),
          })
        )
      );
    },
    [
      cameraFocusRingOpacity,
      cameraFocusRingScale,
      reduceMotionEnabled,
    ]
  );

  const handleCameraFocusTap = useCallback(
    async (x: number, y: number) => {
      if (
        !cameraRef.current ||
        !cameraDevice?.supportsFocus ||
        !canShowLiveCameraPreview ||
        cameraUnavailable ||
        interactionsDisabled
      ) {
        return;
      }

      showCameraFocusRing(x, y);

      try {
        await cameraRef.current.focus({ x, y });
      } catch {
        // Ignore focus failures so the rest of the preview remains responsive.
      }
    },
    [
      cameraDevice?.supportsFocus,
      cameraRef,
      cameraUnavailable,
      canShowLiveCameraPreview,
      interactionsDisabled,
      showCameraFocusRing,
    ]
  );

  const restartCameraPreview = useCallback((manual = false) => {
    if (manual) {
      cameraAutoRecoveryCountRef.current = 0;
    }

    cameraSwitchInFlightRef.current = false;
    cameraTransitionMaskOpacity.value = withTiming(1, {
      duration: reduceMotionEnabled ? 0 : CAMERA_TRANSITION_FADE_IN_MS,
      easing: Easing.out(Easing.cubic),
    });
    setCameraUnavailable(false);
    setCameraIssueDetail(null);
    setIsCameraReady(false);
    setCameraRetryNonce((current) => current + 1);
  }, [
    cameraTransitionMaskOpacity,
    reduceMotionEnabled,
  ]);

  const handleCameraStartupFailure = useCallback(
    (detail?: string | null) => {
      const normalizedDetail = detail?.trim() ?? null;
      if (cameraAutoRecoveryCountRef.current < CAMERA_AUTO_RECOVERY_ATTEMPTS) {
        cameraAutoRecoveryCountRef.current += 1;
        restartCameraPreview();
        return;
      }

      setCameraUnavailable(true);
      setCameraIssueDetail(
        normalizedDetail ||
        t(
          'capture.cameraUnavailableTimeoutHint',
          'The camera preview took too long to start. Try again to restart the camera session.'
        )
      );
      setIsCameraReady(false);
      cameraSwitchInFlightRef.current = false;
      cameraTransitionMaskOpacity.value = withTiming(0, { duration: 0 });
    },
    [
      cameraTransitionMaskOpacity,
      restartCameraPreview,
      t,
    ]
  );

  const handleCameraInitialized = useCallback(() => {
    cameraAutoRecoveryCountRef.current = 0;
    setCameraUnavailable(false);
    setCameraIssueDetail(null);
    if (!canShowLiveCameraPreview || !isCameraRevealAllowed) {
      return;
    }

    const isSwitchingCamera = cameraSwitchInFlightRef.current;
    cameraTransitionMaskOpacity.value = withTiming(
      isSwitchingCamera ? CAMERA_SWITCH_READY_SOFTEN_OPACITY : CAMERA_TRANSITION_READY_SOFTEN_OPACITY,
      {
        duration: reduceMotionEnabled
          ? 0
          : isSwitchingCamera
            ? CAMERA_SWITCH_READY_SOFTEN_MS
            : CAMERA_TRANSITION_READY_SOFTEN_MS,
        easing: Easing.out(Easing.cubic),
      }
    );
  }, [
    cameraTransitionMaskOpacity,
    canShowLiveCameraPreview,
    isCameraRevealAllowed,
    reduceMotionEnabled,
  ]);

  const handleCameraPreviewStarted = useCallback(() => {
    const isSwitchingCamera = cameraSwitchInFlightRef.current;
    cameraSwitchInFlightRef.current = false;
    cameraAutoRecoveryCountRef.current = 0;
    setCameraUnavailable(false);
    setCameraIssueDetail(null);
    setIsCameraReady(true);
    if (!isCameraRevealAllowed) {
      cameraTransitionMaskOpacity.value = withTiming(1, { duration: 0 });
      return;
    }

    cameraTransitionMaskOpacity.value = isSwitchingCamera
      ? reduceMotionEnabled
        ? withTiming(0, { duration: 0 })
        : withSpring(0, {
            stiffness: 300,
            damping: 28,
            mass: 0.6,
          })
      : withTiming(0, {
          duration: reduceMotionEnabled ? 0 : CAMERA_TRANSITION_FADE_OUT_MS,
          easing: Easing.out(Easing.cubic),
        });
  }, [
    cameraTransitionMaskOpacity,
    isCameraRevealAllowed,
    reduceMotionEnabled,
  ]);

  useEffect(() => {
    const previousCanShowLiveCameraPreview = previousCanShowLiveCameraPreviewRef.current;
    const previousShouldRenderCameraPreview = previousShouldRenderCameraPreviewRef.current;
    previousCanShowLiveCameraPreviewRef.current = canShowLiveCameraPreview;
    previousShouldRenderCameraPreviewRef.current = shouldRenderCameraPreview;

    if (
      !canShowLiveCameraPreview &&
      previousCanShowLiveCameraPreview &&
      shouldRenderCameraPreview
    ) {
      setIsCameraReady(false);
    }

    if (
      canShowLiveCameraPreview &&
      !previousCanShowLiveCameraPreview &&
      previousShouldRenderCameraPreview
    ) {
      setCameraActivationNonce((current) => current + 1);
    }
  }, [canShowLiveCameraPreview, shouldRenderCameraPreview]);

  useEffect(() => {
    if (!shouldRenderCameraPreview) {
      setIsCameraReady(true);
      setCameraUnavailable(false);
      setCameraIssueDetail(null);
      cameraSwitchInFlightRef.current = false;
      cameraTransitionMaskOpacity.value = withTiming(0, { duration: 0 });
      return;
    }

    const isSwitchingCamera = cameraSwitchInFlightRef.current;
    cameraTransitionMaskOpacity.value = withTiming(isSwitchingCamera ? CAMERA_SWITCH_MASK_OPACITY : 1, {
      duration: reduceMotionEnabled
        ? 0
        : isSwitchingCamera
          ? CAMERA_SWITCH_FADE_IN_MS
          : CAMERA_TRANSITION_FADE_IN_MS,
      easing: Easing.out(Easing.cubic),
    });
    setIsCameraReady(false);
    setCameraUnavailable(false);
    setCameraIssueDetail(null);
  }, [
    cameraActivationNonce,
    cameraDevice?.id,
    cameraRetryNonce,
    cameraSessionKey,
    cameraTransitionMaskOpacity,
    reduceMotionEnabled,
    shouldRenderCameraPreview,
  ]);

  useEffect(() => {
    if (!shouldRenderCameraPreview) {
      return;
    }

    if (!canShowLiveCameraPreview || !isCameraRevealAllowed) {
      cameraTransitionMaskOpacity.value = withTiming(1, { duration: 0 });
    }
  }, [
    cameraTransitionMaskOpacity,
    canShowLiveCameraPreview,
    isCameraRevealAllowed,
    shouldRenderCameraPreview,
  ]);

  useEffect(() => {
    if (
      !shouldRenderCameraPreview ||
      !canShowLiveCameraPreview ||
      !isCameraRevealAllowed ||
      !isCameraReady ||
      cameraUnavailable
    ) {
      return;
    }

    cameraTransitionMaskOpacity.value = withTiming(0, {
      duration: reduceMotionEnabled ? 0 : CAMERA_TRANSITION_FADE_OUT_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [
    cameraTransitionMaskOpacity,
    cameraUnavailable,
    canShowLiveCameraPreview,
    isCameraReady,
    isCameraRevealAllowed,
    reduceMotionEnabled,
    shouldRenderCameraPreview,
  ]);

  useEffect(() => {
    cameraAutoRecoveryCountRef.current = 0;
  }, [cameraSessionKey, captureMode, facing, permissionGranted, isCameraPreviewActive, capturedPhoto]);

  useLayoutEffect(() => {
    if (captureMode !== 'camera') {
      pendingBackCameraLensChangeRef.current = null;
      resetCameraZoom();
    }
  }, [captureMode, resetCameraZoom]);

  useLayoutEffect(() => {
    const previousFacing = previousFacingRef.current;
    previousFacingRef.current = facing;

    if (previousFacing !== facing) {
      pendingBackCameraLensChangeRef.current = null;
      resetCameraZoom();
    }
  }, [facing, resetCameraZoom]);

  useLayoutEffect(() => {
    const previousBackCameraLens = previousBackCameraLensRef.current;
    previousBackCameraLensRef.current = backCameraLens;

    if (previousBackCameraLens !== backCameraLens && facing === 'back') {
      const pendingLensChange = pendingBackCameraLensChangeRef.current;
      const shouldShowBadge = pendingLensChange?.lens === backCameraLens;
      pendingBackCameraLensChangeRef.current = null;

      if (
        pendingLensChange?.mode === 'pinch' &&
        typeof pendingLensChange.zoomFactor === 'number'
      ) {
        setCameraZoomState(pendingLensChange.zoomFactor, { showBadge: shouldShowBadge });
        return;
      }

      resetCameraZoom({ showBadge: shouldShowBadge });
    }
  }, [backCameraLens, facing, resetCameraZoom, setCameraZoomState]);

  useEffect(
    () => () => {
      cameraGestureLockCountRef.current = 0;
      onCameraGestureActiveChange?.(false);
      clearCameraZoomBadgeTimeout();
      cancelAnimation(cameraFocusRingOpacity);
      cancelAnimation(cameraFocusRingScale);
    },
    [
      cameraFocusRingOpacity,
      cameraFocusRingScale,
      clearCameraZoomBadgeTimeout,
      onCameraGestureActiveChange,
    ]
  );

  useEffect(() => {
    if (canShowLiveCameraPreview) {
      return;
    }

    cameraGestureLockCountRef.current = 0;
    onCameraGestureActiveChange?.(false);
  }, [canShowLiveCameraPreview, onCameraGestureActiveChange]);

  useEffect(() => {
    if (!canShowLiveCameraPreview || isCameraReady || cameraUnavailable) {
      return;
    }

    const timer = setTimeout(() => {
      handleCameraStartupFailure();
    }, CAMERA_START_TIMEOUT_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [
    cameraDevice?.id,
    cameraRetryNonce,
    canShowLiveCameraPreview,
    cameraUnavailable,
    handleCameraStartupFailure,
    isCameraReady,
  ]);

  useEffect(() => {
    cameraHintVisibility.value = withTiming(showCameraInstructionHint ? 1 : 0, {
      duration: reduceMotionEnabled ? 0 : 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [cameraHintVisibility, reduceMotionEnabled, showCameraInstructionHint]);

  const cameraHintAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cameraHintVisibility.value,
    transform: [{ scale: 0.985 + cameraHintVisibility.value * 0.015 }],
  }), [cameraHintVisibility]);

  const cameraRadiusAnimatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - cameraHintVisibility.value,
    transform: [{ scale: 1 - cameraHintVisibility.value * 0.015 }],
  }), [cameraHintVisibility]);

  const cameraTransitionMaskAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cameraTransitionMaskOpacity.value,
  }), [cameraTransitionMaskOpacity]);

  const cameraFocusRingAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cameraFocusRingOpacity.value,
    transform: [{ scale: cameraFocusRingScale.value }],
  }), [cameraFocusRingOpacity, cameraFocusRingScale]);

  const shutterOuterAnimatedStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      livePhotoVisualProgress.value,
      [0, 1],
      [colors.border, `${colors.primary}3D`]
    ),
    borderWidth: 4,
    transform: [{ scale: 1 + livePhotoHaloProgress.value * 0.025 }],
  }), [colors.border, colors.primary, livePhotoHaloProgress, livePhotoVisualProgress]);

  const shutterCaptureHaloAnimatedStyle = useAnimatedStyle(() => ({
    opacity: livePhotoVisualProgress.value * (
      reduceMotionEnabled ? 0.12 : 0.16 + livePhotoHaloProgress.value * 0.14
    ),
    transform: [{ scale: 1 + livePhotoHaloProgress.value * (reduceMotionEnabled ? 0.04 : 0.18) }],
  }), [livePhotoHaloProgress, livePhotoVisualProgress, reduceMotionEnabled]);

  const shutterInnerAnimatedStyle = useAnimatedStyle(() => ({
    width: SHUTTER_CORE_SIZE,
    height: SHUTTER_CORE_SIZE,
    borderRadius: SHUTTER_CORE_SIZE / 2,
    transform: [{ scale: shutterScale.value }],
  }), [shutterScale]);

  useEffect(() => {
    livePhotoVisualProgress.value = withTiming(isLivePhotoCaptureInProgress ? 1 : 0, {
      duration: reduceMotionEnabled ? 110 : 180,
      easing: Easing.out(Easing.cubic),
    });

    cancelAnimation(livePhotoHaloProgress);
    livePhotoHaloProgress.value = 0;

    if (!isLivePhotoCaptureInProgress) {
      return;
    }

    if (reduceMotionEnabled) {
      livePhotoHaloProgress.value = 1;
      return;
    }

    livePhotoHaloProgress.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: 720,
          easing: Easing.out(Easing.quad),
        }),
        withTiming(0, {
          duration: 720,
          easing: Easing.inOut(Easing.quad),
        })
      ),
      -1,
      false
    );

    return () => {
      cancelAnimation(livePhotoHaloProgress);
    };
  }, [
    isLivePhotoCaptureInProgress,
    livePhotoHaloProgress,
    livePhotoVisualProgress,
    reduceMotionEnabled,
  ]);

  useEffect(() => {
    if (!isLivePhotoCaptureInProgress) {
      setLivePhotoCountdownSeconds(LIVE_PHOTO_MAX_DURATION_SECONDS);
      setLivePhotoRingProgress(0);
      return;
    }

    const startedAt = Date.now();
    const maxDurationMs = LIVE_PHOTO_MAX_DURATION_SECONDS * 1000;
    const updateCountdown = () => {
      const elapsedMs = Date.now() - startedAt;
      const remainingMs = Math.max(0, maxDurationMs - elapsedMs);
      setLivePhotoRingProgress(Math.min(1, elapsedMs / maxDurationMs));
      setLivePhotoCountdownSeconds(Math.max(1, Math.ceil(remainingMs / 1000)));
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 32);
    return () => {
      clearInterval(interval);
    };
  }, [isLivePhotoCaptureInProgress]);

  const showCameraUnavailableState =
    captureMode === 'camera' && !capturedPhoto && permissionGranted && cameraUnavailable;
  const cameraUnavailableDetail =
    cameraIssueDetail?.trim() || t(
      'capture.cameraUnavailableHint',
      'The camera session may have stalled. Try again to restart the preview.'
    );
  const cameraZoomGesturesEnabled =
    canShowLiveCameraPreview && !showCameraUnavailableState && !interactionsDisabled;
  const cameraFocusGesturesEnabled =
    cameraZoomGesturesEnabled && Boolean(cameraDevice?.supportsFocus);

  const handleSwitchCameraPress = useCallback(() => {
    cameraSwitchInFlightRef.current = true;
    cameraTransitionMaskOpacity.value = withTiming(CAMERA_SWITCH_MASK_OPACITY, {
      duration: reduceMotionEnabled ? 0 : CAMERA_SWITCH_FADE_IN_MS,
      easing: Easing.out(Easing.cubic),
    });
    setIsCameraReady(false);
    onToggleFacing();
  }, [
    cameraTransitionMaskOpacity,
    onToggleFacing,
    reduceMotionEnabled,
  ]);

  const handleShutterLongPress = useCallback(() => {
    if (!allowShutterLongPress) {
      return;
    }
    shutterLongPressTriggeredRef.current = true;
    onStartLivePhotoCapture();
  }, [allowShutterLongPress, onStartLivePhotoCapture]);

  const handleShutterPress = useCallback(() => {
    if (shutterLongPressTriggeredRef.current) {
      shutterLongPressTriggeredRef.current = false;
      return;
    }

    onTakePicture();
  }, [onTakePicture]);

  const handleShutterRelease = useCallback(() => {
    onShutterPressOut();
    if (shutterLongPressTriggeredRef.current) {
      setTimeout(() => {
        shutterLongPressTriggeredRef.current = false;
      }, 0);
      return;
    }

    shutterLongPressTriggeredRef.current = false;
  }, [onShutterPressOut]);

  const currentBackCameraLensZoomSpec = useMemo(
    () => getBackCameraLensZoomSpec(backCameraLensZoomConfig, backCameraLens),
    [backCameraLens, backCameraLensZoomConfig]
  );
  const rearZoomLensOptions = useMemo(
    () =>
      getSortedRearZoomLensOptions(
        availableBackCameraLenses,
        backCameraLens,
        backCameraLensZoomConfig
      ),
    [availableBackCameraLenses, backCameraLens, backCameraLensZoomConfig]
  );
  const currentLensAnchor = facing === 'back' ? currentBackCameraLensZoomSpec.anchor : 1;
  const resolvedCameraZoomState = useMemo(
    () => resolveCameraZoomState(cameraDevice, currentLensAnchor, cameraZoomFactor),
    [cameraDevice, currentLensAnchor, cameraZoomFactor]
  );
  const rearMinimumLogicalZoomFactor = useMemo(
    () => (
      rearZoomLensOptions.length > 0
        ? Math.min(...rearZoomLensOptions.map((option) => option.min))
        : resolvedCameraZoomState.bounds.min
    ),
    [rearZoomLensOptions, resolvedCameraZoomState.bounds.min]
  );
  const rearMaximumLogicalZoomFactor = useMemo(
    () => (
      rearZoomLensOptions.length > 0
        ? Math.max(...rearZoomLensOptions.map((option) => option.max))
        : resolvedCameraZoomState.bounds.max
    ),
    [rearZoomLensOptions, resolvedCameraZoomState.bounds.max]
  );
  const minimumLogicalZoomFactor =
    facing === 'back' ? rearMinimumLogicalZoomFactor : resolvedCameraZoomState.bounds.min;
  const maximumLogicalZoomFactor =
    facing === 'back' ? rearMaximumLogicalZoomFactor : resolvedCameraZoomState.bounds.max;
  const displayedCameraZoomFactor =
    facing === 'back'
      ? clamp(cameraZoomFactor, minimumLogicalZoomFactor, maximumLogicalZoomFactor)
      : resolvedCameraZoomState.logicalZoomFactor;
  const cameraPreviewZoom = resolvedCameraZoomState.previewZoom;
  const cameraZoomLabel = formatCameraZoomFactor(displayedCameraZoomFactor, 'badge');
  const cameraZoomSelectorLabel = formatCameraZoomFactor(displayedCameraZoomFactor, 'selector');
  const shouldShowPersistentCameraZoomBadge =
    displayedCameraZoomFactor > 1.01 || displayedCameraZoomFactor < 0.99;

  useLayoutEffect(() => {
    cameraZoomFactorRef.current = displayedCameraZoomFactor;
  }, [displayedCameraZoomFactor]);

  const handleBackCameraLensPress = useCallback(
    (nextLens: BackCameraLens) => {
      if (nextLens === backCameraLens) {
        return;
      }

      pendingBackCameraLensChangeRef.current = {
        lens: nextLens,
        mode: 'manual',
      };
      onChangeBackCameraLens?.(nextLens);
    },
    [backCameraLens, onChangeBackCameraLens]
  );

  const cameraZoomGesture = useMemo(
    () => {
      const tapGesture = Gesture.Tap()
        .enabled(cameraFocusGesturesEnabled)
        .runOnJS(true)
        .maxDuration(250)
        .maxDistance(12)
        .onEnd((event: { x: number; y: number }, success: boolean) => {
          if (success === false) {
            return;
          }

          void handleCameraFocusTap(event.x, event.y);
        });

      return Gesture.Exclusive(
        Gesture.Pinch()
          .enabled(cameraZoomGesturesEnabled)
          .runOnJS(true)
          .shouldCancelWhenOutside(false)
          .onBegin(() => {
            beginCameraGestureLock();
            cameraPinchZoomStartRef.current = cameraZoomFactorRef.current;
            cameraPinchScaleStartRef.current = 1;
          })
          .onUpdate((event) => {
            const relativeScale = event.scale / cameraPinchScaleStartRef.current;
            const scaledLogicalZoom =
              cameraPinchZoomStartRef.current *
              Math.pow(Math.max(relativeScale, 0.01), CAMERA_ZOOM_PINCH_EXPONENT);
            const nextLogicalZoom = clamp(
              scaledLogicalZoom,
              minimumLogicalZoomFactor,
              maximumLogicalZoomFactor
            );
            const nextBackCameraLens =
              facing === 'back'
                ? getBackCameraLensForLogicalZoom(
                    nextLogicalZoom,
                    backCameraLens,
                    rearZoomLensOptions
                  )
                : backCameraLens;

            if (facing === 'back') {
              const pendingLensChange = pendingBackCameraLensChangeRef.current;

              if (nextBackCameraLens !== backCameraLens) {
                if (pendingLensChange?.lens !== nextBackCameraLens) {
                  pendingBackCameraLensChangeRef.current = {
                    lens: nextBackCameraLens,
                    mode: 'pinch',
                    zoomFactor: nextLogicalZoom,
                  };
                  onChangeBackCameraLens?.(nextBackCameraLens);
                } else if (pendingLensChange.mode === 'pinch') {
                  pendingLensChange.zoomFactor = nextLogicalZoom;
                }
              } else if (pendingLensChange?.mode === 'pinch') {
                pendingBackCameraLensChangeRef.current = null;
                onChangeBackCameraLens?.(backCameraLens);
              }
            }

            updateCameraZoomFactor(nextLogicalZoom);
          })
          .onEnd(() => {
            scheduleHideCameraZoomBadge();
          })
          .onFinalize(() => {
            endCameraGestureLock();
          }),
        tapGesture
      );
    },
    [
      beginCameraGestureLock,
      cameraFocusGesturesEnabled,
      cameraZoomGesturesEnabled,
      endCameraGestureLock,
      backCameraLens,
      facing,
      handleCameraFocusTap,
      maximumLogicalZoomFactor,
      minimumLogicalZoomFactor,
      onChangeBackCameraLens,
      rearZoomLensOptions,
      scheduleHideCameraZoomBadge,
      updateCameraZoomFactor,
    ]
  );

  const cameraKey = `camera-session-${cameraSessionKey}-${cameraRetryNonce}-${cameraActivationNonce}-${cameraDevice?.id ?? 'none'}`;

  return useMemo(
    () => ({
      cameraFocusPoint,
      cameraFocusRingAnimatedStyle,
      cameraHintAnimatedStyle,
      cameraKey,
      cameraPreviewZoom,
      cameraRadiusAnimatedStyle,
      cameraTransitionMaskAnimatedStyle,
      cameraUnavailableDetail,
      cameraZoomGesture,
      cameraZoomLabel,
      cameraZoomSelectorLabel,
      canShowLiveCameraPreview,
      handleCameraInitialized,
      handleBackCameraLensPress,
      handleCameraPreviewStarted,
      handleCameraStartupFailure,
      handleShutterLongPress,
      handleShutterPress,
      handleShutterRelease,
      handleSwitchCameraPress,
      livePhotoCountdownSeconds,
      livePhotoProgressPath,
      livePhotoRingProgress,
      restartCameraPreview,
      shouldRenderCameraPreview,
      shouldShowCameraCard,
      showCameraInstructionHint,
      showCameraUnavailableState,
      showCameraZoomBadge: showCameraZoomBadge || shouldShowPersistentCameraZoomBadge,
      shutterCaptureHaloAnimatedStyle,
      shutterInnerAnimatedStyle,
      shutterOuterAnimatedStyle,
    }),
    [
      cameraFocusPoint,
      cameraFocusRingAnimatedStyle,
      cameraHintAnimatedStyle,
      cameraKey,
      cameraPreviewZoom,
      cameraRadiusAnimatedStyle,
      cameraTransitionMaskAnimatedStyle,
      cameraUnavailableDetail,
      cameraZoomGesture,
      cameraZoomLabel,
      cameraZoomSelectorLabel,
      canShowLiveCameraPreview,
      handleCameraInitialized,
      handleBackCameraLensPress,
      handleCameraPreviewStarted,
      handleCameraStartupFailure,
      handleShutterLongPress,
      handleShutterPress,
      handleShutterRelease,
      handleSwitchCameraPress,
      livePhotoCountdownSeconds,
      livePhotoProgressPath,
      livePhotoRingProgress,
      restartCameraPreview,
      shouldRenderCameraPreview,
      shouldShowCameraCard,
      showCameraInstructionHint,
      showCameraUnavailableState,
      showCameraZoomBadge,
      shouldShowPersistentCameraZoomBadge,
      shutterCaptureHaloAnimatedStyle,
      shutterInnerAnimatedStyle,
      shutterOuterAnimatedStyle,
    ]
  );
}
