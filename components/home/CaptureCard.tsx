import { Ionicons } from '@expo/vector-icons';
import { CameraView } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView } from '../ui/GlassView';
import { Image } from 'expo-image';
import { TFunction } from 'i18next';
import { forwardRef, ReactNode, RefObject, useCallback, useEffect, useRef, useState, useMemo, useImperativeHandle } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  Pressable,
  type PressableProps,
  type StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import Reanimated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { DOODLE_ARTBOARD_FRAME } from '../../constants/doodleLayout';
import { Layout, Shadows, Typography } from '../../constants/theme';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import type { ThemeColors } from '../../hooks/useTheme';
import { getCaptureNoteGradient } from '../../services/noteAppearance';
import { applyCommittedInlineEmoji } from '../../services/noteDecorations';
import NoteDoodleCanvas, { DoodleStroke } from '../NoteDoodleCanvas';
import PrimaryButton from '../ui/PrimaryButton';
import { isOlderIOS } from '../../utils/platform';

const { width } = Dimensions.get('window');
const HORIZONTAL_PADDING = Layout.screenPadding - 8;
const CARD_SIZE = width - HORIZONTAL_PADDING * 2;
const TOP_CONTROL_INSET = 24;
const TOP_CONTROL_HEIGHT = 38;
const TOP_CONTROL_RADIUS = 19;
const SHUTTER_OUTER_SIZE = 68;
const SIDE_ACTION_SIZE = 46;
const SHUTTER_SIDE_ACTION_GAP = 14;
const SHUTTER_SIDE_ACTION_OFFSET = SHUTTER_OUTER_SIZE / 2 + SHUTTER_SIDE_ACTION_GAP + SIDE_ACTION_SIZE;
const CAPTURE_BUTTON_PRESS_IN = { duration: 120, easing: Easing.out(Easing.quad) };
const CAPTURE_BUTTON_PRESS_OUT = { duration: 160, easing: Easing.out(Easing.cubic) };
const AnimatedIonicons = Reanimated.createAnimatedComponent(Ionicons);
const AnimatedPressable = Reanimated.createAnimatedComponent(Pressable);
const DEFAULT_CAPTURE_TEXT_PLACEHOLDERS = [
  'Note about this place...',
  'Leave a tiny clue for future you...',
  'What should you remember here?',
  'Write one quick thing before it escapes...',
  'Anything here worth saving for later?',
  'Drop a small memory here...',
];

function getCaptureTextPlaceholderVariants(t: TFunction) {
  const translated = t('capture.textPlaceholderVariants', {
    returnObjects: true,
    defaultValue: DEFAULT_CAPTURE_TEXT_PLACEHOLDERS,
  } as any);

  return Array.isArray(translated) && translated.every((item) => typeof item === 'string')
    ? translated
    : DEFAULT_CAPTURE_TEXT_PLACEHOLDERS;
}

export interface CaptureCardHandle {
  getDoodleSnapshot: () => { enabled: boolean; strokes: DoodleStroke[] };
  resetDoodle: () => void;
}

type CaptureAnimatedPressableProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  pressedScale?: number;
};

function CaptureAnimatedPressable({
  children,
  disabled,
  onPressIn,
  onPressOut,
  pressedScale = 0.97,
  style,
  ...props
}: CaptureAnimatedPressableProps) {
  const pressScale = useSharedValue(1);

  useEffect(() => {
    if (disabled) {
      pressScale.value = 1;
    }
  }, [disabled, pressScale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const handlePressIn = useCallback<NonNullable<PressableProps['onPressIn']>>(
    (event) => {
      if (!disabled) {
        pressScale.value = withTiming(pressedScale, CAPTURE_BUTTON_PRESS_IN);
      }
      onPressIn?.(event);
    },
    [disabled, onPressIn, pressScale, pressedScale]
  );

  const handlePressOut = useCallback<NonNullable<PressableProps['onPressOut']>>(
    (event) => {
      pressScale.value = withTiming(1, CAPTURE_BUTTON_PRESS_OUT);
      onPressOut?.(event);
    },
    [onPressOut, pressScale]
  );

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}

interface CaptureCardProps {
  snapHeight: number;
  topInset: number;
  isSearching: boolean;
  captureMode: 'text' | 'camera';
  cameraSessionKey: number;
  captureScale: Animated.Value;
  captureTranslateY: Animated.Value;
  saveTransitionProgress?: Animated.Value;
  colors: Pick<
    ThemeColors,
    | 'primary'
    | 'captureButtonBg'
    | 'card'
    | 'border'
    | 'text'
    | 'secondaryText'
    | 'captureCardText'
    | 'captureCardPlaceholder'
    | 'captureCardBorder'
    | 'captureGlassFill'
    | 'captureGlassBorder'
    | 'captureGlassText'
    | 'captureGlassIcon'
    | 'captureGlassPlaceholder'
    | 'captureGlassColorScheme'
    | 'captureCameraOverlay'
    | 'captureCameraOverlayBorder'
    | 'captureCameraOverlayText'
    | 'captureFlashOverlay'
  >;
  t: TFunction;
  noteText: string;
  onChangeNoteText: (nextText: string) => void;
  restaurantName: string;
  onChangeRestaurantName: (nextName: string) => void;
  capturedPhoto: string | null;
  onRetakePhoto: () => void;
  needsCameraPermission: boolean;
  onRequestCameraPermission: () => void;
  facing: 'back' | 'front';
  onToggleFacing: () => void;
  onOpenPhotoLibrary: () => void;
  cameraRef: RefObject<CameraView | null>;
  shouldRenderCameraPreview: boolean;
  flashAnim: Animated.Value;
  permissionGranted: boolean;
  onShutterPressIn: () => void;
  onShutterPressOut: () => void;
  onTakePicture: () => void;
  onSaveNote: () => void;
  saving: boolean;
  saveState?: 'idle' | 'saving' | 'success';
  shutterScale: Animated.Value;
  leadingAccessory?: ReactNode;
  cameraStatusText?: string | null;
  remainingPhotoSlots?: number | null;
  libraryImportLocked?: boolean;
  importingPhoto?: boolean;
  shareTarget: 'private' | 'shared';
  onChangeShareTarget: (nextTarget: 'private' | 'shared') => void;
  onDoodleModeChange?: (enabled: boolean) => void;
  footerContent?: ReactNode;
}

const CaptureCard = forwardRef<CaptureCardHandle, CaptureCardProps>(function CaptureCard({
  snapHeight,
  topInset,
  isSearching,
  captureMode,
  cameraSessionKey,
  captureScale,
  captureTranslateY,
  saveTransitionProgress,
  colors,
  t,
  noteText,
  onChangeNoteText,
  restaurantName,
  onChangeRestaurantName,
  capturedPhoto,
  onRetakePhoto,
  needsCameraPermission,
  onRequestCameraPermission,
  facing,
  onToggleFacing,
  onOpenPhotoLibrary,
  cameraRef,
  shouldRenderCameraPreview,
  flashAnim,
  permissionGranted,
  onShutterPressIn,
  onShutterPressOut,
  onTakePicture,
  onSaveNote,
  saving,
  saveState = 'idle',
  shutterScale,
  leadingAccessory,
  cameraStatusText,
  remainingPhotoSlots,
  libraryImportLocked = false,
  importingPhoto = false,
  shareTarget,
  onChangeShareTarget,
  onDoodleModeChange,
  footerContent,
}, ref) {
  const reduceMotionEnabled = useReducedMotion();
  const internalSaveTransitionProgress = useRef(new Animated.Value(0)).current;
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraUnavailable, setCameraUnavailable] = useState(false);
  const [cameraIssueDetail, setCameraIssueDetail] = useState<string | null>(null);
  const [cameraRetryNonce, setCameraRetryNonce] = useState(0);
  const [textDoodleModeEnabled, setTextDoodleModeEnabled] = useState(false);
  const [photoDoodleModeEnabled, setPhotoDoodleModeEnabled] = useState(false);
  const [textDoodleStrokes, setTextDoodleStrokes] = useState<DoodleStroke[]>([]);
  const [photoDoodleStrokes, setPhotoDoodleStrokes] = useState<DoodleStroke[]>([]);
  const [textPlaceholderIndex, setTextPlaceholderIndex] = useState(0);
  const isPhotoDoodleSurface = captureMode === 'camera' && Boolean(capturedPhoto);
  const doodleModeEnabled = isPhotoDoodleSurface ? photoDoodleModeEnabled : textDoodleModeEnabled;
  const doodleStrokes = isPhotoDoodleSurface ? photoDoodleStrokes : textDoodleStrokes;
  const isCameraSaveMode = captureMode === 'camera';
  const isSharedTarget = shareTarget === 'shared';
  const isDarkCaptureTheme = colors.captureGlassColorScheme === 'dark';
  const textCardActiveIconColor = isDarkCaptureTheme ? colors.captureCardText : '#FFFFFF';
  const photoPreviewControlFill = capturedPhoto
    ? (isDarkCaptureTheme ? 'rgba(22,22,24,0.74)' : 'rgba(255,250,242,0.78)')
    : colors.captureCameraOverlay;
  const photoPreviewControlBorder = capturedPhoto
    ? (isDarkCaptureTheme ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.42)')
    : colors.captureCameraOverlayBorder;
  const photoPreviewControlText = capturedPhoto ? colors.captureGlassText : colors.captureCameraOverlayText;
  const photoPreviewActiveFill = colors.primary;
  const photoPreviewActiveText = colors.captureCardText;
  const privateAudienceLabel = t('shared.capturePrivate', 'Just me');
  const sharedAudienceLabel = t('shared.manageTitle', 'Friends');
  const audienceLabel = isSharedTarget ? sharedAudienceLabel : privateAudienceLabel;
  const audienceSizerLabel =
    privateAudienceLabel.length >= sharedAudienceLabel.length ? privateAudienceLabel : sharedAudienceLabel;
  const privateAudienceSurfaceBackground =
    captureMode === 'text' ? colors.captureGlassFill : photoPreviewControlFill;
  const sharedAudienceSurfaceBackground = '#FFF4DE';
  const privateAudienceSurfaceBorder =
    captureMode === 'text' ? colors.captureGlassBorder : photoPreviewControlBorder;
  const sharedAudienceSurfaceBorder = 'rgba(255,255,255,0.56)';
  const privateAudienceColor =
    captureMode === 'text' ? colors.captureGlassText : photoPreviewControlText;
  const sharedAudienceColor = colors.primary;
  const audienceIconColor = isSharedTarget ? sharedAudienceColor : privateAudienceColor;
  const audienceProgress = useSharedValue(isSharedTarget ? 1 : 0);
  const audiencePressScale = useSharedValue(1);
  const audienceStateScale = useSharedValue(1);
  const saveStateScale = useSharedValue(1);
  const saveSuccessProgress = useSharedValue(saveState === 'success' ? 1 : 0);
  const previousTextDraftEmptyRef = useRef(noteText.length === 0);
  const previousCaptureModeRef = useRef(captureMode);
  const placeholderVariants = useMemo(() => getCaptureTextPlaceholderVariants(t), [t]);
  const activeTextPlaceholder =
    placeholderVariants[textPlaceholderIndex % placeholderVariants.length] ??
    DEFAULT_CAPTURE_TEXT_PLACEHOLDERS[0];
  const isSaveBusy = saving || saveState === 'saving';
  const isSaveSuccessful = saveState === 'success';
  const saveIdleBackground = isCameraSaveMode ? colors.primary : colors.captureButtonBg;

  useEffect(() => {
    if (captureMode === 'camera' && !capturedPhoto && permissionGranted && shouldRenderCameraPreview) {
      setIsCameraReady(false);
      setCameraUnavailable(false);
      setCameraIssueDetail(null);
      return;
    }

    setIsCameraReady(true);
    setCameraUnavailable(false);
    setCameraIssueDetail(null);
  }, [captureMode, capturedPhoto, permissionGranted, cameraSessionKey, cameraRetryNonce, shouldRenderCameraPreview]);

  useEffect(() => {
    let cancelled = false;

    if (captureMode !== 'camera' || capturedPhoto || !permissionGranted || !shouldRenderCameraPreview) {
      return () => {
        cancelled = true;
      };
    }

    void CameraView.isAvailableAsync()
      .then((available) => {
        if (cancelled || available) {
          return;
        }

        setCameraUnavailable(true);
        setIsCameraReady(false);
      })
      .catch(() => {
        // Ignore availability probe failures and rely on onMountError when available.
      });

    return () => {
      cancelled = true;
    };
  }, [captureMode, capturedPhoto, permissionGranted, cameraSessionKey, cameraRetryNonce, shouldRenderCameraPreview]);

  useEffect(() => {
    audienceProgress.value = withTiming(isSharedTarget ? 1 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
    audienceStateScale.value = withSequence(
      withTiming(0.94, { duration: 110, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 220, easing: Easing.out(Easing.back(1.1)) })
    );
  }, [audienceProgress, audienceStateScale, isSharedTarget]);

  useEffect(() => {
    if (saveState === 'success') {
      saveSuccessProgress.value = withTiming(1, {
        duration: reduceMotionEnabled ? 120 : 220,
        easing: Easing.out(Easing.cubic),
      });
      saveStateScale.value = withSequence(
        withTiming(reduceMotionEnabled ? 1.01 : 1.05, {
          duration: reduceMotionEnabled ? 90 : 150,
          easing: Easing.out(Easing.cubic),
        }),
        withTiming(1, {
          duration: reduceMotionEnabled ? 120 : 220,
          easing: Easing.out(Easing.back(1.1)),
        })
      );
      return;
    }

    saveSuccessProgress.value = withTiming(0, {
      duration: reduceMotionEnabled ? 90 : 170,
      easing: Easing.out(Easing.cubic),
    });
    saveStateScale.value = withTiming(saveState === 'saving' ? 0.98 : 1, {
      duration: reduceMotionEnabled ? 90 : 150,
      easing: Easing.out(Easing.cubic),
    });
  }, [reduceMotionEnabled, saveState, saveStateScale, saveSuccessProgress]);

  useEffect(() => {
    if (captureMode !== 'text') {
      setTextDoodleModeEnabled(false);
    }

    if (!capturedPhoto) {
      setPhotoDoodleModeEnabled(false);
    }
  }, [captureMode, capturedPhoto]);

  useEffect(() => {
    const isTextDraftEmpty = noteText.length === 0;
    const wasTextDraftEmpty = previousTextDraftEmptyRef.current;
    const previousCaptureMode = previousCaptureModeRef.current;
    const enteredFreshEmptyTextDraft =
      captureMode === 'text' &&
      isTextDraftEmpty &&
      (!wasTextDraftEmpty || previousCaptureMode !== 'text');

    if (enteredFreshEmptyTextDraft) {
      setTextPlaceholderIndex((current) => current + 1);
    }

    previousTextDraftEmptyRef.current = isTextDraftEmpty;
    previousCaptureModeRef.current = captureMode;
  }, [captureMode, noteText.length]);

  useEffect(() => {
    onDoodleModeChange?.((captureMode === 'text' || Boolean(capturedPhoto)) && doodleModeEnabled);
  }, [captureMode, capturedPhoto, doodleModeEnabled, onDoodleModeChange]);

  const resetDoodle = useCallback(() => {
    setTextDoodleModeEnabled(false);
    setPhotoDoodleModeEnabled(false);
    setTextDoodleStrokes([]);
    setPhotoDoodleStrokes([]);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      getDoodleSnapshot: () => ({
        enabled: doodleModeEnabled,
        strokes: doodleStrokes.map((stroke) => ({
          color: stroke.color,
          points: [...stroke.points],
        })),
      }),
      resetDoodle,
    }),
    [doodleModeEnabled, doodleStrokes, resetDoodle]
  );

  const animatedAudienceBadgeStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      audienceProgress.value,
      [0, 1],
      [privateAudienceSurfaceBackground, sharedAudienceSurfaceBackground]
    ),
    borderColor: interpolateColor(
      audienceProgress.value,
      [0, 1],
      [privateAudienceSurfaceBorder, sharedAudienceSurfaceBorder]
    ),
    transform: [{ scale: audiencePressScale.value * audienceStateScale.value }],
  }));

  const animatedAudienceIconStyle = useAnimatedStyle(() => ({
    color: interpolateColor(audienceProgress.value, [0, 1], [privateAudienceColor, sharedAudienceColor]),
  }));

  const animatedAudienceTextStyle = useAnimatedStyle(() => ({
    color: interpolateColor(audienceProgress.value, [0, 1], [privateAudienceColor, sharedAudienceColor]),
  }));
  const animatedSaveButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: saveStateScale.value }],
  }));
  const animatedSaveInnerStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      saveSuccessProgress.value,
      [0, 1],
      [saveIdleBackground, colors.primary]
    ),
  }));
  const animatedSaveHaloStyle = useAnimatedStyle(() => ({
    opacity: saveSuccessProgress.value * (reduceMotionEnabled ? 0.16 : 0.28),
    transform: [{ scale: 1 + saveSuccessProgress.value * (reduceMotionEnabled ? 0.03 : 0.08) }],
  }));
  const animatedSaveIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + saveSuccessProgress.value * 0.12 }],
  }));
  const effectiveSaveTransitionProgress = saveTransitionProgress ?? internalSaveTransitionProgress;
  const saveTransitionOpacity = effectiveSaveTransitionProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.1],
  });
  const saveTransitionTranslateY = effectiveSaveTransitionProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -24],
  });
  const saveTransitionScale = effectiveSaveTransitionProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.965],
  });
  const showCameraUnavailableState =
    captureMode === 'camera' && !capturedPhoto && permissionGranted && cameraUnavailable;
  const cameraUnavailableDetail =
    cameraIssueDetail?.trim() || t(
      'capture.cameraUnavailableHint',
      'This can happen on a simulator or when the camera session gets stuck. Try again or use a physical device.'
    );
  const handleToggleDoodleMode = useCallback(() => {
    if (isPhotoDoodleSurface) {
      setPhotoDoodleModeEnabled((current) => !current);
      return;
    }

    setTextDoodleModeEnabled((current) => !current);
  }, [isPhotoDoodleSurface]);
  const handleUndoDoodle = useCallback(() => {
    if (isPhotoDoodleSurface) {
      setPhotoDoodleStrokes((current) => current.slice(0, -1));
      return;
    }

    setTextDoodleStrokes((current) => current.slice(0, -1));
  }, [isPhotoDoodleSurface]);
  const handleClearDoodle = useCallback(() => {
    if (isPhotoDoodleSurface) {
      setPhotoDoodleStrokes([]);
      return;
    }

    setTextDoodleStrokes([]);
  }, [isPhotoDoodleSurface]);
  const handleChangeNoteText = useCallback(
    (nextText: string) => {
      onChangeNoteText(applyCommittedInlineEmoji(noteText, nextText));
    },
    [noteText, onChangeNoteText]
  );
  const captureGradient = getCaptureNoteGradient();

  return (
    <View style={[styles.snapItem, { height: snapHeight, paddingTop: topInset + 60 }]}>
      <Animated.View
        style={[
          styles.captureArea,
          {
            opacity: saveTransitionOpacity,
            transform: [
              { translateY: Animated.add(captureTranslateY, saveTransitionTranslateY) },
              { scale: Animated.multiply(captureScale, saveTransitionScale) },
            ],
          },
        ]}
        pointerEvents={isSearching ? 'none' : 'auto'}
      >
        {captureMode === 'text' ? (
          <LinearGradient
            style={[
              styles.textCard,
              {
                borderColor: colors.captureCardBorder,
              },
            ]}
            colors={captureGradient}
            start={{ x: 0.08, y: 0.06 }}
            end={{ x: 0.94, y: 0.94 }}
          >
            <View pointerEvents="box-none" style={styles.textCardTopRow}>
              <CaptureAnimatedPressable
                testID="capture-doodle-toggle"
                onPress={handleToggleDoodleMode}
                style={[
                  styles.textCardActionButton,
                  {
                    backgroundColor: doodleModeEnabled ? colors.captureButtonBg : colors.captureGlassFill,
                    borderColor: doodleModeEnabled ? 'rgba(255,255,255,0.18)' : colors.captureGlassBorder,
                  },
                ]}
              >
                <Ionicons
                  name={doodleModeEnabled ? 'create' : 'create-outline'}
                  size={16}
                  color={doodleModeEnabled ? textCardActiveIconColor : colors.captureGlassText}
                />
              </CaptureAnimatedPressable>

              {doodleModeEnabled ? (
                <View style={styles.textCardActionCluster}>
                  <CaptureAnimatedPressable
                    testID="capture-doodle-undo"
                    onPress={handleUndoDoodle}
                    disabled={doodleStrokes.length === 0}
                    style={[
                      styles.textCardActionPill,
                      {
                        backgroundColor: colors.captureGlassFill,
                        borderColor: colors.captureGlassBorder,
                        opacity: doodleStrokes.length === 0 ? 0.45 : 1,
                      },
                    ]}
                  >
                    <Ionicons name="arrow-undo-outline" size={14} color={colors.captureGlassText} />
                  </CaptureAnimatedPressable>
                  <CaptureAnimatedPressable
                    testID="capture-doodle-clear"
                    onPress={handleClearDoodle}
                    disabled={doodleStrokes.length === 0}
                    style={[
                      styles.textCardActionPill,
                      {
                        backgroundColor: colors.captureGlassFill,
                        borderColor: colors.captureGlassBorder,
                        opacity: doodleStrokes.length === 0 ? 0.45 : 1,
                      },
                    ]}
                  >
                    <Ionicons name="close-outline" size={14} color={colors.captureGlassText} />
                  </CaptureAnimatedPressable>
                </View>
              ) : null}
            </View>

            <View pointerEvents={doodleModeEnabled ? 'auto' : 'none'} style={styles.doodleCanvasLayer}>
              <NoteDoodleCanvas
                strokes={doodleStrokes}
                editable={doodleModeEnabled}
                activeColor={colors.captureCardText}
                onChangeStrokes={setTextDoodleStrokes}
              />
            </View>

            <View style={styles.cardTextCenter}>
              <TextInput
                testID="capture-note-input"
                key={`note-text-${isSearching}`}
                style={[
                  styles.textInput,
                  { color: colors.captureCardText },
                  noteText.length > 200 ? { fontSize: 16, lineHeight: 22 } :
                  noteText.length > 100 ? { fontSize: 20, lineHeight: 28 } : null,
                ]}
                placeholder={activeTextPlaceholder}
                placeholderTextColor={colors.captureCardPlaceholder}
                multiline
                value={noteText}
                editable={!doodleModeEnabled}
                onChangeText={handleChangeNoteText}
                maxLength={300}
                selectionColor={colors.captureCardText}
              />
            </View>

            <View style={[styles.cardRestaurantPill, { borderColor: colors.captureGlassBorder }]}>
              {isOlderIOS ? (
                <View
                  style={[
                    StyleSheet.absoluteFillObject,
                    {
                      backgroundColor: colors.captureGlassFill,
                      borderRadius: 20,
                    },
                  ]}
                />
              ) : null}
              {/* Keep interactive content outside the native glass host to avoid intermittent child layout misses. */}
              <GlassView
                pointerEvents="none"
                style={StyleSheet.absoluteFillObject}
                glassEffectStyle="regular"
                colorScheme={colors.captureGlassColorScheme}
              />
              <Ionicons
                name="restaurant-outline"
                size={14}
                color={colors.captureGlassIcon}
              />
              <TextInput
                key={`restaurant-${isSearching}`}
                style={[styles.cardRestaurantInput, { color: colors.captureGlassText }]}
                placeholder={t('capture.restaurantPlaceholder', 'Restaurant name (e.g. Phở Hòa)')}
                placeholderTextColor={colors.captureGlassPlaceholder}
                value={restaurantName}
                onChangeText={onChangeRestaurantName}
                maxLength={100}
                selectionColor={colors.captureGlassText}
              />
            </View>
            </LinearGradient>
        ) : capturedPhoto ? (
          <View style={[styles.cameraContainer, { backgroundColor: colors.captureCameraOverlay }]}>
            <Image source={{ uri: capturedPhoto }} style={styles.cameraPreview} contentFit="cover" />
            <View pointerEvents="box-none" style={styles.photoDoodleToolbar}>
              <CaptureAnimatedPressable
                testID="capture-doodle-toggle"
                accessibilityLabel={
                  doodleModeEnabled ? t('capture.doneDrawing', 'Done') : t('capture.draw', 'Draw')
                }
                onPress={handleToggleDoodleMode}
                style={[
                  styles.cameraOverlayButton,
                  styles.photoDoodleIconButton,
                  {
                    backgroundColor: doodleModeEnabled ? photoPreviewActiveFill : photoPreviewControlFill,
                    borderColor: doodleModeEnabled ? photoPreviewActiveFill : photoPreviewControlBorder,
                  },
                ]}
              >
                <Ionicons
                  name={doodleModeEnabled ? 'create' : 'create-outline'}
                  size={16}
                  color={doodleModeEnabled ? photoPreviewActiveText : photoPreviewControlText}
                />
              </CaptureAnimatedPressable>

              {doodleModeEnabled ? (
                <View pointerEvents="box-none" style={styles.photoDoodleActionsCluster}>
                  <CaptureAnimatedPressable
                    testID="capture-doodle-undo"
                    onPress={handleUndoDoodle}
                    disabled={doodleStrokes.length === 0}
                    style={[
                      styles.cameraOverlayButton,
                      styles.textCardActionPill,
                      {
                        backgroundColor: photoPreviewControlFill,
                        borderColor: photoPreviewControlBorder,
                        opacity: doodleStrokes.length === 0 ? 0.45 : 1,
                      },
                    ]}
                  >
                    <Ionicons name="arrow-undo-outline" size={14} color={photoPreviewControlText} />
                  </CaptureAnimatedPressable>
                  <CaptureAnimatedPressable
                    testID="capture-doodle-clear"
                    onPress={handleClearDoodle}
                    disabled={doodleStrokes.length === 0}
                    style={[
                      styles.cameraOverlayButton,
                      styles.textCardActionPill,
                      {
                        backgroundColor: photoPreviewControlFill,
                        borderColor: photoPreviewControlBorder,
                        opacity: doodleStrokes.length === 0 ? 0.45 : 1,
                      },
                    ]}
                  >
                    <Ionicons name="close-outline" size={14} color={photoPreviewControlText} />
                  </CaptureAnimatedPressable>
                </View>
              ) : null}
            </View>
            <View pointerEvents={doodleModeEnabled ? 'auto' : 'none'} style={styles.doodleCanvasLayer}>
              <NoteDoodleCanvas
                strokes={doodleStrokes}
                editable={doodleModeEnabled}
                activeColor="#FFFFFF"
                onChangeStrokes={setPhotoDoodleStrokes}
              />
            </View>
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.captureFlashOverlay, opacity: flashAnim, zIndex: 50 },
              ]}
            />
          </View>
        ) : needsCameraPermission ? (
          <View style={[styles.textCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="camera" size={48} color={colors.secondaryText} />
            <Text style={[styles.permissionText, { color: colors.text }]}>
              {t('capture.cameraPermission', 'Camera access needed')}
            </Text>
            <PrimaryButton
              label={t('capture.grantAccess', 'Grant Access')}
              onPress={onRequestCameraPermission}
              style={styles.permissionButton}
            />
          </View>
        ) : (
          <View
            style={[styles.cameraContainer, { backgroundColor: colors.captureCameraOverlay }]}
            collapsable={false}
          >
            {showCameraUnavailableState ? (
              <View style={styles.cameraUnavailableState}>
                <Ionicons name="camera-outline" size={42} color={colors.captureCameraOverlayText} />
                <Text style={[styles.cameraUnavailableTitle, { color: colors.captureCameraOverlayText }]}>
                  {t('capture.cameraUnavailable', "Camera preview couldn't start")}
                </Text>
                <Text style={[styles.cameraUnavailableHint, { color: colors.captureCameraOverlayText }]}>
                  {cameraUnavailableDetail}
                </Text>
                <PrimaryButton
                  label={t('capture.cameraTryAgain', 'Try Again')}
                  variant="secondary"
                  onPress={() => {
                    setCameraUnavailable(false);
                    setCameraIssueDetail(null);
                    setIsCameraReady(false);
                    setCameraRetryNonce((current) => current + 1);
                  }}
                  style={styles.cameraRetryButton}
                />
              </View>
            ) : (
              <>
                {captureMode === 'camera' && shouldRenderCameraPreview ? (
                  <CameraView
                    key={`camera-session-${cameraSessionKey}-${cameraRetryNonce}-${facing}`}
                    style={styles.cameraPreview}
                    facing={facing}
                    ref={cameraRef}
                    onCameraReady={() => {
                      setCameraUnavailable(false);
                      setCameraIssueDetail(null);
                      setIsCameraReady(true);
                    }}
                    onMountError={(error) => {
                      setCameraUnavailable(true);
                      setCameraIssueDetail(error.message);
                      setIsCameraReady(false);
                    }}
                  />
                ) : null}
                {shouldRenderCameraPreview && !isCameraReady ? (
                  <View pointerEvents="none" style={styles.cameraLoadingOverlay}>
                    <ActivityIndicator size="small" color={colors.captureCameraOverlayText} />
                  </View>
                ) : null}
              </>
            )}
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.captureFlashOverlay, opacity: flashAnim, zIndex: 50 },
              ]}
            />
            <CaptureAnimatedPressable
              style={[
                styles.cameraOverlayButton,
                styles.libraryBtn,
                {
                  backgroundColor: colors.captureCameraOverlay,
                  borderColor: colors.captureCameraOverlayBorder,
                },
              ]}
              onPress={onOpenPhotoLibrary}
            >
              {importingPhoto ? (
                <ActivityIndicator size="small" color={colors.captureCameraOverlayText} />
              ) : (
                <>
                  <Ionicons name={libraryImportLocked ? 'sparkles' : 'images'} size={18} color={colors.captureCameraOverlayText} />
                  <Text style={[styles.libraryBtnText, { color: colors.captureCameraOverlayText }]}>
                    {libraryImportLocked ? t('capture.plusLibraryLocked', 'Plus') : t('capture.importPhoto', 'Photos')}
                  </Text>
                </>
              )}
            </CaptureAnimatedPressable>
            {!showCameraUnavailableState ? (
              <CaptureAnimatedPressable
                style={[
                  styles.cameraOverlayButton,
                  styles.flipBtn,
                  {
                    backgroundColor: colors.captureCameraOverlay,
                    borderColor: colors.captureCameraOverlayBorder,
                  },
                ]}
                onPress={onToggleFacing}
              >
                <Ionicons name="camera-reverse" size={20} color={colors.captureCameraOverlayText} />
              </CaptureAnimatedPressable>
            ) : null}
          </View>
        )}
        <View
          pointerEvents="box-none"
          style={styles.cardAudienceBadgeHost}
        >
          <Pressable
            testID="capture-share-target-toggle"
            accessibilityRole="button"
            accessibilityState={{ selected: isSharedTarget }}
            onPress={() => onChangeShareTarget(shareTarget === 'private' ? 'shared' : 'private')}
            onPressIn={() => {
              audiencePressScale.value = withTiming(0.97, CAPTURE_BUTTON_PRESS_IN);
            }}
            onPressOut={() => {
              audiencePressScale.value = withTiming(1, CAPTURE_BUTTON_PRESS_OUT);
            }}
          >
            <Reanimated.View
              style={[
                styles.cardAudienceBadge,
                isSharedTarget ? styles.cardAudienceBadgeSelected : null,
                animatedAudienceBadgeStyle,
              ]}
            >
              <View pointerEvents="none" style={styles.cardAudienceBadgeSizer}>
                <Ionicons name="lock-closed-outline" size={16} color="transparent" />
                <Text style={[styles.cardAudienceBadgeText, styles.cardAudienceBadgeSizerText]}>
                  {audienceSizerLabel}
                </Text>
              </View>
              <Reanimated.View style={styles.cardAudienceBadgeVisibleContent}>
                <AnimatedIonicons
                  name={shareTarget === 'shared' ? 'people-outline' : 'lock-closed-outline'}
                  size={16}
                  color={audienceIconColor}
                  style={animatedAudienceIconStyle}
                />
                <Reanimated.Text
                  style={[
                    styles.cardAudienceBadgeText,
                    animatedAudienceTextStyle,
                  ]}
                >
                  {audienceLabel}
                </Reanimated.Text>
              </Reanimated.View>
            </Reanimated.View>
          </Pressable>
        </View>
      </Animated.View>

      <Animated.View
        style={[
          styles.belowCardSection,
          {
            opacity: saveTransitionOpacity,
            transform: [
              { translateY: Animated.add(captureTranslateY, saveTransitionTranslateY) },
              { scale: Animated.multiply(captureScale, saveTransitionScale) },
            ],
          },
        ]}
      >
        {cameraStatusText ? (
          <Text style={[styles.cameraStatusText, { color: colors.secondaryText }]}>{cameraStatusText}</Text>
        ) : null}
        {captureMode === 'camera' && !capturedPhoto ? (
          <View style={styles.belowCardShutterRow}>
            {leadingAccessory ? <View style={styles.shutterLeadingAccessory}>{leadingAccessory}</View> : null}
            {permissionGranted ? (
              <CaptureAnimatedPressable
                onPressIn={onShutterPressIn}
                onPressOut={onShutterPressOut}
                onPress={onTakePicture}
                pressedScale={0.985}
                style={[styles.shutterOuter, { borderColor: colors.border }]}
              >
                <Animated.View
                  style={[
                    styles.shutterInner,
                    {
                      backgroundColor: colors.primary,
                      transform: [{ scale: shutterScale }],
                    },
                  ]}
                >
                  {typeof remainingPhotoSlots === 'number' && remainingPhotoSlots > 0 ? (
                    <Text style={styles.shutterInnerCountText}>{remainingPhotoSlots}</Text>
                  ) : null}
                </Animated.View>
              </CaptureAnimatedPressable>
            ) : null}
          </View>
        ) : capturedPhoto ? (
          <View style={[styles.belowCardShutterRow, styles.belowCardCapturedPhotoActions]}>
            {leadingAccessory ? <View style={styles.shutterLeadingAccessory}>{leadingAccessory}</View> : null}

            <CaptureAnimatedPressable
              testID="capture-save-button"
              onPress={onSaveNote}
              disabled={isSaveBusy || isSaveSuccessful}
              pressedScale={0.985}
              style={[
                styles.shutterOuter,
                {
                  borderColor: colors.border,
                  opacity: isSaveBusy ? 0.72 : 1,
                },
                animatedSaveButtonStyle,
              ]}
            >
              <Reanimated.View
                style={[
                  styles.shutterInner,
                  styles.saveInner,
                  animatedSaveInnerStyle,
                ]}
              >
                <Reanimated.View
                  pointerEvents="none"
                  style={[
                    styles.saveHalo,
                    {
                      backgroundColor: colors.primary,
                    },
                    animatedSaveHaloStyle,
                  ]}
                />
                {isSaveBusy ? (
                  <ActivityIndicator size="small" color={isCameraSaveMode ? colors.captureCardText : '#FFFFFF'} />
                ) : (
                  <Reanimated.View style={animatedSaveIconStyle}>
                    <Ionicons
                      name={isSaveSuccessful ? 'checkmark-done' : 'checkmark'}
                      size={24}
                      color={isCameraSaveMode ? colors.captureCardText : '#FFFFFF'}
                    />
                  </Reanimated.View>
                )}
              </Reanimated.View>
            </CaptureAnimatedPressable>

            <CaptureAnimatedPressable
              testID="capture-retake-button"
              accessibilityLabel={t('capture.retake', 'Retake')}
              onPress={onRetakePhoto}
              disabled={isSaveBusy || isSaveSuccessful}
              style={[
                styles.secondaryActionButton,
                styles.shutterTrailingAccessory,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  opacity: isSaveBusy || isSaveSuccessful ? 0.55 : 1,
                },
              ]}
            >
              <Ionicons name="refresh" size={18} color={colors.text} />
            </CaptureAnimatedPressable>
          </View>
        ) : (
          <View style={styles.belowCardShutterRow}>
            {leadingAccessory ? <View style={styles.shutterLeadingAccessory}>{leadingAccessory}</View> : null}
            <CaptureAnimatedPressable
              testID="capture-save-button"
              onPress={onSaveNote}
              disabled={isSaveBusy || isSaveSuccessful}
              pressedScale={0.985}
              style={[
                styles.shutterOuter,
                {
                  borderColor: colors.border,
                  opacity: isSaveBusy ? 0.72 : 1,
                },
                animatedSaveButtonStyle,
              ]}
            >
              <Reanimated.View
                style={[
                  styles.shutterInner,
                  styles.saveInner,
                  animatedSaveInnerStyle,
                ]}
              >
                <Reanimated.View
                  pointerEvents="none"
                  style={[
                    styles.saveHalo,
                    {
                      backgroundColor: colors.primary,
                    },
                    animatedSaveHaloStyle,
                  ]}
                />
                {isSaveBusy ? (
                  <ActivityIndicator size="small" color={isCameraSaveMode ? colors.captureCardText : '#FFFFFF'} />
                ) : (
                  <Reanimated.View style={animatedSaveIconStyle}>
                    <Ionicons
                      name={isSaveSuccessful ? 'checkmark-done' : 'checkmark'}
                      size={24}
                      color={isCameraSaveMode ? colors.captureCardText : '#FFFFFF'}
                    />
                  </Reanimated.View>
                )}
              </Reanimated.View>
            </CaptureAnimatedPressable>
          </View>
        )}
        {footerContent ? <View style={styles.footerSlot}>{footerContent}</View> : null}
      </Animated.View>
    </View>
  );
});

export default CaptureCard;

const styles = StyleSheet.create({
  snapItem: {
    width,
    justifyContent: 'center',
  },
  captureArea: {
    height: CARD_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  textCard: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: Layout.cardRadius,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    padding: 32,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    ...Shadows.card,
  },
  textInput: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 34,
    paddingTop: 0,
    paddingBottom: 0,
    width: '100%',
    textShadowRadius: 6,
    fontFamily: 'System',
    maxHeight: 260,
  },
  cardTextCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  textCardTopRow: {
    position: 'absolute',
    top: TOP_CONTROL_INSET,
    left: 18,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 3,
  },
  photoDoodleToolbar: {
    position: 'absolute',
    top: TOP_CONTROL_INSET,
    left: 18,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 11,
  },
  photoDoodleActionsCluster: {
    flexDirection: 'row',
    gap: 8,
  },
  photoDoodleIconButton: {
    width: TOP_CONTROL_HEIGHT,
    height: TOP_CONTROL_HEIGHT,
    borderRadius: TOP_CONTROL_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCardActionCluster: {
    flexDirection: 'row',
    gap: 8,
  },
  textCardActionButton: {
    width: TOP_CONTROL_HEIGHT,
    height: TOP_CONTROL_HEIGHT,
    borderRadius: TOP_CONTROL_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCardActionPill: {
    width: TOP_CONTROL_HEIGHT,
    height: TOP_CONTROL_HEIGHT,
    borderRadius: TOP_CONTROL_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doodleCanvasLayer: {
    ...StyleSheet.absoluteFillObject,
    ...DOODLE_ARTBOARD_FRAME,
    zIndex: 2,
  },
  cardRestaurantPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    width: '100%',
    marginTop: 8,
    overflow: 'hidden',
    position: 'relative',
    zIndex: 3,
  },
  cardRestaurantInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
    paddingTop: 0,
    paddingBottom: 0,
    paddingRight: 48,
  },
  cameraContainer: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: Layout.cardRadius,
    borderCurve: 'continuous',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'android' ? {} : Shadows.card),
    backgroundColor: '#000',
  },
  cameraOverlayButton: {
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    zIndex: 10,
  },
  cameraPreview: {
    ...StyleSheet.absoluteFillObject,
  },
  cameraLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  cameraUnavailableState: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  cameraUnavailableTitle: {
    ...Typography.body,
    textAlign: 'center',
    fontWeight: '700',
  },
  cameraUnavailableHint: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'System',
    lineHeight: 18,
  },
  cameraRetryButton: {
    minWidth: 150,
    marginTop: 4,
  },
  flipBtn: {
    position: 'absolute',
    top: TOP_CONTROL_INSET,
    right: 16,
    width: TOP_CONTROL_HEIGHT,
    height: TOP_CONTROL_HEIGHT,
    borderRadius: TOP_CONTROL_RADIUS,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  libraryBtn: {
    position: 'absolute',
    top: TOP_CONTROL_INSET,
    left: 16,
    minHeight: TOP_CONTROL_HEIGHT,
    borderRadius: TOP_CONTROL_RADIUS,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    zIndex: 10,
  },
  libraryBtnText: {
    fontWeight: '600',
    fontSize: 13,
  },
  retakeBtn: {
    position: 'absolute',
    top: TOP_CONTROL_INSET,
    right: 16,
    width: TOP_CONTROL_HEIGHT,
    height: TOP_CONTROL_HEIGHT,
    borderRadius: TOP_CONTROL_RADIUS,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  permissionText: {
    ...Typography.body,
    textAlign: 'center',
  },
  permissionButton: {
    marginTop: 16,
    width: '100%',
  },
  belowCardSection: {
    paddingHorizontal: HORIZONTAL_PADDING + 4,
    paddingTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 90,
    gap: 12,
  },
  cameraStatusText: {
    ...Typography.pill,
    textAlign: 'center',
  },
  cardAudienceBadgeHost: {
    position: 'absolute',
    top: TOP_CONTROL_INSET,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  cardAudienceBadge: {
    minHeight: TOP_CONTROL_HEIGHT,
    borderRadius: TOP_CONTROL_RADIUS,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardAudienceBadgeSizer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cardAudienceBadgeVisibleContent: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cardAudienceBadgeText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
  },
  cardAudienceBadgeSizerText: {
    color: 'transparent',
  },
  cardAudienceBadgeSelected: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  belowCardShutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    width: '100%',
    position: 'relative',
  },
  belowCardCapturedPhotoActions: {
    minHeight: 68,
  },
  shutterLeadingAccessory: {
    position: 'absolute',
    left: '50%',
    marginLeft: -SHUTTER_SIDE_ACTION_OFFSET,
    width: SIDE_ACTION_SIZE,
    height: SIDE_ACTION_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryActionButton: {
    width: SIDE_ACTION_SIZE,
    height: SIDE_ACTION_SIZE,
    borderRadius: SIDE_ACTION_SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterTrailingAccessory: {
    position: 'absolute',
    left: '50%',
    marginLeft: SHUTTER_OUTER_SIZE / 2 + SHUTTER_SIDE_ACTION_GAP,
  },
  shutterOuter: {
    width: SHUTTER_OUTER_SIZE,
    height: SHUTTER_OUTER_SIZE,
    borderRadius: SHUTTER_OUTER_SIZE / 2,
    borderWidth: 4,
    borderColor: 'rgba(150,150,150,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveInner: {
    transform: [{ scale: 1 }],
    overflow: 'hidden',
  },
  saveHalo: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 27,
  },
  shutterInnerCountText: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 18,
    fontWeight: '800',
  },
  footerSlot: {
    width: '100%',
    paddingTop: 2,
  },
});
