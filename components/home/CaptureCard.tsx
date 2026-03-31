import { Ionicons } from '@expo/vector-icons';
import { CameraView } from 'expo-camera';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { TFunction } from 'i18next';
import { type ComponentProps, forwardRef, ReactNode, RefObject, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  type GestureResponderEvent,
  Keyboard,
  type KeyboardEvent,
  Platform,
  Pressable,
  type PressableProps,
  ScrollView,
  type StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  Easing,
  FadeInLeft,
  FadeOutLeft,
  interpolateColor,
  LinearTransition,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showAppAlert } from '../../utils/alert';
import { DOODLE_ARTBOARD_FRAME } from '../../constants/doodleLayout';
import { ENABLE_PHOTO_STICKERS } from '../../constants/experiments';
import { formatRadiusLabel, NOTE_RADIUS_OPTIONS } from '../../constants/noteRadius';
import { Layout, Radii, Shadows, Sheet, Typography } from '../../constants/theme';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import type { ThemeColors } from '../../hooks/useTheme';
import {
  DEFAULT_NOTE_COLOR_ID,
  getCaptureNoteGradient,
  getNoteColorCardGradient,
} from '../../services/noteAppearance';
import { applyCommittedInlineEmoji } from '../../services/noteDecorations';
import {
  bringStickerPlacementToFront,
  createStickerPlacement,
  duplicateStickerPlacement,
  importStickerAsset,
  type NoteStickerPlacement,
  StickerImportError,
  setStickerPlacementOutlineEnabled,
  updateStickerPlacementTransform,
} from '../../services/noteStickers';
import { isOlderIOS } from '../../utils/platform';
import {
  ClipboardStickerError,
  hasClipboardStickerImage,
  importStickerAssetFromClipboard,
} from '../../utils/stickerClipboard';
import AppSheet from '../AppSheet';
import AppSheetScaffold from '../AppSheetScaffold';
import NoteDoodleCanvas, { DoodleStroke } from '../NoteDoodleCanvas';
import NoteStickerCanvas from '../NoteStickerCanvas';
import StickerSourceSheet from '../StickerSourceSheet';
import { GlassView } from '../ui/GlassView';
import NoteColorPicker from '../ui/NoteColorPicker';
import PremiumNoteFinishOverlay from '../ui/PremiumNoteFinishOverlay';
import PrimaryButton from '../ui/PrimaryButton';
import StickerPastePopover from '../ui/StickerPastePopover';

const { width } = Dimensions.get('window');
const HORIZONTAL_PADDING = Layout.screenPadding - 8;
const CARD_SIZE = width - HORIZONTAL_PADDING * 2;
const TOP_CONTROL_INSET = 24;
const TOP_CONTROL_HEIGHT = 38;
const TOP_CONTROL_RADIUS = 19;
const DECORATE_OPTION_ACTIVE_SCALE = 1;
const DECORATE_OPTION_CONTENT_SCALE = 1;
const SHUTTER_OUTER_SIZE = 68;
const SIDE_ACTION_SIZE = 46;
const SHUTTER_SIDE_ACTION_OFFSET = SHUTTER_OUTER_SIZE / 2 + 12 + SIDE_ACTION_SIZE;
const STICKER_SOURCE_SHEET_DISMISS_DELAY_MS = 250;
const PHOTO_DOODLE_DEFAULT_COLOR = '#FFFFFF';
const CAMERA_AUTO_RECOVERY_ATTEMPTS = 1;
const CAMERA_START_TIMEOUT_MS = 2400;
const CAMERA_ZOOM_PAN_RANGE = 0.9;
const CAMERA_ZOOM_PINCH_RANGE = 0.45;
const CAMERA_ZOOM_LABEL_VISIBLE_MS = 1100;
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

function getUniqueColors(colors: string[]) {
  return colors.filter((color, index) => colors.indexOf(color) === index);
}

function clamp(value: number, minValue: number, maxValue: number) {
  return Math.min(maxValue, Math.max(minValue, value));
}

function getStickerImportErrorMessage(t: TFunction, error: unknown) {
  if (error instanceof StickerImportError) {
    if (error.code === 'unsupported-format') {
      return t(
        'capture.stickerUnsupportedFormat',
        'Please import a transparent PNG or WebP sticker.'
      );
    }

    if (error.code === 'file-unavailable') {
      return t(
        'capture.stickerFileUnavailable',
        'Sticker file is not available on this device.'
      );
    }

    if (error.code === 'missing-transparency') {
      return t(
        'capture.stickerMissingTransparency',
        'This image does not include transparency. Import a transparent PNG or WebP sticker.'
      );
    }
  }

  return error instanceof Error
    ? error.message
    : t('capture.photoImportFailed', 'We could not import that photo right now.');
}

export interface CaptureCardHandle {
  getDoodleSnapshot: () => { enabled: boolean; strokes: DoodleStroke[] };
  getStickerSnapshot: () => { enabled: boolean; placements: NoteStickerPlacement[] };
  resetDoodle: () => void;
  resetStickers: () => void;
}

type StickerPastePromptState = {
  visible: boolean;
  x: number;
  y: number;
};

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
  iconSize = 17,
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
    transform: [{ translateY: Math.round(activeProgress.value * 3) }],
  }));

  const animatedActiveIconStyle = useAnimatedStyle(() => ({
    opacity: activeProgress.value,
    transform: [{ translateY: Math.round((1 - activeProgress.value) * -3) }],
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

interface DoodleColorPaletteProps {
  colors: string[];
  selectedColor: string;
  onSelectColor: (color: string) => void;
  buttonBackgroundColor: string;
  buttonBorderColor: string;
  selectedBorderColor: string;
  swatchBorderColor: string;
  testIDPrefix: string;
}

function DoodleColorPalette({
  colors,
  selectedColor,
  onSelectColor,
  buttonBackgroundColor,
  buttonBorderColor,
  selectedBorderColor,
  swatchBorderColor,
  testIDPrefix,
}: DoodleColorPaletteProps) {
  return (
    <View style={styles.doodleColorPalette}>
      <ScrollView
        horizontal
        style={styles.doodleColorPaletteScroll}
        contentContainerStyle={styles.doodleColorPaletteContent}
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {colors.map((color, index) => {
          const isSelected = selectedColor === color;

          return (
            <CaptureAnimatedPressable
              key={`${testIDPrefix}-${color}`}
              testID={`${testIDPrefix}-${index}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`Doodle color ${index + 1}`}
              onPress={() => onSelectColor(color)}
              active={isSelected}
              activeScale={1}
              activeTranslateY={0}
              contentActiveScale={1}
              contentActiveTranslateY={0}
              style={[
                styles.doodleColorButton,
                {
                  backgroundColor: buttonBackgroundColor,
                  borderColor: isSelected ? selectedBorderColor : buttonBorderColor,
                },
              ]}
            >
              <View
                style={[
                  styles.doodleColorSwatch,
                  {
                    backgroundColor: color,
                    borderColor: color.toUpperCase() === '#FFFFFF' ? swatchBorderColor : 'transparent',
                  },
                ]}
              />
            </CaptureAnimatedPressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

type CaptureGlassActionButtonProps = Omit<CaptureAnimatedPressableProps, 'children'> & {
  iconName: ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  glassColorScheme: 'light' | 'dark';
  fallbackColor: string;
  borderColor: string;
  iconSize?: number;
};

function CaptureGlassActionButton({
  iconName,
  iconColor,
  glassColorScheme,
  fallbackColor,
  borderColor,
  iconSize = 18,
  style,
  ...props
}: CaptureGlassActionButtonProps) {
  return (
    <CaptureAnimatedPressable
      {...props}
      childrenContainerStyle={styles.secondaryActionButtonContent}
      style={[
        styles.secondaryActionButton,
        {
          borderColor,
        },
        style,
      ]}
    >
      {isOlderIOS ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: fallbackColor,
            },
          ]}
        />
      ) : null}
      <GlassView
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        glassEffectStyle="regular"
        colorScheme={glassColorScheme}
        fallbackColor={fallbackColor}
      />
      <Ionicons name={iconName} size={iconSize} color={iconColor} />
    </CaptureAnimatedPressable>
  );
}

interface CaptureCardProps {
  snapHeight: number;
  topInset: number;
  isSearching: boolean;
  captureMode: 'text' | 'camera';
  cameraSessionKey: number;
  captureScale: SharedValue<number>;
  captureTranslateY: SharedValue<number>;
  colors: Pick<
    ThemeColors,
    | 'primary'
    | 'primarySoft'
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
  noteColor?: string | null;
  onChangeNoteColor?: (nextColor: string | null) => void;
  lockedNoteColorIds?: string[];
  previewOnlyNoteColorIds?: string[];
  onPressLockedNoteColor?: (colorId: string) => void;
  restaurantName: string;
  onChangeRestaurantName: (nextName: string) => void;
  capturedPhoto: string | null;
  onRetakePhoto: () => void;
  needsCameraPermission: boolean;
  cameraPermissionRequiresSettings?: boolean;
  onRequestCameraPermission: () => void;
  facing: 'back' | 'front';
  onToggleFacing: () => void;
  onOpenPhotoLibrary: () => void;
  cameraRef: RefObject<CameraView | null>;
  shouldRenderCameraPreview: boolean;
  flashAnim: SharedValue<number>;
  permissionGranted: boolean;
  onShutterPressIn: () => void;
  onShutterPressOut: () => void;
  onTakePicture: () => void;
  onSaveNote: () => void;
  onOpenNotes: () => void;
  saving: boolean;
  saveState?: 'idle' | 'saving' | 'success';
  shutterScale: SharedValue<number>;
  cameraStatusText?: string | null;
  remainingPhotoSlots?: number | null;
  libraryImportLocked?: boolean;
  importingPhoto?: boolean;
  radius: number;
  onChangeRadius: (nextRadius: number) => void;
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
  noteColor = null,
  onChangeNoteColor,
  lockedNoteColorIds = [],
  previewOnlyNoteColorIds = [],
  onPressLockedNoteColor,
  restaurantName,
  onChangeRestaurantName,
  capturedPhoto,
  onRetakePhoto,
  needsCameraPermission,
  cameraPermissionRequiresSettings = false,
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
  onOpenNotes,
  saving,
  saveState = 'idle',
  shutterScale,
  cameraStatusText,
  remainingPhotoSlots,
  libraryImportLocked = false,
  importingPhoto = false,
  radius,
  onChangeRadius,
  shareTarget,
  onChangeShareTarget,
  onDoodleModeChange,
  footerContent,
}, ref) {
  const reduceMotionEnabled = useReducedMotion();
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraUnavailable, setCameraUnavailable] = useState(false);
  const [showNoteColorSheet, setShowNoteColorSheet] = useState(false);
  const [showRadiusSheet, setShowRadiusSheet] = useState(false);
  const [cameraIssueDetail, setCameraIssueDetail] = useState<string | null>(null);
  const [cameraRetryNonce, setCameraRetryNonce] = useState(0);
  const [cameraZoom, setCameraZoom] = useState(0);
  const [showCameraZoomBadge, setShowCameraZoomBadge] = useState(false);
  const [textDoodleModeEnabled, setTextDoodleModeEnabled] = useState(false);
  const [photoDoodleModeEnabled, setPhotoDoodleModeEnabled] = useState(false);
  const [textDecorateMenuExpanded, setTextDecorateMenuExpanded] = useState(false);
  const [photoDecorateMenuExpanded, setPhotoDecorateMenuExpanded] = useState(false);
  const [textDoodleStrokes, setTextDoodleStrokes] = useState<DoodleStroke[]>([]);
  const [photoDoodleStrokes, setPhotoDoodleStrokes] = useState<DoodleStroke[]>([]);
  const [textDoodleColor, setTextDoodleColor] = useState(colors.captureCardText);
  const [photoDoodleColor, setPhotoDoodleColor] = useState(PHOTO_DOODLE_DEFAULT_COLOR);
  const [textStickerModeEnabled, setTextStickerModeEnabled] = useState(false);
  const [photoStickerModeEnabled, setPhotoStickerModeEnabled] = useState(false);
  const [textStickerPlacements, setTextStickerPlacements] = useState<NoteStickerPlacement[]>([]);
  const [photoStickerPlacements, setPhotoStickerPlacements] = useState<NoteStickerPlacement[]>([]);
  const [textSelectedStickerId, setTextSelectedStickerId] = useState<string | null>(null);
  const [photoSelectedStickerId, setPhotoSelectedStickerId] = useState<string | null>(null);
  const [importingSticker, setImportingSticker] = useState(false);
  const [showStickerSourceSheet, setShowStickerSourceSheet] = useState(false);
  const [pendingStickerSourceAction, setPendingStickerSourceAction] = useState<'photos' | null>(null);
  const [stickerSourceCanPasteFromClipboard, setStickerSourceCanPasteFromClipboard] = useState(false);
  const [pastePrompt, setPastePrompt] = useState<StickerPastePromptState>({ visible: false, x: CARD_SIZE / 2, y: CARD_SIZE / 2 });
  const [textPlaceholderIndex, setTextPlaceholderIndex] = useState(0);
  const [isNoteInputFocused, setIsNoteInputFocused] = useState(false);
  const [isRestaurantInputFocused, setIsRestaurantInputFocused] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const cameraAutoRecoveryCountRef = useRef(0);
  const cameraZoomRef = useRef(0);
  const cameraPanZoomStartRef = useRef(0);
  const cameraPinchZoomStartRef = useRef(0);
  const cameraZoomBadgeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPhotoDoodleSurface = captureMode === 'camera' && Boolean(capturedPhoto);
  const doodleModeEnabled = isPhotoDoodleSurface ? photoDoodleModeEnabled : textDoodleModeEnabled;
  const doodleStrokes = isPhotoDoodleSurface ? photoDoodleStrokes : textDoodleStrokes;
  const doodleColor = isPhotoDoodleSurface ? photoDoodleColor : textDoodleColor;
  const stickerModeEnabled = isPhotoDoodleSurface ? photoStickerModeEnabled : textStickerModeEnabled;
  const stickerPlacements = isPhotoDoodleSurface ? photoStickerPlacements : textStickerPlacements;
  const selectedStickerId = isPhotoDoodleSurface ? photoSelectedStickerId : textSelectedStickerId;
  const selectedStickerPlacement = useMemo(
    () => stickerPlacements.find((placement) => placement.id === selectedStickerId) ?? null,
    [selectedStickerId, stickerPlacements]
  );
  const selectedStickerOutlineEnabled = selectedStickerPlacement?.outlineEnabled !== false;
  const decorateMenuExpanded = isPhotoDoodleSurface ? photoDecorateMenuExpanded : textDecorateMenuExpanded;
  const textDoodleColors = useMemo(
    () => getUniqueColors([colors.captureCardText, PHOTO_DOODLE_DEFAULT_COLOR, colors.primary]),
    [colors.captureCardText, colors.primary]
  );
  const photoDoodleColors = useMemo(
    () => getUniqueColors([PHOTO_DOODLE_DEFAULT_COLOR, '#1C1C1E', colors.primary]),
    [colors.primary]
  );
  const doodleColorOptions = isPhotoDoodleSurface ? photoDoodleColors : textDoodleColors;
  const isCameraSaveMode = captureMode === 'camera';
  const isSharedTarget = shareTarget === 'shared';
  const isDarkCaptureTheme = colors.captureGlassColorScheme === 'dark';
  const textCardActiveIconColor = isDarkCaptureTheme ? colors.captureCardText : '#FFFFFF';
  const sharedTargetHighlightBackground = isDarkCaptureTheme
    ? 'rgba(255, 193, 7, 0.26)'
    : colors.primarySoft;
  const sharedTargetHighlightBorder = isDarkCaptureTheme
    ? 'rgba(255, 193, 7, 0.52)'
    : 'rgba(224, 177, 91, 0.38)';
  const sharedTargetHighlightIcon = colors.captureCardText;
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
  const savePressScale = useSharedValue(1);
  const previousTextDraftEmptyRef = useRef(noteText.length === 0);
  const previousCaptureModeRef = useRef(captureMode);
  const previousTextDoodleDefaultColorRef = useRef(colors.captureCardText);
  const pastePromptTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const placeholderVariants = useMemo(() => getCaptureTextPlaceholderVariants(t), [t]);
  const activeTextPlaceholder =
    placeholderVariants[textPlaceholderIndex % placeholderVariants.length] ??
    DEFAULT_CAPTURE_TEXT_PLACEHOLDERS[0];
  const showDecorateControls = decorateMenuExpanded || doodleModeEnabled || stickerModeEnabled;
  const isSaveBusy = saving || saveState === 'saving';
  const isSaveSuccessful = saveState === 'success';
  const interactionsDisabled = isSaveBusy || isSaveSuccessful;
  const canShowLiveCameraPreview =
    captureMode === 'camera' && !capturedPhoto && permissionGranted && shouldRenderCameraPreview;
  const saveIdleBackground = isCameraSaveMode ? colors.primary : colors.captureButtonBg;
  const disableAndroidTextTransforms = Platform.OS === 'android' && captureMode === 'text' && isNoteInputFocused;
  const decorateProgress = useSharedValue(showDecorateControls ? 1 : 0);
  const keyboardLift = useSharedValue(0);
  const isTextEntryFocused = captureMode === 'text' && (isNoteInputFocused || isRestaurantInputFocused);

  const clearCameraZoomBadgeTimeout = useCallback(() => {
    if (cameraZoomBadgeTimeoutRef.current) {
      clearTimeout(cameraZoomBadgeTimeoutRef.current);
      cameraZoomBadgeTimeoutRef.current = null;
    }
  }, []);

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

  const restartCameraPreview = useCallback((manual = false) => {
    if (manual) {
      cameraAutoRecoveryCountRef.current = 0;
    }

    setCameraUnavailable(false);
    setCameraIssueDetail(null);
    setIsCameraReady(false);
    setCameraRetryNonce((current) => current + 1);
  }, []);

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
    },
    [restartCameraPreview, t]
  );

  useEffect(() => {
    if (canShowLiveCameraPreview) {
      setIsCameraReady(false);
      setCameraUnavailable(false);
      setCameraIssueDetail(null);
      return;
    }

    setIsCameraReady(true);
    setCameraUnavailable(false);
    setCameraIssueDetail(null);
  }, [cameraSessionKey, cameraRetryNonce, canShowLiveCameraPreview]);

  useEffect(() => {
    cameraAutoRecoveryCountRef.current = 0;
  }, [cameraSessionKey, captureMode, facing, permissionGranted, shouldRenderCameraPreview, capturedPhoto]);

  useEffect(() => {
    if (captureMode !== 'camera') {
      resetCameraZoom();
    }
  }, [captureMode, resetCameraZoom]);

  useEffect(() => () => clearCameraZoomBadgeTimeout(), [clearCameraZoomBadgeTimeout]);

  useEffect(() => {
    let cancelled = false;

    if (!canShowLiveCameraPreview) {
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
  }, [cameraRetryNonce, canShowLiveCameraPreview]);

  useEffect(() => {
    if (!canShowLiveCameraPreview || isCameraReady || cameraUnavailable) {
      return;
    }

    const timer = setTimeout(() => {
      handleCameraStartupFailure();
    }, CAMERA_START_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [cameraRetryNonce, canShowLiveCameraPreview, cameraUnavailable, handleCameraStartupFailure, isCameraReady]);

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
    if (isSaveBusy || isSaveSuccessful) {
      savePressScale.value = 1;
    }
  }, [isSaveBusy, isSaveSuccessful, savePressScale]);

  useEffect(() => {
    if (captureMode !== 'text') {
      setIsNoteInputFocused(false);
      setIsRestaurantInputFocused(false);
      setTextDoodleModeEnabled(false);
      setTextStickerModeEnabled(false);
      setTextDecorateMenuExpanded(false);
    }

    if (!capturedPhoto) {
      setPhotoDoodleModeEnabled(false);
      setPhotoStickerModeEnabled(false);
      setPhotoDecorateMenuExpanded(false);
    }

    setShowStickerSourceSheet(false);
  }, [captureMode, capturedPhoto]);

  useEffect(() => {
    const previousDefaultColor = previousTextDoodleDefaultColorRef.current;
    setTextDoodleColor((current) => (
      current === previousDefaultColor ? colors.captureCardText : current
    ));
    previousTextDoodleDefaultColorRef.current = colors.captureCardText;
  }, [colors.captureCardText]);

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

  useEffect(() => {
    const handleKeyboardFrame = (event: KeyboardEvent) => {
      setKeyboardHeight(event.endCoordinates.height);
    };
    const handleKeyboardHide = () => {
      setKeyboardHeight(0);
    };
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const frameEvent = Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, handleKeyboardFrame);
    const frameSubscription = Keyboard.addListener(frameEvent, handleKeyboardFrame);
    const hideSubscription = Keyboard.addListener(hideEvent, handleKeyboardHide);

    return () => {
      showSubscription.remove();
      frameSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    const nextLift = isTextEntryFocused
      ? Math.min(Math.max(keyboardHeight - 150, 0), 170)
      : 0;

    keyboardLift.value = withTiming(nextLift, {
      duration: reduceMotionEnabled ? 110 : 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [isTextEntryFocused, keyboardHeight, keyboardLift, reduceMotionEnabled]);

  const clearPastePromptTimeout = useCallback(() => {
    if (pastePromptTimeoutRef.current) {
      clearTimeout(pastePromptTimeoutRef.current);
      pastePromptTimeoutRef.current = null;
    }
  }, []);

  const dismissPastePrompt = useCallback(() => {
    clearPastePromptTimeout();
    setPastePrompt((current) => (current.visible ? { ...current, visible: false } : current));
  }, [clearPastePromptTimeout]);

  const handleSavePressIn = useCallback(() => {
    if (isSaveBusy || isSaveSuccessful) {
      return;
    }

    savePressScale.value = withTiming(0.85, {
      duration: 120,
      easing: Easing.out(Easing.quad),
    });
  }, [isSaveBusy, isSaveSuccessful, savePressScale]);

  const handleSavePressOut = useCallback(() => {
    savePressScale.value = withTiming(1, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [savePressScale]);

  const schedulePastePromptDismiss = useCallback(() => {
    clearPastePromptTimeout();
    pastePromptTimeoutRef.current = setTimeout(() => {
      setPastePrompt((current) => ({ ...current, visible: false }));
      pastePromptTimeoutRef.current = null;
    }, 2600);
  }, [clearPastePromptTimeout]);

  useEffect(() => () => clearPastePromptTimeout(), [clearPastePromptTimeout]);

  useEffect(() => {
    if (doodleModeEnabled || stickerModeEnabled || importingSticker || interactionsDisabled) {
      dismissPastePrompt();
    }
  }, [dismissPastePrompt, doodleModeEnabled, importingSticker, interactionsDisabled, stickerModeEnabled]);

  useEffect(() => {
    if (importingSticker || interactionsDisabled) {
      setShowStickerSourceSheet(false);
    }
  }, [importingSticker, interactionsDisabled]);

  const resetDoodle = useCallback(() => {
    setTextDoodleModeEnabled(false);
    setPhotoDoodleModeEnabled(false);
    setTextDoodleStrokes([]);
    setPhotoDoodleStrokes([]);
    setTextDoodleColor(colors.captureCardText);
    setPhotoDoodleColor(PHOTO_DOODLE_DEFAULT_COLOR);
  }, [colors.captureCardText]);

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
  }));
  const animatedDecorateIconStyle = useAnimatedStyle(() => ({}));
  const animatedDecorateChevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${decorateProgress.value * 180}deg` }],
  }));
  const decorateControlsTargetWidth =
    doodleModeEnabled || stickerModeEnabled
      ? doodleModeEnabled
        ? 228
        : TOP_CONTROL_HEIGHT * 4 + 24
      : ENABLE_PHOTO_STICKERS
        ? TOP_CONTROL_HEIGHT * 2 + 8
        : TOP_CONTROL_HEIGHT;
  const animatedDecorateControlsStyle = useAnimatedStyle(() => ({
    opacity: decorateProgress.value,
    width: decorateControlsTargetWidth * decorateProgress.value,
    marginLeft: 8 * decorateProgress.value,
    transform: [
      { translateX: (1 - decorateProgress.value) * -10 },
      { scale: 0.97 + decorateProgress.value * 0.03 },
    ],
  }));
  const animatedSaveInnerStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      saveSuccessProgress.value,
      [0, 1],
      [saveIdleBackground, colors.primary]
    ),
    transform: [{ scale: saveStateScale.value }],
  }));
  const animatedSaveHaloStyle = useAnimatedStyle(() => ({
    opacity: saveSuccessProgress.value * (reduceMotionEnabled ? 0.16 : 0.28),
    transform: [{ scale: 1 + saveSuccessProgress.value * (reduceMotionEnabled ? 0.03 : 0.08) }],
  }));
  const animatedSaveIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + saveSuccessProgress.value * 0.12 }],
  }));
  const captureAreaAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: captureTranslateY.value },
      { scale: captureScale.value },
    ],
  }), [captureScale, captureTranslateY]);
  const belowCardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: captureTranslateY.value },
      { scale: captureScale.value },
    ],
  }), [captureScale, captureTranslateY]);
  const flashAnimatedStyle = useAnimatedStyle(() => ({
    opacity: flashAnim.value,
  }), [flashAnim]);
  const keyboardLiftAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -keyboardLift.value }],
  }), [keyboardLift]);
  const shutterInnerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: shutterScale.value }],
  }), [shutterScale]);
  const savePressAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: savePressScale.value }],
  }), [savePressScale]);
  const decorateActionLayout = reduceMotionEnabled ? undefined : LinearTransition.duration(180);
  const decorateActionEntering = reduceMotionEnabled ? undefined : FadeInLeft.duration(180);
  const decorateActionExiting = reduceMotionEnabled ? undefined : FadeOutLeft.duration(140);
  const showCameraUnavailableState =
    captureMode === 'camera' && !capturedPhoto && permissionGranted && cameraUnavailable;
  const cameraUnavailableDetail =
    cameraIssueDetail?.trim() || t(
      'capture.cameraUnavailableHint',
      'The camera session may have stalled. Try again to restart the preview.'
    );
  const cameraZoomGesturesEnabled =
    canShowLiveCameraPreview && !showCameraUnavailableState && !interactionsDisabled;
  const cameraZoomLabel = `${Math.round(cameraZoom * 100)}%`;
  const cameraZoomGesture = useMemo(
    () =>
      Gesture.Simultaneous(
        Gesture.Pan()
          .enabled(cameraZoomGesturesEnabled)
          .runOnJS(true)
          .maxPointers(1)
          .activeOffsetY([-10, 10])
          .failOffsetX([-48, 48])
          .shouldCancelWhenOutside(false)
          .onBegin(() => {
            cameraPanZoomStartRef.current = cameraZoomRef.current;
          })
          .onUpdate((event) => {
            const nextZoom =
              cameraPanZoomStartRef.current -
              (event.translationY / Math.max(CARD_SIZE, 1)) * CAMERA_ZOOM_PAN_RANGE;
            updateCameraZoom(nextZoom);
          })
          .onEnd(() => {
            scheduleHideCameraZoomBadge();
          }),
        Gesture.Pinch()
          .enabled(cameraZoomGesturesEnabled)
          .runOnJS(true)
          .shouldCancelWhenOutside(false)
          .onBegin(() => {
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
      ),
    [cameraZoomGesturesEnabled, scheduleHideCameraZoomBadge, updateCameraZoom]
  );
  const handleToggleDecorateMenu = useCallback(() => {
    dismissPastePrompt();

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
  }, [dismissPastePrompt, doodleModeEnabled, isPhotoDoodleSurface, stickerModeEnabled]);
  const handleToggleDoodleMode = useCallback(() => {
    dismissPastePrompt();

    if (isPhotoDoodleSurface) {
      setPhotoDecorateMenuExpanded(true);
      setPhotoStickerModeEnabled(false);
      setPhotoDoodleModeEnabled((current) => !current);
      return;
    }

    setTextDecorateMenuExpanded(true);
    setTextStickerModeEnabled(false);
    setTextDoodleModeEnabled((current) => !current);
  }, [dismissPastePrompt, isPhotoDoodleSurface]);
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
  const handleSelectDoodleColor = useCallback(
    (nextColor: string) => {
      if (isPhotoDoodleSurface) {
        setPhotoDoodleColor(nextColor);
        return;
      }

      setTextDoodleColor(nextColor);
    },
    [isPhotoDoodleSurface]
  );
  const applyImportedSticker = useCallback((nextPlacement: NoteStickerPlacement) => {
    if (isPhotoDoodleSurface) {
      setPhotoStickerPlacements((current) => [...current, nextPlacement]);
      setPhotoSelectedStickerId(nextPlacement.id);
      setPhotoStickerModeEnabled(true);
      setPhotoDoodleModeEnabled(false);
      setPhotoDecorateMenuExpanded(true);
      return;
    }

    setTextStickerPlacements((current) => [...current, nextPlacement]);
    setTextSelectedStickerId(nextPlacement.id);
    setTextStickerModeEnabled(true);
    setTextDoodleModeEnabled(false);
    setTextDecorateMenuExpanded(true);
  }, [isPhotoDoodleSurface]);
  const handleImportSticker = useCallback(async () => {
    if (!ENABLE_PHOTO_STICKERS || importingSticker) {
      return;
    }

    dismissPastePrompt();

    let mediaPermission = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (mediaPermission.status !== 'granted') {
      mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    }

    if (mediaPermission.status !== 'granted') {
      showAppAlert(
        t('capture.photoLibraryPermissionTitle', 'Photo access needed'),
        mediaPermission.canAskAgain === false
          ? t(
            'capture.photoLibraryPermissionSettingsMsg',
            'Photo library access is blocked for Noto. Open Settings to import from your library.'
          )
          : t(
            'capture.photoLibraryPermissionMsg',
            'Allow photo library access so you can import an image into this note.'
          )
      );
      return;
    }

    setImportingSticker(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
        selectionLimit: 1,
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        return;
      }

      const importedAsset = await importStickerAsset({
        uri: result.assets[0].uri,
        mimeType: result.assets[0].mimeType,
        name: result.assets[0].fileName,
      });
      const nextPlacement = createStickerPlacement(importedAsset, stickerPlacements);
      applyImportedSticker(nextPlacement);
    } catch (error) {
      console.warn('Sticker import failed:', error);
      showAppAlert(
        t('capture.error', 'Error'),
        getStickerImportErrorMessage(t, error)
      );
    } finally {
      setImportingSticker(false);
    }
  }, [applyImportedSticker, dismissPastePrompt, importingSticker, stickerPlacements, t]);
  useEffect(() => {
    if (showStickerSourceSheet || pendingStickerSourceAction !== 'photos') {
      return;
    }

    const timer = setTimeout(() => {
      setPendingStickerSourceAction(null);
      void handleImportSticker();
    }, STICKER_SOURCE_SHEET_DISMISS_DELAY_MS);

    return () => clearTimeout(timer);
  }, [handleImportSticker, pendingStickerSourceAction, showStickerSourceSheet]);
  const handlePasteStickerFromClipboard = useCallback(async () => {
    if (!ENABLE_PHOTO_STICKERS || importingSticker) {
      return;
    }

    dismissPastePrompt();
    setImportingSticker(true);

    try {
      const importedAsset = await importStickerAssetFromClipboard({
        requiresUpdate: t(
          'capture.clipboardStickerRequiresUpdateMsg',
          'Clipboard sticker paste needs the latest app build. Restart the iOS app after rebuilding to use this.'
        ),
        unavailable: t(
          'capture.clipboardStickerUnavailableMsg',
          'Copy a transparent sticker image first, then try again.'
        ),
        unsupported: t(
          'capture.clipboardStickerUnsupported',
          'We could not read that clipboard image right now.'
        ),
        storageUnavailable: t(
          'capture.clipboardStickerStorageUnavailable',
          'Sticker storage is unavailable on this device.'
        ),
      });
      const nextPlacement = createStickerPlacement(importedAsset, stickerPlacements);
      applyImportedSticker(nextPlacement);
    } catch (error) {
      console.warn('Sticker paste failed:', error);
      const alertTitle =
        error instanceof ClipboardStickerError && error.code === 'unavailable'
          ? t('capture.clipboardStickerUnavailableTitle', 'No sticker to paste')
          : error instanceof ClipboardStickerError && error.code === 'requires-update'
            ? t('capture.clipboardStickerRequiresUpdateTitle', 'Update required')
            : t('capture.error', 'Error');
      showAppAlert(
        alertTitle,
        error instanceof Error
          ? error.message
          : t('capture.clipboardStickerFailed', 'We could not paste that sticker right now.')
      );
    } finally {
      setImportingSticker(false);
    }
  }, [applyImportedSticker, dismissPastePrompt, importingSticker, stickerPlacements, t]);
  const handleShowCardPastePrompt = useCallback(
    async (event: GestureResponderEvent) => {
      if (
        !ENABLE_PHOTO_STICKERS ||
        importingSticker ||
        doodleModeEnabled ||
        stickerModeEnabled ||
        stickerPlacements.length > 0 ||
        interactionsDisabled
      ) {
        return;
      }

      const canPasteFromClipboard = await hasClipboardStickerImage();

      if (!canPasteFromClipboard) {
        dismissPastePrompt();
        return;
      }

      const locationX = typeof event.nativeEvent.locationX === 'number' ? event.nativeEvent.locationX : CARD_SIZE / 2;
      const locationY = typeof event.nativeEvent.locationY === 'number' ? event.nativeEvent.locationY : CARD_SIZE / 2;

      setPastePrompt({
        visible: true,
        x: locationX,
        y: locationY,
      });
      schedulePastePromptDismiss();
    },
    [
      dismissPastePrompt,
      doodleModeEnabled,
      importingSticker,
      interactionsDisabled,
      schedulePastePromptDismiss,
      stickerModeEnabled,
      stickerPlacements.length,
    ]
  );
  const handleConfirmPasteFromPrompt = useCallback(() => {
    dismissPastePrompt();
    void handlePasteStickerFromClipboard();
  }, [dismissPastePrompt, handlePasteStickerFromClipboard]);
  const handleCloseStickerSourceSheet = useCallback(() => {
    setShowStickerSourceSheet(false);
  }, []);
  const handleSelectStickerSourceClipboard = useCallback(() => {
    setShowStickerSourceSheet(false);
    void handlePasteStickerFromClipboard();
  }, [handlePasteStickerFromClipboard]);
  const handleSelectStickerSourcePhotos = useCallback(() => {
    setPendingStickerSourceAction('photos');
    setShowStickerSourceSheet(false);
  }, []);
  const handleShowStickerSourceOptions = useCallback(async () => {
    if (!ENABLE_PHOTO_STICKERS || importingSticker) {
      return;
    }

    dismissPastePrompt();
    const canPasteFromClipboard = await hasClipboardStickerImage();
    setStickerSourceCanPasteFromClipboard(canPasteFromClipboard);
    setShowStickerSourceSheet(true);
  }, [dismissPastePrompt, importingSticker]);
  const handleToggleStickerMode = useCallback(() => {
    if (!ENABLE_PHOTO_STICKERS) {
      return;
    }

    dismissPastePrompt();

    if (isPhotoDoodleSurface) {
      if (photoStickerModeEnabled) {
        setPhotoSelectedStickerId(null);
      }
      setPhotoDecorateMenuExpanded(true);
      setPhotoDoodleModeEnabled(false);
      setPhotoStickerModeEnabled((current) => !current);
      return;
    }

    if (textStickerModeEnabled) {
      setTextSelectedStickerId(null);
    }
    setTextDecorateMenuExpanded(true);
    setTextDoodleModeEnabled(false);
    setTextStickerModeEnabled((current) => !current);
  }, [dismissPastePrompt, isPhotoDoodleSurface, photoStickerModeEnabled, textStickerModeEnabled]);
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
  const handlePressStickerCanvas = useCallback(() => {
    if (!stickerModeEnabled) {
      return;
    }

    dismissPastePrompt();

    if (selectedStickerId) {
      handleSelectSticker(null);
      return;
    }

    if (isPhotoDoodleSurface) {
      setPhotoStickerModeEnabled(false);
      return;
    }

    setTextStickerModeEnabled(false);
  }, [
    dismissPastePrompt,
    handleSelectSticker,
    isPhotoDoodleSurface,
    selectedStickerId,
    stickerModeEnabled,
  ]);
  const handlePressOutsideCard = useCallback(() => {
    if (!showDecorateControls) {
      return;
    }

    dismissPastePrompt();

    if (isPhotoDoodleSurface) {
      setPhotoSelectedStickerId(null);
      setPhotoDoodleModeEnabled(false);
      setPhotoStickerModeEnabled(false);
      setPhotoDecorateMenuExpanded(false);
      return;
    }

    setTextSelectedStickerId(null);
    setTextDoodleModeEnabled(false);
    setTextStickerModeEnabled(false);
    setTextDecorateMenuExpanded(false);
  }, [dismissPastePrompt, isPhotoDoodleSurface, showDecorateControls]);
  const handleSelectedStickerAction = useCallback(
    (action: 'rotate-left' | 'rotate-right' | 'smaller' | 'larger' | 'duplicate' | 'front' | 'remove' | 'outline-toggle') => {
      if (!selectedStickerId) {
        return;
      }

      const currentPlacements = stickerPlacements;
      let nextPlacements = currentPlacements;

      if (action === 'duplicate') {
        nextPlacements = duplicateStickerPlacement(currentPlacements, selectedStickerId);
      } else if (action === 'front') {
        nextPlacements = bringStickerPlacementToFront(currentPlacements, selectedStickerId);
      } else if (action === 'outline-toggle') {
        const selectedPlacement = currentPlacements.find((placement) => placement.id === selectedStickerId);
        nextPlacements = selectedPlacement
          ? setStickerPlacementOutlineEnabled(
            currentPlacements,
            selectedStickerId,
            selectedPlacement.outlineEnabled === false
          )
          : currentPlacements;
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
  const captureGradient = getCaptureNoteGradient({ noteColor });
  const inlineColorGradient =
    getNoteColorCardGradient(noteColor ?? DEFAULT_NOTE_COLOR_ID) ??
    getNoteColorCardGradient(DEFAULT_NOTE_COLOR_ID) ??
    captureGradient;
  const handleOpenNoteColorSheet = useCallback(() => {
    if (!onChangeNoteColor) {
      return;
    }

    setShowNoteColorSheet(true);
  }, [onChangeNoteColor]);
  const handleCloseNoteColorSheet = useCallback(() => {
    setShowNoteColorSheet(false);
  }, []);
  const handleOpenRadiusSheet = useCallback(() => {
    setShowRadiusSheet(true);
  }, []);
  const handleCloseRadiusSheet = useCallback(() => {
    setShowRadiusSheet(false);
  }, []);
  const handleSelectNoteColor = useCallback(
    (nextColor: string | null) => {
      if (!onChangeNoteColor) {
        return;
      }

      onChangeNoteColor(nextColor ?? DEFAULT_NOTE_COLOR_ID);
      setShowNoteColorSheet(false);
    },
    [onChangeNoteColor]
  );
  const handleSelectRadius = useCallback(
    (nextRadius: number) => {
      onChangeRadius(nextRadius);
      setShowRadiusSheet(false);
    },
    [onChangeRadius]
  );

  useEffect(() => {
    if (captureMode !== 'text' || !onChangeNoteColor) {
      setShowNoteColorSheet(false);
    }
  }, [captureMode, onChangeNoteColor]);
  useEffect(() => {
    if (isSearching) {
      setShowRadiusSheet(false);
    }
  }, [isSearching]);

  const noteColorSheetBody = onChangeNoteColor ? (
    <AppSheetScaffold
      headerVariant="standard"
      title={t('capture.noteColor', 'Card color')}
      subtitle={t('capture.noteColorHint', 'Pick the gradient you want before saving this note.')}
      contentContainerStyle={styles.noteColorSheet}
    >
      <View>
        <NoteColorPicker
          selectedColor={noteColor ?? DEFAULT_NOTE_COLOR_ID}
          onSelectColor={handleSelectNoteColor}
          lockedColorIds={lockedNoteColorIds}
          previewOnlyColorIds={previewOnlyNoteColorIds}
          onLockedColorPress={onPressLockedNoteColor}
          testIDPrefix="capture-note-color"
          compact
        />
      </View>
    </AppSheetScaffold>
  ) : null;
  const radiusSheetBody = (
    <AppSheetScaffold
      headerVariant="standard"
      title={t('capture.radius', 'Radius')}
      subtitle={t(
        'capture.radiusPickerHint',
        'Pick how close you need to be.'
      )}
      contentContainerStyle={styles.radiusSheet}
      useHorizontalPadding={false}
    >
      <View>
        {NOTE_RADIUS_OPTIONS.map((option, index) => {
          const isSelected = radius === option;

          return (
            <View key={option}>
              <Pressable
                testID={`capture-radius-${option}`}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => handleSelectRadius(option)}
                style={({ pressed }) => [
                  styles.radiusSheetRow,
                  isSelected ? { backgroundColor: `${colors.primary}12` } : null,
                  pressed ? styles.radiusSheetRowPressed : null,
                ]}
              >
                <Text style={[styles.radiusSheetLabel, { color: colors.text }]}>
                  {formatRadiusLabel(option)}
                </Text>
                <Ionicons
                  name={isSelected ? 'radio-button-on' : 'radio-button-off-outline'}
                  size={20}
                  color={isSelected ? colors.primary : colors.secondaryText}
                />
              </Pressable>
              {index < NOTE_RADIUS_OPTIONS.length - 1 ? (
                <View style={[styles.radiusSheetDivider, { backgroundColor: colors.border }]} />
              ) : null}
            </View>
          );
        })}
      </View>
    </AppSheetScaffold>
  );
  return (
    <>
      <View style={[styles.snapItem, { height: snapHeight, paddingTop: topInset + 60 }]}>
        <Pressable
          testID="capture-decorate-dismiss-surface"
          accessible={false}
          pointerEvents={showDecorateControls && !interactionsDisabled ? 'auto' : 'none'}
          style={styles.decorateDismissSurface}
          onPress={handlePressOutsideCard}
        />
        <Reanimated.View style={keyboardLiftAnimatedStyle}>
          <Reanimated.View
            testID="capture-card-area"
            style={[
              styles.captureArea,
              disableAndroidTextTransforms ? null : captureAreaAnimatedStyle,
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
              <PremiumNoteFinishOverlay
                noteColor={noteColor}
                animated
                interactive={false}
                previewMode="editor"
              />
              {ENABLE_PHOTO_STICKERS ? (
                <Pressable
                  testID="capture-card-paste-surface"
                  style={styles.cardPasteSurface}
                  onLongPress={handleShowCardPastePrompt}
                  delayLongPress={320}
                />
              ) : null}
              <View pointerEvents="box-none" style={styles.cardTopOverlay}>
                <View style={styles.cardTopOverlayRow}>
                  <CaptureAnimatedPressable
                    testID="capture-decorate-toggle"
                    accessibilityLabel={t('capture.decorate', 'Decorate')}
                    onPress={handleToggleDecorateMenu}
                    hitSlop={10}
                    active={showDecorateControls}
                    activeScale={1}
                    activeTranslateY={0}
                    contentActiveScale={1}
                    style={[styles.textCardActionButton, styles.decorateToggleButton, animatedDecorateButtonStyle]}
                  >
                    <Reanimated.View style={animatedDecorateIconStyle}>
                      <Ionicons
                        name={showDecorateControls ? 'color-wand' : 'color-wand-outline'}
                        size={17}
                        color={showDecorateControls ? textCardActiveIconColor : colors.captureGlassText}
                      />
                    </Reanimated.View>
                    <Reanimated.View style={[styles.decorateChevronWrap, animatedDecorateChevronStyle]}>
                      <Ionicons
                        name="chevron-forward"
                        size={13}
                        color={showDecorateControls ? textCardActiveIconColor : colors.captureGlassIcon}
                      />
                    </Reanimated.View>
                  </CaptureAnimatedPressable>
                  <Reanimated.View
                    pointerEvents={showDecorateControls ? 'auto' : 'none'}
                    style={[styles.decorateControlsWrap, animatedDecorateControlsStyle]}
                  >
                    <View style={styles.decorateControlsInline}>
                      {doodleModeEnabled ? (
                        <Reanimated.View layout={decorateActionLayout} style={styles.textCardActionCluster}>
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
                            activeScale={DECORATE_OPTION_ACTIVE_SCALE}
                            activeTranslateY={0}
                            contentActiveScale={DECORATE_OPTION_CONTENT_SCALE}
                            contentActiveTranslateY={0}
                            style={styles.textCardActionButton}
                          />
                          <Reanimated.View
                            entering={decorateActionEntering}
                            exiting={decorateActionExiting}
                            layout={decorateActionLayout}
                          >
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
                          </Reanimated.View>
                          <Reanimated.View
                            entering={decorateActionEntering}
                            exiting={decorateActionExiting}
                            layout={decorateActionLayout}
                          >
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
                          </Reanimated.View>
                          <Reanimated.View
                            entering={decorateActionEntering}
                            exiting={decorateActionExiting}
                            layout={decorateActionLayout}
                          >
                            <DoodleColorPalette
                              colors={doodleColorOptions}
                              selectedColor={doodleColor}
                              onSelectColor={handleSelectDoodleColor}
                              buttonBackgroundColor={colors.captureGlassFill}
                              buttonBorderColor={colors.captureGlassBorder}
                              selectedBorderColor={colors.captureButtonBg}
                              swatchBorderColor="rgba(43,38,33,0.16)"
                              testIDPrefix="capture-doodle-color"
                            />
                          </Reanimated.View>
                        </Reanimated.View>
                      ) : stickerModeEnabled ? (
                        <Reanimated.View layout={decorateActionLayout} style={styles.textCardActionCluster}>
                          <CaptureToggleIconButton
                            testID="capture-sticker-toggle"
                            accessibilityHint={t(
                              'capture.stickerPasteHint',
                              'Tap to edit stickers. Tap + to add from Clipboard or Photos.'
                            )}
                            onPress={handleToggleStickerMode}
                            active={stickerModeEnabled}
                            activeIconName="images"
                            inactiveIconName="images-outline"
                            activeBackgroundColor={colors.captureButtonBg}
                            inactiveBackgroundColor={colors.captureGlassFill}
                            activeBorderColor="rgba(255,255,255,0.18)"
                            inactiveBorderColor={colors.captureGlassBorder}
                            activeIconColor={textCardActiveIconColor}
                            inactiveIconColor={colors.captureGlassText}
                            activeScale={DECORATE_OPTION_ACTIVE_SCALE}
                            activeTranslateY={0}
                            contentActiveScale={DECORATE_OPTION_CONTENT_SCALE}
                            contentActiveTranslateY={0}
                            style={styles.textCardActionButton}
                          />
                          <Reanimated.View
                            entering={decorateActionEntering}
                            exiting={decorateActionExiting}
                            layout={decorateActionLayout}
                          >
                            <CaptureAnimatedPressable
                              testID="capture-sticker-import"
                              onPress={() => {
                                void handleShowStickerSourceOptions();
                              }}
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
                          </Reanimated.View>
                          <Reanimated.View
                            entering={decorateActionEntering}
                            exiting={decorateActionExiting}
                            layout={decorateActionLayout}
                          >
                            <CaptureAnimatedPressable
                              testID="capture-sticker-outline-toggle"
                              accessibilityLabel={
                                selectedStickerOutlineEnabled
                                  ? t('capture.stickerOutlineDisable', 'Turn off outline')
                                  : t('capture.stickerOutlineEnable', 'Turn on outline')
                              }
                              onPress={() => handleSelectedStickerAction('outline-toggle')}
                              disabled={!selectedStickerId}
                              disabledOpacity={0.45}
                              style={[
                                styles.textCardActionPill,
                                {
                                  backgroundColor:
                                    selectedStickerId && selectedStickerOutlineEnabled
                                      ? colors.captureButtonBg
                                      : colors.captureGlassFill,
                                  borderColor:
                                    selectedStickerId && selectedStickerOutlineEnabled
                                      ? 'rgba(255,255,255,0.18)'
                                      : colors.captureGlassBorder,
                                },
                              ]}
                            >
                              <Ionicons
                                name={selectedStickerOutlineEnabled ? 'ellipse' : 'ellipse-outline'}
                                size={14}
                                color={
                                  selectedStickerId && selectedStickerOutlineEnabled
                                    ? textCardActiveIconColor
                                    : colors.captureGlassText
                                }
                              />
                            </CaptureAnimatedPressable>
                          </Reanimated.View>
                          <Reanimated.View
                            entering={decorateActionEntering}
                            exiting={decorateActionExiting}
                            layout={decorateActionLayout}
                          >
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
                          </Reanimated.View>
                        </Reanimated.View>
                      ) : (
                        <Reanimated.View layout={decorateActionLayout} style={styles.textCardActionCluster}>
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
                            activeScale={DECORATE_OPTION_ACTIVE_SCALE}
                            activeTranslateY={0}
                            contentActiveScale={DECORATE_OPTION_CONTENT_SCALE}
                            contentActiveTranslateY={0}
                            style={styles.textCardActionButton}
                          />
                          {ENABLE_PHOTO_STICKERS ? (
                            <CaptureToggleIconButton
                              testID="capture-sticker-toggle"
                              accessibilityHint={t(
                                'capture.stickerPasteHint',
                                'Tap to edit stickers. Tap + to add from Clipboard or Photos.'
                              )}
                              onPress={handleToggleStickerMode}
                              active={stickerModeEnabled}
                              activeIconName="images"
                              inactiveIconName="images-outline"
                              activeBackgroundColor={colors.captureButtonBg}
                              inactiveBackgroundColor={colors.captureGlassFill}
                              activeBorderColor="rgba(255,255,255,0.18)"
                              inactiveBorderColor={colors.captureGlassBorder}
                              activeIconColor={textCardActiveIconColor}
                              inactiveIconColor={colors.captureGlassText}
                              activeScale={DECORATE_OPTION_ACTIVE_SCALE}
                              activeTranslateY={0}
                              contentActiveScale={DECORATE_OPTION_CONTENT_SCALE}
                              contentActiveTranslateY={0}
                              style={styles.textCardActionButton}
                            />
                          ) : null}
                        </Reanimated.View>
                      )}
                    </View>
                  </Reanimated.View>
                </View>
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
                    onPressCanvas={handlePressStickerCanvas}
                  />
                </View>
              ) : null}
              <View pointerEvents={doodleModeEnabled ? 'auto' : 'none'} style={styles.doodleCanvasLayer}>
                <NoteDoodleCanvas
                  strokes={doodleStrokes}
                  editable={doodleModeEnabled}
                  activeColor={doodleColor}
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
                  onFocus={() => setIsNoteInputFocused(true)}
                  onBlur={() => setIsNoteInputFocused(false)}
                  maxLength={300}
                  selectionColor={colors.captureCardText}
                />
              </View>
              <StickerPastePopover
                visible={pastePrompt.visible}
                anchor={{ x: pastePrompt.x, y: pastePrompt.y }}
                containerWidth={CARD_SIZE}
                containerHeight={CARD_SIZE}
                label={t('capture.pasteStickerAction', 'Paste sticker')}
                description={t('capture.clipboardStickerReadyHint', 'Copied image will be added as a sticker.')}
                backgroundColor="rgba(255, 250, 242, 0.96)"
                borderColor={colors.captureGlassBorder}
                secondaryTextColor={colors.captureGlassIcon}
                buttonBackgroundColor={colors.captureButtonBg}
                buttonTextColor="#FFFDFC"
                onPress={handleConfirmPasteFromPrompt}
                onDismiss={dismissPastePrompt}
                popoverTestID="capture-card-paste-popover"
                actionTestID="capture-card-paste-action"
                dismissTestID="capture-card-paste-dismiss"
              />
            </LinearGradient>
          ) : capturedPhoto ? (
            <View style={[styles.cameraContainer, { backgroundColor: colors.captureCameraOverlay }]}>
              <Image source={{ uri: capturedPhoto }} style={styles.cameraPreview} contentFit="cover" />
              {ENABLE_PHOTO_STICKERS ? (
                <Pressable
                  testID="capture-card-paste-surface"
                  style={styles.cardPasteSurface}
                  onLongPress={handleShowCardPastePrompt}
                  delayLongPress={320}
                />
              ) : null}
              <View pointerEvents="box-none" style={styles.cardTopOverlay}>
                <View style={styles.cardTopOverlayRow}>
                  <CaptureAnimatedPressable
                    testID="capture-decorate-toggle"
                    accessibilityLabel={t('capture.decorate', 'Decorate')}
                    onPress={handleToggleDecorateMenu}
                    hitSlop={10}
                    active={showDecorateControls}
                    activeScale={1}
                    activeTranslateY={0}
                    contentActiveScale={1}
                    style={[
                      styles.cameraOverlayButton,
                      styles.textCardActionButton,
                      styles.decorateToggleButton,
                      animatedDecorateButtonStyle,
                    ]}
                  >
                    <Reanimated.View style={animatedDecorateIconStyle}>
                      <Ionicons
                        name={showDecorateControls ? 'color-wand' : 'color-wand-outline'}
                        size={17}
                        color={showDecorateControls ? photoPreviewActiveText : photoPreviewControlText}
                      />
                    </Reanimated.View>
                    <Reanimated.View style={[styles.decorateChevronWrap, animatedDecorateChevronStyle]}>
                      <Ionicons
                        name="chevron-forward"
                        size={13}
                        color={showDecorateControls ? photoPreviewActiveText : photoPreviewControlText}
                      />
                    </Reanimated.View>
                  </CaptureAnimatedPressable>
                  <Reanimated.View
                    pointerEvents={showDecorateControls ? 'auto' : 'none'}
                    style={[styles.decorateControlsWrap, animatedDecorateControlsStyle]}
                  >
                    <View pointerEvents="box-none" style={styles.decorateControlsInline}>
                      {doodleModeEnabled ? (
                        <Reanimated.View
                          pointerEvents="box-none"
                          layout={decorateActionLayout}
                          style={styles.photoDoodleActionsCluster}
                        >
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
                            activeScale={DECORATE_OPTION_ACTIVE_SCALE}
                            activeTranslateY={0}
                            contentActiveScale={DECORATE_OPTION_CONTENT_SCALE}
                            contentActiveTranslateY={0}
                            style={[
                              styles.cameraOverlayButton,
                              styles.photoDoodleIconButton,
                            ]}
                          />
                          <Reanimated.View
                            entering={decorateActionEntering}
                            exiting={decorateActionExiting}
                            layout={decorateActionLayout}
                          >
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
                          </Reanimated.View>
                          <Reanimated.View
                            entering={decorateActionEntering}
                            exiting={decorateActionExiting}
                            layout={decorateActionLayout}
                          >
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
                          </Reanimated.View>
                          <Reanimated.View
                            entering={decorateActionEntering}
                            exiting={decorateActionExiting}
                            layout={decorateActionLayout}
                          >
                            <DoodleColorPalette
                              colors={doodleColorOptions}
                              selectedColor={doodleColor}
                              onSelectColor={handleSelectDoodleColor}
                              buttonBackgroundColor={photoPreviewControlFill}
                              buttonBorderColor={photoPreviewControlBorder}
                              selectedBorderColor={photoPreviewActiveFill}
                              swatchBorderColor="rgba(43,38,33,0.16)"
                              testIDPrefix="capture-doodle-color"
                            />
                          </Reanimated.View>
                        </Reanimated.View>
                      ) : stickerModeEnabled ? (
                        <Reanimated.View
                          pointerEvents="box-none"
                          layout={decorateActionLayout}
                          style={styles.photoDoodleActionsCluster}
                        >
                          <CaptureToggleIconButton
                            testID="capture-sticker-toggle"
                            accessibilityLabel={stickerModeEnabled ? t('capture.doneStickers', 'Done') : t('capture.stickers', 'Stickers')}
                            accessibilityHint={t(
                              'capture.stickerPasteHint',
                              'Tap to edit stickers. Tap + to add from Clipboard or Photos.'
                            )}
                            onPress={handleToggleStickerMode}
                            active={stickerModeEnabled}
                            activeIconName="images"
                            inactiveIconName="images-outline"
                            activeBackgroundColor={photoPreviewActiveFill}
                            inactiveBackgroundColor={photoPreviewControlFill}
                            activeBorderColor={photoPreviewActiveFill}
                            inactiveBorderColor={photoPreviewControlBorder}
                            activeIconColor={photoPreviewActiveText}
                            inactiveIconColor={photoPreviewControlText}
                            activeScale={DECORATE_OPTION_ACTIVE_SCALE}
                            activeTranslateY={0}
                            contentActiveScale={DECORATE_OPTION_CONTENT_SCALE}
                            contentActiveTranslateY={0}
                            style={[
                              styles.cameraOverlayButton,
                              styles.photoDoodleIconButton,
                            ]}
                          />
                          <Reanimated.View
                            entering={decorateActionEntering}
                            exiting={decorateActionExiting}
                            layout={decorateActionLayout}
                          >
                            <CaptureAnimatedPressable
                              testID="capture-sticker-import"
                              onPress={() => {
                                void handleShowStickerSourceOptions();
                              }}
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
                          </Reanimated.View>
                          <Reanimated.View
                            entering={decorateActionEntering}
                            exiting={decorateActionExiting}
                            layout={decorateActionLayout}
                          >
                            <CaptureAnimatedPressable
                              testID="capture-sticker-outline-toggle"
                              accessibilityLabel={
                                selectedStickerOutlineEnabled
                                  ? t('capture.stickerOutlineDisable', 'Turn off outline')
                                  : t('capture.stickerOutlineEnable', 'Turn on outline')
                              }
                              onPress={() => handleSelectedStickerAction('outline-toggle')}
                              disabled={!selectedStickerId}
                              disabledOpacity={0.45}
                              style={[
                                styles.cameraOverlayButton,
                                styles.textCardActionPill,
                                {
                                  backgroundColor:
                                    selectedStickerId && selectedStickerOutlineEnabled
                                      ? photoPreviewActiveFill
                                      : photoPreviewControlFill,
                                  borderColor:
                                    selectedStickerId && selectedStickerOutlineEnabled
                                      ? photoPreviewActiveFill
                                      : photoPreviewControlBorder,
                                },
                              ]}
                            >
                              <Ionicons
                                name={selectedStickerOutlineEnabled ? 'ellipse' : 'ellipse-outline'}
                                size={14}
                                color={
                                  selectedStickerId && selectedStickerOutlineEnabled
                                    ? photoPreviewActiveText
                                    : photoPreviewControlText
                                }
                              />
                            </CaptureAnimatedPressable>
                          </Reanimated.View>
                          <Reanimated.View
                            entering={decorateActionEntering}
                            exiting={decorateActionExiting}
                            layout={decorateActionLayout}
                          >
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
                          </Reanimated.View>
                        </Reanimated.View>
                      ) : (
                        <Reanimated.View layout={decorateActionLayout} style={styles.textCardActionCluster}>
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
                            activeScale={DECORATE_OPTION_ACTIVE_SCALE}
                            activeTranslateY={0}
                            contentActiveScale={DECORATE_OPTION_CONTENT_SCALE}
                            contentActiveTranslateY={0}
                            style={[
                              styles.cameraOverlayButton,
                              styles.photoDoodleIconButton,
                            ]}
                          />
                          {ENABLE_PHOTO_STICKERS ? (
                            <CaptureToggleIconButton
                              testID="capture-sticker-toggle"
                              accessibilityLabel={stickerModeEnabled ? t('capture.doneStickers', 'Done') : t('capture.stickers', 'Stickers')}
                              accessibilityHint={t(
                                'capture.stickerPasteHint',
                                'Tap to edit stickers. Tap + to add from Clipboard or Photos.'
                              )}
                              onPress={handleToggleStickerMode}
                              active={stickerModeEnabled}
                              activeIconName="images"
                              inactiveIconName="images-outline"
                              activeBackgroundColor={photoPreviewActiveFill}
                              inactiveBackgroundColor={photoPreviewControlFill}
                              activeBorderColor={photoPreviewActiveFill}
                              inactiveBorderColor={photoPreviewControlBorder}
                              activeIconColor={photoPreviewActiveText}
                              inactiveIconColor={photoPreviewControlText}
                              activeScale={DECORATE_OPTION_ACTIVE_SCALE}
                              activeTranslateY={0}
                              contentActiveScale={DECORATE_OPTION_CONTENT_SCALE}
                              contentActiveTranslateY={0}
                              style={[
                                styles.cameraOverlayButton,
                                styles.photoDoodleIconButton,
                              ]}
                            />
                          ) : null}
                        </Reanimated.View>
                      )}
                    </View>
                  </Reanimated.View>
                </View>
              </View>
              {ENABLE_PHOTO_STICKERS && stickerPlacements.length > 0 ? (
                <View pointerEvents={stickerModeEnabled ? 'box-none' : 'none'} style={styles.doodleCanvasLayer}>
                  <NoteStickerCanvas
                    placements={stickerPlacements}
                    editable={stickerModeEnabled}
                    onChangePlacements={handleChangeStickerPlacements}
                    selectedPlacementId={selectedStickerId}
                    onChangeSelectedPlacementId={handleSelectSticker}
                    onPressCanvas={handlePressStickerCanvas}
                  />
                </View>
              ) : null}
              <View pointerEvents={doodleModeEnabled ? 'auto' : 'none'} style={styles.doodleCanvasLayer}>
                <NoteDoodleCanvas
                  strokes={doodleStrokes}
                  editable={doodleModeEnabled}
                  activeColor={doodleColor}
                  onChangeStrokes={setPhotoDoodleStrokes}
                />
              </View>
              <Reanimated.View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: colors.captureFlashOverlay, zIndex: 50 },
                  flashAnimatedStyle,
                ]}
              />
              <StickerPastePopover
                visible={pastePrompt.visible}
                anchor={{ x: pastePrompt.x, y: pastePrompt.y }}
                containerWidth={CARD_SIZE}
                containerHeight={CARD_SIZE}
                label={t('capture.pasteStickerAction', 'Paste sticker')}
                description={t('capture.clipboardStickerReadyHint', 'Copied image will be added as a sticker.')}
                backgroundColor="rgba(255, 250, 242, 0.96)"
                borderColor={photoPreviewControlBorder}
                secondaryTextColor={colors.captureGlassIcon}
                buttonBackgroundColor={colors.captureButtonBg}
                buttonTextColor="#FFFDFC"
                onPress={handleConfirmPasteFromPrompt}
                onDismiss={dismissPastePrompt}
                popoverTestID="capture-card-paste-popover"
                actionTestID="capture-card-paste-action"
                dismissTestID="capture-card-paste-dismiss"
              />
            </View>
          ) : needsCameraPermission ? (
            <View style={[styles.textCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="camera" size={48} color={colors.secondaryText} />
              <Text style={[styles.permissionText, { color: colors.text }]}>
                {cameraPermissionRequiresSettings
                  ? t(
                    'capture.cameraPermissionSettingsMsg',
                    'Camera access is blocked for Noto. Open Settings to take photos.'
                  )
                  : t('capture.cameraPermission', 'Camera access needed')}
              </Text>
              <PrimaryButton
                label={
                  cameraPermissionRequiresSettings
                    ? t('common.openSettings', 'Open Settings')
                    : t('capture.grantAccess', 'Grant Access')
                }
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
                      restartCameraPreview(true);
                    }}
                    style={styles.cameraRetryButton}
                  />
                </View>
              ) : (
                <>
                  {captureMode === 'camera' && shouldRenderCameraPreview ? (
                    <GestureDetector gesture={cameraZoomGesture}>
                      <View style={styles.cameraGestureLayer}>
                        <CameraView
                          key={`camera-session-${cameraSessionKey}-${cameraRetryNonce}-${facing}`}
                          style={styles.cameraPreview}
                          facing={facing}
                          zoom={cameraZoom}
                          active={canShowLiveCameraPreview}
                          ref={cameraRef}
                          onCameraReady={() => {
                            cameraAutoRecoveryCountRef.current = 0;
                            setCameraUnavailable(false);
                            setCameraIssueDetail(null);
                            setIsCameraReady(true);
                          }}
                          onMountError={(error) => {
                            handleCameraStartupFailure(error.message);
                          }}
                        />
                      </View>
                    </GestureDetector>
                  ) : null}
                  {shouldRenderCameraPreview && !isCameraReady ? (
                    <View pointerEvents="none" style={styles.cameraLoadingOverlay}>
                      <ActivityIndicator size="small" color={colors.captureCameraOverlayText} />
                    </View>
                  ) : null}
                  {showCameraZoomBadge && shouldRenderCameraPreview ? (
                    <View pointerEvents="none" style={styles.cameraZoomBadge}>
                      <Text style={[styles.cameraZoomBadgeText, { color: colors.captureCameraOverlayText }]}>
                        {cameraZoomLabel}
                      </Text>
                    </View>
                  ) : null}
                </>
              )}
              <Reanimated.View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: colors.captureFlashOverlay, zIndex: 50 },
                  flashAnimatedStyle,
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
            </View>
          )}
          </Reanimated.View>

          <Reanimated.View
            style={[
              styles.belowCardSection,
              belowCardAnimatedStyle,
            ]}
            pointerEvents={interactionsDisabled ? 'none' : 'auto'}
          >
          {cameraStatusText ? (
            <Text style={[styles.cameraStatusText, { color: colors.secondaryText }]}>{cameraStatusText}</Text>
          ) : null}
          <View style={styles.belowCardMetaRow}>
            <View style={styles.captureMetaStack}>
              {captureMode === 'text' ? (
                <View style={[styles.cardRestaurantPill, styles.captureMetaComposite, { borderColor: colors.captureGlassBorder }]}>
                  {isOlderIOS ? (
                    <View
                      style={[
                        StyleSheet.absoluteFill,
                        {
                          backgroundColor: colors.captureGlassFill,
                          borderRadius: Radii.pill,
                        },
                      ]}
                    />
                  ) : null}
                  <GlassView
                    pointerEvents="none"
                    style={StyleSheet.absoluteFill}
                    glassEffectStyle="regular"
                    colorScheme={colors.captureGlassColorScheme}
                  />
                  <View style={styles.captureMetaInputWrap}>
                    <Ionicons
                      name="restaurant-outline"
                      size={13}
                      color={colors.captureGlassIcon}
                    />
                    <TextInput
                      testID="capture-restaurant-input"
                      style={[styles.cardRestaurantInput, styles.cardRestaurantInputCompact, { color: colors.captureGlassText }]}
                      placeholder={t('capture.restaurantPlaceholder', 'Restaurant name (e.g. Phở Hòa)')}
                      placeholderTextColor={colors.captureGlassPlaceholder}
                      value={restaurantName}
                      onChangeText={onChangeRestaurantName}
                      onFocus={() => setIsRestaurantInputFocused(true)}
                      onBlur={() => setIsRestaurantInputFocused(false)}
                      maxLength={100}
                      selectionColor={colors.captureGlassText}
                    />
                  </View>
                  <View style={[styles.captureMetaDivider, { backgroundColor: colors.captureGlassBorder }]} />
                  <View style={styles.captureMetaActions}>
                    <CaptureToggleIconButton
                      testID="capture-share-target-toggle"
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSharedTarget }}
                      accessibilityLabel={isSharedTarget ? t('shared.captureShared', 'Friends') : t('shared.capturePrivate', 'Just me')}
                      onPress={() => onChangeShareTarget(shareTarget === 'private' ? 'shared' : 'private')}
                      hitSlop={10}
                      active={isSharedTarget}
                      activeIconName="people-outline"
                      inactiveIconName="lock-closed-outline"
                      activeBackgroundColor={sharedTargetHighlightBackground}
                      inactiveBackgroundColor={colors.captureGlassFill}
                      activeBorderColor={sharedTargetHighlightBorder}
                      inactiveBorderColor={colors.captureGlassBorder}
                      activeIconColor={sharedTargetHighlightIcon}
                      inactiveIconColor={colors.captureGlassText}
                      iconSize={15}
                      activeScale={1.015}
                      contentActiveScale={1.03}
                      style={styles.captureInlineShareButton}
                    />
                    <CaptureAnimatedPressable
                      testID="capture-radius-toggle"
                      accessibilityRole="button"
                      accessibilityLabel={`${t('capture.radiusLabel', 'Reminder radius')}: ${formatRadiusLabel(radius)}`}
                      onPress={handleOpenRadiusSheet}
                      hitSlop={10}
                      style={[
                        styles.captureInlineRadiusButton,
                        {
                          backgroundColor: colors.captureGlassFill,
                          borderColor: colors.captureGlassBorder,
                        },
                      ]}
                    >
                      <Ionicons name="radio-outline" size={16} color={colors.captureGlassText} />
                    </CaptureAnimatedPressable>
                    {onChangeNoteColor ? (
                      <CaptureAnimatedPressable
                        testID="capture-note-color-toggle"
                        accessibilityRole="button"
                        accessibilityLabel={t('capture.noteColor', 'Card color')}
                        onPress={handleOpenNoteColorSheet}
                        hitSlop={10}
                        style={[
                          styles.captureInlineColorButton,
                          {
                            backgroundColor: colors.captureGlassFill,
                            borderColor: colors.captureGlassBorder,
                          },
                        ]}
                      >
                        <LinearGradient
                          colors={inlineColorGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.captureInlineColorPreview}
                        />
                      </CaptureAnimatedPressable>
                    ) : null}
                  </View>
                </View>
              ) : (
                <CaptureAnimatedPressable
                  testID="capture-radius-toggle"
                  accessibilityRole="button"
                  accessibilityLabel={`${t('capture.radiusLabel', 'Reminder radius')}: ${formatRadiusLabel(radius)}`}
                  onPress={handleOpenRadiusSheet}
                  hitSlop={10}
                  childrenContainerStyle={styles.captureStandaloneRadiusButtonContent}
                  style={[
                    styles.captureStandaloneRadiusButton,
                    {
                      borderColor: colors.captureGlassBorder,
                      backgroundColor: isOlderIOS ? colors.captureGlassFill : 'transparent',
                    },
                  ]}
                >
                  {!isOlderIOS ? (
                    <GlassView
                      pointerEvents="none"
                      style={StyleSheet.absoluteFill}
                      glassEffectStyle="regular"
                      colorScheme={colors.captureGlassColorScheme}
                    />
                  ) : null}
                  <Ionicons name="radio-outline" size={16} color={colors.captureGlassIcon} />
                </CaptureAnimatedPressable>
              )}
            </View>
          </View>
          {captureMode === 'camera' && !capturedPhoto ? (
            <View style={styles.belowCardShutterRow}>
              {permissionGranted ? (
                <CaptureGlassActionButton
                  accessibilityLabel={t('notes.viewAllButton', 'View all notes')}
                  onPress={onOpenNotes}
                  iconName="grid-outline"
                  iconColor={colors.captureGlassText}
                  glassColorScheme={colors.captureGlassColorScheme}
                  fallbackColor={colors.card}
                  borderColor={colors.captureGlassBorder}
                  style={[
                    styles.belowCardLeadingAction,
                  ]}
                />
              ) : (
                <View style={[styles.belowCardSideActionSpacer, styles.belowCardLeadingAction]} />
              )}
              {permissionGranted ? (
                <CaptureAnimatedPressable
                  onPressIn={onShutterPressIn}
                  onPressOut={onShutterPressOut}
                  onPress={onTakePicture}
                  pressedScale={0.985}
                  style={[styles.shutterOuter, { borderColor: colors.border }]}
                >
                  <Reanimated.View
                    style={[
                      styles.shutterInner,
                      {
                        backgroundColor: colors.primary,
                      },
                      shutterInnerAnimatedStyle,
                    ]}
                  >
                    {typeof remainingPhotoSlots === 'number' && remainingPhotoSlots > 0 ? (
                      <Text style={styles.shutterInnerCountText}>{remainingPhotoSlots}</Text>
                    ) : null}
                  </Reanimated.View>
                </CaptureAnimatedPressable>
              ) : null}
              {!showCameraUnavailableState && permissionGranted ? (
                <CaptureGlassActionButton
                  accessibilityLabel={t('capture.switchCamera', 'Switch camera')}
                  onPress={onToggleFacing}
                  iconName="camera-reverse"
                  iconColor={colors.captureGlassText}
                  glassColorScheme={colors.captureGlassColorScheme}
                  fallbackColor={colors.card}
                  borderColor={colors.captureGlassBorder}
                  style={[
                    styles.belowCardTrailingAction,
                  ]}
                />
              ) : (
                <View style={[styles.belowCardSideActionSpacer, styles.belowCardTrailingAction]} />
              )}
            </View>
          ) : capturedPhoto ? (
            <View style={[styles.belowCardShutterRow, styles.belowCardCapturedPhotoActions]}>
              <CaptureGlassActionButton
                accessibilityLabel={t('notes.viewAllButton', 'View all notes')}
                onPress={onOpenNotes}
                iconName="grid-outline"
                iconColor={colors.captureGlassText}
                glassColorScheme={colors.captureGlassColorScheme}
                fallbackColor={colors.card}
                borderColor={colors.captureGlassBorder}
                style={[
                  styles.belowCardLeadingAction,
                ]}
              />
              <CaptureAnimatedPressable
                testID="capture-save-button"
                onPress={onSaveNote}
                onPressIn={handleSavePressIn}
                onPressOut={handleSavePressOut}
                disabled={isSaveBusy || isSaveSuccessful}
                pressedScale={0.985}
                disabledOpacity={isSaveBusy ? 0.72 : 1}
                style={[
                  styles.shutterOuter,
                  {
                    borderColor: colors.border,
                  },
                ]}
              >
                <Reanimated.View style={savePressAnimatedStyle}>
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
                </Reanimated.View>
              </CaptureAnimatedPressable>

              <CaptureGlassActionButton
                testID="capture-retake-button"
                accessibilityLabel={t('capture.retake', 'Retake')}
                onPress={onRetakePhoto}
                disabled={isSaveBusy || isSaveSuccessful}
                disabledOpacity={0.55}
                iconName="refresh"
                iconColor={colors.captureGlassText}
                glassColorScheme={colors.captureGlassColorScheme}
                fallbackColor={colors.card}
                borderColor={colors.captureGlassBorder}
                style={[
                  styles.belowCardTrailingAction,
                ]}
              />
            </View>
          ) : (
            <View style={styles.belowCardShutterRow}>
              <CaptureGlassActionButton
                accessibilityLabel={t('notes.viewAllButton', 'View all notes')}
                onPress={onOpenNotes}
                iconName="grid-outline"
                iconColor={colors.captureGlassText}
                glassColorScheme={colors.captureGlassColorScheme}
                fallbackColor={colors.card}
                borderColor={colors.captureGlassBorder}
                style={[
                  styles.belowCardLeadingAction,
                ]}
              />
              <CaptureAnimatedPressable
                testID="capture-save-button"
                onPress={onSaveNote}
                onPressIn={handleSavePressIn}
                onPressOut={handleSavePressOut}
                disabled={isSaveBusy || isSaveSuccessful}
                pressedScale={0.985}
                disabledOpacity={isSaveBusy ? 0.72 : 1}
                style={[
                  styles.shutterOuter,
                  {
                    borderColor: colors.border,
                  },
                ]}
              >
                <Reanimated.View style={savePressAnimatedStyle}>
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
                </Reanimated.View>
              </CaptureAnimatedPressable>
              <View style={[styles.belowCardSideActionSpacer, styles.belowCardTrailingAction]} />
            </View>
          )}
          {footerContent ? <View style={styles.footerSlot}>{footerContent}</View> : null}
          </Reanimated.View>
        </Reanimated.View>
      </View>
      <StickerSourceSheet
        visible={showStickerSourceSheet}
        canPasteFromClipboard={stickerSourceCanPasteFromClipboard}
        title={t('capture.addStickerTitle', 'Add sticker')}
        pasteLabel={t('capture.pasteStickerFromClipboard', 'Paste from Clipboard')}
        photoLabel={t('capture.chooseStickerFromPhotos', 'Choose from Photos')}
        cancelLabel={t('common.cancel', 'Cancel')}
        onSelectClipboard={handleSelectStickerSourceClipboard}
        onSelectPhotos={handleSelectStickerSourcePhotos}
        onClose={handleCloseStickerSourceSheet}
      />
      {noteColorSheetBody ? (
        <AppSheet
          visible={showNoteColorSheet}
          onClose={handleCloseNoteColorSheet}
          iosColorScheme={colors.captureGlassColorScheme}
        >
          {noteColorSheetBody}
        </AppSheet>
      ) : null}
      <AppSheet
        visible={showRadiusSheet}
        onClose={handleCloseRadiusSheet}
        iosColorScheme={colors.captureGlassColorScheme}
        topInset={topInset}
      >
        {radiusSheetBody}
      </AppSheet>
    </>
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
  decorateDismissSurface: {
    ...StyleSheet.absoluteFillObject,
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
  cardPasteSurface: {
    ...StyleSheet.absoluteFill,
    zIndex: 0,
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
    width: 50,
    height: 40,
    paddingHorizontal: 0,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  decorateChevronWrap: {
    width: 13,
    height: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decorateControlsWrap: {
    overflow: 'hidden',
    height: TOP_CONTROL_HEIGHT,
    justifyContent: 'center',
  },
  decorateControlsInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  textCardActionPill: {
    width: TOP_CONTROL_HEIGHT,
    height: TOP_CONTROL_HEIGHT,
    borderRadius: TOP_CONTROL_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doodleColorPalette: {
    width: 96,
    overflow: 'hidden',
  },
  doodleColorPaletteScroll: {
    flexGrow: 0,
  },
  doodleColorPaletteContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 4,
  },
  doodleColorButton: {
    width: TOP_CONTROL_HEIGHT,
    height: TOP_CONTROL_HEIGHT,
    borderRadius: TOP_CONTROL_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doodleColorSwatch: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
  },
  doodleCanvasLayer: {
    ...StyleSheet.absoluteFill,
    ...DOODLE_ARTBOARD_FRAME,
    zIndex: 2,
  },
  textStickerCanvasLayer: {
    ...StyleSheet.absoluteFill,
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
    minHeight: 42,
    paddingHorizontal: 10,
    paddingVertical: 0,
    borderRadius: Radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
    zIndex: 3,
  },
  cardRestaurantPillBelow: {
    marginTop: 0,
  },
  captureMetaComposite: {
    width: '100%',
    maxWidth: 344,
    alignSelf: 'center',
    paddingHorizontal: 8,
    gap: 0,
  },
  captureMetaStack: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },
  captureMetaInputWrap: {
    flex: 1,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  captureMetaActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  cardRestaurantInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
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
    marginHorizontal: 5,
    opacity: 0.45,
  },
  captureInlineShareButton: {
    width: 31,
    height: 31,
    borderRadius: 15.5,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInlineRadiusButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInlineColorButton: {
    width: 31,
    height: 31,
    borderRadius: 15.5,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInlineColorPreview: {
    width: 18,
    height: 18,
    borderRadius: 9,
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
    ...StyleSheet.absoluteFill,
  },
  cameraGestureLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  cameraLoadingOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  cameraZoomBadge: {
    position: 'absolute',
    top: TOP_CONTROL_INSET,
    right: 16,
    minWidth: 58,
    minHeight: TOP_CONTROL_HEIGHT,
    paddingHorizontal: 12,
    borderRadius: TOP_CONTROL_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(28,28,30,0.52)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    zIndex: 10,
  },
  cameraZoomBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'System',
  },
  cameraUnavailableState: {
    ...StyleSheet.absoluteFill,
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
    paddingTop: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 78,
    gap: 10,
  },
  belowCardMetaRow: {
    width: '100%',
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  captureStandaloneRadiusButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureStandaloneRadiusButtonContent: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
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
  belowCardLeadingAction: {
    position: 'absolute',
    left: '50%',
    marginLeft: -SHUTTER_SIDE_ACTION_OFFSET,
  },
  belowCardTrailingAction: {
    position: 'absolute',
    left: '50%',
    marginLeft: SHUTTER_OUTER_SIZE / 2 + 12,
  },
  belowCardSideActionSpacer: {
    width: SIDE_ACTION_SIZE,
    height: SIDE_ACTION_SIZE,
  },
  secondaryActionButton: {
    width: SIDE_ACTION_SIZE,
    height: SIDE_ACTION_SIZE,
    borderRadius: SIDE_ACTION_SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionButtonContent: {
    width: '100%',
    height: '100%',
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
    ...StyleSheet.absoluteFill,
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
  noteColorSheet: {
    gap: 12,
  },
  noteColorPreviewHint: {
    marginTop: 12,
    textAlign: 'left',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  radiusSheet: {
    gap: 12,
  },
  radiusSheetRow: {
    minHeight: 60,
    paddingHorizontal: Sheet.android.horizontalPadding,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  radiusSheetRowPressed: {
    opacity: 0.9,
  },
  radiusSheetLabel: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'System',
  },
  radiusSheetDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Sheet.android.horizontalPadding,
  },
});
