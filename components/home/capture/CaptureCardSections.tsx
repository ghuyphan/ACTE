import { Ionicons } from '@expo/vector-icons';
import { Canvas, Path as SkiaPath } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { TFunction } from 'i18next';
import { memo, type ComponentProps, type RefObject, useCallback, useMemo } from 'react';
import {
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { Camera, type CameraDevice } from 'react-native-vision-camera';
import Reanimated, { FadeOut, ZoomIn } from 'react-native-reanimated';
import { ENABLE_PHOTO_STICKERS } from '../../../constants/experiments';
import { CaptureChrome } from '../../../constants/theme';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import {
  formatCameraZoomFactor,
  getBackCameraLensZoomSpec,
  type BackCameraLens,
  type BackCameraLensZoomConfig,
} from '../../../services/cameraZoom';
import {
  getCaptureNoteGradient,
} from '../../../services/noteAppearance';
import type { NoteStickerPlacement } from '../../../services/noteStickers';
import type { PhotoFilterId } from '../../../services/photoFilters';
import NoteDoodleCanvas, { type DoodleStroke } from '../../notes/NoteDoodleCanvas';
import NoteStickerCanvas, { type StickerEntryAnimation } from '../../notes/NoteStickerCanvas';
import PhotoMediaView from '../../notes/PhotoMediaView';
import PremiumNoteFinishOverlay from '../../ui/PremiumNoteFinishOverlay';
import PrimaryButton from '../../ui/PrimaryButton';
import StickerPastePopover from '../../ui/StickerPastePopover';
import LivePhotoIcon from '../../ui/LivePhotoIcon';
import LivePhotoOffIcon from '../../ui/LivePhotoOffIcon';
import {
  DualCameraPreview,
  type DualCameraPreviewHandle,
} from './DualCameraPreview';
import { CaptureControlRail } from './CaptureControlRail';
import {
  CaptureAnimatedPressable,
  CaptureToggleIconButton,
  FilteredPhotoCanvas,
} from './CaptureControls';
import { LiveCameraFilterOverlay } from './LiveCameraFilterOverlay';
import { getCaptureChromePalette } from './captureControlVisuals';
import {
  CAMERA_FOCUS_RING_SIZE,
  CARD_SIZE,
  LIVE_PHOTO_RING_STROKE_WIDTH,
  PHOTO_CAPTION_MAX_LENGTH,
  styles,
} from './captureCardStyles';
import type {
  CaptureCardAnimatedStyle,
  CaptureCardColors,
  CaptureCardTextInputStyle,
  StickerAction,
} from './captureShared';

interface TextCaptureSurfaceProps {
  activeTextPlaceholder: string;
  animatedAutoEmojiPopStyle: CaptureCardAnimatedStyle;
  colors: CaptureCardColors;
  doodleColor: string;
  doodleModeEnabled: boolean;
  doodleStrokes: DoodleStroke[];
  handleChangeNoteText: (nextText: string) => void;
  handleChangeStickerPlacements: (nextPlacements: NoteStickerPlacement[]) => void;
  handleNoteInputBlur: () => void;
  handleNoteInputFocus: () => void;
  handlePressStickerCanvas: () => void;
  handleSelectedStickerAction: (action: StickerAction) => void;
  handleSelectSticker: (nextId: string | null) => void;
  interactionsDisabled: boolean;
  noteInputRef: RefObject<TextInput | null>;
  noteColor?: string | null;
  noteText: string;
  onCanvasGestureActiveChange: (active: boolean) => void;
  recentAutoEmoji: { emoji: string; token: number } | null;
  selectedStickerId: string | null;
  setTextDoodleStrokes: (nextStrokes: DoodleStroke[]) => void;
  stickerEntryAnimation: StickerEntryAnimation | null;
  stickerModeEnabled: boolean;
  stickerPlacements: NoteStickerPlacement[];
  textInputDynamicStyle: CaptureCardTextInputStyle;
  onStickerEntryAnimationComplete: (placementId: string) => void;
}

export const TextCaptureSurface = memo(function TextCaptureSurface({
  activeTextPlaceholder,
  animatedAutoEmojiPopStyle,
  colors,
  doodleColor,
  doodleModeEnabled,
  doodleStrokes,
  handleChangeNoteText,
  handleChangeStickerPlacements,
  handleNoteInputBlur,
  handleNoteInputFocus,
  handlePressStickerCanvas,
  handleSelectedStickerAction,
  handleSelectSticker,
  interactionsDisabled,
  noteInputRef,
  noteColor = null,
  noteText,
  onCanvasGestureActiveChange,
  recentAutoEmoji,
  selectedStickerId,
  setTextDoodleStrokes,
  stickerEntryAnimation,
  stickerModeEnabled,
  stickerPlacements,
  textInputDynamicStyle,
  onStickerEntryAnimationComplete,
}: TextCaptureSurfaceProps) {
  const captureGradient = getCaptureNoteGradient({
    noteColor,
    fallbackGradient: colors.captureGradient ?? colors.gradient ?? null,
    colorScheme: colors.captureGlassColorScheme,
  });
  const usesLightCaptureChrome = colors.captureGlassColorScheme === 'light';
  const handleToggleSelectedPlacementMotionLock = useCallback(
    () => handleSelectedStickerAction('motion-lock-toggle'),
    [handleSelectedStickerAction]
  );
  const handleToggleSelectedPlacementOutline = useCallback(
    () => handleSelectedStickerAction('outline-toggle'),
    [handleSelectedStickerAction]
  );
  const handleRemoveSelectedPlacement = useCallback(
    () => handleSelectedStickerAction('remove'),
    [handleSelectedStickerAction]
  );

  return (
    <View
      style={[
        styles.textCardShadow,
        usesLightCaptureChrome ? styles.textCardShadowLightContrast : null,
        {
          shadowColor: usesLightCaptureChrome ? colors.text : CaptureChrome.shadowDark,
        },
      ]}
    >
      <LinearGradient
        style={[
          styles.textCard,
          usesLightCaptureChrome ? styles.textCardLightContrast : null,
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

        {ENABLE_PHOTO_STICKERS && (stickerPlacements.length > 0 || stickerModeEnabled) ? (
          <View
            pointerEvents={stickerModeEnabled ? 'box-none' : 'none'}
            style={styles.textStickerCanvasLayer}
          >
            <NoteStickerCanvas
              placements={stickerPlacements}
              editable={stickerModeEnabled}
              stampShadowEnabled={false}
              onChangePlacements={handleChangeStickerPlacements}
              onGestureActiveChange={onCanvasGestureActiveChange}
              selectedPlacementId={selectedStickerId}
              onChangeSelectedPlacementId={handleSelectSticker}
              onPressCanvas={handlePressStickerCanvas}
              entryAnimation={stickerEntryAnimation}
              onEntryAnimationComplete={onStickerEntryAnimationComplete}
              onToggleSelectedPlacementMotionLock={handleToggleSelectedPlacementMotionLock}
              onToggleSelectedPlacementOutline={handleToggleSelectedPlacementOutline}
              onRemoveSelectedPlacement={handleRemoveSelectedPlacement}
            />
          </View>
        ) : null}
        {doodleStrokes.length > 0 || doodleModeEnabled ? (
          <View
            pointerEvents={doodleModeEnabled ? 'auto' : 'none'}
            style={styles.doodleCanvasLayer}
          >
            <NoteDoodleCanvas
              strokes={doodleStrokes}
              editable={doodleModeEnabled}
              activeColor={doodleColor}
              onChangeStrokes={setTextDoodleStrokes}
              onGestureActiveChange={onCanvasGestureActiveChange}
            />
          </View>
        ) : null}

        <View
          pointerEvents={doodleModeEnabled || stickerModeEnabled ? 'none' : 'auto'}
          style={styles.cardTextCenter}
        >
          {recentAutoEmoji ? (
            <Reanimated.View
              pointerEvents="none"
              testID="capture-auto-emoji-pop"
              style={[
                styles.autoEmojiPopWrap,
                {
                  backgroundColor: `${colors.captureGlassFill}F4`,
                  borderColor: colors.captureGlassBorder,
                  shadowColor: colors.primary,
                },
                animatedAutoEmojiPopStyle,
              ]}
            >
              <Text testID="capture-auto-emoji-pop-label" style={styles.autoEmojiPopEmoji}>
                {recentAutoEmoji.emoji}
              </Text>
              <Ionicons name="sparkles" size={13} color={colors.primary} />
            </Reanimated.View>
          ) : null}
          <TextInput
            ref={noteInputRef}
            testID="capture-note-input"
            style={[
              styles.textInput,
              { color: colors.captureCardText },
              textInputDynamicStyle,
            ]}
            placeholder={activeTextPlaceholder}
            placeholderTextColor={colors.captureCardPlaceholder}
            multiline
            value={noteText}
            editable={!interactionsDisabled}
            onChangeText={handleChangeNoteText}
            onFocus={handleNoteInputFocus}
            onBlur={handleNoteInputBlur}
            maxLength={300}
            selectionColor={colors.primary}
          />
        </View>
      </LinearGradient>
    </View>
  );
});

interface PhotoCaptureSurfaceProps {
  capturedPairedVideo: string | null;
  capturedPhoto: string;
  captureCoverAnimatedStyle: CaptureCardAnimatedStyle;
  colors: CaptureCardColors;
  dismissPastePrompt: () => void;
  doodleColor: string;
  doodleModeEnabled: boolean;
  doodleStrokes: DoodleStroke[];
  handleChangeStickerPlacements: (nextPlacements: NoteStickerPlacement[]) => void;
  handleConfirmPasteFromPrompt: () => void;
  handlePressStickerCanvas: () => void;
  handleSelectedStickerAction: (action: StickerAction) => void;
  handleSelectSticker: (nextId: string | null) => void;
  handleShowCardPastePrompt: ComponentProps<typeof Pressable>['onLongPress'];
  hasLivePhotoMotion: boolean;
  interactionsDisabled: boolean;
  noteInputRef: RefObject<TextInput | null>;
  noteText: string;
  onCanvasGestureActiveChange: (active: boolean) => void;
  onChangeNoteText: (nextText: string) => void;
  onPhotoCaptionBlur: () => void;
  onPhotoCaptionFocus: () => void;
  onPhotoSurfaceReady: () => void;
  pastePrompt: {
    visible: boolean;
    x: number;
    y: number;
  };
  selectedPhotoFilterId: PhotoFilterId;
  selectedStickerId: string | null;
  setPhotoDoodleStrokes: (nextStrokes: DoodleStroke[]) => void;
  showCaptureCover: boolean;
  stickerEntryAnimation: StickerEntryAnimation | null;
  stickerModeEnabled: boolean;
  stickerPlacements: NoteStickerPlacement[];
  t: TFunction;
  onStickerEntryAnimationComplete: (placementId: string) => void;
}

export const PhotoCaptureSurface = memo(function PhotoCaptureSurface({
  capturedPairedVideo,
  capturedPhoto,
  captureCoverAnimatedStyle,
  colors,
  dismissPastePrompt,
  doodleColor,
  doodleModeEnabled,
  doodleStrokes,
  handleChangeStickerPlacements,
  handleConfirmPasteFromPrompt,
  handlePressStickerCanvas,
  handleSelectedStickerAction,
  handleSelectSticker,
  handleShowCardPastePrompt,
  hasLivePhotoMotion,
  interactionsDisabled,
  noteInputRef,
  noteText,
  onCanvasGestureActiveChange,
  onChangeNoteText,
  onPhotoCaptionBlur,
  onPhotoCaptionFocus,
  onPhotoSurfaceReady,
  pastePrompt,
  selectedPhotoFilterId,
  selectedStickerId,
  setPhotoDoodleStrokes,
  showCaptureCover,
  stickerEntryAnimation,
  stickerModeEnabled,
  stickerPlacements,
  t,
  onStickerEntryAnimationComplete,
}: PhotoCaptureSurfaceProps) {
  const photoPreviewControlBorder = hasLivePhotoMotion
    ? colors.captureGlassColorScheme === 'dark'
      ? CaptureChrome.livePhotoBorder.dark
      : CaptureChrome.livePhotoBorder.light
    : colors.captureCameraOverlayBorder;
  const handleToggleSelectedPlacementMotionLock = useCallback(
    () => handleSelectedStickerAction('motion-lock-toggle'),
    [handleSelectedStickerAction]
  );
  const handleToggleSelectedPlacementOutline = useCallback(
    () => handleSelectedStickerAction('outline-toggle'),
    [handleSelectedStickerAction]
  );
  const handleRemoveSelectedPlacement = useCallback(
    () => handleSelectedStickerAction('remove'),
    [handleSelectedStickerAction]
  );
  const handleClearPhotoCaption = useCallback(() => {
    onChangeNoteText('');
    noteInputRef.current?.focus();
  }, [noteInputRef, onChangeNoteText]);

  return (
    <View
      style={[styles.cameraContainer, { backgroundColor: colors.captureCameraOverlay }]}
    >
      {hasLivePhotoMotion ? (
        <>
          <PhotoMediaView
            imageUrl={capturedPhoto}
            isLivePhoto
            pairedVideoUri={capturedPairedVideo}
            showLiveBadge={false}
            style={styles.cameraPreview}
            imageStyle={styles.cameraPreview}
            enablePlayback
            onImageReady={onPhotoSurfaceReady}
          />
          <LiveCameraFilterOverlay
            filterId={selectedPhotoFilterId}
            width={CARD_SIZE}
            height={CARD_SIZE}
            style={styles.cameraPreview}
          />
        </>
      ) : (
        <FilteredPhotoCanvas
          sourceUri={capturedPhoto}
          filterId={selectedPhotoFilterId}
          width={CARD_SIZE}
          height={CARD_SIZE}
          style={styles.cameraPreview}
          onImageReady={onPhotoSurfaceReady}
        />
      )}
      {showCaptureCover ? (
        <Reanimated.View
          pointerEvents="none"
          style={[
            styles.captureTransitionCover,
            { backgroundColor: colors.captureFlashOverlay },
            captureCoverAnimatedStyle,
          ]}
        />
      ) : null}
      {ENABLE_PHOTO_STICKERS && !hasLivePhotoMotion ? (
        <Pressable
          testID="capture-card-paste-surface"
          style={styles.cardPasteSurface}
          onLongPress={handleShowCardPastePrompt}
          delayLongPress={320}
        />
      ) : null}
      {ENABLE_PHOTO_STICKERS && (stickerPlacements.length > 0 || stickerModeEnabled) ? (
        <View
          pointerEvents={stickerModeEnabled ? 'box-none' : 'none'}
          style={styles.doodleCanvasLayer}
        >
          <NoteStickerCanvas
            placements={stickerPlacements}
            editable={stickerModeEnabled}
            onChangePlacements={handleChangeStickerPlacements}
            onGestureActiveChange={onCanvasGestureActiveChange}
            selectedPlacementId={selectedStickerId}
            onChangeSelectedPlacementId={handleSelectSticker}
            onPressCanvas={handlePressStickerCanvas}
            entryAnimation={stickerEntryAnimation}
            onEntryAnimationComplete={onStickerEntryAnimationComplete}
            onToggleSelectedPlacementMotionLock={handleToggleSelectedPlacementMotionLock}
            onToggleSelectedPlacementOutline={handleToggleSelectedPlacementOutline}
            onRemoveSelectedPlacement={handleRemoveSelectedPlacement}
          />
        </View>
      ) : null}
      {doodleStrokes.length > 0 || doodleModeEnabled ? (
        <View
          pointerEvents={doodleModeEnabled ? 'auto' : 'none'}
          style={styles.doodleCanvasLayer}
        >
          <NoteDoodleCanvas
            strokes={doodleStrokes}
            editable={doodleModeEnabled}
            activeColor={doodleColor}
            onChangeStrokes={setPhotoDoodleStrokes}
            onGestureActiveChange={onCanvasGestureActiveChange}
          />
        </View>
      ) : null}
      <StickerPastePopover
        visible={pastePrompt.visible}
        anchor={{ x: pastePrompt.x, y: pastePrompt.y }}
        containerWidth={CARD_SIZE}
        containerHeight={CARD_SIZE}
        label={t('capture.pasteStickerAction', 'Paste sticker')}
        description={t(
          'capture.clipboardStickerReadyHint',
          'Copied image will be added as a sticker.'
        )}
        backgroundColor={CaptureChrome.stickerPastePopoverBackground}
        borderColor={photoPreviewControlBorder}
        secondaryTextColor={colors.captureGlassIcon}
        buttonBackgroundColor={colors.captureButtonBg}
        buttonTextColor={CaptureChrome.stickerPasteButtonText}
        onPress={handleConfirmPasteFromPrompt}
        onDismiss={dismissPastePrompt}
        popoverTestID="capture-card-paste-popover"
        actionTestID="capture-card-paste-action"
        dismissTestID="capture-card-paste-dismiss"
      />
      <View pointerEvents="box-none" style={styles.cardBottomOverlay}>
        <View
          testID="capture-photo-caption-container"
          style={[
            styles.photoCaptionOverlayField,
            {
              backgroundColor: colors.captureGlassFill,
              borderColor: photoPreviewControlBorder,
            },
          ]}
        >
          <Ionicons
            name="create-outline"
            size={16}
            color={colors.captureGlassIcon}
            style={styles.photoCaptionIcon}
          />
          <TextInput
            ref={noteInputRef}
            testID="capture-photo-caption-input"
            style={[styles.photoCaptionOverlayInput, { color: colors.captureGlassText }]}
            value={noteText}
            onChangeText={onChangeNoteText}
            onFocus={onPhotoCaptionFocus}
            onBlur={onPhotoCaptionBlur}
            editable={!interactionsDisabled && !doodleModeEnabled && !stickerModeEnabled}
            placeholder={t('capture.photoCaptionPlaceholder', 'Add a short note...')}
            placeholderTextColor={colors.captureGlassPlaceholder}
            maxLength={PHOTO_CAPTION_MAX_LENGTH}
            returnKeyType="done"
            blurOnSubmit
            selectionColor={colors.primary}
          />
          {noteText.trim().length > 0 ? (
            <Pressable
              testID="capture-photo-caption-clear"
              accessibilityRole="button"
              accessibilityLabel={t('capture.clearPhotoCaption', 'Clear caption')}
              hitSlop={8}
              onPress={handleClearPhotoCaption}
              style={styles.photoCaptionClearButton}
            >
              <Ionicons
                name="close-circle"
                size={18}
                color={colors.captureGlassPlaceholder}
              />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
});

interface LiveCameraSurfaceProps {
  backCameraLens: BackCameraLens;
  availableBackCameraLenses: BackCameraLens[];
  backCameraLensZoomConfig?: BackCameraLensZoomConfig;
  cameraDevice?: CameraDevice;
  cameraFocusPoint: { x: number; y: number } | null;
  cameraFocusRingAnimatedStyle: CaptureCardAnimatedStyle;
  cameraKey: number | string;
  cameraPermissionRequiresSettings: boolean;
  cameraPreviewZoom: number;
  cameraRef: RefObject<Camera | null>;
  cameraZoomSelectorLabel: string;
  dualCameraPreviewRef?: RefObject<DualCameraPreviewHandle | null>;
  dualCaptureAwaitingSecondShot?: boolean;
  dualCaptureFacingText?: string | null;
  dualCaptureFirstShotUri?: string | null;
  dualCaptureStepText?: string | null;
  dualCaptureStatusText?: string | null;
  dualCameraSupported?: boolean;
  dualModeEnabled?: boolean;
  cameraTransitionMaskAnimatedStyle: CaptureCardAnimatedStyle;
  cameraUnavailableDetail: string;
  cameraZoomGesture: ComponentProps<typeof GestureDetector>['gesture'];
  cameraZoomLabel: string;
  canShowLiveCameraPreview: boolean;
  colors: CaptureCardColors;
  facing: 'back' | 'front';
  captureCoverAnimatedStyle: CaptureCardAnimatedStyle;
  handleCameraInitialized: () => void;
  handleCameraPreviewStarted: () => void;
  handleCameraRetryPress: () => void;
  handleCameraStartupFailure: (message: string) => void;
  handleRequestCameraPermissionPress: () => void;
  isLivePhotoCaptureInProgress: boolean;
  livePhotoCaptureEnabled: boolean;
  livePhotoCaptureToggleDisabled: boolean;
  livePhotoProgressPath: ComponentProps<typeof SkiaPath>['path'];
  livePhotoRingProgress: number;
  needsCameraPermission: boolean;
  onChangeBackCameraLens: (nextLens: BackCameraLens) => void;
  onToggleLivePhotoCapture: () => void;
  shouldRenderCameraPreview: boolean;
  showCaptureCover: boolean;
  showCameraUnavailableState: boolean;
  showCameraZoomBadge: boolean;
  selectedPhotoFilterId: PhotoFilterId;
  t: TFunction;
}

export const LiveCameraSurface = memo(function LiveCameraSurface({
  backCameraLens,
  availableBackCameraLenses,
  backCameraLensZoomConfig,
  cameraDevice,
  cameraFocusPoint,
  cameraFocusRingAnimatedStyle,
  cameraKey,
  cameraPermissionRequiresSettings,
  cameraPreviewZoom,
  cameraRef,
  cameraZoomSelectorLabel,
  dualCameraPreviewRef,
  dualCaptureAwaitingSecondShot = false,
  dualCaptureFacingText = null,
  dualCaptureFirstShotUri = null,
  dualCaptureStepText = null,
  dualCaptureStatusText = null,
  dualCameraSupported = false,
  dualModeEnabled = false,
  cameraTransitionMaskAnimatedStyle,
  cameraUnavailableDetail,
  cameraZoomGesture,
  cameraZoomLabel,
  canShowLiveCameraPreview,
  colors,
  facing,
  captureCoverAnimatedStyle,
  handleCameraInitialized,
  handleCameraPreviewStarted,
  handleCameraRetryPress,
  handleCameraStartupFailure,
  handleRequestCameraPermissionPress,
  isLivePhotoCaptureInProgress,
  livePhotoCaptureEnabled,
  livePhotoCaptureToggleDisabled,
  livePhotoProgressPath,
  livePhotoRingProgress,
  needsCameraPermission,
  onChangeBackCameraLens,
  onToggleLivePhotoCapture,
  shouldRenderCameraPreview,
  showCaptureCover,
  showCameraUnavailableState,
  showCameraZoomBadge,
  selectedPhotoFilterId,
  t,
}: LiveCameraSurfaceProps) {
  const reduceMotionEnabled = useReducedMotion();
  const showDualCaptureFirstShotInset = Boolean(dualCaptureFirstShotUri);
  const shouldShowBackCameraLensSelector =
    facing === 'back' &&
    availableBackCameraLenses.length > 1 &&
    !dualModeEnabled &&
    !showDualCaptureFirstShotInset &&
    !needsCameraPermission &&
    !showCameraUnavailableState;
  const shouldShowZoomBadge =
    !showDualCaptureFirstShotInset &&
    !shouldShowBackCameraLensSelector &&
    (showCameraZoomBadge || cameraPreviewZoom > 1.01);
  const backCameraLensOptions = useMemo(
    () =>
      availableBackCameraLenses.map((lens) => {
        const zoomSpec = getBackCameraLensZoomSpec(backCameraLensZoomConfig, lens);

        switch (lens) {
          case 'ultra-wide':
            return {
              lens,
              label:
                lens === backCameraLens
                  ? cameraZoomSelectorLabel
                  : formatCameraZoomFactor(zoomSpec.anchor, 'selector'),
              accessibilityLabel: t('capture.backCameraUltraWideA11y', 'Use ultra-wide camera'),
            };
          case 'telephoto':
            return {
              lens,
              label:
                lens === backCameraLens
                  ? cameraZoomSelectorLabel
                  : formatCameraZoomFactor(zoomSpec.anchor, 'selector'),
              accessibilityLabel: t('capture.backCameraTelephotoA11y', 'Use telephoto camera'),
            };
          case 'wide':
          default:
            return {
              lens,
              label:
                lens === backCameraLens
                  ? cameraZoomSelectorLabel
                  : formatCameraZoomFactor(zoomSpec.anchor, 'selector'),
              accessibilityLabel: t('capture.backCameraWideA11y', 'Use wide camera'),
            };
        }
      }),
    [availableBackCameraLenses, backCameraLens, backCameraLensZoomConfig, cameraZoomSelectorLabel, t]
  );
  const activeBackCameraLensOption =
    backCameraLensOptions.find((option) => option.lens === backCameraLens) ?? backCameraLensOptions[0];
  const showLivePhotoToggle =
    !dualModeEnabled &&
    !showDualCaptureFirstShotInset &&
    !needsCameraPermission &&
    !showCameraUnavailableState;
  const showDualCaptureGuide =
    typeof dualCaptureStepText === 'string' &&
    dualCaptureStepText.length > 0 &&
    !dualModeEnabled &&
    !needsCameraPermission &&
    !showCameraUnavailableState &&
    !isLivePhotoCaptureInProgress;
  const showDualCaptureInset = showDualCaptureFirstShotInset;
  const showDualCaptureStatus = Boolean(dualCaptureStatusText);

  const showDualCameraPreview =
    dualModeEnabled &&
    !needsCameraPermission &&
    !showCameraUnavailableState;
  const shouldRenderSingleCameraPreview =
    !dualModeEnabled && shouldRenderCameraPreview;
  const handleDualCameraPreviewReady = useCallback(() => {
    handleCameraInitialized();
    handleCameraPreviewStarted();
  }, [handleCameraInitialized, handleCameraPreviewStarted]);
  const handleDualCameraCaptureError = useCallback(
    (event: { nativeEvent?: { message?: string } }) => {
      handleCameraStartupFailure(
        event.nativeEvent?.message ?? 'Dual camera preview could not start.'
      );
    },
    [handleCameraStartupFailure]
  );
  const handoffFadeOut = reduceMotionEnabled ? undefined : FadeOut.duration(100);
  const handoffInsetIn = reduceMotionEnabled
    ? undefined
    : ZoomIn.springify().damping(18).stiffness(220).mass(0.9);
  const glassPalette = getCaptureChromePalette(colors);
  const dualCaptureGuideBackground = glassPalette.activeControlBackgroundColor;
  const dualCaptureGuideBorder = glassPalette.controlBorderColor;
  const dualCaptureGuideActivePip = colors.primary;
  const dualCaptureGuideInactivePip = colors.captureGlassPlaceholder;
  const dualCaptureGuideDivider = colors.captureGlassBorder;
  const dualCaptureGuideText = colors.primary;
  const cameraLensOptionInactiveBackground = 'transparent';
  const cameraLensOptionActiveBackground = glassPalette.activeControlBackgroundColor;
  const cameraLensOptionInactiveText = colors.captureGlassText;
  const cameraLensOptionActiveText = colors.primary;

  return (
    <View
      style={[styles.cameraContainer, { backgroundColor: colors.captureCameraOverlay }]}
      collapsable={false}
    >
      {showDualCameraPreview && dualCameraSupported ? (
        <View style={styles.cameraGestureLayer} collapsable={false}>
          <DualCameraPreview
            ref={dualCameraPreviewRef}
            active={canShowLiveCameraPreview}
            primaryFacing={facing}
            onPreviewReady={handleDualCameraPreviewReady}
            onCaptureError={handleDualCameraCaptureError}
            style={styles.cameraPreview}
          />
        </View>
      ) : shouldRenderSingleCameraPreview ? (
        <>
          <GestureDetector gesture={cameraZoomGesture}>
            <View style={styles.cameraGestureLayer} collapsable={false}>
              <Camera
                key={cameraKey}
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
              <LiveCameraFilterOverlay
                filterId={selectedPhotoFilterId}
                width={CARD_SIZE}
                height={CARD_SIZE}
                style={styles.cameraPreview}
              />
              {shouldShowZoomBadge ? (
                <View
                  testID="capture-camera-zoom-badge"
                  pointerEvents="none"
                  style={[
                    styles.cameraZoomBadge,
                    showLivePhotoToggle ? styles.cameraZoomBadgeWithLivePhotoToggle : null,
                  ]}
                >
                  <Text
                    style={[styles.cameraZoomBadgeText, { color: colors.captureCameraOverlayText }]}
                  >
                    {cameraZoomLabel}
                  </Text>
                </View>
              ) : null}
              {cameraFocusPoint ? (
                <Reanimated.View
                  pointerEvents="none"
                  style={[
                    styles.cameraFocusRing,
                    {
                      borderColor: colors.primary,
                      left: cameraFocusPoint.x - CAMERA_FOCUS_RING_SIZE / 2,
                      top: cameraFocusPoint.y - CAMERA_FOCUS_RING_SIZE / 2,
                    },
                    cameraFocusRingAnimatedStyle,
                  ]}
                />
              ) : null}
            </View>
          </GestureDetector>
          {shouldShowBackCameraLensSelector && activeBackCameraLensOption ? (
            <View
              testID="capture-camera-zoom-container"
              pointerEvents="box-none"
              style={styles.cameraLensSelector}
            >
              <CaptureControlRail
                testID="capture-back-camera-lens-selector"
                borderColor={glassPalette.controlBorderColor}
                colors={colors}
                style={styles.cameraLensSelectorPill}
                rowStyle={styles.cameraLensSelectorRow}
              >
                {backCameraLensOptions.map((option) => {
                  const selected = option.lens === activeBackCameraLensOption.lens;

                  return (
                    <CaptureAnimatedPressable
                      key={option.lens}
                      testID={`capture-back-camera-lens-button-${option.lens}`}
                      accessibilityLabel={option.accessibilityLabel}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: selected, selected }}
                      onPress={() => onChangeBackCameraLens(option.lens)}
                      disabled={selected}
                      disabledOpacity={1}
                      pressedScale={0.96}
                      style={[
                        styles.cameraLensOptionButton,
                        {
                          backgroundColor: selected
                            ? cameraLensOptionActiveBackground
                            : cameraLensOptionInactiveBackground,
                          borderColor: selected ? glassPalette.controlBorderColor : 'transparent',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.cameraLensOptionText,
                          {
                            color: selected
                              ? cameraLensOptionActiveText
                              : cameraLensOptionInactiveText,
                          },
                        ]}
                      >
                        {option.label}
                      </Text>
                    </CaptureAnimatedPressable>
                  );
                })}
              </CaptureControlRail>
            </View>
          ) : null}
          {showLivePhotoToggle ? (
            <CaptureToggleIconButton
              testID="capture-live-photo-mode-toggle"
              accessibilityLabel={t('capture.livePhotoMotionToggle', 'Live photo motion')}
              accessibilityRole="switch"
              accessibilityState={{
                checked: livePhotoCaptureEnabled,
                disabled: livePhotoCaptureToggleDisabled,
              }}
              onPress={onToggleLivePhotoCapture}
              disabled={livePhotoCaptureToggleDisabled}
              disabledOpacity={0.65}
              active={livePhotoCaptureEnabled}
              activeIconName="radio-button-on"
              inactiveIconName="radio-button-off-outline"
              activeBackgroundColor={glassPalette.controlBackgroundColor}
              inactiveBackgroundColor={glassPalette.controlBackgroundColor}
              activeBorderColor={colors.primary}
              inactiveBorderColor={glassPalette.controlBorderColor}
              activeIconColor={colors.primary}
              inactiveIconColor={colors.captureGlassText}
              iconSize={19}
              pressedScale={0.96}
              renderActiveIcon={({ color, size }) => (
                <LivePhotoIcon size={size} color={color} />
              )}
              renderInactiveIcon={({ color, progress, size }) => (
                <LivePhotoOffIcon size={size} color={color} progress={progress} />
              )}
              style={[styles.cameraOverlayButton, styles.cameraLivePhotoToggleButton]}
            />
          ) : null}
        </>
      ) : null}
      {showDualCaptureGuide ? (
        <View
          pointerEvents="none"
          testID="capture-dual-step-indicator"
          style={styles.cameraLivePhotoGuideOverlay}
        >
          <View
            testID="capture-dual-step-pill"
            style={[
              styles.dualCaptureStepIndicator,
              {
                backgroundColor: dualCaptureGuideBackground,
                borderColor: dualCaptureGuideBorder,
              },
            ]}
          >
            <View style={styles.dualCaptureStepPips}>
              <View
                testID="capture-dual-step-pip-1"
                style={[
                  styles.dualCaptureStepPip,
                  styles.dualCaptureStepPipActive,
                  { backgroundColor: dualCaptureGuideActivePip },
                ]}
              />
              <View
                testID="capture-dual-step-pip-2"
                style={[
                  styles.dualCaptureStepPip,
                  { backgroundColor: dualCaptureGuideInactivePip },
                  dualCaptureAwaitingSecondShot ? styles.dualCaptureStepPipActive : null,
                  dualCaptureAwaitingSecondShot
                    ? { backgroundColor: dualCaptureGuideActivePip }
                    : null,
                ]}
              />
            </View>
            <Text style={[styles.dualCaptureStepLabel, { color: dualCaptureGuideText }]}>
              {dualCaptureStepText}
            </Text>
            {dualCaptureAwaitingSecondShot && dualCaptureFacingText ? (
              <View
                style={[
                  styles.dualCaptureFacingWrap,
                  { borderLeftColor: dualCaptureGuideDivider },
                ]}
              >
                <Text style={[styles.dualCaptureFacingText, { color: dualCaptureGuideText }]}>
                  {dualCaptureFacingText}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
      {showDualCaptureStatus ? (
        <View pointerEvents="none" style={styles.cameraDualPreviewOnlyBadgeWrap}>
          <View
            style={[
              styles.cameraDualPreviewOnlyBadge,
              {
                backgroundColor: colors.captureGlassFill,
                borderColor: colors.captureGlassBorder,
              },
            ]}
          >
            <Ionicons name="copy-outline" size={13} color={colors.captureGlassText} />
            <Text
              style={[
                styles.cameraDualPreviewOnlyBadgeText,
                { color: colors.captureGlassText },
              ]}
            >
              {dualCaptureStatusText}
            </Text>
          </View>
        </View>
      ) : null}
      {showDualCaptureInset ? (
        <Reanimated.View
          pointerEvents="none"
          testID="capture-dual-inset-preview"
          entering={handoffInsetIn}
          exiting={handoffFadeOut}
          style={styles.cameraDualPreviewInset}
          >
            <Image
              source={{ uri: dualCaptureFirstShotUri! }}
              style={styles.cameraPreview}
              contentFit="cover"
              transition={0}
              cachePolicy="none"
            />
            <View style={styles.cameraDualPreviewInsetScrim} />
        </Reanimated.View>
      ) : null}
      <Reanimated.View
        testID="camera-transition-overlay"
        pointerEvents="none"
        style={[styles.cameraTransitionOverlay, cameraTransitionMaskAnimatedStyle]}
      />
      {isLivePhotoCaptureInProgress ? (
        <View pointerEvents="none" style={styles.cameraLiveProgressOverlay}>
          <Canvas style={styles.cameraLiveProgressCanvas}>
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
      ) : null}
      {showCaptureCover ? (
        <Reanimated.View
          pointerEvents="none"
          style={[
            styles.captureTransitionCover,
            { backgroundColor: colors.captureFlashOverlay },
            captureCoverAnimatedStyle,
          ]}
        />
      ) : null}
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
      ) : null}
    </View>
  );
});
