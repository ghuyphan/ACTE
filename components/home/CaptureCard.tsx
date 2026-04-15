import { Ionicons } from '@expo/vector-icons';
import type { TFunction } from 'i18next';
import {
  forwardRef,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Camera, type CameraDevice } from 'react-native-vision-camera';
import Reanimated, {
  Easing,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { ENABLE_PHOTO_STICKERS } from '../../constants/experiments';
import { formatRadiusLabel, NOTE_RADIUS_OPTIONS } from '../../constants/noteRadius';
import { Layout } from '../../constants/theme';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import type { ThemeColors } from '../../hooks/useTheme';
import {
  DEFAULT_NOTE_COLOR_ID,
} from '../../services/noteAppearance';
import { type NoteStickerPlacement } from '../../services/noteStickers';
import type { PhotoFilterId } from '../../services/photoFilters';
import type { DoodleStroke } from '../notes/NoteDoodleCanvas';
import type { StickerEntryAnimation } from '../notes/NoteStickerCanvas';
import AppSheet from '../sheets/AppSheet';
import AppSheetScaffold from '../sheets/AppSheetScaffold';
import StickerSourceSheet from '../sheets/StickerSourceSheet';
import NoteColorPicker from '../ui/NoteColorPicker';
import {
  LiveCameraSurface,
  PhotoCaptureSurface,
  TextCaptureSurface,
} from './capture/CaptureCardSections';
import type { CameraUiStage } from './capture/captureShared';
import { CaptureActionRow } from './capture/CaptureActionRow';
import {
  PhotoCaptureBottomBar,
  TextCaptureBottomBar,
} from './capture/CaptureDecorateRail';
import { LiveCameraActionBar } from './capture/LiveCameraActionBar';
import { triggerCaptureCardHaptic } from './capture/CaptureControls';
import StampCutterEditor from './capture/StampCutterEditor';
import StampPreviewEditor from './capture/StampPreviewEditor';
import StickerCutoutPreviewEditor from './capture/StickerCutoutPreviewEditor';
import type { WindowRect } from './capture/stickerCreationTypes';
import {
  CARD_SIZE,
  DOCKED_HEADER_CONTENT_OVERLAP,
  LIVE_PHOTO_RING_STROKE_WIDTH,
  PHOTO_DOODLE_DEFAULT_COLOR,
  styles,
} from './capture/captureCardStyles';
import {
  CAPTURE_BUTTON_PRESS_IN,
  CAPTURE_BUTTON_PRESS_OUT,
  CAPTURE_EMOJI_POP_BOUNCE,
  CAPTURE_EMOJI_POP_DRIFT,
  CAPTURE_EMOJI_POP_ENTER,
  CAPTURE_EMOJI_POP_EXIT,
  CAPTURE_EMOJI_POP_HOLD,
  CAPTURE_EMOJI_POP_LIFT,
  CAPTURE_EMOJI_POP_SETTLE,
  CAPTURE_SAVE_BUSY_SCALE,
  CAPTURE_SAVE_SUCCESS_EXIT,
  CAPTURE_SAVE_SUCCESS_RESET,
  CAPTURE_SAVE_SUCCESS_SCALE,
  getCaptureTiming,
  scaleCaptureDuration,
} from './capture/captureMotion';
import { useCaptureCardCameraController } from './useCaptureCardCameraController';
import { useCaptureCardDecorations } from './useCaptureCardDecorations';
import { useCaptureCardMetaSheets } from './useCaptureCardMetaSheets';
import { useCaptureCardStickerFlow } from './useCaptureCardStickerFlow';
import {
  resolveCaptureKeyboardLift,
  useCaptureCardTextInputState,
} from './useCaptureCardTextInputState';

const DEFAULT_CAPTURE_TEXT_PLACEHOLDERS = [
  'Note about this place...',
  'Leave a tiny clue for future you...',
  'What should you remember here?',
  'Write one quick thing before it escapes...',
  'Anything here worth saving for later?',
  'Drop a small memory here...',
];
const LIGHT_CAPTURE_ACTIVE_ICON_COLOR = '#FFFFFF';
const HOME_PAGE_VISUAL_BOTTOM_INSET = 90;

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
  closeDecorateControls: () => void;
  dismissInputs: () => void;
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
  lockedPhotoFilterIds?: PhotoFilterId[];
  onPressLockedPhotoFilter?: (filterId: PhotoFilterId) => void;
  cameraRef: RefObject<Camera | null>;
  cameraDevice?: CameraDevice;
  isCameraPreviewActive: boolean;
  isCameraRevealAllowed?: boolean;
  permissionGranted: boolean;
  onShutterPressIn: () => void;
  onShutterPressOut: () => void;
  onTakePicture: () => void;
  onStartLivePhotoCapture?: () => void;
  onSaveNote: () => void;
  saving: boolean;
  saveState?: 'idle' | 'saving' | 'success';
  shutterScale: SharedValue<number>;
  isStillPhotoCaptureInProgress?: boolean;
  isLivePhotoCaptureInProgress?: boolean;
  isLivePhotoCaptureSettling?: boolean;
  isLivePhotoSaveGuardActive?: boolean;
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
  onTextEntryFocusChange?: (focused: boolean) => void;
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
  lockedPhotoFilterIds = [],
  onPressLockedPhotoFilter = onChangePhotoFilter,
  cameraRef,
  cameraDevice,
  isCameraPreviewActive,
  isCameraRevealAllowed = true,
  permissionGranted,
  onShutterPressIn,
  onShutterPressOut,
  onTakePicture,
  onStartLivePhotoCapture = () => undefined,
  onSaveNote,
  saving,
  saveState = 'idle',
  shutterScale,
  isStillPhotoCaptureInProgress = false,
  isLivePhotoCaptureInProgress = false,
  isLivePhotoCaptureSettling = false,
  isLivePhotoSaveGuardActive = false,
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
  onTextEntryFocusChange,
  footerContent,
}, ref) {
  const reduceMotionEnabled = useReducedMotion();
  const isSharedTarget = shareTarget === 'shared';
  const isDarkCaptureTheme = colors.captureGlassColorScheme === 'dark';
  const textCardActiveIconColor = isDarkCaptureTheme
    ? colors.captureCardText
    : LIGHT_CAPTURE_ACTIVE_ICON_COLOR;
  const effectiveTextModeNoteColor =
    captureMode === 'text' ? (noteColor ?? DEFAULT_NOTE_COLOR_ID) : noteColor;
  const hasLivePhotoMotion = Boolean(capturedPairedVideo);
  const saveStateScale = useSharedValue(1);
  const saveSuccessProgress = useSharedValue(saveState === 'success' ? 1 : 0);
  const savePressScale = useSharedValue(1);
  const autoEmojiPopOpacity = useSharedValue(0);
  const autoEmojiPopTranslateY = useSharedValue(12);
  const autoEmojiPopScale = useSharedValue(0.86);
  const captureCoverOpacity = useSharedValue(0);
  const iosKeyboardLift = useSharedValue(0);
  const [isPhotoCaptionFocused, setIsPhotoCaptionFocused] = useState(false);
  const [pendingPhotoReveal, setPendingPhotoReveal] = useState(false);
  const [shouldRenderCaptureCover, setShouldRenderCaptureCover] = useState(false);
  const [canvasGestureActive, setCanvasGestureActive] = useState(false);
  const [cameraGestureActive, setCameraGestureActive] = useState(false);
  const [stickerEntryAnimation, setStickerEntryAnimation] = useState<StickerEntryAnimation | null>(null);
  const previousCapturedPhotoRef = useRef(capturedPhoto);
  const previousTextDraftEmptyRef = useRef(noteText.length === 0);
  const previousCaptureModeRef = useRef(captureMode);
  const noteInputRef = useRef<TextInput | null>(null);
  const latestIosKeyboardScreenYRef = useRef(0);
  const pendingIosKeyboardLiftTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const placeholderVariants = useMemo(() => getCaptureTextPlaceholderVariants(t), [t]);
  const textInputDynamicStyle = useMemo(
    () =>
      noteText.length > 200
        ? { fontSize: 16, lineHeight: 22 }
        : noteText.length > 100
          ? { fontSize: 20, lineHeight: 28 }
          : null,
    [noteText.length]
  );
  const isSaveBusy =
    saving ||
    saveState === 'saving' ||
    isLivePhotoCaptureSettling ||
    isLivePhotoSaveGuardActive;
  const isSaveSuccessful = saveState === 'success';
  const isSaveDisabled = isSaveBusy || isSaveSuccessful;
  const interactionsDisabled = isSaveBusy || isSaveSuccessful;

  const {
    activeTextPlaceholder,
    dismissCaptureInputs: dismissCaptureInputsState,
    handleChangeNoteText,
    handleNoteInputBlur,
    handleNoteInputFocus,
    isNoteInputFocused,
    isTextEntryFocused,
    recentAutoEmoji,
    rotatePlaceholderIfNeeded,
  } = useCaptureCardTextInputState({
    captureMode,
    noteText,
    noteInputRef,
    onChangeNoteText,
    placeholderVariants,
  });

  const isCaptureTextEntryFocused = isTextEntryFocused || isPhotoCaptionFocused;
  const pageBottomInset = topInset + HOME_PAGE_VISUAL_BOTTOM_INSET;
  const animateIosKeyboardLift = useCallback(
    (nextLift: number, duration?: number) => {
      const nextDuration = reduceMotionEnabled ? 0 : Math.max(120, Math.round(duration ?? 240));

      iosKeyboardLift.value =
        nextDuration === 0
          ? nextLift
          : withTiming(nextLift, {
              duration: nextDuration,
              easing: Easing.out(Easing.cubic),
            });
    },
    [iosKeyboardLift, reduceMotionEnabled]
  );

  const updateIosKeyboardLift = useCallback(
    (keyboardScreenY: number, duration?: number) => {
      if (Platform.OS !== 'ios' || keyboardScreenY <= 0) {
        animateIosKeyboardLift(0, duration);
        return;
      }

      const inputNode = noteInputRef.current as
        | (TextInput & {
            measureInWindow?: (
              callback: (x: number, y: number, width: number, height: number) => void
            ) => void;
          })
        | null;

      if (!inputNode?.measureInWindow) {
        animateIosKeyboardLift(0, duration);
        return;
      }

      inputNode.measureInWindow((_x, inputY, _width, inputHeight) => {
        const nextLift = resolveCaptureKeyboardLift({
          extraGap: captureMode === 'camera' && capturedPhoto ? 24 : 18,
          inputHeight,
          inputY,
          keyboardScreenY,
          minimumVisibleInputY: topInset + Layout.headerHeight + 22,
        });

        animateIosKeyboardLift(nextLift, duration);
      });
    },
    [animateIosKeyboardLift, captureMode, capturedPhoto, topInset]
  );

  const scheduleIosKeyboardLiftUpdate = useCallback(() => {
    if (Platform.OS !== 'ios') {
      return;
    }

    if (pendingIosKeyboardLiftTimeoutRef.current != null) {
      clearTimeout(pendingIosKeyboardLiftTimeoutRef.current);
    }

    pendingIosKeyboardLiftTimeoutRef.current = setTimeout(() => {
      pendingIosKeyboardLiftTimeoutRef.current = null;

      const keyboardScreenY = latestIosKeyboardScreenYRef.current;
      if (keyboardScreenY <= 0) {
        return;
      }

      updateIosKeyboardLift(keyboardScreenY);
    }, 0);
  }, [updateIosKeyboardLift]);

  const handlePhotoCaptionFocus = useCallback(() => {
    setIsPhotoCaptionFocused(true);
    scheduleIosKeyboardLiftUpdate();
  }, [scheduleIosKeyboardLiftUpdate]);
  const handlePhotoCaptionBlur = useCallback(() => {
    setIsPhotoCaptionFocused(false);
  }, []);

  useEffect(() => {
    onTextEntryFocusChange?.(isCaptureTextEntryFocused);
  }, [isCaptureTextEntryFocused, onTextEntryFocusChange]);

  useEffect(() => {
    return () => {
      onTextEntryFocusChange?.(false);
    };
  }, [onTextEntryFocusChange]);

  useEffect(() => {
    if (captureMode === 'camera' && capturedPhoto) {
      return;
    }

    setIsPhotoCaptionFocused(false);
  }, [captureMode, capturedPhoto]);

  useEffect(() => {
    const previousCapturedPhoto = previousCapturedPhotoRef.current;

    if (!capturedPhoto) {
      setPendingPhotoReveal(false);
    } else if (!previousCapturedPhoto) {
      setPendingPhotoReveal(true);
    }

    previousCapturedPhotoRef.current = capturedPhoto;
  }, [capturedPhoto]);

  const dismissCaptureInputs = useCallback(() => {
    noteInputRef.current?.blur();
    setIsPhotoCaptionFocused(false);
    dismissCaptureInputsState();
  }, [dismissCaptureInputsState]);

  useEffect(() => {
    if (Platform.OS !== 'ios') {
      return;
    }

    const handleKeyboardWillChangeFrame = (event: {
      duration?: number;
      endCoordinates?: { screenY?: number };
    }) => {
      latestIosKeyboardScreenYRef.current = event.endCoordinates?.screenY ?? 0;

      if (!isCaptureTextEntryFocused) {
        animateIosKeyboardLift(0, event.duration);
        return;
      }

      updateIosKeyboardLift(latestIosKeyboardScreenYRef.current, event.duration);
    };

    const handleKeyboardWillHide = (event: { duration?: number }) => {
      latestIosKeyboardScreenYRef.current = 0;
      animateIosKeyboardLift(0, event.duration);
    };

    const keyboardWillChangeFrameSubscription = Keyboard.addListener(
      'keyboardWillChangeFrame',
      handleKeyboardWillChangeFrame
    );
    const keyboardWillHideSubscription = Keyboard.addListener(
      'keyboardWillHide',
      handleKeyboardWillHide
    );

    return () => {
      keyboardWillChangeFrameSubscription.remove();
      keyboardWillHideSubscription.remove();
    };
  }, [animateIosKeyboardLift, isCaptureTextEntryFocused, updateIosKeyboardLift]);

  useEffect(() => {
    if (Platform.OS !== 'ios') {
      return;
    }

    if (!isCaptureTextEntryFocused) {
      animateIosKeyboardLift(0);
      return;
    }

    scheduleIosKeyboardLiftUpdate();
  }, [animateIosKeyboardLift, isCaptureTextEntryFocused, scheduleIosKeyboardLiftUpdate]);

  useEffect(
    () => () => {
      if (pendingIosKeyboardLiftTimeoutRef.current != null) {
        clearTimeout(pendingIosKeyboardLiftTimeoutRef.current);
      }
    },
    []
  );

  const {
    applyImportedSticker,
    changeStickerPlacements: handleChangeStickerPlacements,
    clearDoodle: handleClearDoodle,
    closeDecorateControls,
    doodleColor,
    doodleColorOptions,
    doodleModeEnabled,
    doodleStrokes,
    pressStickerCanvas: handlePressStickerCanvasInternal,
    resetDoodle,
    resetStickers,
    selectDoodleColor: handleSelectDoodleColor,
    selectedStickerId,
    selectSticker: selectStickerPlacement,
    stickerModeEnabled,
    stickerPlacements,
    toggleDoodleMode: toggleDoodleModeInternal,
    toggleStickerMode: toggleStickerModeInternal,
    undoDoodle: handleUndoDoodle,
    setPhotoDoodleStrokes,
    setTextDoodleStrokes,
  } = useCaptureCardDecorations({
    captureMode,
    capturedPhoto,
    captureCardTextColor: colors.captureCardText,
    photoDoodleDefaultColor: PHOTO_DOODLE_DEFAULT_COLOR,
    primaryColor: colors.primary,
    dismissCaptureInputs,
    enablePhotoStickers: ENABLE_PHOTO_STICKERS,
  });

  const {
    closeStickerOverlays,
    dismissPastePrompt,
    handleCloseStampCutterEditor,
    handleCloseStampPreviewEditor,
    handleCloseStickerCutoutPreviewEditor,
    handleCompleteStampCutterPlacement: handleCompleteStampCutterPlacementInternal,
    handleCloseStickerSourceSheet,
    handleConfirmStampCutter,
    handleConfirmStampPreview,
    handleConfirmStickerCutoutPreview,
    handleConfirmPasteFromPrompt,
    handleInlinePasteStickerPress,
    handleNativeInlinePasteStickerPress,
    handleSelectedStickerAction,
    handleSelectSticker,
    handleShowCardPastePrompt,
    handleShowStickerSourceOptions,
    handleToggleStickerMode,
    importingSticker,
    inlinePasteLoading,
    pastePrompt,
    showInlinePasteButton,
    showStampCutterEditor,
    showStampPreviewEditor,
    showStickerCutoutPreviewEditor,
    showStickerSourceSheet,
    stampCutterDraft,
    stampPreviewDraft,
    stickerCutoutPreviewDraft,
    stickerSourceActions,
    useNativeInlinePasteButton,
  } = useCaptureCardStickerFlow({
    captureMode,
    t,
    cardSize: CARD_SIZE,
    enablePhotoStickers: ENABLE_PHOTO_STICKERS,
    noteText,
    isNoteInputFocused,
    doodleModeEnabled,
    stickerModeEnabled,
    interactionsDisabled,
    selectedStickerId,
    stickerPlacements,
    applyImportedSticker,
    dismissOverlay: dismissCaptureInputs,
    onChangeStickerPlacements: handleChangeStickerPlacements,
    selectSticker: selectStickerPlacement,
    toggleStickerMode: toggleStickerModeInternal,
  });

  useEffect(() => {
    if (!stickerEntryAnimation) {
      return;
    }

    if (!stickerPlacements.some((placement) => placement.id === stickerEntryAnimation.placementId)) {
      setStickerEntryAnimation(null);
    }
  }, [stickerEntryAnimation, stickerPlacements]);

  const handleCompleteStampCutterPlacement = useCallback(
    ({
      placement,
      entryDelayMs,
      sourceRect,
    }: {
      placement: NoteStickerPlacement;
      entryDelayMs?: number;
      sourceRect: WindowRect;
    }) => {
      setStickerEntryAnimation({
        placementId: placement.id,
        sourceRect,
        startDelayMs: entryDelayMs,
      });
      handleCompleteStampCutterPlacementInternal(placement);
    },
    [handleCompleteStampCutterPlacementInternal]
  );

  const handleStickerEntryAnimationComplete = useCallback((placementId: string) => {
    setStickerEntryAnimation((current) => (
      current?.placementId === placementId ? null : current
    ));
  }, []);

  const {
    handleCloseNoteColorSheet,
    handleCloseRadiusSheet,
    handleOpenNoteColorSheet,
    handlePressLockedNoteColor,
    handleSelectNoteColor,
    handleSelectRadius,
    showNoteColorSheet,
    showRadiusSheet,
  } = useCaptureCardMetaSheets({
    captureMode,
    isSearching,
    onChangeNoteColor,
    onChangeRadius,
    onPressLockedNoteColor,
    onHaptic: triggerCaptureCardHaptic,
  });

  const {
    cameraFocusPoint,
    cameraFocusRingAnimatedStyle,
    cameraKey,
    cameraPreviewZoom,
    cameraZoomLabel,
    cameraTransitionMaskAnimatedStyle,
    cameraUnavailableDetail,
    cameraZoomGesture,
    canShowLiveCameraPreview,
    handleCameraInitialized,
    handleCameraPreviewStarted,
    handleCameraStartupFailure,
    handleShutterLongPress,
    handleShutterPress,
    handleShutterRelease,
    handleSwitchCameraPress,
    livePhotoCountdownSeconds,
    livePhotoProgressPath,
    livePhotoRingProgress,
    restartCameraPreview,
    shouldRenderCameraPreview,
    shouldShowCameraCard,
    showCameraUnavailableState,
    showCameraZoomBadge,
    shutterCaptureHaloAnimatedStyle,
    shutterInnerAnimatedStyle,
    shutterOuterAnimatedStyle,
  } = useCaptureCardCameraController({
    captureMode,
    capturedPhoto,
    cameraRef,
    cameraDevice,
    cameraSessionKey,
    permissionGranted,
    isCameraPreviewActive,
    isCameraRevealAllowed,
    facing,
    cameraInstructionText,
    isLivePhotoCaptureInProgress,
    interactionsDisabled,
    reduceMotionEnabled,
    shutterScale,
    colors: {
      border: colors.border,
      primary: colors.primary,
    },
    t,
    cardSize: CARD_SIZE,
    livePhotoRingStrokeWidth: LIVE_PHOTO_RING_STROKE_WIDTH,
    onCameraGestureActiveChange: setCameraGestureActive,
    onToggleFacing,
    onTakePicture,
    onShutterPressOut,
    onStartLivePhotoCapture,
  });

  const handleToggleDoodleMode = useCallback(() => {
    dismissPastePrompt();
    toggleDoodleModeInternal();
  }, [dismissPastePrompt, toggleDoodleModeInternal]);

  const handlePressStickerCanvas = useCallback(() => {
    dismissPastePrompt();
    handlePressStickerCanvasInternal();
  }, [dismissPastePrompt, handlePressStickerCanvasInternal]);

  const disableAndroidCaptureTransforms =
    Platform.OS === 'android' &&
    !isModeSwitchAnimating &&
    (captureMode === 'camera' || (captureMode === 'text' && isTextEntryFocused));
  const shouldUseSimpleKeyboardAvoidance = Platform.OS === 'ios' && isCaptureTextEntryFocused;
  const androidTextEntryBottomInset =
    Platform.OS === 'android' && isCaptureTextEntryFocused ? 96 : 0;
  const captureKeyboardVerticalOffset = topInset + 76;

  useEffect(() => {
    if (saveState === 'success') {
      saveSuccessProgress.value = withTiming(
        1,
        getCaptureTiming(CAPTURE_SAVE_SUCCESS_SCALE, reduceMotionEnabled)
      );
      saveStateScale.value = withSequence(
        withTiming(reduceMotionEnabled ? 1.01 : 1.05, getCaptureTiming(CAPTURE_SAVE_BUSY_SCALE, reduceMotionEnabled)),
        withTiming(1, getCaptureTiming(CAPTURE_SAVE_SUCCESS_RESET, reduceMotionEnabled))
      );
      return;
    }

    saveSuccessProgress.value = withTiming(
      0,
      getCaptureTiming(CAPTURE_SAVE_SUCCESS_EXIT, reduceMotionEnabled)
    );
    saveStateScale.value = withTiming(
      saveState === 'saving' ? 0.98 : 1,
      getCaptureTiming(CAPTURE_SAVE_BUSY_SCALE, reduceMotionEnabled)
    );
  }, [reduceMotionEnabled, saveState, saveStateScale, saveSuccessProgress]);

  useEffect(() => {
    if (isSaveDisabled) {
      savePressScale.value = 1;
    }
  }, [isSaveDisabled, savePressScale]);

  useEffect(() => {
    if (!recentAutoEmoji) {
      autoEmojiPopOpacity.value = 0;
      autoEmojiPopTranslateY.value = 12;
      autoEmojiPopScale.value = 0.86;
      return;
    }

    autoEmojiPopOpacity.value = withSequence(
      withTiming(1, getCaptureTiming(CAPTURE_EMOJI_POP_ENTER, reduceMotionEnabled)),
      withTiming(1, getCaptureTiming(CAPTURE_EMOJI_POP_HOLD, reduceMotionEnabled)),
      withTiming(0, getCaptureTiming(CAPTURE_EMOJI_POP_EXIT, reduceMotionEnabled))
    );
    autoEmojiPopTranslateY.value = withSequence(
      withTiming(
        reduceMotionEnabled ? 0 : -12,
        getCaptureTiming(CAPTURE_EMOJI_POP_LIFT, reduceMotionEnabled)
      ),
      withTiming(
        reduceMotionEnabled ? 0 : -18,
        getCaptureTiming(CAPTURE_EMOJI_POP_DRIFT, reduceMotionEnabled)
      )
    );
    autoEmojiPopScale.value = withSequence(
      withTiming(1.06, getCaptureTiming(CAPTURE_EMOJI_POP_BOUNCE, reduceMotionEnabled)),
      withTiming(1, getCaptureTiming(CAPTURE_EMOJI_POP_SETTLE, reduceMotionEnabled))
    );
  }, [
    autoEmojiPopOpacity,
    autoEmojiPopScale,
    autoEmojiPopTranslateY,
    recentAutoEmoji,
    reduceMotionEnabled,
  ]);

  useEffect(() => {
    closeDecorateControls();
    closeStickerOverlays();
    setCanvasGestureActive(false);
    setCameraGestureActive(false);
  }, [captureMode, capturedPhoto, closeDecorateControls, closeStickerOverlays]);

  useEffect(() => {
    if (!doodleModeEnabled && !stickerModeEnabled) {
      setCanvasGestureActive(false);
    }
  }, [doodleModeEnabled, stickerModeEnabled]);

  useEffect(() => {
    const wasTextDraftEmpty = previousTextDraftEmptyRef.current;
    const previousCaptureMode = previousCaptureModeRef.current;
    previousTextDraftEmptyRef.current = rotatePlaceholderIfNeeded(
      previousCaptureMode,
      wasTextDraftEmpty
    );
    previousCaptureModeRef.current = captureMode;
  }, [captureMode, rotatePlaceholderIfNeeded]);

  useEffect(() => {
    onDoodleModeChange?.(
      (captureMode === 'text' || Boolean(capturedPhoto)) &&
        (doodleModeEnabled || stickerModeEnabled)
    );
  }, [captureMode, capturedPhoto, doodleModeEnabled, onDoodleModeChange, stickerModeEnabled]);

  useEffect(() => {
    onInteractionLockChange?.(
      canvasGestureActive || cameraGestureActive || isLivePhotoCaptureInProgress
    );
  }, [
    canvasGestureActive,
    cameraGestureActive,
    isLivePhotoCaptureInProgress,
    onInteractionLockChange,
  ]);

  useEffect(() => {
    if (!isModeSwitchAnimating) {
      return;
    }

    closeDecorateControls();
    closeStickerOverlays();
  }, [closeDecorateControls, closeStickerOverlays, isModeSwitchAnimating]);

  const handleSavePressIn = useCallback(() => {
    if (isSaveDisabled) {
      return;
    }

    savePressScale.value = withTiming(0.85, CAPTURE_BUTTON_PRESS_IN);
  }, [isSaveDisabled, savePressScale]);

  const handleSavePressOut = useCallback(() => {
    savePressScale.value = withTiming(1, CAPTURE_BUTTON_PRESS_OUT);
  }, [savePressScale]);

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
      dismissInputs: dismissCaptureInputs,
    }),
    [
      closeDecorateControls,
      dismissCaptureInputs,
      doodleModeEnabled,
      doodleStrokes,
      resetDoodle,
      resetStickers,
      stickerModeEnabled,
      stickerPlacements,
    ]
  );

  const animatedSaveInnerStyle = useAnimatedStyle(
    () => ({
      backgroundColor: colors.primary,
      transform: [{ scale: saveStateScale.value }],
    }),
    [colors.primary, saveStateScale]
  );
  const animatedSaveHaloStyle = useAnimatedStyle(() => ({
    opacity: saveSuccessProgress.value * (reduceMotionEnabled ? 0.16 : 0.28),
    transform: [
      { scale: 1 + saveSuccessProgress.value * (reduceMotionEnabled ? 0.03 : 0.08) },
    ],
  }));
  const animatedSaveIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + saveSuccessProgress.value * 0.12 }],
  }));
  const animatedAutoEmojiPopStyle = useAnimatedStyle(
    () => ({
      opacity: autoEmojiPopOpacity.value,
      transform: [
        { translateY: autoEmojiPopTranslateY.value },
        { scale: autoEmojiPopScale.value },
      ],
    }),
    [autoEmojiPopOpacity, autoEmojiPopScale, autoEmojiPopTranslateY]
  );
  const captureAreaAnimatedStyle = useAnimatedStyle(
    () => ({
      transform: [
        { translateY: captureTranslateY.value - iosKeyboardLift.value },
        { scale: captureScale.value },
      ],
    }),
    [captureScale, captureTranslateY, iosKeyboardLift]
  );
  const belowCardAnimatedStyle = useAnimatedStyle(
    () => ({
      transform: [
        { translateY: captureTranslateY.value },
        { scale: captureScale.value },
      ],
    }),
    [captureScale, captureTranslateY]
  );
  const captureCoverAnimatedStyle = useAnimatedStyle(
    () => ({
      opacity: captureCoverOpacity.value,
    }),
    [captureCoverOpacity]
  );
  const savePressAnimatedStyle = useAnimatedStyle(
    () => ({
      transform: [{ scale: savePressScale.value }],
    }),
    [savePressScale]
  );

  const handleCameraRetryPress = useCallback(() => {
    triggerCaptureCardHaptic();
    restartCameraPreview(true);
  }, [restartCameraPreview]);

  const handleRequestCameraPermissionPress = useCallback(() => {
    triggerCaptureCardHaptic();
    onRequestCameraPermission();
  }, [onRequestCameraPermission]);

  const handlePhotoSurfaceReady = useCallback(() => {
    setPendingPhotoReveal(false);
  }, []);

  const shouldShowCaptureCover =
    captureMode === 'camera' && (isStillPhotoCaptureInProgress || pendingPhotoReveal);
  const cameraUiStage: CameraUiStage =
    captureMode !== 'camera'
      ? 'text'
      : shouldShowCaptureCover
        ? 'capturing'
        : capturedPhoto
          ? 'review'
          : 'live';
  const isCameraUiCapturing = cameraUiStage === 'capturing';
  const shouldRenderPhotoCaptureSurface =
    captureMode === 'camera' &&
    Boolean(capturedPhoto) &&
    (cameraUiStage === 'capturing' || cameraUiStage === 'review');
  const shouldRenderLiveCameraSurface =
    captureMode === 'camera' &&
    shouldShowCameraCard &&
    (cameraUiStage === 'live' || cameraUiStage === 'capturing');
  const controlsUiStage: CameraUiStage =
    captureMode === 'camera' && shouldRenderCaptureCover ? 'capturing' : cameraUiStage;

  useEffect(() => {
    if (shouldShowCaptureCover) {
      setShouldRenderCaptureCover(true);
      captureCoverOpacity.value = withTiming(1, {
        duration: scaleCaptureDuration(140, reduceMotionEnabled),
        easing: Easing.out(Easing.quad),
      });
      return;
    }

    if (!shouldRenderCaptureCover) {
      captureCoverOpacity.value = 0;
      return;
    }

    captureCoverOpacity.value = withTiming(
      0,
      {
        duration: scaleCaptureDuration(680, reduceMotionEnabled),
        easing: Easing.out(Easing.cubic),
      },
      (finished) => {
        if (finished) {
          runOnJS(setShouldRenderCaptureCover)(false);
        }
      }
    );
  }, [
    captureCoverOpacity,
    reduceMotionEnabled,
    shouldRenderCaptureCover,
    shouldShowCaptureCover,
  ]);

  const noteColorSheetBody = onChangeNoteColor ? (
    <AppSheetScaffold
      headerVariant="standard"
      title={t('capture.noteColor', 'Card color')}
      subtitle={t(
        'capture.noteColorHint',
        'Pick the gradient you want before saving this note.'
      )}
      contentContainerStyle={styles.noteColorSheet}
    >
      <View>
        <NoteColorPicker
          selectedColor={effectiveTextModeNoteColor ?? DEFAULT_NOTE_COLOR_ID}
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
      subtitle={t('capture.radiusPickerHint', 'Pick how close you need to be.')}
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
      <View
        style={[
          styles.snapItem,
          {
            height: snapHeight,
            paddingTop: topInset + Layout.headerHeight - DOCKED_HEADER_CONTENT_OVERLAP,
            paddingBottom: pageBottomInset + androidTextEntryBottomInset,
          },
        ]}
      >
        <Reanimated.View
          testID="capture-card-area"
          style={[
            styles.captureArea,
            disableAndroidCaptureTransforms ? null : captureAreaAnimatedStyle,
          ]}
          pointerEvents={
            isSearching || interactionsDisabled || isCameraUiCapturing ? 'none' : 'auto'
          }
        >
          {cameraUiStage === 'text' ? (
            <TextCaptureSurface
              activeTextPlaceholder={activeTextPlaceholder}
              animatedAutoEmojiPopStyle={animatedAutoEmojiPopStyle}
              colors={colors}
              doodleColor={doodleColor}
              doodleModeEnabled={doodleModeEnabled}
              doodleStrokes={doodleStrokes}
              handleChangeNoteText={handleChangeNoteText}
              handleChangeStickerPlacements={handleChangeStickerPlacements}
              handleNoteInputBlur={handleNoteInputBlur}
              handleNoteInputFocus={() => {
                handleNoteInputFocus();
                scheduleIosKeyboardLiftUpdate();
              }}
              handlePressStickerCanvas={handlePressStickerCanvas}
              handleSelectedStickerAction={handleSelectedStickerAction}
              handleSelectSticker={handleSelectSticker}
              interactionsDisabled={interactionsDisabled}
              noteInputRef={noteInputRef}
              noteColor={effectiveTextModeNoteColor}
              noteText={noteText}
              onCanvasGestureActiveChange={setCanvasGestureActive}
              recentAutoEmoji={recentAutoEmoji}
              selectedStickerId={selectedStickerId}
              setTextDoodleStrokes={setTextDoodleStrokes}
              stickerEntryAnimation={stickerEntryAnimation}
              stickerModeEnabled={stickerModeEnabled}
              stickerPlacements={stickerPlacements}
              textInputDynamicStyle={textInputDynamicStyle}
              onStickerEntryAnimationComplete={handleStickerEntryAnimationComplete}
            />
          ) : (
            <View style={styles.cameraSurfaceStack}>
              {shouldRenderLiveCameraSurface ? (
                <View style={styles.cameraSurfaceLayer}>
                  <LiveCameraSurface
                    cameraDevice={cameraDevice}
                    cameraFocusPoint={cameraFocusPoint}
                    cameraFocusRingAnimatedStyle={cameraFocusRingAnimatedStyle}
                    cameraKey={cameraKey}
                    cameraPermissionRequiresSettings={cameraPermissionRequiresSettings}
                    cameraPreviewZoom={cameraPreviewZoom}
                    cameraRef={cameraRef}
                    cameraTransitionMaskAnimatedStyle={cameraTransitionMaskAnimatedStyle}
                    cameraUnavailableDetail={cameraUnavailableDetail}
                    cameraZoomGesture={cameraZoomGesture}
                    cameraZoomLabel={cameraZoomLabel}
                    canShowLiveCameraPreview={canShowLiveCameraPreview}
                    colors={colors}
                    facing={facing}
                    captureCoverAnimatedStyle={captureCoverAnimatedStyle}
                    handleCameraInitialized={handleCameraInitialized}
                    handleCameraPreviewStarted={handleCameraPreviewStarted}
                    handleCameraRetryPress={handleCameraRetryPress}
                    handleCameraStartupFailure={handleCameraStartupFailure}
                    handleRequestCameraPermissionPress={handleRequestCameraPermissionPress}
                    isLivePhotoCaptureInProgress={isLivePhotoCaptureInProgress}
                    livePhotoProgressPath={livePhotoProgressPath}
                    livePhotoRingProgress={livePhotoRingProgress}
                    needsCameraPermission={needsCameraPermission}
                    shouldRenderCameraPreview={shouldRenderCameraPreview}
                    showCaptureCover={
                      shouldRenderCaptureCover && !shouldRenderPhotoCaptureSurface
                    }
                    showCameraUnavailableState={showCameraUnavailableState}
                    showCameraZoomBadge={showCameraZoomBadge}
                    t={t}
                  />
                </View>
              ) : null}
              {shouldRenderPhotoCaptureSurface && capturedPhoto ? (
                <View style={[styles.cameraSurfaceLayer, styles.cameraSurfaceTopLayer]}>
                  <PhotoCaptureSurface
                    capturedPairedVideo={capturedPairedVideo}
                    capturedPhoto={capturedPhoto}
                    captureCoverAnimatedStyle={captureCoverAnimatedStyle}
                    colors={colors}
                    dismissPastePrompt={dismissPastePrompt}
                    doodleColor={doodleColor}
                    doodleModeEnabled={doodleModeEnabled}
                    doodleStrokes={doodleStrokes}
                    handleChangeStickerPlacements={handleChangeStickerPlacements}
                    handleConfirmPasteFromPrompt={handleConfirmPasteFromPrompt}
                    handlePressStickerCanvas={handlePressStickerCanvas}
                    handleSelectedStickerAction={handleSelectedStickerAction}
                    handleSelectSticker={handleSelectSticker}
                    handleShowCardPastePrompt={handleShowCardPastePrompt}
                    hasLivePhotoMotion={hasLivePhotoMotion}
                    interactionsDisabled={interactionsDisabled}
                    noteInputRef={noteInputRef}
                    noteText={noteText}
                    onCanvasGestureActiveChange={setCanvasGestureActive}
                    onChangeNoteText={onChangeNoteText}
                    onChangePhotoFilter={onChangePhotoFilter}
                    lockedPhotoFilterIds={lockedPhotoFilterIds}
                    onPressLockedPhotoFilter={onPressLockedPhotoFilter}
                    onPhotoCaptionBlur={handlePhotoCaptionBlur}
                    onPhotoCaptionFocus={handlePhotoCaptionFocus}
                    onPhotoSurfaceReady={handlePhotoSurfaceReady}
                    pastePrompt={pastePrompt}
                    selectedPhotoFilterId={selectedPhotoFilterId}
                    selectedStickerId={selectedStickerId}
                    setPhotoDoodleStrokes={setPhotoDoodleStrokes}
                    showCaptureCover={shouldRenderCaptureCover}
                    stickerEntryAnimation={stickerEntryAnimation}
                    stickerModeEnabled={stickerModeEnabled}
                    stickerPlacements={stickerPlacements}
                    t={t}
                    onStickerEntryAnimationComplete={handleStickerEntryAnimationComplete}
                  />
                </View>
              ) : null}
            </View>
          )}
        </Reanimated.View>

        <KeyboardAvoidingView
          enabled={shouldUseSimpleKeyboardAvoidance}
          behavior="padding"
          keyboardVerticalOffset={captureKeyboardVerticalOffset}
          style={styles.captureKeyboardAvoiding}
        >
          <Reanimated.View
            style={[
              styles.belowCardSection,
              disableAndroidCaptureTransforms ? null : belowCardAnimatedStyle,
            ]}
            pointerEvents={interactionsDisabled || isCameraUiCapturing ? 'none' : 'auto'}
          >
            <View style={styles.belowCardMetaRow} pointerEvents="box-none">
              {controlsUiStage === 'text' ? (
                <Reanimated.View
                  key="toolbar-text"
                  style={styles.belowCardToolbarLayer}
                >
                  <TextCaptureBottomBar
                    colors={colors}
                    doodleColor={doodleColor}
                    doodleColorOptions={doodleColorOptions}
                    doodleModeEnabled={doodleModeEnabled}
                    doodleStrokes={doodleStrokes}
                    handleClearDoodle={handleClearDoodle}
                    handleInlinePasteStickerPress={handleInlinePasteStickerPress}
                    handleNativeInlinePasteStickerPress={handleNativeInlinePasteStickerPress}
                    handleOpenNoteColorSheet={handleOpenNoteColorSheet}
                    handleSelectDoodleColor={handleSelectDoodleColor}
                    handleSelectedStickerAction={handleSelectedStickerAction}
                    handleShowStickerSourceOptions={handleShowStickerSourceOptions}
                    handleToggleDoodleMode={handleToggleDoodleMode}
                    handleToggleStickerMode={handleToggleStickerMode}
                    handleUndoDoodle={handleUndoDoodle}
                    importingSticker={importingSticker}
                    inlinePasteLoading={inlinePasteLoading}
                    noteColor={effectiveTextModeNoteColor}
                    showInlinePasteButton={showInlinePasteButton}
                    stickerModeEnabled={stickerModeEnabled}
                    t={t}
                    useNativeInlinePasteButton={useNativeInlinePasteButton}
                  />
                </Reanimated.View>
              ) : controlsUiStage === 'review' ? (
                <Reanimated.View
                  key="toolbar-review"
                  style={styles.belowCardToolbarLayer}
                >
                  <PhotoCaptureBottomBar
                    colors={colors}
                    doodleColor={doodleColor}
                    doodleColorOptions={doodleColorOptions}
                    doodleModeEnabled={doodleModeEnabled}
                    doodleStrokes={doodleStrokes}
                    handleClearDoodle={handleClearDoodle}
                    handleSelectDoodleColor={handleSelectDoodleColor}
                    handleSelectedStickerAction={handleSelectedStickerAction}
                    handleShowStickerSourceOptions={handleShowStickerSourceOptions}
                    handleToggleDoodleMode={handleToggleDoodleMode}
                    handleToggleStickerMode={handleToggleStickerMode}
                    handleUndoDoodle={handleUndoDoodle}
                    hasLivePhotoMotion={hasLivePhotoMotion}
                    importingSticker={importingSticker}
                    onImportMotionClip={onImportMotionClip}
                    onRemoveMotionClip={onRemoveMotionClip}
                    stickerModeEnabled={stickerModeEnabled}
                    t={t}
                  />
                </Reanimated.View>
              ) : (
                <Reanimated.View
                  key="toolbar-live"
                  style={styles.belowCardToolbarLayer}
                >
                  <LiveCameraActionBar
                    cameraInstructionText={cameraInstructionText}
                    colors={colors}
                    importingPhoto={importingPhoto}
                    libraryImportLocked={libraryImportLocked}
                    needsCameraPermission={needsCameraPermission}
                    onOpenPhotoLibrary={onOpenPhotoLibrary}
                    t={t}
                  />
                </Reanimated.View>
              )}
            </View>
            <CaptureActionRow
              animatedSaveHaloStyle={animatedSaveHaloStyle}
              animatedSaveIconStyle={animatedSaveIconStyle}
              animatedSaveInnerStyle={animatedSaveInnerStyle}
              colors={colors}
              cameraUiStage={controlsUiStage}
              handleSavePressIn={handleSavePressIn}
              handleSavePressOut={handleSavePressOut}
              handleShutterLongPress={handleShutterLongPress}
              handleShutterPress={handleShutterPress}
              handleShutterRelease={handleShutterRelease}
              handleSwitchCameraPress={handleSwitchCameraPress}
              isLivePhotoCaptureInProgress={isLivePhotoCaptureInProgress}
              isSaveBusy={isSaveBusy}
              isSaveDisabled={isSaveDisabled}
              isSaveSuccessful={isSaveSuccessful}
              isSharedTarget={isSharedTarget}
              livePhotoCountdownSeconds={livePhotoCountdownSeconds}
              onChangeShareTarget={onChangeShareTarget}
              onRetakePhoto={onRetakePhoto}
              onSaveNote={onSaveNote}
              onShutterPressIn={onShutterPressIn}
              permissionGranted={permissionGranted}
              remainingPhotoSlots={remainingPhotoSlots}
              savePressAnimatedStyle={savePressAnimatedStyle}
              shareTarget={shareTarget}
              showCameraUnavailableState={showCameraUnavailableState}
              shutterCaptureHaloAnimatedStyle={shutterCaptureHaloAnimatedStyle}
              shutterInnerAnimatedStyle={shutterInnerAnimatedStyle}
              shutterOuterAnimatedStyle={shutterOuterAnimatedStyle}
              t={t}
            />
            {footerContent ? <View style={styles.footerSlot}>{footerContent}</View> : null}
          </Reanimated.View>
        </KeyboardAvoidingView>
      </View>

      <StickerSourceSheet
        visible={showStickerSourceSheet}
        title={t('capture.addStickerTitle', 'Add sticker')}
        subtitle={t(
          'capture.addStickerHint',
          'Choose a floating sticker or a photo stamp.'
        )}
        cancelLabel={t('common.cancel', 'Cancel')}
        actions={stickerSourceActions}
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

      <StampCutterEditor
        visible={showStampCutterEditor}
        draft={stampCutterDraft}
        loading={importingSticker}
        title={t('capture.stampCutterTitle', 'Cut stamp')}
        subtitle={t(
          'capture.stampCutterHint',
          'Drag, pinch, or use the controls to frame the part of the photo you want on the stamp.'
        )}
        cancelLabel={t('common.cancel', 'Cancel')}
        confirmLabel={t('capture.stampCutterConfirm', 'Cut stamp')}
        classicStyleLabel={t('capture.stampStyleClassic', 'Classic')}
        circleStyleLabel={t('capture.stampStyleCircle', 'Circle')}
        onClose={handleCloseStampCutterEditor}
        onCompletePlacement={handleCompleteStampCutterPlacement}
        onConfirm={handleConfirmStampCutter}
      />
      <StampPreviewEditor
        visible={showStampPreviewEditor}
        draft={stampPreviewDraft}
        loading={importingSticker}
        title={t('capture.stampPreviewTitle', 'Create stamp')}
        subtitle={t(
          'capture.stampPreviewHint',
          'Preview the full photo as a perforated stamp before adding it to your note.'
        )}
        cancelLabel={t('common.cancel', 'Cancel')}
        confirmLabel={t('capture.stampPreviewConfirm', 'Add stamp')}
        classicStyleLabel={t('capture.stampStyleClassic', 'Classic')}
        circleStyleLabel={t('capture.stampStyleCircle', 'Circle')}
        onClose={handleCloseStampPreviewEditor}
        onCompletePlacement={handleCompleteStampCutterPlacement}
        onConfirm={handleConfirmStampPreview}
      />
      <StickerCutoutPreviewEditor
        visible={showStickerCutoutPreviewEditor}
        draft={stickerCutoutPreviewDraft}
        loading={importingSticker}
        title={t('capture.stickerCutoutPreviewTitle', 'Create sticker')}
        subtitle={t(
          'capture.stickerCutoutPreviewHint',
          'Keep the lifted subject, then choose whether the sticker starts with an outline.'
        )}
        cancelLabel={t('common.cancel', 'Cancel')}
        confirmLabel={t('capture.stickerCutoutPreviewConfirm', 'Add sticker')}
        outlineOnLabel={t('capture.stickerOutlineOn', 'Outline on')}
        outlineOffLabel={t('capture.stickerOutlineOff', 'Outline off')}
        onClose={handleCloseStickerCutoutPreviewEditor}
        onCompletePlacement={handleCompleteStampCutterPlacement}
        onConfirm={handleConfirmStickerCutoutPreview}
      />
    </>
  );
});

export default CaptureCard;
