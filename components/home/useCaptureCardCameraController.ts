import { Skia } from '@shopify/react-native-skia';
import type { TFunction } from 'i18next';
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  Easing,
  interpolateColor,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { Camera, CameraDevice } from 'react-native-vision-camera';
import { Layout } from '../../constants/theme';
import type { ThemeColors } from '../../hooks/useTheme';
import { LIVE_PHOTO_MAX_DURATION_SECONDS } from '../../services/livePhotoProcessing';

const CAMERA_AUTO_RECOVERY_ATTEMPTS = 1;
const CAMERA_START_TIMEOUT_MS = 2400;
const CAMERA_ZOOM_PAN_RANGE = 0.9;
const CAMERA_ZOOM_PINCH_RANGE = 0.45;
const CAMERA_ZOOM_LABEL_VISIBLE_MS = 1100;
const CAMERA_TRANSITION_FADE_IN_MS = 110;
const CAMERA_TRANSITION_READY_SOFTEN_MS = 120;
const CAMERA_TRANSITION_READY_SOFTEN_OPACITY = 0.32;
const CAMERA_TRANSITION_FADE_OUT_MS = 140;
const CAMERA_SWITCH_MASK_OPACITY = 0.78;
const CAMERA_SWITCH_FADE_IN_MS = 80;
const CAMERA_SWITCH_READY_SOFTEN_MS = 90;
const CAMERA_SWITCH_READY_SOFTEN_OPACITY = 0.18;
const CAMERA_SWITCH_FADE_OUT_MS = 100;
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
  facing: 'back' | 'front';
  cameraInstructionText?: string | null;
  isLivePhotoCaptureInProgress: boolean;
  interactionsDisabled: boolean;
  reduceMotionEnabled: boolean;
  shutterScale: SharedValue<number>;
  colors: Pick<ThemeColors, 'primary' | 'border'>;
  t: TFunction;
  cardSize: number;
  livePhotoRingStrokeWidth: number;
  onCameraGestureActiveChange?: (active: boolean) => void;
  onToggleFacing: () => void;
  onTakePicture: () => void;
  onShutterPressOut: () => void;
  onStartLivePhotoCapture: () => void;
}

export function useCaptureCardCameraController({
  captureMode,
  capturedPhoto,
  cameraRef,
  cameraDevice,
  cameraSessionKey,
  permissionGranted,
  isCameraPreviewActive,
  facing,
  cameraInstructionText = null,
  isLivePhotoCaptureInProgress,
  interactionsDisabled,
  reduceMotionEnabled,
  shutterScale,
  colors,
  t,
  cardSize,
  livePhotoRingStrokeWidth,
  onCameraGestureActiveChange,
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
  const [cameraZoom, setCameraZoom] = useState(0);
  const [showCameraZoomBadge, setShowCameraZoomBadge] = useState(false);
  const [cameraFocusPoint, setCameraFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const shutterLongPressTriggeredRef = useRef(false);
  const cameraAutoRecoveryCountRef = useRef(0);
  const cameraZoomRef = useRef(0);
  const cameraPanZoomStartRef = useRef(0);
  const cameraPinchZoomStartRef = useRef(0);
  const cameraGestureLockCountRef = useRef(0);
  const cameraSwitchInFlightRef = useRef(false);
  const cameraZoomBadgeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cameraFocusRingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const clearCameraFocusRingTimeout = useCallback(() => {
    if (cameraFocusRingTimeoutRef.current) {
      clearTimeout(cameraFocusRingTimeoutRef.current);
      cameraFocusRingTimeoutRef.current = null;
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

  const updateCameraZoom = useCallback(
    (nextZoom: number) => {
      const clampedZoom = clamp(nextZoom, 0, 1);
      cameraZoomRef.current = clampedZoom;
      setCameraZoom((current) => (Math.abs(current - clampedZoom) < 0.001 ? current : clampedZoom));
      setShowCameraZoomBadge(true);
      scheduleHideCameraZoomBadge();
    },
    [scheduleHideCameraZoomBadge]
  );

  const resetCameraZoom = useCallback(() => {
    clearCameraZoomBadgeTimeout();
    cameraZoomRef.current = 0;
    setCameraZoom(0);
    setShowCameraZoomBadge(false);
  }, [clearCameraZoomBadgeTimeout]);

  const showCameraFocusRing = useCallback(
    (x: number, y: number) => {
      clearCameraFocusRingTimeout();
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
        })
      );
      cameraFocusRingOpacity.value = withTiming(1, {
        duration: reduceMotionEnabled ? 0 : CAMERA_FOCUS_RING_FADE_IN_MS,
        easing: Easing.out(Easing.cubic),
      });
      cameraFocusRingTimeoutRef.current = setTimeout(() => {
        cameraFocusRingScale.value = withTiming(1.06, {
          duration: reduceMotionEnabled ? 0 : CAMERA_FOCUS_RING_FADE_OUT_MS,
          easing: Easing.out(Easing.cubic),
        });
        cameraFocusRingOpacity.value = withTiming(0, {
          duration: reduceMotionEnabled ? 0 : CAMERA_FOCUS_RING_FADE_OUT_MS,
          easing: Easing.out(Easing.cubic),
        });
        cameraFocusRingTimeoutRef.current = null;
      }, CAMERA_FOCUS_RING_VISIBLE_MS);
    },
    [
      cameraFocusRingOpacity,
      cameraFocusRingScale,
      clearCameraFocusRingTimeout,
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
  }, [cameraTransitionMaskOpacity, reduceMotionEnabled]);

  const handleCameraStartupFailure = useCallback(
    (detail?: string | null) => {
      if (cameraAutoRecoveryCountRef.current < CAMERA_AUTO_RECOVERY_ATTEMPTS) {
        cameraAutoRecoveryCountRef.current += 1;
        restartCameraPreview();
        return;
      }

      setCameraUnavailable(true);
      setCameraIssueDetail(
        detail?.trim() ||
        t(
          'capture.cameraUnavailableTimeoutHint',
          'The camera preview took too long to start. Try again to restart the camera session.'
        )
      );
      setIsCameraReady(false);
      cameraSwitchInFlightRef.current = false;
      cameraTransitionMaskOpacity.value = withTiming(0, { duration: 0 });
    },
    [cameraTransitionMaskOpacity, restartCameraPreview, t]
  );

  const handleCameraInitialized = useCallback(() => {
    cameraAutoRecoveryCountRef.current = 0;
    setCameraUnavailable(false);
    setCameraIssueDetail(null);
    if (!canShowLiveCameraPreview) {
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
    reduceMotionEnabled,
  ]);

  const handleCameraPreviewStarted = useCallback(() => {
    const isSwitchingCamera = cameraSwitchInFlightRef.current;
    cameraSwitchInFlightRef.current = false;
    cameraAutoRecoveryCountRef.current = 0;
    setCameraUnavailable(false);
    setCameraIssueDetail(null);
    setIsCameraReady(true);
    cameraTransitionMaskOpacity.value = withTiming(0, {
      duration: reduceMotionEnabled ? 0 : isSwitchingCamera ? CAMERA_SWITCH_FADE_OUT_MS : CAMERA_TRANSITION_FADE_OUT_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [
    cameraTransitionMaskOpacity,
    reduceMotionEnabled,
  ]);

  useEffect(() => {
    const previousCanShowLiveCameraPreview = previousCanShowLiveCameraPreviewRef.current;
    previousCanShowLiveCameraPreviewRef.current = canShowLiveCameraPreview;

    if (canShowLiveCameraPreview && !previousCanShowLiveCameraPreview) {
      setCameraActivationNonce((current) => current + 1);
    }
  }, [canShowLiveCameraPreview]);

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
    cameraAutoRecoveryCountRef.current = 0;
  }, [cameraSessionKey, captureMode, facing, permissionGranted, isCameraPreviewActive, capturedPhoto]);

  useEffect(() => {
    if (captureMode !== 'camera') {
      resetCameraZoom();
    }
  }, [captureMode, resetCameraZoom]);

  useEffect(
    () => () => {
      cameraGestureLockCountRef.current = 0;
      onCameraGestureActiveChange?.(false);
      clearCameraZoomBadgeTimeout();
      clearCameraFocusRingTimeout();
    },
    [clearCameraFocusRingTimeout, clearCameraZoomBadgeTimeout, onCameraGestureActiveChange]
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

    return () => clearTimeout(timer);
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
  }, [cameraTransitionMaskOpacity, onToggleFacing, reduceMotionEnabled]);

  const handleShutterLongPress = useCallback(() => {
    shutterLongPressTriggeredRef.current = true;
    onStartLivePhotoCapture();
  }, [onStartLivePhotoCapture]);

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

  const maxPreviewZoomFactor = useMemo(() => {
    if (!cameraDevice) {
      return 1;
    }

    return Math.max(cameraDevice.neutralZoom, Math.min(cameraDevice.maxZoom, 8));
  }, [cameraDevice]);

  const cameraPreviewZoom = useMemo(() => {
    if (!cameraDevice) {
      return 1;
    }

    const zoomRange = maxPreviewZoomFactor - cameraDevice.neutralZoom;
    return cameraDevice.neutralZoom + zoomRange * cameraZoom;
  }, [cameraDevice, cameraZoom, maxPreviewZoomFactor]);

  const cameraZoomLabel = `${cameraPreviewZoom.toFixed(1)}x`;
  const cameraZoomGesture = useMemo(
    () => {
      const tapGesture = Gesture.Tap()
        .enabled(cameraFocusGesturesEnabled)
        .runOnJS(true)
        .maxDuration(250)
        .onBegin(() => {
          beginCameraGestureLock();
        })
        .onEnd((event, success) => {
          if (success === false) {
            return;
          }

          void handleCameraFocusTap(event.x, event.y);
        })
        .onFinalize(() => {
          endCameraGestureLock();
        });

      return Gesture.Simultaneous(
        tapGesture,
        Gesture.Pan()
          .enabled(cameraZoomGesturesEnabled)
          .runOnJS(true)
          .maxPointers(1)
          .activeOffsetY([-10, 10])
          .failOffsetX([-48, 48])
          .shouldCancelWhenOutside(false)
          .onBegin(() => {
            beginCameraGestureLock();
            cameraPanZoomStartRef.current = cameraZoomRef.current;
          })
          .onUpdate((event) => {
            const nextZoom =
              cameraPanZoomStartRef.current -
              (event.translationY / Math.max(cardSize, 1)) * CAMERA_ZOOM_PAN_RANGE;
            updateCameraZoom(nextZoom);
          })
          .onEnd(() => {
            scheduleHideCameraZoomBadge();
          })
          .onFinalize(() => {
            endCameraGestureLock();
          }),
        Gesture.Pinch()
          .enabled(cameraZoomGesturesEnabled)
          .runOnJS(true)
          .shouldCancelWhenOutside(false)
          .onBegin(() => {
            beginCameraGestureLock();
            cameraPinchZoomStartRef.current = cameraZoomRef.current;
          })
          .onUpdate((event) => {
            const nextZoom =
              cameraPinchZoomStartRef.current + (event.scale - 1) * CAMERA_ZOOM_PINCH_RANGE;
            updateCameraZoom(nextZoom);
          })
          .onEnd(() => {
            scheduleHideCameraZoomBadge();
          })
          .onFinalize(() => {
            endCameraGestureLock();
          })
      );
    },
    [
      beginCameraGestureLock,
      cameraFocusGesturesEnabled,
      cameraZoomGesturesEnabled,
      cardSize,
      endCameraGestureLock,
      handleCameraFocusTap,
      scheduleHideCameraZoomBadge,
      updateCameraZoom,
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
      canShowLiveCameraPreview,
      handleCameraInitialized,
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
      canShowLiveCameraPreview,
      handleCameraInitialized,
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
      shutterCaptureHaloAnimatedStyle,
      shutterInnerAnimatedStyle,
      shutterOuterAnimatedStyle,
    ]
  );
}
