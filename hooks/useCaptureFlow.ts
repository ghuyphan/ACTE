import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useCallback, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { DEFAULT_NOTE_RADIUS } from '../constants/noteRadius';

export type CaptureMode = 'text' | 'camera';

export function useCaptureFlow() {
  const [captureMode, setCaptureMode] = useState<CaptureMode>('text');
  const [cameraSessionKey, setCameraSessionKey] = useState(0);
  const [restaurantName, setRestaurantName] = useState('');
  const [noteText, setNoteText] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [radius, setRadius] = useState(DEFAULT_NOTE_RADIUS);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [permission, requestPermission] = useCameraPermissions();

  const cameraRef = useRef<CameraView>(null);
  const captureOpacity = useRef(new Animated.Value(1)).current;
  const captureScale = useRef(new Animated.Value(1)).current;
  const captureTranslateY = useRef(new Animated.Value(0)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;
  const shutterScale = useRef(new Animated.Value(1)).current;

  const animateModeSwitch = useCallback((callback: () => void) => {
    Animated.parallel([
      Animated.timing(captureScale, { toValue: 0.97, duration: 110, useNativeDriver: true }),
      Animated.timing(captureTranslateY, { toValue: -10, duration: 110, useNativeDriver: true }),
    ]).start(() => {
      callback();
      Animated.parallel([
        Animated.spring(captureScale, { toValue: 1, tension: 210, friction: 17, useNativeDriver: true }),
        Animated.spring(captureTranslateY, { toValue: 0, tension: 210, friction: 17, useNativeDriver: true }),
      ]).start();
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
    });
  }, [animateModeSwitch]);

  const refreshCameraSession = useCallback(() => {
    setCameraSessionKey((current) => current + 1);
  }, []);

  const handleShutterPressIn = useCallback(() => {
    Animated.spring(shutterScale, {
      toValue: 0.85,
      tension: 300,
      friction: 15,
      useNativeDriver: true,
    }).start();
  }, [shutterScale]);

  const handleShutterPressOut = useCallback(() => {
    Animated.spring(shutterScale, {
      toValue: 1,
      tension: 200,
      friction: 12,
      useNativeDriver: true,
    }).start();
  }, [shutterScale]);

  const takePicture = useCallback(async () => {
    if (!cameraRef.current) {
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    flashAnim.setValue(1);
    Animated.timing(flashAnim, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start();

    const photo = await cameraRef.current.takePictureAsync({
      quality: 0.35,
    });
    shutterScale.setValue(1);
    if (photo?.uri) {
      setCapturedPhoto(photo.uri);
    }
  }, [cameraRef, flashAnim, shutterScale]);

  const resetCapture = useCallback(() => {
    setNoteText('');
    setRestaurantName('');
    setCapturedPhoto(null);
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
