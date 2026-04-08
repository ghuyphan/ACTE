import { AppState, Platform } from 'react-native';
import { Camera, type CameraPermissionStatus, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Easing, runOnJS, useSharedValue, withTiming } from 'react-native-reanimated';
import { DEFAULT_NOTE_RADIUS } from '../constants/noteRadius';
import type { PhotoFilterId } from '../services/photoFilters';
import { LIVE_PHOTO_MAX_DURATION_SECONDS } from '../services/livePhotoProcessing';

export type CaptureMode = 'text' | 'camera';
const LIVE_PHOTO_SETTLE_MS = 450;
const LIVE_PHOTO_SAVE_GUARD_MS = 900;
const LIVE_PHOTO_RELEASE_BUFFER_MS = 180;

type CaptureCameraPermission = {
  granted: boolean;
  canAskAgain: boolean;
  status: CameraPermissionStatus;
};

type CameraCaptureErrorLike = {
  code?: string;
};

function normalizeCapturedFileUri(path: string) {
  return path.startsWith('file://') ? path : `file://${path}`;
}

function getCaptureErrorCode(error: unknown) {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return null;
  }

  return typeof (error as CameraCaptureErrorLike).code === 'string'
    ? (error as CameraCaptureErrorLike).code
    : null;
}

export function useCaptureFlow() {
  const [captureMode, setCaptureMode] = useState<CaptureMode>('text');
  const [isModeSwitchAnimating, setIsModeSwitchAnimating] = useState(false);
  const [cameraSessionKey, setCameraSessionKey] = useState(0);
  const [restaurantName, setRestaurantName] = useState('');
  const [noteText, setNoteText] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [capturedPairedVideo, setCapturedPairedVideo] = useState<string | null>(null);
  const [isLivePhotoCaptureInProgress, setIsLivePhotoCaptureInProgress] = useState(false);
  const [isLivePhotoCaptureSettling, setIsLivePhotoCaptureSettling] = useState(false);
  const [isLivePhotoSaveGuardActive, setIsLivePhotoSaveGuardActive] = useState(false);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [selectedPromptText, setSelectedPromptText] = useState<string | null>(null);
  const [promptAnswer, setPromptAnswer] = useState('');
  const [moodEmoji, setMoodEmoji] = useState<string | null>(null);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [hasShuffledPrompt, setHasShuffledPrompt] = useState(false);
  const [radius, setRadius] = useState(DEFAULT_NOTE_RADIUS);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [selectedPhotoFilterId, setSelectedPhotoFilterId] = useState<PhotoFilterId>('original');
  const { hasPermission, requestPermission: requestCameraPermission } = useCameraPermission();
  const cameraDevice = useCameraDevice(
    facing,
    facing === 'back'
      ? { physicalDevices: ['wide-angle-camera'] }
      : undefined
  );
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState(() => hasPermission);
  const [cameraPermissionStatus, setCameraPermissionStatus] = useState<CameraPermissionStatus>(() =>
    Camera.getCameraPermissionStatus()
  );

  const cameraRef = useRef<Camera>(null);
  const previousCameraPermissionGrantedRef = useRef(cameraPermissionGranted);
  const previousAppStateRef = useRef(AppState.currentState);
  const livePhotoCaptureTokenRef = useRef(0);
  const livePhotoStopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const livePhotoSettleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const livePhotoSaveGuardTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const livePhotoMinimumDurationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const livePhotoRecordingActiveRef = useRef(false);
  const livePhotoRecordingStartedAtRef = useRef<number | null>(null);
  const livePhotoPhotoPromiseRef = useRef<Promise<string | null> | null>(null);
  const livePhotoVideoPromiseRef = useRef<Promise<string | null> | null>(null);
  const livePhotoVideoResolveRef = useRef<((uri: string | null) => void) | null>(null);
  const livePhotoVideoRejectRef = useRef<((error: unknown) => void) | null>(null);
  const suppressNextPhotoTapRef = useRef(false);
  const captureScale = useSharedValue(1);
  const captureTranslateY = useSharedValue(0);
  const flashAnim = useSharedValue(0);
  const shutterScale = useSharedValue(1);

  useEffect(() => {
    setCameraPermissionGranted(hasPermission);
    setCameraPermissionStatus(hasPermission ? 'granted' : Camera.getCameraPermissionStatus());
  }, [hasPermission]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      const previousState = previousAppStateRef.current;
      previousAppStateRef.current = state;

      if (state === 'active') {
        const nextStatus = Camera.getCameraPermissionStatus();
        setCameraPermissionGranted(nextStatus === 'granted');
        setCameraPermissionStatus(nextStatus);

        if (captureMode === 'camera' && nextStatus === 'granted' && previousState !== 'active') {
          setCameraSessionKey((current) => current + 1);
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [captureMode]);

  useEffect(() => {
    setSelectedPhotoFilterId('original');
  }, [capturedPhoto]);

  const clearLivePhotoStopTimeout = useCallback(() => {
    if (livePhotoStopTimeoutRef.current) {
      clearTimeout(livePhotoStopTimeoutRef.current);
      livePhotoStopTimeoutRef.current = null;
    }
  }, []);

  const clearLivePhotoSettleTimeout = useCallback(() => {
    if (livePhotoSettleTimeoutRef.current) {
      clearTimeout(livePhotoSettleTimeoutRef.current);
      livePhotoSettleTimeoutRef.current = null;
    }
  }, []);

  const clearLivePhotoSaveGuardTimeout = useCallback(() => {
    if (livePhotoSaveGuardTimeoutRef.current) {
      clearTimeout(livePhotoSaveGuardTimeoutRef.current);
      livePhotoSaveGuardTimeoutRef.current = null;
    }
  }, []);

  const clearLivePhotoMinimumDurationTimeout = useCallback(() => {
    if (livePhotoMinimumDurationTimeoutRef.current) {
      clearTimeout(livePhotoMinimumDurationTimeoutRef.current);
      livePhotoMinimumDurationTimeoutRef.current = null;
    }
  }, []);

  const clearLivePhotoSaveGuard = useCallback(() => {
    clearLivePhotoSaveGuardTimeout();
    setIsLivePhotoSaveGuardActive(false);
  }, [clearLivePhotoSaveGuardTimeout]);

  const clearLivePhotoTapSuppression = useCallback(() => {
    suppressNextPhotoTapRef.current = false;
  }, []);

  const resetLivePhotoCaptureRefs = useCallback(() => {
    clearLivePhotoStopTimeout();
    clearLivePhotoSettleTimeout();
    clearLivePhotoSaveGuardTimeout();
    clearLivePhotoMinimumDurationTimeout();
    clearLivePhotoTapSuppression();
    livePhotoRecordingStartedAtRef.current = null;
    livePhotoPhotoPromiseRef.current = null;
    livePhotoVideoPromiseRef.current = null;
    livePhotoVideoResolveRef.current = null;
    livePhotoVideoRejectRef.current = null;
  }, [
    clearLivePhotoSaveGuardTimeout,
    clearLivePhotoMinimumDurationTimeout,
    clearLivePhotoSettleTimeout,
    clearLivePhotoStopTimeout,
    clearLivePhotoTapSuppression,
  ]);

  const cancelLivePhotoCapture = useCallback(async () => {
    const camera = cameraRef.current;
    const wasRecording = livePhotoRecordingActiveRef.current;
    livePhotoRecordingActiveRef.current = false;
    livePhotoRecordingStartedAtRef.current = null;

    if (camera && wasRecording) {
      try {
        await camera.cancelRecording();
      } catch (error) {
        const errorCode = getCaptureErrorCode(error);
        if (
          errorCode !== 'capture/no-recording-in-progress' &&
          errorCode !== 'capture/recording-canceled'
        ) {
          console.warn('Failed to cancel live photo capture:', error);
        }
      }
    }

    resetLivePhotoCaptureRefs();
  }, [cameraRef, resetLivePhotoCaptureRefs]);

  useEffect(
    () => () => {
      void cancelLivePhotoCapture();
    },
    [cancelLivePhotoCapture]
  );

  useEffect(() => {
    const previousGranted = previousCameraPermissionGrantedRef.current;
    previousCameraPermissionGrantedRef.current = cameraPermissionGranted;

    if (!previousGranted && cameraPermissionGranted && captureMode === 'camera') {
      setCameraSessionKey((current) => current + 1);
    }
  }, [cameraPermissionGranted, captureMode]);

  const permission = useMemo<CaptureCameraPermission>(() => {
    const canAskAgain =
      Platform.OS === 'android'
        ? cameraPermissionStatus !== 'restricted'
        : cameraPermissionStatus === 'not-determined';

    return {
      granted: cameraPermissionGranted,
      canAskAgain,
      status: cameraPermissionStatus,
    };
  }, [cameraPermissionGranted, cameraPermissionStatus]);

  const animateModeSwitch = useCallback((callback: () => void) => {
    setIsModeSwitchAnimating(true);
    captureScale.value = withTiming(0.97, {
      duration: 110,
      easing: Easing.out(Easing.cubic),
    });
    captureTranslateY.value = withTiming(-10, {
      duration: 110,
      easing: Easing.out(Easing.cubic),
    }, (finished) => {
      if (!finished) {
        return;
      }

      runOnJS(callback)();
      captureScale.value = withTiming(1, {
        duration: 220,
        easing: Easing.out(Easing.cubic),
      });
      captureTranslateY.value = withTiming(0, {
        duration: 220,
        easing: Easing.out(Easing.cubic),
      }, (settled) => {
        if (!settled) {
          return;
        }

        runOnJS(setIsModeSwitchAnimating)(false);
      });
    });
  }, [captureScale, captureTranslateY]);

  const toggleCaptureMode = useCallback(() => {
    if (isModeSwitchAnimating) {
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    animateModeSwitch(() => {
      setCaptureMode((mode) => {
        const nextMode = mode === 'text' ? 'camera' : 'text';
        if (nextMode === 'camera') {
          setCameraSessionKey((current) => current + 1);
        }
        return nextMode;
      });
      void cancelLivePhotoCapture();
      setCapturedPhoto(null);
      setCapturedPairedVideo(null);
      setIsLivePhotoCaptureInProgress(false);
      setIsLivePhotoCaptureSettling(false);
      setIsLivePhotoSaveGuardActive(false);
      setSelectedPromptId(null);
      setSelectedPromptText(null);
      setPromptAnswer('');
      setMoodEmoji(null);
      setPromptExpanded(false);
      setHasShuffledPrompt(false);
    });
  }, [animateModeSwitch, cancelLivePhotoCapture, isModeSwitchAnimating]);

  const refreshCameraSession = useCallback(() => {
    setCameraSessionKey((current) => current + 1);
  }, []);

  const handleShutterPressIn = useCallback(() => {
    shutterScale.value = withTiming(0.85, {
      duration: 120,
      easing: Easing.out(Easing.quad),
    });
  }, [shutterScale]);

  const finishLivePhotoCapture = useCallback(async () => {
    clearLivePhotoStopTimeout();
    if (!cameraRef.current || !livePhotoRecordingActiveRef.current) {
      setIsLivePhotoCaptureInProgress(false);
      return;
    }

    livePhotoRecordingActiveRef.current = false;
    livePhotoRecordingStartedAtRef.current = null;
    setIsLivePhotoCaptureInProgress(false);

    try {
      await cameraRef.current.stopRecording();
    } catch (error) {
      const errorCode = getCaptureErrorCode(error);
      if (errorCode !== 'capture/no-recording-in-progress') {
        console.warn('Failed to stop live photo capture:', error);
      }
    }

    const [photoUri, pairedVideoUri] = await Promise.all([
      (livePhotoPhotoPromiseRef.current ?? Promise.resolve(null)).catch((error) => {
        console.warn('Failed to finalize live photo still image:', error);
        return null;
      }),
      (livePhotoVideoPromiseRef.current ?? Promise.resolve(null)).catch((error) => {
        console.warn('Failed to finalize live photo motion clip:', error);
        return null;
      }),
    ]);

    resetLivePhotoCaptureRefs();
    if (photoUri) {
      clearLivePhotoSettleTimeout();
      clearLivePhotoSaveGuard();
      setCapturedPhoto(photoUri);
      setCapturedPairedVideo(pairedVideoUri);
      setIsLivePhotoCaptureSettling(true);
      setIsLivePhotoSaveGuardActive(true);
      livePhotoSettleTimeoutRef.current = setTimeout(() => {
        setIsLivePhotoCaptureSettling(false);
      }, LIVE_PHOTO_SETTLE_MS);
      livePhotoSaveGuardTimeoutRef.current = setTimeout(() => {
        setIsLivePhotoSaveGuardActive(false);
        livePhotoSaveGuardTimeoutRef.current = null;
      }, LIVE_PHOTO_SAVE_GUARD_MS);
      clearLivePhotoTapSuppression();
      return;
    }

    setIsLivePhotoCaptureSettling(false);
    clearLivePhotoSaveGuard();
    clearLivePhotoTapSuppression();
  }, [cameraRef, clearLivePhotoSaveGuard, clearLivePhotoSettleTimeout, clearLivePhotoStopTimeout, resetLivePhotoCaptureRefs]);

  const handleShutterPressOut = useCallback(() => {
    shutterScale.value = withTiming(1, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
    });
    if (livePhotoRecordingActiveRef.current) {
      const startedAt = livePhotoRecordingStartedAtRef.current;
      const elapsedMs = startedAt ? Date.now() - startedAt : LIVE_PHOTO_RELEASE_BUFFER_MS;
      const remainingMs = LIVE_PHOTO_RELEASE_BUFFER_MS - elapsedMs;

      if (remainingMs > 0) {
        clearLivePhotoMinimumDurationTimeout();
        livePhotoMinimumDurationTimeoutRef.current = setTimeout(() => {
          livePhotoMinimumDurationTimeoutRef.current = null;
          void finishLivePhotoCapture();
        }, remainingMs);
        return;
      }

      void finishLivePhotoCapture();
    }
  }, [clearLivePhotoMinimumDurationTimeout, finishLivePhotoCapture, shutterScale]);

  const takePicture = useCallback(async () => {
    if (suppressNextPhotoTapRef.current) {
      suppressNextPhotoTapRef.current = false;
      return;
    }

    if (!cameraRef.current) {
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const photo = await cameraRef.current.takePhoto({
      enableShutterSound: false,
    });
    shutterScale.value = 1;
    if (photo?.path) {
      clearLivePhotoSaveGuard();
      setIsLivePhotoCaptureInProgress(false);
      setIsLivePhotoCaptureSettling(false);
      setCapturedPairedVideo(null);
      setCapturedPhoto(normalizeCapturedFileUri(photo.path));
    }
  }, [cameraRef, clearLivePhotoSaveGuard, shutterScale]);

  const startLivePhotoCapture = useCallback(async () => {
    if (!cameraRef.current || isLivePhotoCaptureInProgress) {
      return;
    }

    suppressNextPhotoTapRef.current = true;
    clearLivePhotoStopTimeout();
    clearLivePhotoSettleTimeout();
    resetLivePhotoCaptureRefs();
    livePhotoCaptureTokenRef.current += 1;
    const captureToken = livePhotoCaptureTokenRef.current;
    livePhotoRecordingActiveRef.current = true;
    livePhotoRecordingStartedAtRef.current = Date.now();
    setIsLivePhotoCaptureInProgress(true);
    setIsLivePhotoCaptureSettling(false);
    setCapturedPairedVideo(null);
    livePhotoVideoPromiseRef.current = new Promise<string | null>((resolve, reject) => {
      livePhotoVideoResolveRef.current = resolve;
      livePhotoVideoRejectRef.current = reject;
    });

    try {
      cameraRef.current.startRecording({
        fileType: 'mp4',
        videoCodec: Platform.OS === 'ios' ? 'h265' : 'h264',
        onRecordingFinished: (video) => {
          if (livePhotoCaptureTokenRef.current !== captureToken) {
            return;
          }

          livePhotoVideoResolveRef.current?.(
            video.path ? normalizeCapturedFileUri(video.path) : null
          );
        },
        onRecordingError: (error) => {
          if (livePhotoCaptureTokenRef.current !== captureToken) {
            return;
          }

          const errorCode = getCaptureErrorCode(error);
          if (
            errorCode === 'capture/recording-canceled' ||
            errorCode === 'capture/no-recording-in-progress'
          ) {
            livePhotoVideoResolveRef.current?.(null);
            return;
          }

          livePhotoVideoRejectRef.current?.(error);
        },
      });

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      livePhotoPhotoPromiseRef.current = cameraRef.current
        .takePhoto({
          enableShutterSound: false,
        })
        .then((photo) => (photo?.path ? normalizeCapturedFileUri(photo.path) : null))
        .catch(async (error) => {
          console.warn('Live photo capture failed while taking the still image:', error);

          try {
            await cameraRef.current?.cancelRecording();
          } catch (cancelError) {
            const errorCode = getCaptureErrorCode(cancelError);
            if (errorCode !== 'capture/no-recording-in-progress') {
              console.warn('Failed to cancel live photo capture after a still-image error:', cancelError);
            }
          }

          return null;
        });

      livePhotoStopTimeoutRef.current = setTimeout(() => {
        void finishLivePhotoCapture();
      }, LIVE_PHOTO_MAX_DURATION_SECONDS * 1000);
    } catch (error) {
      livePhotoRecordingActiveRef.current = false;
      setIsLivePhotoCaptureInProgress(false);
      try {
        await cameraRef.current.cancelRecording();
      } catch {
        // Ignore cleanup failures after a capture error.
      }
      resetLivePhotoCaptureRefs();
      clearLivePhotoTapSuppression();
      console.warn('Live photo capture failed:', error);
    }
  }, [
    cameraRef,
    clearLivePhotoSettleTimeout,
    clearLivePhotoTapSuppression,
    finishLivePhotoCapture,
    isLivePhotoCaptureInProgress,
    resetLivePhotoCaptureRefs,
  ]);

  const requestPermission = useCallback(async () => {
    const granted = await requestCameraPermission();
    setCameraPermissionGranted(granted);
    setCameraPermissionStatus(granted ? 'granted' : Camera.getCameraPermissionStatus());
    return granted;
  }, [requestCameraPermission]);

  const resetCapture = useCallback(() => {
    setNoteText('');
    setRestaurantName('');
    void cancelLivePhotoCapture();
    setCapturedPhoto(null);
    setCapturedPairedVideo(null);
    setIsLivePhotoCaptureInProgress(false);
    setIsLivePhotoCaptureSettling(false);
    setIsLivePhotoSaveGuardActive(false);
    clearLivePhotoTapSuppression();
    setSelectedPromptId(null);
    setSelectedPromptText(null);
    setPromptAnswer('');
    setMoodEmoji(null);
    setPromptExpanded(false);
    setHasShuffledPrompt(false);
    setRadius(DEFAULT_NOTE_RADIUS);
  }, [cancelLivePhotoCapture]);

  const needsCameraPermission = captureMode === 'camera' && (!permission || !permission.granted);

  return {
    captureMode,
    cameraSessionKey,
    setCaptureMode,
    restaurantName,
    setRestaurantName,
    noteText,
    setNoteText,
    capturedPhoto,
    setCapturedPhoto,
    capturedPairedVideo,
    setCapturedPairedVideo,
    isLivePhotoCaptureInProgress,
    isLivePhotoCaptureSettling,
    isLivePhotoSaveGuardActive,
    selectedPromptId,
    setSelectedPromptId,
    selectedPromptText,
    setSelectedPromptText,
    promptAnswer,
    setPromptAnswer,
    moodEmoji,
    setMoodEmoji,
    promptExpanded,
    setPromptExpanded,
    hasShuffledPrompt,
    setHasShuffledPrompt,
    radius,
    setRadius,
    facing,
    setFacing,
    selectedPhotoFilterId,
    setSelectedPhotoFilterId,
    cameraDevice,
    permission,
    requestPermission,
    cameraRef,
    captureScale,
    captureTranslateY,
    flashAnim,
    shutterScale,
    isModeSwitchAnimating,
    animateModeSwitch,
    toggleCaptureMode,
    refreshCameraSession,
    handleShutterPressIn,
    handleShutterPressOut,
    takePicture,
    startLivePhotoCapture,
    finishLivePhotoCapture,
    needsCameraPermission,
    resetCapture,
  };
}
