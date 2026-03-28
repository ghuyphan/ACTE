import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useCallback, useRef, useState } from 'react';
import { Easing, runOnJS, useSharedValue, withTiming } from 'react-native-reanimated';
import { DEFAULT_NOTE_RADIUS } from '../constants/noteRadius';

export type CaptureMode = 'text' | 'camera';

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
  const [permission, requestPermission] = useCameraPermissions();

  const cameraRef = useRef<CameraView>(null);
  const captureOpacity = useSharedValue(1);
  const captureScale = useSharedValue(1);
  const captureTranslateY = useSharedValue(0);
  const flashAnim = useSharedValue(0);
  const shutterScale = useSharedValue(1);

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
    flashAnim.value = 1;
    flashAnim.value = withTiming(0, {
      duration: 400,
    });

    const photo = await cameraRef.current.takePictureAsync({
      quality: 0.35,
    });
    shutterScale.value = 1;
    if (photo?.uri) {
      setCapturedPhoto(photo.uri);
    }
  }, [cameraRef, flashAnim, shutterScale]);

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
