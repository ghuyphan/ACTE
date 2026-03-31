import { AppState } from 'react-native';
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
  const [cameraPermissionStatus, setCameraPermissionStatus] = useState<CameraPermissionStatus>(() =>
    Camera.getCameraPermissionStatus()
  );

  const cameraRef = useRef<Camera>(null);
  const captureOpacity = useSharedValue(1);
  const captureScale = useSharedValue(1);
  const captureTranslateY = useSharedValue(0);
  const flashAnim = useSharedValue(0);
  const shutterScale = useSharedValue(1);

  useEffect(() => {
    setCameraPermissionStatus(hasPermission ? 'granted' : Camera.getCameraPermissionStatus());
  }, [hasPermission]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setCameraPermissionStatus(Camera.getCameraPermissionStatus());
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    setSelectedPhotoFilterId('original');
  }, [capturedPhoto]);

  const permission = useMemo<CaptureCameraPermission>(() => ({
    granted: hasPermission,
    canAskAgain: cameraPermissionStatus === 'not-determined',
    status: cameraPermissionStatus,
  }), [cameraPermissionStatus, hasPermission]);

  const animateModeSwitch = useCallback((callback: () => void) => {
    captureScale.value = withTiming(0.97, { duration: 110 });
    captureTranslateY.value = withTiming(-10, { duration: 110 }, (finished) => {
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
      });
    });
  }, [captureScale, captureTranslateY]);

  const toggleCaptureMode = useCallback(() => {
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
  }, [animateModeSwitch]);

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
    captureOpacity,
    captureScale,
    captureTranslateY,
    flashAnim,
    shutterScale,
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
