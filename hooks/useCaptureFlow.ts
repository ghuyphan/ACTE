import { AppState, Platform } from 'react-native';
import { Camera, type CameraPermissionStatus, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Easing, runOnJS, useSharedValue, withTiming } from 'react-native-reanimated';
import { DEFAULT_NOTE_RADIUS } from '../constants/noteRadius';
import type { PhotoFilterId } from '../services/photoFilters';

export type CaptureMode = 'text' | 'camera';

type CaptureCameraPermission = {
  granted: boolean;
  canAskAgain: boolean;
  status: CameraPermissionStatus;
};

export function useCaptureFlow() {
  const [captureMode, setCaptureMode] = useState<CaptureMode>('text');
  const [isModeSwitchAnimating, setIsModeSwitchAnimating] = useState(false);
  const [cameraSessionKey, setCameraSessionKey] = useState(0);
  const [restaurantName, setRestaurantName] = useState('');
  const [noteText, setNoteText] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
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
  const cameraDevice = useCameraDevice(facing);
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState(() => hasPermission);
  const [cameraPermissionStatus, setCameraPermissionStatus] = useState<CameraPermissionStatus>(() =>
    Camera.getCameraPermissionStatus()
  );

  const cameraRef = useRef<Camera>(null);
  const previousCameraPermissionGrantedRef = useRef(cameraPermissionGranted);
  const previousAppStateRef = useRef(AppState.currentState);
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
      setCapturedPhoto(null);
      setSelectedPromptId(null);
      setSelectedPromptText(null);
      setPromptAnswer('');
      setMoodEmoji(null);
      setPromptExpanded(false);
      setHasShuffledPrompt(false);
    });
  }, [animateModeSwitch, isModeSwitchAnimating]);

  const refreshCameraSession = useCallback(() => {
    setCameraSessionKey((current) => current + 1);
  }, []);

  const handleShutterPressIn = useCallback(() => {
    shutterScale.value = withTiming(0.85, {
      duration: 120,
      easing: Easing.out(Easing.quad),
    });
  }, [shutterScale]);

  const handleShutterPressOut = useCallback(() => {
    shutterScale.value = withTiming(1, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [shutterScale]);

  const takePicture = useCallback(async () => {
    if (!cameraRef.current) {
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const photo = await cameraRef.current.takePhoto({
      enableShutterSound: false,
    });
    shutterScale.value = 1;
    if (photo?.path) {
      setCapturedPhoto(photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`);
    }
  }, [cameraRef, shutterScale]);

  const requestPermission = useCallback(async () => {
    const granted = await requestCameraPermission();
    setCameraPermissionGranted(granted);
    setCameraPermissionStatus(granted ? 'granted' : Camera.getCameraPermissionStatus());
    return granted;
  }, [requestCameraPermission]);

  const resetCapture = useCallback(() => {
    setNoteText('');
    setRestaurantName('');
    setCapturedPhoto(null);
    setSelectedPromptId(null);
    setSelectedPromptText(null);
    setPromptAnswer('');
    setMoodEmoji(null);
    setPromptExpanded(false);
    setHasShuffledPrompt(false);
    setRadius(DEFAULT_NOTE_RADIUS);
  }, []);

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
    needsCameraPermission,
    resetCapture,
  };
}
