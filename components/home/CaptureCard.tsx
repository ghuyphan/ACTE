import { Ionicons } from '@expo/vector-icons';
import { CameraView } from 'expo-camera';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView } from '../ui/GlassView';
import { Image } from 'expo-image';
import { TFunction } from 'i18next';
import { forwardRef, ReactNode, RefObject, useCallback, useEffect, useRef, useState, useMemo, useImperativeHandle, type ComponentProps } from 'react';
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
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { DOODLE_ARTBOARD_FRAME } from '../../constants/doodleLayout';
import { ENABLE_PHOTO_STICKERS } from '../../constants/experiments';
import { Layout, Shadows, Typography } from '../../constants/theme';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import type { ThemeColors } from '../../hooks/useTheme';
import { getCaptureNoteGradient } from '../../services/noteAppearance';
import { applyCommittedInlineEmoji } from '../../services/noteDecorations';
import NoteStickerCanvas from '../NoteStickerCanvas';
import NoteDoodleCanvas, { DoodleStroke } from '../NoteDoodleCanvas';
import {
  bringStickerPlacementToFront,
  createStickerPlacement,
  duplicateStickerPlacement,
  importStickerAsset,
  type NoteStickerPlacement,
  updateStickerPlacementTransform,
} from '../../services/noteStickers';
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
const SHUTTER_SIDE_ACTION_GAP = 22;
const CAPTURE_BUTTON_PRESS_IN = { duration: 120, easing: Easing.out(Easing.quad) };
const CAPTURE_BUTTON_PRESS_OUT = { duration: 160, easing: Easing.out(Easing.cubic) };
const CAPTURE_BUTTON_STATE_IN = { duration: 160, easing: Easing.out(Easing.cubic) };
const CAPTURE_BUTTON_STATE_OUT = { duration: 210, easing: Easing.out(Easing.cubic) };
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
  getStickerSnapshot: () => { enabled: boolean; placements: NoteStickerPlacement[] };
  resetDoodle: () => void;
  resetStickers: () => void;
}

type CaptureAnimatedPressableProps = Omit<PressableProps, 'children' | 'style'> & {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  pressedScale?: number;
  active?: boolean;
  activeScale?: number;
  activeTranslateY?: number;
  disabledOpacity?: number;
  contentActiveScale?: number;
  contentActiveTranslateY?: number;
  childrenContainerStyle?: StyleProp<ViewStyle>;
};

function CaptureAnimatedPressable({
  children,
  disabled,
  active = false,
  activeScale = 1,
  activeTranslateY = 0,
  disabledOpacity = 0.45,
  contentActiveScale = 1,
  contentActiveTranslateY = 0,
  childrenContainerStyle,
  onPressIn,
  onPressOut,
  pressedScale = 0.97,
  style,
  ...props
}: CaptureAnimatedPressableProps) {
  const reduceMotionEnabled = useReducedMotion();
  const pressScale = useSharedValue(1);
  const activeProgress = useSharedValue(active ? 1 : 0);
  const disabledProgress = useSharedValue(disabled ? 1 : 0);

  useEffect(() => {
    const transition = reduceMotionEnabled
      ? { duration: 110, easing: Easing.out(Easing.quad) }
      : active
        ? CAPTURE_BUTTON_STATE_IN
        : CAPTURE_BUTTON_STATE_OUT;
    activeProgress.value = withTiming(active ? 1 : 0, transition);
  }, [active, activeProgress, reduceMotionEnabled]);

  useEffect(() => {
    if (disabled) {
      pressScale.value = 1;
    }
    const transition = reduceMotionEnabled
      ? { duration: 110, easing: Easing.out(Easing.quad) }
      : disabled
        ? CAPTURE_BUTTON_STATE_IN
        : CAPTURE_BUTTON_STATE_OUT;
    disabledProgress.value = withTiming(disabled ? 1 : 0, transition);
  }, [disabled, disabledProgress, pressScale, reduceMotionEnabled]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - disabledProgress.value * (1 - disabledOpacity),
    transform: [
      { translateY: activeTranslateY * activeProgress.value },
      {
        scale:
          pressScale.value *
          (1 + (activeScale - 1) * activeProgress.value),
      },
    ],
  }));

  const animatedChildrenStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: contentActiveTranslateY * activeProgress.value },
      { scale: 1 + (contentActiveScale - 1) * activeProgress.value },
    ],
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
      pressScale.value = reduceMotionEnabled
        ? withTiming(1, CAPTURE_BUTTON_PRESS_OUT)
        : withSpring(1, {
            stiffness: 520,
            damping: 34,
            mass: 0.38,
          });
      onPressOut?.(event);
    },
    [onPressOut, pressScale, reduceMotionEnabled]
  );

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
    >
      <Reanimated.View style={[styles.captureButtonContent, childrenContainerStyle, animatedChildrenStyle]}>
        {children}
      </Reanimated.View>
    </AnimatedPressable>
  );
}

type CaptureToggleIconButtonProps = Omit<CaptureAnimatedPressableProps, 'children'> & {
  active: boolean;
  activeIconName: ComponentProps<typeof Ionicons>['name'];
  inactiveIconName: ComponentProps<typeof Ionicons>['name'];
  activeBackgroundColor: string;
  inactiveBackgroundColor: string;
  activeBorderColor: string;
  inactiveBorderColor: string;
  activeIconColor: string;
  inactiveIconColor: string;
  iconSize?: number;
  iconRotate?: number;
};

function CaptureToggleIconButton({
  active,
  activeIconName,
  inactiveIconName,
  activeBackgroundColor,
  inactiveBackgroundColor,
  activeBorderColor,
  inactiveBorderColor,
  activeIconColor,
  inactiveIconColor,
  iconSize = 16,
  iconRotate = 12,
  style,
  activeScale = 1.035,
  activeTranslateY = -1.5,
  contentActiveScale = 1.06,
  contentActiveTranslateY = -0.5,
  ...props
}: CaptureToggleIconButtonProps) {
  const reduceMotionEnabled = useReducedMotion();
  const activeProgress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    const transition = reduceMotionEnabled
      ? { duration: 110, easing: Easing.out(Easing.quad) }
      : active
        ? CAPTURE_BUTTON_STATE_IN
        : CAPTURE_BUTTON_STATE_OUT;
    activeProgress.value = withTiming(active ? 1 : 0, transition);
  }, [active, activeProgress, reduceMotionEnabled]);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      activeProgress.value,
      [0, 1],
      [inactiveBackgroundColor, activeBackgroundColor]
    ),
    borderColor: interpolateColor(
      activeProgress.value,
      [0, 1],
      [inactiveBorderColor, activeBorderColor]
    ),
  }));

  const animatedInactiveIconStyle = useAnimatedStyle(() => ({
    opacity: 1 - activeProgress.value,
    transform: [
      { translateY: activeProgress.value * 5 },
      { scale: 1 - activeProgress.value * 0.12 },
      { rotate: `${activeProgress.value * -iconRotate}deg` },
    ],
  }));

  const animatedActiveIconStyle = useAnimatedStyle(() => ({
    opacity: activeProgress.value,
    transform: [
      { translateY: (1 - activeProgress.value) * -5 },
      { scale: 0.88 + activeProgress.value * 0.12 },
      { rotate: `${(1 - activeProgress.value) * iconRotate}deg` },
    ],
  }));

  return (
    <CaptureAnimatedPressable
      {...props}
      active={active}
      activeScale={activeScale}
      activeTranslateY={activeTranslateY}
      contentActiveScale={contentActiveScale}
      contentActiveTranslateY={contentActiveTranslateY}
      style={[style, animatedButtonStyle]}
    >
      <View style={styles.captureToggleIconWrap}>
        <Reanimated.View style={[styles.captureToggleIconLayer, animatedInactiveIconStyle]}>
          <Ionicons name={inactiveIconName} size={iconSize} color={inactiveIconColor} />
        </Reanimated.View>
        <Reanimated.View style={[styles.captureToggleIconLayer, animatedActiveIconStyle]}>
          <Ionicons name={activeIconName} size={iconSize} color={activeIconColor} />
        </Reanimated.View>
      </View>
    </CaptureAnimatedPressable>
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
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraUnavailable, setCameraUnavailable] = useState(false);
  const [cameraIssueDetail, setCameraIssueDetail] = useState<string | null>(null);
  const [cameraRetryNonce, setCameraRetryNonce] = useState(0);
  const [textDoodleModeEnabled, setTextDoodleModeEnabled] = useState(false);
  const [photoDoodleModeEnabled, setPhotoDoodleModeEnabled] = useState(false);
  const [textDecorateMenuExpanded, setTextDecorateMenuExpanded] = useState(false);
  const [photoDecorateMenuExpanded, setPhotoDecorateMenuExpanded] = useState(false);
  const [textDoodleStrokes, setTextDoodleStrokes] = useState<DoodleStroke[]>([]);
  const [photoDoodleStrokes, setPhotoDoodleStrokes] = useState<DoodleStroke[]>([]);
  const [textStickerModeEnabled, setTextStickerModeEnabled] = useState(false);
  const [photoStickerModeEnabled, setPhotoStickerModeEnabled] = useState(false);
  const [textStickerPlacements, setTextStickerPlacements] = useState<NoteStickerPlacement[]>([]);
  const [photoStickerPlacements, setPhotoStickerPlacements] = useState<NoteStickerPlacement[]>([]);
  const [textSelectedStickerId, setTextSelectedStickerId] = useState<string | null>(null);
  const [photoSelectedStickerId, setPhotoSelectedStickerId] = useState<string | null>(null);
  const [importingSticker, setImportingSticker] = useState(false);
  const [textPlaceholderIndex, setTextPlaceholderIndex] = useState(0);
  const isPhotoDoodleSurface = captureMode === 'camera' && Boolean(capturedPhoto);
  const doodleModeEnabled = isPhotoDoodleSurface ? photoDoodleModeEnabled : textDoodleModeEnabled;
  const doodleStrokes = isPhotoDoodleSurface ? photoDoodleStrokes : textDoodleStrokes;
  const stickerModeEnabled = isPhotoDoodleSurface ? photoStickerModeEnabled : textStickerModeEnabled;
  const stickerPlacements = isPhotoDoodleSurface ? photoStickerPlacements : textStickerPlacements;
  const selectedStickerId = isPhotoDoodleSurface ? photoSelectedStickerId : textSelectedStickerId;
  const decorateMenuExpanded = isPhotoDoodleSurface ? photoDecorateMenuExpanded : textDecorateMenuExpanded;
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
  const saveStateScale = useSharedValue(1);
  const saveSuccessProgress = useSharedValue(saveState === 'success' ? 1 : 0);
  const previousTextDraftEmptyRef = useRef(noteText.length === 0);
  const previousCaptureModeRef = useRef(captureMode);
  const placeholderVariants = useMemo(() => getCaptureTextPlaceholderVariants(t), [t]);
  const activeTextPlaceholder =
    placeholderVariants[textPlaceholderIndex % placeholderVariants.length] ??
    DEFAULT_CAPTURE_TEXT_PLACEHOLDERS[0];
  const showDecorateControls = decorateMenuExpanded || doodleModeEnabled || stickerModeEnabled;
  const isSaveBusy = saving || saveState === 'saving';
  const isSaveSuccessful = saveState === 'success';
  const interactionsDisabled = isSaveBusy || isSaveSuccessful;
  const saveIdleBackground = isCameraSaveMode ? colors.primary : colors.captureButtonBg;
  const decorateProgress = useSharedValue(showDecorateControls ? 1 : 0);

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
    decorateProgress.value = withTiming(showDecorateControls ? 1 : 0, {
      duration: reduceMotionEnabled ? 120 : 260,
      easing: Easing.out(Easing.cubic),
    });
  }, [decorateProgress, reduceMotionEnabled, showDecorateControls]);

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
      setTextStickerModeEnabled(false);
      setTextDecorateMenuExpanded(false);
    }

    if (!capturedPhoto) {
      setPhotoDoodleModeEnabled(false);
      setPhotoStickerModeEnabled(false);
      setPhotoDecorateMenuExpanded(false);
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

  const resetStickers = useCallback(() => {
    setTextStickerModeEnabled(false);
    setPhotoStickerModeEnabled(false);
    setTextStickerPlacements([]);
    setPhotoStickerPlacements([]);
    setTextSelectedStickerId(null);
    setPhotoSelectedStickerId(null);
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
      getStickerSnapshot: () => ({
        enabled: stickerModeEnabled,
        placements: stickerPlacements.map((placement) => ({
          ...placement,
          asset: {
            ...placement.asset,
          },
        })),
      }),
      resetDoodle,
      resetStickers,
    }),
    [doodleModeEnabled, doodleStrokes, resetDoodle, resetStickers, stickerModeEnabled, stickerPlacements]
  );

  const animatedSaveButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: saveStateScale.value }],
  }));
  const animatedDecorateButtonStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      decorateProgress.value,
      [0, 1],
      [isCameraSaveMode ? photoPreviewControlFill : colors.captureGlassFill, isCameraSaveMode ? photoPreviewActiveFill : colors.captureButtonBg]
    ),
    borderColor: interpolateColor(
      decorateProgress.value,
      [0, 1],
      [isCameraSaveMode ? photoPreviewControlBorder : colors.captureGlassBorder, 'rgba(255,255,255,0.18)']
    ),
    transform: [
      { scale: 1 + decorateProgress.value * 0.04 },
      { translateY: decorateProgress.value * -1.5 },
    ],
  }));
  const animatedDecorateIconStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${decorateProgress.value * 14}deg` },
      { scale: 1 + decorateProgress.value * 0.08 },
    ],
  }));
  const animatedDecorateControlsStyle = useAnimatedStyle(() => ({
    opacity: decorateProgress.value,
    maxHeight: 14 + TOP_CONTROL_HEIGHT + decorateProgress.value * 4,
    transform: [
      { translateY: (1 - decorateProgress.value) * -8 },
      { scale: 0.96 + decorateProgress.value * 0.04 },
    ],
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
  const showCameraUnavailableState =
    captureMode === 'camera' && !capturedPhoto && permissionGranted && cameraUnavailable;
  const cameraUnavailableDetail =
    cameraIssueDetail?.trim() || t(
      'capture.cameraUnavailableHint',
      'This can happen on a simulator or when the camera session gets stuck. Try again or use a physical device.'
    );
  const handleToggleDecorateMenu = useCallback(() => {
    if (doodleModeEnabled || stickerModeEnabled) {
      if (isPhotoDoodleSurface) {
        setPhotoDoodleModeEnabled(false);
        setPhotoStickerModeEnabled(false);
        setPhotoDecorateMenuExpanded(false);
        return;
      }

      setTextDoodleModeEnabled(false);
      setTextStickerModeEnabled(false);
      setTextDecorateMenuExpanded(false);
      return;
    }

    if (isPhotoDoodleSurface) {
      setPhotoDecorateMenuExpanded((current) => !current);
      return;
    }

    setTextDecorateMenuExpanded((current) => !current);
  }, [doodleModeEnabled, isPhotoDoodleSurface, stickerModeEnabled]);
  const handleToggleDoodleMode = useCallback(() => {
    if (isPhotoDoodleSurface) {
      setPhotoDecorateMenuExpanded(true);
      setPhotoStickerModeEnabled(false);
      setPhotoDoodleModeEnabled((current) => !current);
      return;
    }

    setTextDecorateMenuExpanded(true);
    setTextStickerModeEnabled(false);
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
  const handleImportSticker = useCallback(async () => {
    if (!ENABLE_PHOTO_STICKERS || importingSticker) {
      return;
    }

    setImportingSticker(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: false,
        copyToCacheDirectory: true,
        type: ['image/png', 'image/webp'],
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const importedAsset = await importStickerAsset({
        uri: result.assets[0].uri,
        mimeType: result.assets[0].mimeType,
        name: result.assets[0].name,
      });
      const nextPlacement = createStickerPlacement(importedAsset, stickerPlacements);
      if (isPhotoDoodleSurface) {
        setPhotoStickerPlacements((current) => [...current, nextPlacement]);
        setPhotoSelectedStickerId(nextPlacement.id);
        setPhotoStickerModeEnabled(true);
        setPhotoDoodleModeEnabled(false);
        return;
      }

      setTextStickerPlacements((current) => [...current, nextPlacement]);
      setTextSelectedStickerId(nextPlacement.id);
      setTextStickerModeEnabled(true);
      setTextDoodleModeEnabled(false);
    } catch (error) {
      console.warn('Sticker import failed:', error);
    } finally {
      setImportingSticker(false);
    }
  }, [importingSticker, isPhotoDoodleSurface, stickerPlacements]);
  const handleToggleStickerMode = useCallback(() => {
    if (!ENABLE_PHOTO_STICKERS) {
      return;
    }

    if (!stickerModeEnabled && stickerPlacements.length === 0 && !importingSticker) {
      void handleImportSticker();
      return;
    }

    if (isPhotoDoodleSurface) {
      setPhotoDecorateMenuExpanded(true);
      setPhotoDoodleModeEnabled(false);
      setPhotoStickerModeEnabled((current) => !current);
      return;
    }

    setTextDecorateMenuExpanded(true);
    setTextDoodleModeEnabled(false);
    setTextStickerModeEnabled((current) => !current);
  }, [handleImportSticker, importingSticker, isPhotoDoodleSurface, stickerModeEnabled, stickerPlacements.length]);
  const handleChangeStickerPlacements = useCallback(
    (nextPlacements: NoteStickerPlacement[]) => {
      if (isPhotoDoodleSurface) {
        setPhotoStickerPlacements(nextPlacements);
        return;
      }

      setTextStickerPlacements(nextPlacements);
    },
    [isPhotoDoodleSurface]
  );
  const handleSelectSticker = useCallback(
    (nextId: string | null) => {
      if (isPhotoDoodleSurface) {
        setPhotoSelectedStickerId(nextId);
        return;
      }

      setTextSelectedStickerId(nextId);
    },
    [isPhotoDoodleSurface]
  );
  const handleSelectedStickerAction = useCallback(
    (action: 'rotate-left' | 'rotate-right' | 'smaller' | 'larger' | 'duplicate' | 'front' | 'remove') => {
      if (!selectedStickerId) {
        return;
      }

      const currentPlacements = stickerPlacements;
      let nextPlacements = currentPlacements;

      if (action === 'duplicate') {
        nextPlacements = duplicateStickerPlacement(currentPlacements, selectedStickerId);
      } else if (action === 'front') {
        nextPlacements = bringStickerPlacementToFront(currentPlacements, selectedStickerId);
      } else if (action === 'remove') {
        nextPlacements = currentPlacements.filter((placement) => placement.id !== selectedStickerId);
        handleSelectSticker(null);
      } else if (action === 'rotate-left') {
        const selectedPlacement = currentPlacements.find((placement) => placement.id === selectedStickerId);
        nextPlacements = selectedPlacement
          ? updateStickerPlacementTransform(currentPlacements, selectedStickerId, {
              rotation: selectedPlacement.rotation - 15,
            })
          : currentPlacements;
      } else if (action === 'rotate-right') {
        const selectedPlacement = currentPlacements.find((placement) => placement.id === selectedStickerId);
        nextPlacements = selectedPlacement
          ? updateStickerPlacementTransform(currentPlacements, selectedStickerId, {
              rotation: selectedPlacement.rotation + 15,
            })
          : currentPlacements;
      } else if (action === 'smaller') {
        const selectedPlacement = currentPlacements.find((placement) => placement.id === selectedStickerId);
        nextPlacements = selectedPlacement
          ? updateStickerPlacementTransform(currentPlacements, selectedStickerId, {
              scale: selectedPlacement.scale - 0.12,
            })
          : currentPlacements;
      } else if (action === 'larger') {
        const selectedPlacement = currentPlacements.find((placement) => placement.id === selectedStickerId);
        nextPlacements = selectedPlacement
          ? updateStickerPlacementTransform(currentPlacements, selectedStickerId, {
              scale: selectedPlacement.scale + 0.12,
            })
          : currentPlacements;
      }

      handleChangeStickerPlacements(nextPlacements);
    },
    [handleChangeStickerPlacements, handleSelectSticker, selectedStickerId, stickerPlacements]
  );
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
            transform: [
              { translateY: captureTranslateY },
              { scale: captureScale },
            ],
          },
        ]}
        pointerEvents={isSearching || interactionsDisabled ? 'none' : 'auto'}
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
            <View pointerEvents="box-none" style={styles.cardTopOverlay}>
              <View style={styles.cardTopOverlayRow}>
                <CaptureAnimatedPressable
                  testID="capture-decorate-toggle"
                  accessibilityLabel={t('capture.decorate', 'Decorate')}
                  onPress={handleToggleDecorateMenu}
                  active={showDecorateControls}
                  activeScale={1.03}
                  activeTranslateY={-1}
                  contentActiveScale={1.04}
                  style={[styles.textCardActionButton, styles.decorateToggleButton, animatedDecorateButtonStyle]}
                >
                  <Reanimated.View style={animatedDecorateIconStyle}>
                    <Ionicons
                      name={showDecorateControls ? 'sparkles' : 'sparkles-outline'}
                      size={16}
                      color={showDecorateControls ? textCardActiveIconColor : colors.captureGlassText}
                    />
                  </Reanimated.View>
                </CaptureAnimatedPressable>
              </View>

              <Reanimated.View
                pointerEvents={showDecorateControls ? 'auto' : 'none'}
                style={[styles.decorateControlsWrap, animatedDecorateControlsStyle]}
              >
                <View style={[styles.cardTopOverlayRow, styles.cardTopOverlayRowWrap]}>
                  <View style={styles.textCardActionCluster}>
                    <CaptureToggleIconButton
                      testID="capture-doodle-toggle"
                      onPress={handleToggleDoodleMode}
                      active={doodleModeEnabled}
                      activeIconName="create"
                      inactiveIconName="create-outline"
                      activeBackgroundColor={colors.captureButtonBg}
                      inactiveBackgroundColor={colors.captureGlassFill}
                      activeBorderColor="rgba(255,255,255,0.18)"
                      inactiveBorderColor={colors.captureGlassBorder}
                      activeIconColor={textCardActiveIconColor}
                      inactiveIconColor={colors.captureGlassText}
                      style={[
                        styles.textCardActionButton,
                      ]}
                    />
                    {ENABLE_PHOTO_STICKERS ? (
                      <CaptureToggleIconButton
                        testID="capture-sticker-toggle"
                        onPress={handleToggleStickerMode}
                        active={stickerModeEnabled}
                        activeIconName="sparkles"
                        inactiveIconName="sparkles-outline"
                        activeBackgroundColor={colors.captureButtonBg}
                        inactiveBackgroundColor={colors.captureGlassFill}
                        activeBorderColor="rgba(255,255,255,0.18)"
                        inactiveBorderColor={colors.captureGlassBorder}
                        activeIconColor={textCardActiveIconColor}
                        inactiveIconColor={colors.captureGlassText}
                        style={[
                          styles.textCardActionButton,
                        ]}
                      />
                    ) : null}
                  </View>

                  {doodleModeEnabled ? (
                    <View style={styles.textCardActionCluster}>
                      <CaptureAnimatedPressable
                        testID="capture-doodle-undo"
                        onPress={handleUndoDoodle}
                        disabled={doodleStrokes.length === 0}
                        disabledOpacity={0.45}
                        style={[
                          styles.textCardActionPill,
                          {
                            backgroundColor: colors.captureGlassFill,
                            borderColor: colors.captureGlassBorder,
                          },
                        ]}
                      >
                        <Ionicons name="arrow-undo-outline" size={14} color={colors.captureGlassText} />
                      </CaptureAnimatedPressable>
                      <CaptureAnimatedPressable
                        testID="capture-doodle-clear"
                        onPress={handleClearDoodle}
                        disabled={doodleStrokes.length === 0}
                        disabledOpacity={0.45}
                        style={[
                          styles.textCardActionPill,
                          {
                            backgroundColor: colors.captureGlassFill,
                            borderColor: colors.captureGlassBorder,
                          },
                        ]}
                      >
                        <Ionicons name="close-outline" size={14} color={colors.captureGlassText} />
                      </CaptureAnimatedPressable>
                    </View>
                  ) : stickerModeEnabled ? (
                    <View style={styles.textCardActionCluster}>
                      <CaptureAnimatedPressable
                        testID="capture-sticker-import"
                        onPress={handleImportSticker}
                        disabled={importingSticker}
                        disabledOpacity={0.45}
                        style={[
                          styles.textCardActionPill,
                          {
                            backgroundColor: colors.captureGlassFill,
                            borderColor: colors.captureGlassBorder,
                          },
                        ]}
                      >
                        <Ionicons name="add-outline" size={14} color={colors.captureGlassText} />
                      </CaptureAnimatedPressable>
                      <CaptureAnimatedPressable
                        testID="capture-sticker-remove"
                        onPress={() => handleSelectedStickerAction('remove')}
                        disabled={!selectedStickerId}
                        disabledOpacity={0.45}
                        style={[
                          styles.textCardActionPill,
                          {
                            backgroundColor: colors.captureGlassFill,
                            borderColor: colors.captureGlassBorder,
                          },
                        ]}
                      >
                        <Ionicons name="trash-outline" size={14} color={colors.captureGlassText} />
                      </CaptureAnimatedPressable>
                    </View>
                  ) : null}
                </View>
              </Reanimated.View>
            </View>

            {ENABLE_PHOTO_STICKERS && stickerPlacements.length > 0 ? (
              <View
                pointerEvents={stickerModeEnabled ? 'box-none' : 'none'}
                style={[
                  styles.textStickerCanvasLayer,
                  stickerModeEnabled ? styles.textStickerCanvasLayerActive : null,
                ]}
              >
                <NoteStickerCanvas
                  placements={stickerPlacements}
                  editable={stickerModeEnabled}
                  onChangePlacements={handleChangeStickerPlacements}
                  selectedPlacementId={selectedStickerId}
                  onChangeSelectedPlacementId={handleSelectSticker}
                />
              </View>
            ) : null}
            <View pointerEvents={doodleModeEnabled ? 'auto' : 'none'} style={styles.doodleCanvasLayer}>
              <NoteDoodleCanvas
                strokes={doodleStrokes}
                editable={doodleModeEnabled}
                activeColor={colors.captureCardText}
                onChangeStrokes={setTextDoodleStrokes}
              />
            </View>

            <View
              pointerEvents={stickerModeEnabled ? 'none' : 'auto'}
              style={[
                styles.cardTextCenter,
                stickerModeEnabled ? styles.cardTextCenterInactive : null,
              ]}
            >
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
                editable={!doodleModeEnabled && !stickerModeEnabled}
                onChangeText={handleChangeNoteText}
                maxLength={300}
                selectionColor={colors.captureCardText}
              />
            </View>
          </LinearGradient>
        ) : capturedPhoto ? (
          <View style={[styles.cameraContainer, { backgroundColor: colors.captureCameraOverlay }]}>
            <Image source={{ uri: capturedPhoto }} style={styles.cameraPreview} contentFit="cover" />
            <View pointerEvents="box-none" style={styles.cardTopOverlay}>
              <View style={styles.cardTopOverlayRow}>
                <CaptureAnimatedPressable
                  testID="capture-decorate-toggle"
                  accessibilityLabel={t('capture.decorate', 'Decorate')}
                  onPress={handleToggleDecorateMenu}
                  active={showDecorateControls}
                  activeScale={1.03}
                  activeTranslateY={-1}
                  contentActiveScale={1.04}
                  style={[
                    styles.cameraOverlayButton,
                    styles.textCardActionButton,
                    styles.decorateToggleButton,
                    animatedDecorateButtonStyle,
                  ]}
                >
                  <Reanimated.View style={animatedDecorateIconStyle}>
                    <Ionicons
                      name={showDecorateControls ? 'sparkles' : 'sparkles-outline'}
                      size={16}
                      color={showDecorateControls ? photoPreviewActiveText : photoPreviewControlText}
                    />
                  </Reanimated.View>
                </CaptureAnimatedPressable>
              </View>

              <Reanimated.View
                pointerEvents={showDecorateControls ? 'auto' : 'none'}
                style={[styles.decorateControlsWrap, animatedDecorateControlsStyle]}
              >
                <View pointerEvents="box-none" style={[styles.cardTopOverlayRow, styles.cardTopOverlayRowWrap]}>
                  <View style={styles.textCardActionCluster}>
                    <CaptureToggleIconButton
                      testID="capture-doodle-toggle"
                      accessibilityLabel={
                        doodleModeEnabled ? t('capture.doneDrawing', 'Done') : t('capture.draw', 'Draw')
                      }
                      onPress={handleToggleDoodleMode}
                      active={doodleModeEnabled}
                      activeIconName="create"
                      inactiveIconName="create-outline"
                      activeBackgroundColor={photoPreviewActiveFill}
                      inactiveBackgroundColor={photoPreviewControlFill}
                      activeBorderColor={photoPreviewActiveFill}
                      inactiveBorderColor={photoPreviewControlBorder}
                      activeIconColor={photoPreviewActiveText}
                      inactiveIconColor={photoPreviewControlText}
                      style={[
                        styles.cameraOverlayButton,
                        styles.photoDoodleIconButton,
                      ]}
                    />
                    {ENABLE_PHOTO_STICKERS ? (
                      <CaptureToggleIconButton
                        testID="capture-sticker-toggle"
                        accessibilityLabel={stickerModeEnabled ? t('capture.doneStickers', 'Done') : t('capture.stickers', 'Stickers')}
                        onPress={handleToggleStickerMode}
                        active={stickerModeEnabled}
                        activeIconName="sparkles"
                        inactiveIconName="sparkles-outline"
                        activeBackgroundColor={photoPreviewActiveFill}
                        inactiveBackgroundColor={photoPreviewControlFill}
                        activeBorderColor={photoPreviewActiveFill}
                        inactiveBorderColor={photoPreviewControlBorder}
                        activeIconColor={photoPreviewActiveText}
                        inactiveIconColor={photoPreviewControlText}
                        style={[
                          styles.cameraOverlayButton,
                          styles.photoDoodleIconButton,
                        ]}
                      />
                    ) : null}
                  </View>

                  {doodleModeEnabled ? (
                    <View pointerEvents="box-none" style={styles.photoDoodleActionsCluster}>
                      <CaptureAnimatedPressable
                        testID="capture-doodle-undo"
                        onPress={handleUndoDoodle}
                        disabled={doodleStrokes.length === 0}
                        disabledOpacity={0.45}
                        style={[
                          styles.cameraOverlayButton,
                          styles.textCardActionPill,
                          {
                            backgroundColor: photoPreviewControlFill,
                            borderColor: photoPreviewControlBorder,
                          },
                        ]}
                      >
                        <Ionicons name="arrow-undo-outline" size={14} color={photoPreviewControlText} />
                      </CaptureAnimatedPressable>
                      <CaptureAnimatedPressable
                        testID="capture-doodle-clear"
                        onPress={handleClearDoodle}
                        disabled={doodleStrokes.length === 0}
                        disabledOpacity={0.45}
                        style={[
                          styles.cameraOverlayButton,
                          styles.textCardActionPill,
                          {
                            backgroundColor: photoPreviewControlFill,
                            borderColor: photoPreviewControlBorder,
                          },
                        ]}
                      >
                        <Ionicons name="close-outline" size={14} color={photoPreviewControlText} />
                      </CaptureAnimatedPressable>
                    </View>
                  ) : stickerModeEnabled ? (
                    <View pointerEvents="box-none" style={styles.photoDoodleActionsCluster}>
                      <CaptureAnimatedPressable
                        testID="capture-sticker-import"
                        onPress={handleImportSticker}
                        disabled={importingSticker}
                        disabledOpacity={0.45}
                        style={[
                          styles.cameraOverlayButton,
                          styles.textCardActionPill,
                          {
                            backgroundColor: photoPreviewControlFill,
                            borderColor: photoPreviewControlBorder,
                          },
                        ]}
                      >
                        <Ionicons name="add-outline" size={14} color={photoPreviewControlText} />
                      </CaptureAnimatedPressable>
                      <CaptureAnimatedPressable
                        testID="capture-sticker-remove"
                        onPress={() => handleSelectedStickerAction('remove')}
                        disabled={!selectedStickerId}
                        disabledOpacity={0.45}
                        style={[
                          styles.cameraOverlayButton,
                          styles.textCardActionPill,
                          {
                            backgroundColor: photoPreviewControlFill,
                            borderColor: photoPreviewControlBorder,
                          },
                        ]}
                      >
                        <Ionicons name="trash-outline" size={14} color={photoPreviewControlText} />
                      </CaptureAnimatedPressable>
                    </View>
                  ) : null}
                </View>
              </Reanimated.View>
            </View>
            {ENABLE_PHOTO_STICKERS && stickerPlacements.length > 0 ? (
              <View pointerEvents={stickerModeEnabled ? 'box-none' : 'none'} style={styles.doodleCanvasLayer}>
                <NoteStickerCanvas
                  placements={stickerPlacements}
                  editable={stickerModeEnabled}
                  onChangePlacements={handleChangeStickerPlacements}
                  selectedPlacementId={selectedStickerId}
                  onChangeSelectedPlacementId={handleSelectSticker}
                />
              </View>
            ) : null}
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
              active={importingPhoto}
              activeScale={1.015}
              activeTranslateY={-1}
              contentActiveScale={1.03}
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
              <CaptureToggleIconButton
                style={[
                  styles.cameraOverlayButton,
                  styles.flipBtn,
                ]}
                active={facing === 'front'}
                activeIconName="camera-reverse"
                inactiveIconName="camera-reverse"
                activeBackgroundColor={colors.primary}
                inactiveBackgroundColor={colors.captureCameraOverlay}
                activeBorderColor={colors.primary}
                inactiveBorderColor={colors.captureCameraOverlayBorder}
                activeIconColor={colors.captureCardText}
                inactiveIconColor={colors.captureCameraOverlayText}
                onPress={onToggleFacing}
                iconSize={20}
                iconRotate={10}
              />
            ) : null}
          </View>
        )}
      </Animated.View>

      <Animated.View
        style={[
          styles.belowCardSection,
          {
            transform: [
              { translateY: captureTranslateY },
              { scale: captureScale },
            ],
          },
        ]}
        pointerEvents={interactionsDisabled ? 'none' : 'auto'}
      >
        {captureMode === 'text' ? (
          <View style={[styles.cardRestaurantPill, styles.cardRestaurantPillBelow, styles.captureMetaComposite, { borderColor: colors.captureGlassBorder }]}>
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
            <View style={styles.captureMetaInputWrap}>
              <Ionicons
                name="restaurant-outline"
                size={14}
                color={colors.captureGlassIcon}
              />
              <TextInput
                testID="capture-restaurant-input"
                key={`restaurant-${isSearching}`}
                style={[styles.cardRestaurantInput, styles.cardRestaurantInputCompact, { color: colors.captureGlassText }]}
                placeholder={t('capture.restaurantPlaceholder', 'Restaurant name (e.g. Phở Hòa)')}
                placeholderTextColor={colors.captureGlassPlaceholder}
                value={restaurantName}
                onChangeText={onChangeRestaurantName}
                maxLength={100}
                selectionColor={colors.captureGlassText}
              />
            </View>
            <View style={[styles.captureMetaDivider, { backgroundColor: colors.captureGlassBorder }]} />
            <CaptureToggleIconButton
              testID="capture-share-target-toggle"
              accessibilityRole="button"
              accessibilityState={{ selected: isSharedTarget }}
              accessibilityLabel={isSharedTarget ? t('shared.captureShared', 'Friends') : t('shared.capturePrivate', 'Just me')}
              onPress={() => onChangeShareTarget(shareTarget === 'private' ? 'shared' : 'private')}
              active={isSharedTarget}
              activeIconName="people-outline"
              inactiveIconName="lock-closed-outline"
              activeBackgroundColor={colors.primary}
              inactiveBackgroundColor="rgba(255,255,255,0)"
              activeBorderColor={colors.primary}
              inactiveBorderColor="rgba(255,255,255,0)"
              activeIconColor={colors.captureCardText}
              inactiveIconColor={colors.captureGlassIcon}
              style={styles.captureInlineShareButton}
            />
          </View>
        ) : null}
        {cameraStatusText ? (
          <Text style={[styles.cameraStatusText, { color: colors.secondaryText }]}>{cameraStatusText}</Text>
        ) : null}
        {captureMode === 'camera' && !capturedPhoto ? (
          <View style={styles.belowCardShutterRow}>
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
            <CaptureAnimatedPressable
              testID="capture-save-button"
              onPress={onSaveNote}
              disabled={isSaveBusy || isSaveSuccessful}
              pressedScale={0.985}
              disabledOpacity={isSaveBusy ? 0.72 : 1}
              style={[
                styles.shutterOuter,
                {
                  borderColor: colors.border,
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
              disabledOpacity={0.55}
              style={[
                styles.secondaryActionButton,
                styles.shutterTrailingAccessory,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                },
              ]}
            >
              <Ionicons name="refresh" size={18} color={colors.text} />
            </CaptureAnimatedPressable>
          </View>
        ) : (
          <View style={styles.belowCardShutterRow}>
            <CaptureAnimatedPressable
              testID="capture-save-button"
              onPress={onSaveNote}
              disabled={isSaveBusy || isSaveSuccessful}
              pressedScale={0.985}
              disabledOpacity={isSaveBusy ? 0.72 : 1}
              style={[
                styles.shutterOuter,
                {
                  borderColor: colors.border,
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
  captureButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  captureToggleIconWrap: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureToggleIconLayer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    zIndex: 1,
  },
  cardTextCenterInactive: {
    zIndex: 0,
  },
  cardTopOverlay: {
    position: 'absolute',
    top: TOP_CONTROL_INSET,
    left: 18,
    right: 18,
    gap: 8,
    zIndex: 11,
  },
  cardTopOverlayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
  },
  cardTopOverlayRowWrap: {
    flexWrap: 'wrap',
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
  decorateToggleButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  decorateControlsWrap: {
    overflow: 'hidden',
    paddingTop: 2,
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
  textStickerCanvasLayer: {
    ...StyleSheet.absoluteFillObject,
    ...DOODLE_ARTBOARD_FRAME,
    zIndex: 0,
  },
  textStickerCanvasLayerActive: {
    zIndex: 2,
  },
  cardRestaurantPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 0,
    borderRadius: Layout.pillRadius,
    borderWidth: StyleSheet.hairlineWidth,
    width: '100%',
    marginTop: 8,
    overflow: 'hidden',
    position: 'relative',
    zIndex: 3,
  },
  cardRestaurantPillBelow: {
    marginTop: 0,
  },
  captureMetaComposite: {
    width: '92%',
    alignSelf: 'center',
    paddingHorizontal: 14,
    gap: 0,
  },
  captureMetaInputWrap: {
    flex: 1,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  cardRestaurantInputCompact: {
    paddingRight: 0,
  },
  captureMetaDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginHorizontal: 6,
    opacity: 0.65,
  },
  captureInlineShareButton: {
    width: 36,
    height: 32,
    marginLeft: 4,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
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
