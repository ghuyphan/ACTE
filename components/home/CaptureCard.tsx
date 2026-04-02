import { Ionicons } from '@expo/vector-icons';
import {
  Canvas,
  ColorMatrix,
  Group,
  Image as SkiaImage,
  Paint,
  Path as SkiaPath,
  Skia,
  useImage as useSkiaImage,
} from '@shopify/react-native-skia';
import {
  ClipboardPasteButton,
  addClipboardListener,
  isPasteButtonAvailable,
  type PasteEventPayload,
  type Subscription,
} from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { TFunction } from 'i18next';
import { type ComponentProps, forwardRef, memo, ReactNode, RefObject, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { Camera, type CameraDevice } from 'react-native-vision-camera';
import Reanimated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { showAppAlert } from '../../utils/alert';
import { STICKER_ARTBOARD_FRAME } from '../../constants/doodleLayout';
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
  setStickerPlacementMotionLocked,
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
  importStickerAssetFromClipboardImageData,
} from '../../utils/stickerClipboard';
import {
  getPhotoFilterPreset,
  PHOTO_FILTER_PRESETS,
  type PhotoFilterId,
} from '../../services/photoFilters';
import AppSheet from '../sheets/AppSheet';
import AppSheetScaffold from '../sheets/AppSheetScaffold';
import NoteDoodleCanvas, { DoodleStroke } from '../notes/NoteDoodleCanvas';
import PhotoMediaView from '../notes/PhotoMediaView';
import NoteStickerCanvas from '../notes/NoteStickerCanvas';
import StickerSourceSheet from '../sheets/StickerSourceSheet';
import { GlassView } from '../ui/GlassView';
import NoteColorPicker from '../ui/NoteColorPicker';
import PremiumNoteFinishOverlay from '../ui/PremiumNoteFinishOverlay';
import PrimaryButton from '../ui/PrimaryButton';
import StickerPastePopover from '../ui/StickerPastePopover';
import LivePhotoIcon from '../ui/LivePhotoIcon';
import { LIVE_PHOTO_MAX_DURATION_SECONDS } from '../../services/livePhotoProcessing';

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
const CAMERA_TRANSITION_FADE_IN_MS = 140;
const CAMERA_TRANSITION_FADE_OUT_MS = 240;
const CAPTURE_BUTTON_PRESS_IN = { duration: 120, easing: Easing.out(Easing.quad) };
const CAPTURE_BUTTON_PRESS_OUT = { duration: 160, easing: Easing.out(Easing.cubic) };
const CAPTURE_BUTTON_STATE_IN = { duration: 160, easing: Easing.out(Easing.cubic) };
const CAPTURE_BUTTON_STATE_OUT = { duration: 210, easing: Easing.out(Easing.cubic) };
const LIVE_PHOTO_RING_SIZE = SHUTTER_OUTER_SIZE;
const LIVE_PHOTO_RING_STROKE_WIDTH = 4;
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

function triggerCaptureCardHaptic(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  void Haptics.impactAsync(style);
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

function getClipboardStickerMessages(t: TFunction) {
  return {
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
    permissionDenied: t(
      'capture.clipboardStickerPermissionDeniedMsg',
      'This device will not let Noto read that clipboard image right now. Try copying it again, or import it from Photos instead.'
    ),
  };
}

function getClipboardStickerAlertTitle(t: TFunction, error: unknown) {
  if (error instanceof ClipboardStickerError && error.code === 'unavailable') {
    return t('capture.clipboardStickerUnavailableTitle', 'No sticker to paste');
  }

  if (error instanceof ClipboardStickerError && error.code === 'requires-update') {
    return t('capture.clipboardStickerRequiresUpdateTitle', 'Update required');
  }

  if (error instanceof ClipboardStickerError && error.code === 'permission-denied') {
    return t('capture.clipboardStickerPermissionDeniedTitle', 'Paste blocked');
  }

  return t('capture.error', 'Error');
}

export interface CaptureCardHandle {
  getDoodleSnapshot: () => { enabled: boolean; strokes: DoodleStroke[] };
  getStickerSnapshot: () => { enabled: boolean; placements: NoteStickerPlacement[] };
  resetDoodle: () => void;
  resetStickers: () => void;
  closeDecorateControls: () => void;
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
  hapticStyle?: Haptics.ImpactFeedbackStyle | null;
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
  hapticStyle = Haptics.ImpactFeedbackStyle.Light,
  onPress,
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

  const handlePress = useCallback<NonNullable<PressableProps['onPress']>>(
    (event) => {
      if (!disabled && hapticStyle != null) {
        triggerCaptureCardHaptic(hapticStyle);
      }
      onPress?.(event);
    },
    [disabled, hapticStyle, onPress]
  );

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPress={handlePress}
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

type FilteredPhotoCanvasProps = {
  sourceUri: string;
  filterId: PhotoFilterId;
  width: number;
  height: number;
  style?: StyleProp<ViewStyle>;
};

const FilteredPhotoCanvas = memo(function FilteredPhotoCanvas({
  sourceUri,
  filterId,
  width,
  height,
  style,
}: FilteredPhotoCanvasProps) {
  const image = useSkiaImage(sourceUri);
  const filterPreset = getPhotoFilterPreset(filterId);

  if (!image) {
    return <View style={style} />;
  }

  return (
    <Canvas style={style}>
      <Group
        layer={
          filterPreset.id === 'original'
            ? undefined
            : (
              <Paint>
                <ColorMatrix matrix={filterPreset.matrix} />
              </Paint>
            )
        }
      >
        <SkiaImage
          image={image}
          x={0}
          y={0}
          width={width}
          height={height}
          fit="cover"
        />
      </Group>
    </Canvas>
  );
});

function PhotoFilterSwatch({
  sourceUri,
  filterId,
}: {
  sourceUri: string;
  filterId: PhotoFilterId;
}) {
  return (
    <FilteredPhotoCanvas
      sourceUri={sourceUri}
      filterId={filterId}
      width={34}
      height={34}
      style={styles.photoFilterPreviewCanvas}
    />
  );
}

type PhotoFilterCarouselProps = {
  sourceUri: string;
  selectedFilterId: PhotoFilterId;
  onSelectFilter: (filterId: PhotoFilterId) => void;
  t: TFunction;
  colors: Pick<ThemeColors, 'captureGlassFill' | 'captureGlassBorder' | 'captureGlassText' | 'primary'>;
};

function PhotoFilterCarousel({
  sourceUri,
  selectedFilterId,
  onSelectFilter,
  t,
  colors,
}: PhotoFilterCarouselProps) {
  return (
    <View
      style={[
        styles.photoFilterTray,
        {
          borderColor: colors.captureGlassBorder,
          backgroundColor: colors.captureGlassFill,
        },
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.photoFilterRow}
      >
        {PHOTO_FILTER_PRESETS.map((preset) => {
          const isSelected = preset.id === selectedFilterId;

          return (
            <CaptureAnimatedPressable
              key={preset.id}
              testID={`capture-filter-${preset.id}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={t(preset.labelKey, preset.defaultLabel)}
              onPress={() => onSelectFilter(preset.id)}
              pressedScale={0.985}
              style={[
                styles.photoFilterButton,
                {
                  borderColor: isSelected ? colors.primary : colors.captureGlassBorder,
                  backgroundColor: colors.captureGlassFill,
                },
              ]}
            >
              <View style={styles.photoFilterPreviewClip}>
                <PhotoFilterSwatch sourceUri={sourceUri} filterId={preset.id} />
              </View>
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
  isModeSwitchAnimating?: boolean;
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
  capturedPairedVideo?: string | null;
  onRetakePhoto: () => void;
  onImportMotionClip?: () => void;
  onRemoveMotionClip?: () => void;
  needsCameraPermission: boolean;
  cameraPermissionRequiresSettings?: boolean;
  onRequestCameraPermission: () => void;
  facing: 'back' | 'front';
  onToggleFacing: () => void;
  onOpenPhotoLibrary: () => void;
  selectedPhotoFilterId: PhotoFilterId;
  onChangePhotoFilter: (filterId: PhotoFilterId) => void;
  cameraRef: RefObject<Camera | null>;
  cameraDevice?: CameraDevice;
  isCameraPreviewActive: boolean;
  flashAnim: SharedValue<number>;
  permissionGranted: boolean;
  onShutterPressIn: () => void;
  onShutterPressOut: () => void;
  onTakePicture: () => void;
  onStartLivePhotoCapture?: () => void;
  onSaveNote: () => void;
  saving: boolean;
  saveState?: 'idle' | 'saving' | 'success';
  shutterScale: SharedValue<number>;
  isLivePhotoCaptureInProgress?: boolean;
  isLivePhotoCaptureSettling?: boolean;
  isLivePhotoSaveGuardActive?: boolean;
  cameraStatusText?: string | null;
  cameraInstructionText?: string | null;
  remainingPhotoSlots?: number | null;
  libraryImportLocked?: boolean;
  importingPhoto?: boolean;
  radius: number;
  onChangeRadius: (nextRadius: number) => void;
  shareTarget: 'private' | 'shared';
  onChangeShareTarget: (nextTarget: 'private' | 'shared') => void;
  onDoodleModeChange?: (enabled: boolean) => void;
  onInteractionLockChange?: (locked: boolean) => void;
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
  isModeSwitchAnimating = false,
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
  capturedPairedVideo = null,
  onRetakePhoto,
  onImportMotionClip = () => undefined,
  onRemoveMotionClip = () => undefined,
  needsCameraPermission,
  cameraPermissionRequiresSettings = false,
  onRequestCameraPermission,
  facing,
  onToggleFacing,
  onOpenPhotoLibrary,
  selectedPhotoFilterId,
  onChangePhotoFilter,
  cameraRef,
  cameraDevice,
  isCameraPreviewActive,
  flashAnim,
  permissionGranted,
  onShutterPressIn,
  onShutterPressOut,
  onTakePicture,
  onStartLivePhotoCapture = () => undefined,
  onSaveNote,
  saving,
  saveState = 'idle',
  shutterScale,
  isLivePhotoCaptureInProgress = false,
  isLivePhotoCaptureSettling = false,
  isLivePhotoSaveGuardActive = false,
  cameraStatusText,
  cameraInstructionText = null,
  remainingPhotoSlots,
  libraryImportLocked = false,
  importingPhoto = false,
  radius,
  onChangeRadius,
  shareTarget,
  onChangeShareTarget,
  onDoodleModeChange,
  onInteractionLockChange,
  footerContent,
}, ref) {
  const reduceMotionEnabled = useReducedMotion();
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraUnavailable, setCameraUnavailable] = useState(false);
  const shutterLongPressTriggeredRef = useRef(false);
  const [livePhotoCountdownSeconds, setLivePhotoCountdownSeconds] = useState(LIVE_PHOTO_MAX_DURATION_SECONDS);
  const [livePhotoRingProgress, setLivePhotoRingProgress] = useState(0);
  const [showNoteColorSheet, setShowNoteColorSheet] = useState(false);
  const [showRadiusSheet, setShowRadiusSheet] = useState(false);
  const [cameraIssueDetail, setCameraIssueDetail] = useState<string | null>(null);
  const [cameraRetryNonce, setCameraRetryNonce] = useState(0);
  const [cameraActivationNonce, setCameraActivationNonce] = useState(0);
  const [cameraZoom, setCameraZoom] = useState(0);
  const [showCameraZoomBadge, setShowCameraZoomBadge] = useState(false);
  const [doodleModeEnabled, setDoodleModeEnabled] = useState(false);
  const [stickerModeEnabled, setStickerModeEnabled] = useState(false);
  const [textDoodleStrokes, setTextDoodleStrokes] = useState<DoodleStroke[]>([]);
  const [photoDoodleStrokes, setPhotoDoodleStrokes] = useState<DoodleStroke[]>([]);
  const [textDoodleColor, setTextDoodleColor] = useState(colors.captureCardText);
  const [photoDoodleColor, setPhotoDoodleColor] = useState(PHOTO_DOODLE_DEFAULT_COLOR);
  const [textStickerPlacements, setTextStickerPlacements] = useState<NoteStickerPlacement[]>([]);
  const [photoStickerPlacements, setPhotoStickerPlacements] = useState<NoteStickerPlacement[]>([]);
  const [textSelectedStickerId, setTextSelectedStickerId] = useState<string | null>(null);
  const [photoSelectedStickerId, setPhotoSelectedStickerId] = useState<string | null>(null);
  const [importingSticker, setImportingSticker] = useState(false);
  const [showStickerSourceSheet, setShowStickerSourceSheet] = useState(false);
  const [pendingStickerSourceAction, setPendingStickerSourceAction] = useState<'photos' | null>(null);
  const [stickerSourceCanPasteFromClipboard, setStickerSourceCanPasteFromClipboard] = useState(false);
  const [inlinePasteCanPasteFromClipboard, setInlinePasteCanPasteFromClipboard] = useState(false);
  const [inlinePasteLoading, setInlinePasteLoading] = useState(false);
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
  const isCameraCaptureSurface = captureMode === 'camera';
  const isPhotoDoodleSurface = isCameraCaptureSurface && Boolean(capturedPhoto);
  const doodleStrokes = isCameraCaptureSurface ? photoDoodleStrokes : textDoodleStrokes;
  const doodleColor = isCameraCaptureSurface ? photoDoodleColor : textDoodleColor;
  const stickerPlacements = isCameraCaptureSurface ? photoStickerPlacements : textStickerPlacements;
  const selectedStickerId = isCameraCaptureSurface ? photoSelectedStickerId : textSelectedStickerId;
  const selectedStickerPlacement = useMemo(
    () => stickerPlacements.find((placement) => placement.id === selectedStickerId) ?? null,
    [selectedStickerId, stickerPlacements]
  );
  const selectedStickerOutlineEnabled = selectedStickerPlacement?.outlineEnabled !== false;
  const selectedStickerMotionLocked = selectedStickerPlacement?.motionLocked === true;
  const textDoodleColors = useMemo(
    () => getUniqueColors([colors.captureCardText, PHOTO_DOODLE_DEFAULT_COLOR, colors.primary]),
    [colors.captureCardText, colors.primary]
  );
  const photoDoodleColors = useMemo(
    () => getUniqueColors([PHOTO_DOODLE_DEFAULT_COLOR, '#1C1C1E', colors.primary]),
    [colors.primary]
  );
  const doodleColorOptions = isCameraCaptureSurface ? photoDoodleColors : textDoodleColors;
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
  const hasLivePhotoMotion = Boolean(capturedPairedVideo);
  const saveStateScale = useSharedValue(1);
  const saveSuccessProgress = useSharedValue(saveState === 'success' ? 1 : 0);
  const savePressScale = useSharedValue(1);
  const cameraTransitionMaskOpacity = useSharedValue(0);
  const livePhotoVisualProgress = useSharedValue(isLivePhotoCaptureInProgress ? 1 : 0);
  const livePhotoHaloProgress = useSharedValue(0);
  const previousTextDraftEmptyRef = useRef(noteText.length === 0);
  const previousCaptureModeRef = useRef(captureMode);
  const previousTextDoodleDefaultColorRef = useRef(colors.captureCardText);
  const pastePromptTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const placeholderVariants = useMemo(() => getCaptureTextPlaceholderVariants(t), [t]);
  const activeTextPlaceholder =
    placeholderVariants[textPlaceholderIndex % placeholderVariants.length] ??
    DEFAULT_CAPTURE_TEXT_PLACEHOLDERS[0];
  const livePhotoProgressPath = useMemo(() => {
    const path = Skia.Path.Make();
    path.addCircle(
      LIVE_PHOTO_RING_SIZE / 2,
      LIVE_PHOTO_RING_SIZE / 2,
      (LIVE_PHOTO_RING_SIZE - LIVE_PHOTO_RING_STROKE_WIDTH) / 2
    );
    return path;
  }, []);
  const isSaveBusy =
    saving ||
    saveState === 'saving' ||
    isLivePhotoCaptureSettling ||
    isLivePhotoSaveGuardActive;
  const isSaveSuccessful = saveState === 'success';
  const isSaveDisabled = isSaveBusy || isSaveSuccessful;
  const interactionsDisabled = isSaveBusy || isSaveSuccessful;
  const useNativeInlinePasteButton = Platform.OS === 'ios' && isPasteButtonAvailable;
  const useFallbackInlinePasteButton = Platform.OS === 'android';
  const hasVisibleCameraStatus = captureMode === 'camera' && Boolean(cameraStatusText);
  const shouldCheckInlinePasteClipboard =
    ENABLE_PHOTO_STICKERS &&
    captureMode === 'text' &&
    noteText.length === 0 &&
    !isNoteInputFocused &&
    !doodleModeEnabled &&
    !stickerModeEnabled &&
    !interactionsDisabled &&
    (useNativeInlinePasteButton || useFallbackInlinePasteButton) &&
    !importingSticker;
  const showInlinePasteButton =
    shouldCheckInlinePasteClipboard &&
    (inlinePasteCanPasteFromClipboard || inlinePasteLoading);
  const shouldPrepareCameraPreview =
    captureMode === 'camera' &&
    !capturedPhoto &&
    permissionGranted;
  const shouldShowCameraCard = captureMode === 'camera' && !capturedPhoto;
  const shouldRenderCameraPreview = shouldPrepareCameraPreview && Boolean(cameraDevice);
  const canShowLiveCameraPreview = shouldRenderCameraPreview && isCameraPreviewActive;
  const previousCanShowLiveCameraPreviewRef = useRef(canShowLiveCameraPreview);
  const saveIdleBackground = isCameraSaveMode ? colors.primary : colors.captureButtonBg;
  const disableAndroidCaptureTransforms =
    Platform.OS === 'android' &&
    !isModeSwitchAnimating &&
    (captureMode === 'camera' || (captureMode === 'text' && isNoteInputFocused));
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
      cameraTransitionMaskOpacity.value = withTiming(0, { duration: 0 });
    },
    [cameraTransitionMaskOpacity, restartCameraPreview, t]
  );

  const handleCameraInitialized = useCallback(() => {
    cameraAutoRecoveryCountRef.current = 0;
    setCameraUnavailable(false);
    setCameraIssueDetail(null);
  }, []);

  const handleCameraPreviewStarted = useCallback(() => {
    cameraAutoRecoveryCountRef.current = 0;
    setCameraUnavailable(false);
    setCameraIssueDetail(null);
    setIsCameraReady(true);
    cameraTransitionMaskOpacity.value = withTiming(0, {
      duration: reduceMotionEnabled ? 0 : CAMERA_TRANSITION_FADE_OUT_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [cameraTransitionMaskOpacity, reduceMotionEnabled]);

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
      cameraTransitionMaskOpacity.value = withTiming(0, { duration: 0 });
      return;
    }

    cameraTransitionMaskOpacity.value = withTiming(1, {
      duration: reduceMotionEnabled ? 0 : CAMERA_TRANSITION_FADE_IN_MS,
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
      clearCameraZoomBadgeTimeout();
    },
    [clearCameraZoomBadgeTimeout]
  );

  useEffect(() => {
    if (!canShowLiveCameraPreview || isCameraReady || cameraUnavailable) {
      return;
    }

    const timer = setTimeout(() => {
      handleCameraStartupFailure();
    }, CAMERA_START_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [cameraDevice?.id, cameraRetryNonce, canShowLiveCameraPreview, cameraUnavailable, handleCameraStartupFailure, isCameraReady]);

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
    if (isSaveDisabled) {
      savePressScale.value = 1;
    }
  }, [isSaveDisabled, savePressScale]);

  const closeDecorateControls = useCallback(() => {
    setDoodleModeEnabled(false);
    setStickerModeEnabled(false);
    setTextSelectedStickerId(null);
    setPhotoSelectedStickerId(null);
  }, []);

  useEffect(() => {
    if (captureMode !== 'text') {
      setIsNoteInputFocused(false);
      setIsRestaurantInputFocused(false);
    }

    closeDecorateControls();
    setShowStickerSourceSheet(false);
  }, [captureMode, capturedPhoto, closeDecorateControls]);

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
    onDoodleModeChange?.(
      (captureMode === 'text' || Boolean(capturedPhoto)) &&
      (doodleModeEnabled || stickerModeEnabled)
    );
  }, [captureMode, capturedPhoto, doodleModeEnabled, onDoodleModeChange, stickerModeEnabled]);

  useEffect(() => {
    onInteractionLockChange?.(
      ((captureMode === 'text' || Boolean(capturedPhoto)) &&
        (doodleModeEnabled || stickerModeEnabled)) ||
      isLivePhotoCaptureInProgress
    );
  }, [
    captureMode,
    capturedPhoto,
    doodleModeEnabled,
    isLivePhotoCaptureInProgress,
    onInteractionLockChange,
    stickerModeEnabled,
  ]);

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

  useEffect(() => {
    if (!isModeSwitchAnimating) {
      return;
    }

    dismissPastePrompt();
    closeDecorateControls();
    setShowStickerSourceSheet(false);
  }, [closeDecorateControls, dismissPastePrompt, isModeSwitchAnimating]);

  const handleSavePressIn = useCallback(() => {
    if (isSaveDisabled) {
      return;
    }

    savePressScale.value = withTiming(0.85, {
      duration: 120,
      easing: Easing.out(Easing.quad),
    });
  }, [isSaveDisabled, savePressScale]);

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

  useEffect(() => {
    let active = true;
    let subscription: Subscription | null = null;

    if (!shouldCheckInlinePasteClipboard) {
      setInlinePasteCanPasteFromClipboard(false);
      return () => {
        active = false;
      };
    }

    const syncClipboardAvailability = async () => {
      const canPasteFromClipboard = await hasClipboardStickerImage();
      if (active) {
        setInlinePasteCanPasteFromClipboard(canPasteFromClipboard);
      }
    };

    void syncClipboardAvailability();
    subscription = addClipboardListener(() => {
      void syncClipboardAvailability();
    });

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [shouldCheckInlinePasteClipboard]);

  const resetDoodle = useCallback(() => {
    if (doodleModeEnabled) {
      setDoodleModeEnabled(false);
    }
    setTextDoodleStrokes([]);
    setPhotoDoodleStrokes([]);
    setTextDoodleColor(colors.captureCardText);
    setPhotoDoodleColor(PHOTO_DOODLE_DEFAULT_COLOR);
  }, [colors.captureCardText, doodleModeEnabled]);

  const resetStickers = useCallback(() => {
    if (stickerModeEnabled) {
      setStickerModeEnabled(false);
    }
    setTextStickerPlacements([]);
    setPhotoStickerPlacements([]);
    setTextSelectedStickerId(null);
    setPhotoSelectedStickerId(null);
  }, [stickerModeEnabled]);

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
      closeDecorateControls,
    }),
    [
      closeDecorateControls,
      doodleModeEnabled,
      doodleStrokes,
      resetDoodle,
      resetStickers,
      stickerModeEnabled,
      stickerPlacements,
    ]
  );

  const animatedSaveInnerStyle = useAnimatedStyle(() => ({
    backgroundColor: isCameraSaveMode
      ? colors.primary
      : interpolateColor(
          saveSuccessProgress.value,
          [0, 1],
          [saveIdleBackground, colors.primary]
        ),
    transform: [{ scale: saveStateScale.value }],
  }), [colors.primary, isCameraSaveMode, saveIdleBackground, saveStateScale, saveSuccessProgress]);
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
  const cameraTransitionMaskAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cameraTransitionMaskOpacity.value,
  }), [cameraTransitionMaskOpacity]);
  const keyboardLiftAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -keyboardLift.value }],
  }), [keyboardLift]);
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
    width: 54 - livePhotoVisualProgress.value * 10,
    height: 54 - livePhotoVisualProgress.value * 10,
    borderRadius: 27 - livePhotoVisualProgress.value * 12,
    transform: [{ scale: shutterScale.value * (1 - livePhotoVisualProgress.value * 0.04) }],
  }), [livePhotoVisualProgress, shutterScale]);
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
  const savePressAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: savePressScale.value }],
  }), [savePressScale]);
  const showCameraUnavailableState =
    captureMode === 'camera' && !capturedPhoto && permissionGranted && cameraUnavailable;
  const cameraUnavailableDetail =
    cameraIssueDetail?.trim() || t(
      'capture.cameraUnavailableHint',
      'The camera session may have stalled. Try again to restart the preview.'
    );
  const cameraZoomGesturesEnabled =
    canShowLiveCameraPreview && !showCameraUnavailableState && !interactionsDisabled;
  const handleSwitchCameraPress = useCallback(() => {
    cameraTransitionMaskOpacity.value = withTiming(1, {
      duration: reduceMotionEnabled ? 0 : CAMERA_TRANSITION_FADE_IN_MS,
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

  const dismissCaptureInputs = useCallback(() => {
    Keyboard.dismiss();
    setIsNoteInputFocused(false);
    setIsRestaurantInputFocused(false);
  }, []);

  const handleToggleDoodleMode = useCallback(() => {
    dismissPastePrompt();
    dismissCaptureInputs();
    setStickerModeEnabled(false);
    if (isPhotoDoodleSurface) {
      setPhotoSelectedStickerId(null);
    } else {
      setTextSelectedStickerId(null);
    }
    setDoodleModeEnabled((current) => !current);
  }, [dismissCaptureInputs, dismissPastePrompt, isPhotoDoodleSurface]);

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
    } else {
      setTextStickerPlacements((current) => [...current, nextPlacement]);
      setTextSelectedStickerId(nextPlacement.id);
    }
    setStickerModeEnabled(true);
    setDoodleModeEnabled(false);
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
      const importedAsset = await importStickerAssetFromClipboard(getClipboardStickerMessages(t));
      const nextPlacement = createStickerPlacement(importedAsset, stickerPlacements);
      applyImportedSticker(nextPlacement);
    } catch (error) {
      if (!(error instanceof ClipboardStickerError && error.code === 'permission-denied')) {
        console.warn('Sticker paste failed:', error);
      }
      showAppAlert(
        getClipboardStickerAlertTitle(t, error),
        error instanceof Error
          ? error.message
          : t('capture.clipboardStickerFailed', 'We could not paste that sticker right now.')
      );
    } finally {
      setImportingSticker(false);
    }
  }, [applyImportedSticker, dismissPastePrompt, importingSticker, stickerPlacements, t]);
  const showPastePromptAt = useCallback(
    async (x: number, y: number) => {
      if (
        !ENABLE_PHOTO_STICKERS ||
        importingSticker ||
        doodleModeEnabled ||
        stickerModeEnabled ||
        interactionsDisabled
      ) {
        return;
      }

      const canPasteFromClipboard = await hasClipboardStickerImage();

      if (!canPasteFromClipboard) {
        dismissPastePrompt();
        return;
      }

      setPastePrompt({
        visible: true,
        x,
        y,
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
    ]
  );
  const handleNativeInlinePasteStickerPress = useCallback(
    async (payload: PasteEventPayload) => {
      if (!ENABLE_PHOTO_STICKERS || importingSticker || inlinePasteLoading || payload.type !== 'image') {
        return;
      }

      dismissPastePrompt();
      setInlinePasteLoading(true);
      setImportingSticker(true);

      try {
        const importedAsset = await importStickerAssetFromClipboardImageData(
          payload.data,
          getClipboardStickerMessages(t)
        );
        const nextPlacement = createStickerPlacement(importedAsset, stickerPlacements);
        applyImportedSticker(nextPlacement);
      } catch (error) {
        if (!(error instanceof ClipboardStickerError && error.code === 'permission-denied')) {
          console.warn('Sticker paste failed:', error);
        }
        showAppAlert(
          getClipboardStickerAlertTitle(t, error),
          error instanceof Error
            ? error.message
            : t('capture.clipboardStickerFailed', 'We could not paste that sticker right now.')
        );
      } finally {
        setImportingSticker(false);
        setInlinePasteLoading(false);
      }
    },
    [
      applyImportedSticker,
      dismissPastePrompt,
      importingSticker,
      inlinePasteLoading,
      stickerPlacements,
      t,
    ]
  );
  const handleShowCardPastePrompt = useCallback(
    async (event: GestureResponderEvent) => {
      const locationX = typeof event.nativeEvent.locationX === 'number' ? event.nativeEvent.locationX : CARD_SIZE / 2;
      const locationY = typeof event.nativeEvent.locationY === 'number' ? event.nativeEvent.locationY : CARD_SIZE / 2;
      await showPastePromptAt(locationX, locationY);
    },
    [showPastePromptAt]
  );
  const handleConfirmPasteFromPrompt = useCallback(() => {
    dismissPastePrompt();
    void handlePasteStickerFromClipboard();
  }, [dismissPastePrompt, handlePasteStickerFromClipboard]);
  const handleInlinePasteStickerPress = useCallback(() => {
    if (inlinePasteLoading) {
      return;
    }

    setInlinePasteLoading(true);
    void handlePasteStickerFromClipboard().finally(() => {
      setInlinePasteLoading(false);
    });
  }, [handlePasteStickerFromClipboard, inlinePasteLoading]);
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
    dismissCaptureInputs();
    setDoodleModeEnabled(false);
    setStickerModeEnabled((current) => !current);
    if (stickerModeEnabled) {
      if (isPhotoDoodleSurface) {
        setPhotoSelectedStickerId(null);
      } else {
        setTextSelectedStickerId(null);
      }
    }
  }, [
    dismissCaptureInputs,
    dismissPastePrompt,
    isPhotoDoodleSurface,
    stickerModeEnabled,
  ]);
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

    closeDecorateControls();
  }, [closeDecorateControls, dismissPastePrompt, handleSelectSticker, selectedStickerId, stickerModeEnabled]);
  const handleToggleStickerMotionLock = useCallback(() => {
    if (!selectedStickerId) {
      return;
    }

    handleChangeStickerPlacements(
      setStickerPlacementMotionLocked(
        stickerPlacements,
        selectedStickerId,
        !selectedStickerMotionLocked
      )
    );
  }, [handleChangeStickerPlacements, selectedStickerId, selectedStickerMotionLocked, stickerPlacements]);

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

      triggerCaptureCardHaptic();
      onChangeNoteColor(nextColor ?? DEFAULT_NOTE_COLOR_ID);
      setShowNoteColorSheet(false);
    },
    [onChangeNoteColor]
  );
  const handleSelectRadius = useCallback(
    (nextRadius: number) => {
      triggerCaptureCardHaptic();
      onChangeRadius(nextRadius);
      setShowRadiusSheet(false);
    },
    [onChangeRadius]
  );
  const handlePressLockedNoteColor = useCallback(
    (colorId: string) => {
      triggerCaptureCardHaptic();
      onPressLockedNoteColor?.(colorId);
    },
    [onPressLockedNoteColor]
  );
  const handleCameraRetryPress = useCallback(() => {
    triggerCaptureCardHaptic();
    restartCameraPreview(true);
  }, [restartCameraPreview]);
  const handleRequestCameraPermissionPress = useCallback(() => {
    triggerCaptureCardHaptic();
    onRequestCameraPermission();
  }, [onRequestCameraPermission]);

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
          onLockedColorPress={handlePressLockedNoteColor}
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
        <Reanimated.View style={keyboardLiftAnimatedStyle}>
          <Reanimated.View
            testID="capture-card-area"
            style={[
              styles.captureArea,
              disableAndroidCaptureTransforms ? null : captureAreaAnimatedStyle,
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
              <View pointerEvents="box-none" style={styles.cardTopOverlay}>
                <View style={[styles.cardTopOverlayRow, styles.cardTopOverlayRowWrap]}>
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
                  {ENABLE_PHOTO_STICKERS && (stickerModeEnabled || stickerPlacements.length > 0) ? (
                    <CaptureAnimatedPressable
                      testID="capture-sticker-motion-lock"
                      accessibilityLabel={
                        selectedStickerMotionLocked
                          ? t('capture.unlockStickerMotion', 'Unlock sticker motion')
                          : t('capture.lockStickerMotion', 'Lock sticker motion')
                      }
                      onPress={handleToggleStickerMotionLock}
                      active={selectedStickerMotionLocked}
                      disabled={!selectedStickerId}
                      disabledOpacity={0.45}
                      activeScale={DECORATE_OPTION_ACTIVE_SCALE}
                      activeTranslateY={0}
                      contentActiveScale={DECORATE_OPTION_CONTENT_SCALE}
                      contentActiveTranslateY={0}
                      style={[
                        styles.textCardActionButton,
                        {
                          backgroundColor: selectedStickerMotionLocked
                            ? colors.captureButtonBg
                            : colors.captureGlassFill,
                          borderColor: selectedStickerMotionLocked
                            ? 'rgba(255,255,255,0.18)'
                            : colors.captureGlassBorder,
                        },
                      ]}
                    >
                      <Ionicons
                        name={selectedStickerMotionLocked ? 'lock-closed' : 'lock-open-outline'}
                        size={16}
                        color={
                          selectedStickerMotionLocked ? textCardActiveIconColor : colors.captureGlassText
                        }
                      />
                    </CaptureAnimatedPressable>
                  ) : null}
                  {doodleModeEnabled ? (
                    <>
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
                    </>
                  ) : null}
                  {stickerModeEnabled ? (
                    <>
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
                    </>
                  ) : null}
                  {showInlinePasteButton ? (
                    <View style={styles.inlinePasteStickerWrap}>
                      {inlinePasteLoading ? (
                        <CaptureAnimatedPressable
                          testID="capture-inline-paste-sticker"
                          accessibilityLabel={t('capture.pasteStickerAction', 'Paste sticker')}
                          disabled
                          disabledOpacity={1}
                          style={[
                            styles.textCardActionButton,
                            styles.inlinePasteStickerIconButton,
                            {
                              backgroundColor: colors.captureGlassFill,
                              borderColor: colors.captureGlassBorder,
                            },
                          ]}
                        >
                          <ActivityIndicator size="small" color={colors.captureGlassText} />
                        </CaptureAnimatedPressable>
                      ) : useNativeInlinePasteButton ? (
                        <ClipboardPasteButton
                          testID="capture-inline-paste-sticker"
                          accessibilityLabel={t('capture.pasteStickerAction', 'Paste sticker')}
                          acceptedContentTypes={['image']}
                          imageOptions={{ format: 'png' }}
                          displayMode="iconOnly"
                          cornerStyle="capsule"
                          backgroundColor={colors.captureGlassFill}
                          foregroundColor={colors.captureGlassText}
                          onPress={handleNativeInlinePasteStickerPress}
                          style={styles.nativeInlinePasteStickerButton}
                        />
                      ) : (
                        <CaptureAnimatedPressable
                          testID="capture-inline-paste-sticker"
                          accessibilityLabel={t('capture.pasteStickerAction', 'Paste sticker')}
                          onPress={handleInlinePasteStickerPress}
                          disabled={inlinePasteLoading}
                          disabledOpacity={1}
                          style={[
                            styles.textCardActionButton,
                            styles.inlinePasteStickerIconButton,
                            {
                              backgroundColor: colors.captureGlassFill,
                              borderColor: colors.captureGlassBorder,
                            },
                          ]}
                        >
                          <Ionicons
                            name="clipboard-outline"
                            size={16}
                            color={colors.captureGlassText}
                          />
                        </CaptureAnimatedPressable>
                      )}
                    </View>
                  ) : null}
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
              {textDoodleStrokes.length > 0 || doodleModeEnabled ? (
                <View
                  pointerEvents={doodleModeEnabled ? 'auto' : 'none'}
                  style={styles.doodleCanvasLayer}
                >
                  <NoteDoodleCanvas
                    strokes={doodleStrokes}
                    editable={doodleModeEnabled}
                    activeColor={doodleColor}
                    onChangeStrokes={setTextDoodleStrokes}
                  />
                </View>
              ) : null}

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
                  selectionColor={colors.primary}
                />
              </View>
            </LinearGradient>
          ) : capturedPhoto ? (
            <View
              style={[styles.cameraContainer, { backgroundColor: colors.captureCameraOverlay }]}
            >
              {hasLivePhotoMotion ? (
                <PhotoMediaView
                  imageUrl={capturedPhoto}
                  isLivePhoto
                  pairedVideoUri={capturedPairedVideo}
                  showLiveBadge={false}
                  style={styles.cameraPreview}
                  imageStyle={styles.cameraPreview}
                  enablePlayback
                />
              ) : (
                <FilteredPhotoCanvas
                  sourceUri={capturedPhoto}
                  filterId={selectedPhotoFilterId}
                  width={CARD_SIZE}
                  height={CARD_SIZE}
                  style={styles.cameraPreview}
                />
              )}
              {ENABLE_PHOTO_STICKERS && !hasLivePhotoMotion ? (
                <Pressable
                  testID="capture-card-paste-surface"
                  style={styles.cardPasteSurface}
                  onLongPress={handleShowCardPastePrompt}
                  delayLongPress={320}
                />
              ) : null}
              <View pointerEvents="box-none" style={styles.cardTopOverlay}>
                <View style={[styles.cardTopOverlayRow, styles.cardTopOverlayRowWrap]}>
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
                  {ENABLE_PHOTO_STICKERS && (stickerModeEnabled || stickerPlacements.length > 0) ? (
                    <CaptureAnimatedPressable
                      testID="capture-sticker-motion-lock"
                      accessibilityLabel={
                        selectedStickerMotionLocked
                          ? t('capture.unlockStickerMotion', 'Unlock sticker motion')
                          : t('capture.lockStickerMotion', 'Lock sticker motion')
                      }
                      onPress={handleToggleStickerMotionLock}
                      active={selectedStickerMotionLocked}
                      disabled={!selectedStickerId}
                      disabledOpacity={0.45}
                      activeScale={DECORATE_OPTION_ACTIVE_SCALE}
                      activeTranslateY={0}
                      contentActiveScale={DECORATE_OPTION_CONTENT_SCALE}
                      contentActiveTranslateY={0}
                      style={[
                        styles.cameraOverlayButton,
                        styles.photoDoodleIconButton,
                        {
                          backgroundColor: selectedStickerMotionLocked
                            ? photoPreviewActiveFill
                            : photoPreviewControlFill,
                          borderColor: selectedStickerMotionLocked
                            ? photoPreviewActiveFill
                            : photoPreviewControlBorder,
                        },
                      ]}
                    >
                      <Ionicons
                        name={selectedStickerMotionLocked ? 'lock-closed' : 'lock-open-outline'}
                        size={16}
                        color={
                          selectedStickerMotionLocked ? photoPreviewActiveText : photoPreviewControlText
                        }
                      />
                    </CaptureAnimatedPressable>
                  ) : null}
                  <CaptureAnimatedPressable
                    testID="capture-live-photo-toggle"
                    accessibilityLabel={
                      hasLivePhotoMotion
                        ? t('capture.removeLivePhotoMotion', 'Remove live photo motion')
                        : t('capture.addLivePhotoMotion', 'Add live photo motion')
                    }
                    onPress={hasLivePhotoMotion ? onRemoveMotionClip : onImportMotionClip}
                    active={hasLivePhotoMotion}
                    activeScale={1.02}
                    activeTranslateY={0}
                    contentActiveScale={1}
                    contentActiveTranslateY={0}
                    style={[
                      styles.cameraOverlayButton,
                      styles.textCardActionPill,
                      styles.livePhotoTogglePill,
                      {
                        backgroundColor: hasLivePhotoMotion ? photoPreviewActiveFill : photoPreviewControlFill,
                        borderColor: hasLivePhotoMotion ? photoPreviewActiveFill : photoPreviewControlBorder,
                      },
                    ]}
                  >
                    <LivePhotoIcon
                      size={15}
                      color={hasLivePhotoMotion ? photoPreviewActiveText : photoPreviewControlText}
                    />
                    <Text
                      style={[
                        styles.livePhotoPillText,
                        { color: hasLivePhotoMotion ? photoPreviewActiveText : photoPreviewControlText },
                      ]}
                    >
                      {hasLivePhotoMotion
                        ? t('capture.removeLivePhotoShort', 'Remove Live')
                        : t('capture.addLivePhotoShort', 'Add Live')}
                    </Text>
                  </CaptureAnimatedPressable>
                  {doodleModeEnabled ? (
                    <>
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
                    </>
                  ) : null}
                  {stickerModeEnabled ? (
                    <>
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
                    </>
                  ) : null}
                </View>
              </View>
              {ENABLE_PHOTO_STICKERS && stickerPlacements.length > 0 ? (
                <View
                  pointerEvents={stickerModeEnabled ? 'box-none' : 'none'}
                  style={styles.doodleCanvasLayer}
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
              {photoDoodleStrokes.length > 0 || doodleModeEnabled ? (
                <View
                  pointerEvents={doodleModeEnabled ? 'auto' : 'none'}
                  style={styles.doodleCanvasLayer}
                >
                  <NoteDoodleCanvas
                    strokes={doodleStrokes}
                    editable={doodleModeEnabled}
                    activeColor={doodleColor}
                    onChangeStrokes={setPhotoDoodleStrokes}
                  />
                </View>
              ) : null}
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
              {!hasLivePhotoMotion ? (
                <View pointerEvents="box-none" style={styles.cardBottomOverlay}>
                  <PhotoFilterCarousel
                    sourceUri={capturedPhoto}
                    selectedFilterId={selectedPhotoFilterId}
                    onSelectFilter={onChangePhotoFilter}
                    t={t}
                    colors={colors}
                  />
                </View>
              ) : null}
            </View>
          ) : shouldShowCameraCard ? (
            <View
              style={[styles.cameraContainer, { backgroundColor: colors.captureCameraOverlay }]}
              collapsable={false}
            >
              {shouldRenderCameraPreview ? (
                <GestureDetector gesture={cameraZoomGesture}>
                  <View style={styles.cameraGestureLayer}>
                    <Camera
                      key={`camera-session-${cameraSessionKey}-${cameraRetryNonce}-${cameraActivationNonce}-${cameraDevice?.id ?? 'none'}`}
                      style={styles.cameraPreview}
                      device={cameraDevice!}
                      isActive={canShowLiveCameraPreview}
                      preview
                      photo
                      video
                      photoQualityBalance="speed"
                      isMirrored={facing === 'front'}
                      zoom={cameraPreviewZoom}
                      resizeMode="cover"
                      androidPreviewViewType="texture-view"
                      ref={cameraRef}
                      onInitialized={handleCameraInitialized}
                      onPreviewStarted={handleCameraPreviewStarted}
                      onError={(error) => {
                        handleCameraStartupFailure(error.message);
                      }}
                    />
                  </View>
                </GestureDetector>
              ) : null}
              <Reanimated.View
                testID="camera-transition-overlay"
                pointerEvents="none"
                style={[
                  styles.cameraTransitionOverlay,
                  cameraTransitionMaskAnimatedStyle,
                ]}
              />
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
                    onPress={handleCameraRetryPress}
                    style={styles.cameraRetryButton}
                  />
                </View>
              ) : needsCameraPermission ? (
                <View style={styles.cameraPermissionOverlay}>
                  <Ionicons name="camera" size={48} color={colors.captureCameraOverlayText} />
                  <Text style={[styles.permissionText, { color: colors.captureCameraOverlayText }]}>
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
                    onPress={handleRequestCameraPermissionPress}
                    style={styles.permissionButton}
                  />
                </View>
              ) : (
                <>
                  {showCameraZoomBadge && canShowLiveCameraPreview ? (
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
              {!needsCameraPermission ? (
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
              ) : null}
            </View>
          ) : null}
          
          </Reanimated.View>

          <Reanimated.View
            style={[
              styles.belowCardSection,
              disableAndroidCaptureTransforms ? null : belowCardAnimatedStyle,
            ]}
            pointerEvents={interactionsDisabled ? 'none' : 'auto'}
          >
          {hasVisibleCameraStatus ? (
            <View style={styles.cameraStatusSlot}>
              <Text
                numberOfLines={1}
                style={[
                  styles.cameraStatusText,
                  { color: colors.secondaryText, opacity: cameraStatusText ? 1 : 0 },
                ]}
              >
                {cameraStatusText ?? ' '}
              </Text>
            </View>
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
                      selectionColor={colors.primary}
                    />
                  </View>
                  <View style={[styles.captureMetaDivider, { backgroundColor: colors.captureGlassBorder }]} />
                  <View style={styles.captureMetaActions}>
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
              ) : cameraInstructionText && !capturedPhoto ? (
                <View style={[styles.cameraHintPill, { borderColor: colors.captureGlassBorder }]}>
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
                  {!isOlderIOS ? (
                    <GlassView
                      pointerEvents="none"
                      style={StyleSheet.absoluteFill}
                      glassEffectStyle="regular"
                      colorScheme={colors.captureGlassColorScheme}
                    />
                  ) : null}
                  <View style={styles.cameraHintContent}>
                    <Ionicons name="sparkles-outline" size={14} color={colors.captureGlassIcon} />
                    <Text
                      numberOfLines={2}
                      style={[styles.cameraHintText, { color: colors.captureGlassText }]}
                    >
                      {cameraInstructionText}
                    </Text>
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
            <View style={styles.cameraControlsWrap}>
              <View style={styles.belowCardShutterRow}>
                {permissionGranted ? (
                  <CaptureGlassActionButton
                    testID="capture-share-target-toggle"
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSharedTarget }}
                    accessibilityLabel={isSharedTarget ? t('shared.captureShared', 'Friends') : t('shared.capturePrivate', 'Just me')}
                    onPress={() => onChangeShareTarget(shareTarget === 'private' ? 'shared' : 'private')}
                    iconName={isSharedTarget ? 'people' : 'lock-closed'}
                    iconColor={colors.captureGlassText}
                    glassColorScheme={colors.captureGlassColorScheme}
                    fallbackColor={colors.card}
                    borderColor={colors.captureGlassBorder}
                    style={[styles.belowCardLeadingAction]}
                  />
                ) : (
                  <View style={[styles.belowCardSideActionSpacer, styles.belowCardLeadingAction]} />
                )}
                {permissionGranted ? (
                  <CaptureAnimatedPressable
                    testID="capture-shutter-button"
                    onPressIn={onShutterPressIn}
                    onPressOut={handleShutterRelease}
                    onPress={handleShutterPress}
                    onLongPress={handleShutterLongPress}
                    delayLongPress={380}
                    hapticStyle={null}
                    pressedScale={0.985}
                    style={[
                      styles.shutterOuter,
                      shutterOuterAnimatedStyle,
                    ]}
                  >
                    <Reanimated.View
                      pointerEvents="none"
                      style={[
                        styles.shutterCaptureHalo,
                        { backgroundColor: `${colors.primary}28` },
                        shutterCaptureHaloAnimatedStyle,
                      ]}
                    />
                    {isLivePhotoCaptureInProgress ? (
                      <>
                        <View pointerEvents="none" style={styles.shutterLiveProgressWrap}>
                          <Canvas style={styles.shutterLiveProgressCanvas}>
                            <SkiaPath
                              path={livePhotoProgressPath}
                              start={0}
                              end={Math.max(livePhotoRingProgress, 0.001)}
                              color={colors.primary}
                              style="stroke"
                              strokeWidth={LIVE_PHOTO_RING_STROKE_WIDTH}
                              strokeCap="round"
                            />
                          </Canvas>
                        </View>
                      </>
                    ) : null}
                    <Reanimated.View
                      style={[
                        styles.shutterInner,
                        {
                          backgroundColor: colors.primary,
                        },
                        shutterInnerAnimatedStyle,
                      ]}
                    >
                      {isLivePhotoCaptureInProgress ? (
                        <Text style={styles.shutterInnerCountText}>{livePhotoCountdownSeconds}s</Text>
                      ) : typeof remainingPhotoSlots === 'number' && remainingPhotoSlots > 0 ? (
                        <Text style={styles.shutterInnerCountText}>{remainingPhotoSlots}</Text>
                      ) : null}
                    </Reanimated.View>
                  </CaptureAnimatedPressable>
                ) : null}
                {!showCameraUnavailableState && permissionGranted ? (
                  <CaptureGlassActionButton
                    accessibilityLabel={t('capture.switchCamera', 'Switch camera')}
                    onPress={handleSwitchCameraPress}
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
            </View>
          ) : capturedPhoto ? (
            <View style={[styles.belowCardShutterRow, styles.belowCardCapturedPhotoActions]}>
              <CaptureGlassActionButton
                testID="capture-share-target-toggle"
                accessibilityRole="button"
                accessibilityState={{ selected: isSharedTarget }}
                accessibilityLabel={isSharedTarget ? t('shared.captureShared', 'Friends') : t('shared.capturePrivate', 'Just me')}
                onPress={() => onChangeShareTarget(shareTarget === 'private' ? 'shared' : 'private')}
                iconName={isSharedTarget ? 'people' : 'lock-closed'}
                iconColor={colors.captureGlassText}
                glassColorScheme={colors.captureGlassColorScheme}
                fallbackColor={colors.card}
                borderColor={colors.captureGlassBorder}
                style={[styles.belowCardLeadingAction]}
              />
              <CaptureAnimatedPressable
                testID="capture-save-button"
                onPress={onSaveNote}
                onPressIn={handleSavePressIn}
                onPressOut={handleSavePressOut}
                disabled={isSaveDisabled}
                pressedScale={0.985}
                disabledOpacity={isSaveDisabled ? 0.72 : 1}
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
                      { backgroundColor: colors.primary },
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
                testID="capture-share-target-toggle"
                accessibilityRole="button"
                accessibilityState={{ selected: isSharedTarget }}
                accessibilityLabel={isSharedTarget ? t('shared.captureShared', 'Friends') : t('shared.capturePrivate', 'Just me')}
                onPress={() => onChangeShareTarget(shareTarget === 'private' ? 'shared' : 'private')}
                iconName={isSharedTarget ? 'people' : 'lock-closed'}
                iconColor={colors.captureGlassText}
                glassColorScheme={colors.captureGlassColorScheme}
                fallbackColor={colors.card}
                borderColor={colors.captureGlassBorder}
                style={[styles.belowCardLeadingAction]}
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
    ...(Platform.OS === 'android' ? {} : Shadows.card),
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
    fontFamily: 'Noto Sans',
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
  inlinePasteStickerWrap: {
    overflow: 'hidden',
    height: TOP_CONTROL_HEIGHT,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  inlinePasteStickerIconButton: {
    width: TOP_CONTROL_HEIGHT,
    height: TOP_CONTROL_HEIGHT,
  },
  nativeInlinePasteStickerButton: {
    width: TOP_CONTROL_HEIGHT,
    height: TOP_CONTROL_HEIGHT,
  },
  cardTopOverlay: {
    position: 'absolute',
    top: TOP_CONTROL_INSET,
    left: 18,
    right: 18,
    gap: 8,
    zIndex: 11,
  },
  cardBottomOverlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    alignItems: 'center',
    zIndex: 12,
  },
  cardTopOverlayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
  },
  textTopControlsDock: {
    height: TOP_CONTROL_HEIGHT,
    position: 'relative',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  textTopControlsLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
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
  livePhotoPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  livePhotoTogglePill: {
    width: 'auto',
    minWidth: 102,
    paddingHorizontal: 12,
    flexDirection: 'row',
    gap: 6,
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
    ...STICKER_ARTBOARD_FRAME,
    zIndex: 2,
  },
  textStickerCanvasLayer: {
    ...StyleSheet.absoluteFill,
    ...STICKER_ARTBOARD_FRAME,
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
  cameraTransitionOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
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
    fontFamily: 'Noto Sans',
  },
  cameraUnavailableState: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  cameraPermissionOverlay: {
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
    fontFamily: 'Noto Sans',
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
  cameraStatusSlot: {
    minHeight: 20,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  cameraInstructionText: {
    ...Typography.pill,
    textAlign: 'center',
  },
  cameraControlsWrap: {
    width: '100%',
    position: 'relative',
    alignItems: 'center',
  },
  cameraHintPill: {
    width: '100%',
    minHeight: 42,
    borderRadius: Radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  cameraHintContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cameraHintText: {
    ...Typography.pill,
    flexShrink: 1,
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
  photoFilterTray: {
    maxWidth: '100%',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 5,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  photoFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  photoFilterButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    borderWidth: 2,
    padding: 1,
  },
  photoFilterPreviewClip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
  },
  photoFilterPreviewCanvas: {
    width: '100%',
    height: '100%',
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
    overflow: 'visible',
  },
  shutterCaptureHalo: {
    position: 'absolute',
    width: SHUTTER_OUTER_SIZE + 18,
    height: SHUTTER_OUTER_SIZE + 18,
    borderRadius: (SHUTTER_OUTER_SIZE + 18) / 2,
  },
  shutterLiveProgressWrap: {
    position: 'absolute',
    width: LIVE_PHOTO_RING_SIZE,
    height: LIVE_PHOTO_RING_SIZE,
    borderRadius: LIVE_PHOTO_RING_SIZE / 2,
    overflow: 'hidden',
    transform: [{ rotate: '-90deg' }],
  },
  shutterLiveProgressCanvas: {
    width: LIVE_PHOTO_RING_SIZE,
    height: LIVE_PHOTO_RING_SIZE,
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
    paddingBottom: Sheet.android.bottomPadding + Sheet.android.comfortBottomPadding,
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
    paddingBottom: Sheet.android.bottomPadding + Sheet.android.comfortBottomPadding,
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
    fontFamily: 'Noto Sans',
  },
  radiusSheetDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Sheet.android.horizontalPadding,
  },
});
