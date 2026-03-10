import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useCallback, useRef, useState } from 'react';
import { Animated } from 'react-native';

export type CaptureMode = 'text' | 'camera';

export function useCaptureFlow() {
  const [captureMode, setCaptureMode] = useState<CaptureMode>('text');
  const [restaurantName, setRestaurantName] = useState('');
  const [noteText, setNoteText] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
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
      Animated.timing(captureOpacity, { toValue: 0, duration: 110, useNativeDriver: true }),
      Animated.timing(captureScale, { toValue: 0.97, duration: 110, useNativeDriver: true }),
      Animated.timing(captureTranslateY, { toValue: -10, duration: 110, useNativeDriver: true }),
    ]).start(() => {
      callback();
      Animated.parallel([
        Animated.spring(captureOpacity, { toValue: 1, tension: 210, friction: 17, useNativeDriver: true }),
        Animated.spring(captureScale, { toValue: 1, tension: 210, friction: 17, useNativeDriver: true }),
        Animated.spring(captureTranslateY, { toValue: 0, tension: 210, friction: 17, useNativeDriver: true }),
      ]).start();
    });
  }, [captureOpacity, captureScale, captureTranslateY]);

  const toggleCaptureMode = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    animateModeSwitch(() => {
      setCaptureMode((mode) => (mode === 'text' ? 'camera' : 'text'));
      setCapturedPhoto(null);
    });
  }, [animateModeSwitch]);

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

    const photo = await cameraRef.current.takePictureAsync();
    shutterScale.setValue(1);
    if (photo?.uri) {
      setCapturedPhoto(photo.uri);
    }
  }, [cameraRef, flashAnim, shutterScale]);

  const resetCapture = useCallback(() => {
    setNoteText('');
    setRestaurantName('');
    setCapturedPhoto(null);
  }, []);

  const needsCameraPermission = captureMode === 'camera' && (!permission || !permission.granted);

  return {
    captureMode,
    setCaptureMode,
    restaurantName,
    setRestaurantName,
    noteText,
    setNoteText,
    capturedPhoto,
    setCapturedPhoto,
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
    handleShutterPressIn,
    handleShutterPressOut,
    takePicture,
    needsCameraPermission,
    resetCapture,
  };
}
