import { Ionicons } from '@expo/vector-icons';
import { Canvas, Path as SkiaPath } from '@shopify/react-native-skia';
import { ClipboardPasteButton } from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import type { TFunction } from 'i18next';
import { type ComponentProps, type ReactNode, type RefObject, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { Camera, type CameraDevice } from 'react-native-vision-camera';
import Reanimated, { LinearTransition } from 'react-native-reanimated';
import { ENABLE_PHOTO_STICKERS } from '../../../constants/experiments';
import { Radii } from '../../../constants/theme';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import type { ThemeColors } from '../../../hooks/useTheme';
import {
  DEFAULT_NOTE_COLOR_ID,
  getCaptureNoteGradient,
} from '../../../services/noteAppearance';
import type { NoteStickerPlacement } from '../../../services/noteStickers';
import type { PhotoFilterId } from '../../../services/photoFilters';
import { isOlderIOS } from '../../../utils/platform';
import NoteDoodleCanvas, { type DoodleStroke } from '../../notes/NoteDoodleCanvas';
import NoteStickerCanvas from '../../notes/NoteStickerCanvas';
import PhotoMediaView from '../../notes/PhotoMediaView';
import PremiumNoteFinishOverlay from '../../ui/PremiumNoteFinishOverlay';
import PrimaryButton from '../../ui/PrimaryButton';
import StickerPastePopover from '../../ui/StickerPastePopover';
import { GlassView } from '../../ui/GlassView';
import DoodleIcon from '../../ui/DoodleIcon';
import LivePhotoIcon from '../../ui/LivePhotoIcon';
import StickerIcon from '../../ui/StickerIcon';
import {
  CaptureAnimatedPressable,
  CaptureGlassActionButton,
  CaptureToggleIconButton,
  DoodleColorPalette,
  FilteredPhotoCanvas,
  PhotoFilterCarousel,
} from './CaptureControls';
import {
  CAMERA_FOCUS_RING_SIZE,
  CARD_SIZE,
  DECORATE_OPTION_ACTIVE_SCALE,
  DECORATE_OPTION_CONTENT_SCALE,
  LIVE_PHOTO_RING_STROKE_WIDTH,
  PHOTO_CAPTION_MAX_LENGTH,
  styles,
} from './captureCardStyles';

type CaptureCardAnimatedStyle = ComponentProps<typeof Reanimated.View>['style'];
type CaptureCardTextInputStyle = ComponentProps<typeof TextInput>['style'];
type CaptureCardColors = Pick<
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

export type CameraUiStage = 'text' | 'live' | 'capturing' | 'review';
export type StickerAction = 'remove' | 'motion-lock-toggle' | 'outline-toggle';

interface CaptureShareTargetButtonProps {
  colors: CaptureCardColors;
  isSharedTarget: boolean;
  shareTarget: 'private' | 'shared';
  t: TFunction;
  onChangeShareTarget: (nextTarget: 'private' | 'shared') => void;
  style?: ViewStyle;
}

function CaptureShareTargetButton({
  colors,
  isSharedTarget,
  shareTarget,
  t,
  onChangeShareTarget,
  style,
}: CaptureShareTargetButtonProps) {
  return (
    <CaptureGlassActionButton
      testID="capture-share-target-toggle"
      accessibilityRole="button"
      accessibilityState={{ selected: isSharedTarget }}
      accessibilityLabel={
        isSharedTarget
          ? t('shared.captureShared', 'Friends')
          : t('shared.capturePrivate', 'Just me')
      }
      onPress={() =>
        onChangeShareTarget(shareTarget === 'private' ? 'shared' : 'private')
      }
      iconName={isSharedTarget ? 'people' : 'lock-closed'}
      iconColor={colors.captureGlassText}
      glassColorScheme={colors.captureGlassColorScheme}
      fallbackColor={colors.card}
      borderColor={colors.captureCardBorder}
      style={style}
    />
  );
}

interface CaptureSaveButtonProps {
  animatedSaveHaloStyle: CaptureCardAnimatedStyle;
  animatedSaveIconStyle: CaptureCardAnimatedStyle;
  animatedSaveInnerStyle: CaptureCardAnimatedStyle;
  colors: CaptureCardColors;
  isSaveBusy: boolean;
  isSaveDisabled: boolean;
  isSaveSuccessful: boolean;
  onSaveNote: () => void;
  onPressIn: () => void;
  onPressOut: () => void;
  savePressAnimatedStyle: CaptureCardAnimatedStyle;
}

function CaptureSaveButton({
  animatedSaveHaloStyle,
  animatedSaveIconStyle,
  animatedSaveInnerStyle,
  colors,
  isSaveBusy,
  isSaveDisabled,
  isSaveSuccessful,
  onSaveNote,
  onPressIn,
  onPressOut,
  savePressAnimatedStyle,
}: CaptureSaveButtonProps) {
  return (
    <CaptureAnimatedPressable
      testID="capture-save-button"
      onPress={onSaveNote}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
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
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Reanimated.View style={animatedSaveIconStyle}>
              <Ionicons
                name={isSaveSuccessful ? 'checkmark-done' : 'checkmark'}
                size={26}
                color="#FFFFFF"
              />
            </Reanimated.View>
          )}
        </Reanimated.View>
      </Reanimated.View>
    </CaptureAnimatedPressable>
  );
}

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
  stickerModeEnabled: boolean;
  stickerPlacements: NoteStickerPlacement[];
  textInputDynamicStyle: CaptureCardTextInputStyle;
}

export function TextCaptureSurface({
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
  noteColor = DEFAULT_NOTE_COLOR_ID,
  noteText,
  onCanvasGestureActiveChange,
  recentAutoEmoji,
  selectedStickerId,
  setTextDoodleStrokes,
  stickerModeEnabled,
  stickerPlacements,
  textInputDynamicStyle,
}: TextCaptureSurfaceProps) {
  const captureGradient = getCaptureNoteGradient({ noteColor });
  const usesLightCaptureChrome = colors.captureGlassColorScheme === 'light';

  return (
    <LinearGradient
      style={[
        styles.textCard,
        usesLightCaptureChrome ? styles.textCardLightContrast : null,
        {
          borderColor: colors.captureCardBorder,
          shadowColor: usesLightCaptureChrome ? colors.text : '#000000',
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
            onToggleSelectedPlacementMotionLock={() =>
              handleSelectedStickerAction('motion-lock-toggle')
            }
            onToggleSelectedPlacementOutline={() =>
              handleSelectedStickerAction('outline-toggle')
            }
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
  );
}

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
  onChangePhotoFilter: (filterId: PhotoFilterId) => void;
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
  stickerModeEnabled: boolean;
  stickerPlacements: NoteStickerPlacement[];
  t: TFunction;
}

export function PhotoCaptureSurface({
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
  onChangePhotoFilter,
  onPhotoCaptionBlur,
  onPhotoCaptionFocus,
  onPhotoSurfaceReady,
  pastePrompt,
  selectedPhotoFilterId,
  selectedStickerId,
  setPhotoDoodleStrokes,
  showCaptureCover,
  stickerModeEnabled,
  stickerPlacements,
  t,
}: PhotoCaptureSurfaceProps) {
  const photoPreviewControlBorder = hasLivePhotoMotion
    ? colors.captureGlassColorScheme === 'dark'
      ? 'rgba(255,255,255,0.14)'
      : 'rgba(255,255,255,0.42)'
    : colors.captureCameraOverlayBorder;

  return (
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
          onImageReady={onPhotoSurfaceReady}
        />
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
            onToggleSelectedPlacementMotionLock={() =>
              handleSelectedStickerAction('motion-lock-toggle')
            }
            onToggleSelectedPlacementOutline={() =>
              handleSelectedStickerAction('outline-toggle')
            }
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
        <View pointerEvents="box-none" style={styles.cardTopOverlay}>
          <PhotoFilterCarousel
            sourceUri={capturedPhoto}
            selectedFilterId={selectedPhotoFilterId}
            onSelectFilter={onChangePhotoFilter}
            t={t}
            colors={colors}
          />
        </View>
      ) : null}
      <View pointerEvents="box-none" style={styles.cardBottomOverlay}>
        <View
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
              onPress={() => {
                onChangeNoteText('');
                noteInputRef.current?.focus();
              }}
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
}

interface LiveCameraSurfaceProps {
  cameraDevice?: CameraDevice;
  cameraFocusPoint: { x: number; y: number } | null;
  cameraFocusRingAnimatedStyle: CaptureCardAnimatedStyle;
  cameraKey: number | string;
  cameraPermissionRequiresSettings: boolean;
  cameraPreviewZoom: number;
  cameraRef: RefObject<Camera | null>;
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
  livePhotoProgressPath: ComponentProps<typeof SkiaPath>['path'];
  livePhotoRingProgress: number;
  needsCameraPermission: boolean;
  shouldRenderCameraPreview: boolean;
  showCaptureCover: boolean;
  showCameraUnavailableState: boolean;
  showCameraZoomBadge: boolean;
  t: TFunction;
}

export function LiveCameraSurface({
  cameraDevice,
  cameraFocusPoint,
  cameraFocusRingAnimatedStyle,
  cameraKey,
  cameraPermissionRequiresSettings,
  cameraPreviewZoom,
  cameraRef,
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
  livePhotoProgressPath,
  livePhotoRingProgress,
  needsCameraPermission,
  shouldRenderCameraPreview,
  showCaptureCover,
  showCameraUnavailableState,
  showCameraZoomBadge,
  t,
}: LiveCameraSurfaceProps) {
  const shouldShowZoomBadge = showCameraZoomBadge || cameraPreviewZoom > 1.01;

  return (
    <View
      style={[styles.cameraContainer, { backgroundColor: colors.captureCameraOverlay }]}
      collapsable={false}
    >
      {shouldRenderCameraPreview ? (
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
            {shouldShowZoomBadge ? (
              <View pointerEvents="none" style={styles.cameraZoomBadge}>
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
}

interface CaptureDecorateRailTheme {
  activeBackgroundColor: string;
  activeBorderColor: string;
  activeIconColor: string;
  detailBackgroundColor: string;
  detailBorderColor: string;
  detailIconColor: string;
  inactiveBackgroundColor: string;
  inactiveBorderColor: string;
  inactiveIconColor: string;
  paletteButtonBackgroundColor: string;
  paletteButtonBorderColor: string;
  paletteSelectedBorderColor: string;
  paletteSwatchBorderColor: string;
  railBorderColor: string;
}

interface CaptureControlRailProps {
  borderColor: string;
  colors: CaptureCardColors;
  children: ReactNode;
  rowStyle?: ViewStyle;
  style?: ViewStyle;
}

function CaptureControlRail({
  borderColor,
  colors,
  children,
  rowStyle,
  style,
}: CaptureControlRailProps) {
  const reduceMotionEnabled = useReducedMotion();
  const railLayoutTransition = useMemo(
    () =>
      reduceMotionEnabled
        ? undefined
        : LinearTransition.springify().damping(19).stiffness(220).mass(0.9),
    [reduceMotionEnabled]
  );

  return (
    <Reanimated.View
      layout={railLayoutTransition}
      style={[styles.textBottomToolsBar, style, { borderColor }]}
    >
      {isOlderIOS ? (
        <View
          pointerEvents="none"
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
      <Reanimated.View layout={railLayoutTransition} style={[styles.textBottomToolsRow, rowStyle]}>
        {children}
      </Reanimated.View>
    </Reanimated.View>
  );
}

interface CaptureDecorateRailProps {
  afterToggles?: ReactNode;
  colors: CaptureCardColors;
  defaultActions?: ReactNode;
  doodleColor: string;
  doodleColorOptions: string[];
  doodleModeEnabled: boolean;
  doodleStrokes: DoodleStroke[];
  enableStickers?: boolean;
  handleClearDoodle: () => void;
  handleSelectDoodleColor: (nextColor: string) => void;
  handleSelectedStickerAction: (action: StickerAction) => void;
  handleShowStickerSourceOptions: ComponentProps<
    typeof CaptureAnimatedPressable
  >['onPress'];
  handleToggleDoodleMode: () => void;
  handleToggleStickerMode: () => void;
  handleUndoDoodle: () => void;
  importingSticker: boolean;
  railStyle?: ViewStyle;
  rowStyle?: ViewStyle;
  selectedStickerId: string | null;
  stickerModeEnabled: boolean;
  t: TFunction;
  theme: CaptureDecorateRailTheme;
}

function CaptureDecorateRail({
  afterToggles = null,
  colors,
  defaultActions = null,
  doodleColor,
  doodleColorOptions,
  doodleModeEnabled,
  doodleStrokes,
  enableStickers = ENABLE_PHOTO_STICKERS,
  handleClearDoodle,
  handleSelectDoodleColor,
  handleSelectedStickerAction,
  handleShowStickerSourceOptions,
  handleToggleDoodleMode,
  handleToggleStickerMode,
  handleUndoDoodle,
  importingSticker,
  railStyle,
  rowStyle,
  selectedStickerId,
  stickerModeEnabled,
  t,
  theme,
}: CaptureDecorateRailProps) {
  const isShowingDoodleControls = doodleModeEnabled;
  const isShowingStickerControls = !isShowingDoodleControls && stickerModeEnabled;

  return (
    <CaptureControlRail
      borderColor={theme.railBorderColor}
      colors={colors}
      style={railStyle}
      rowStyle={rowStyle}
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
        renderActiveIcon={({ color, size }) => <DoodleIcon color={color} size={size} />}
        renderInactiveIcon={({ color, size }) => <DoodleIcon color={color} size={size} />}
        activeBackgroundColor={theme.activeBackgroundColor}
        inactiveBackgroundColor={theme.inactiveBackgroundColor}
        activeBorderColor={theme.activeBorderColor}
        inactiveBorderColor={theme.inactiveBorderColor}
        activeIconColor={theme.activeIconColor}
        inactiveIconColor={theme.inactiveIconColor}
        activeScale={DECORATE_OPTION_ACTIVE_SCALE}
        activeTranslateY={0}
        contentActiveScale={DECORATE_OPTION_CONTENT_SCALE}
        contentActiveTranslateY={0}
        style={styles.textBottomToolsButton}
      />
      {enableStickers ? (
        <CaptureToggleIconButton
          testID="capture-sticker-toggle"
          accessibilityLabel={
            stickerModeEnabled
              ? t('capture.doneStickers', 'Done')
              : t('capture.stickers', 'Stickers')
          }
          accessibilityHint={t(
            'capture.stickerPasteHint',
            'Tap to edit stickers. Tap + to add from Clipboard or Photos.'
          )}
          onPress={handleToggleStickerMode}
          active={stickerModeEnabled}
          activeIconName="images"
          inactiveIconName="images-outline"
          renderActiveIcon={({ color, size }) => <StickerIcon color={color} size={size} />}
          renderInactiveIcon={({ color, size }) => <StickerIcon color={color} size={size} />}
          activeBackgroundColor={theme.activeBackgroundColor}
          inactiveBackgroundColor={theme.inactiveBackgroundColor}
          activeBorderColor={theme.activeBorderColor}
          inactiveBorderColor={theme.inactiveBorderColor}
          activeIconColor={theme.activeIconColor}
          inactiveIconColor={theme.inactiveIconColor}
          activeScale={DECORATE_OPTION_ACTIVE_SCALE}
          activeTranslateY={0}
          contentActiveScale={DECORATE_OPTION_CONTENT_SCALE}
          contentActiveTranslateY={0}
          style={styles.textBottomToolsButton}
        />
      ) : null}
      {afterToggles}
      {isShowingDoodleControls ? (
        <>
          <CaptureAnimatedPressable
            testID="capture-doodle-undo"
            onPress={handleUndoDoodle}
            disabled={doodleStrokes.length === 0}
            disabledOpacity={0.45}
            style={[
              styles.textCardActionPill,
              {
                backgroundColor: theme.detailBackgroundColor,
                borderColor: theme.detailBorderColor,
              },
            ]}
          >
            <Ionicons name="arrow-undo-outline" size={14} color={theme.detailIconColor} />
          </CaptureAnimatedPressable>
          <CaptureAnimatedPressable
            testID="capture-doodle-clear"
            onPress={handleClearDoodle}
            disabled={doodleStrokes.length === 0}
            disabledOpacity={0.45}
            style={[
              styles.textCardActionPill,
              {
                backgroundColor: theme.detailBackgroundColor,
                borderColor: theme.detailBorderColor,
              },
            ]}
          >
            <Ionicons name="trash-outline" size={16} color={theme.detailIconColor} />
          </CaptureAnimatedPressable>
          <DoodleColorPalette
            colors={doodleColorOptions}
            selectedColor={doodleColor}
            onSelectColor={handleSelectDoodleColor}
            buttonBackgroundColor={theme.paletteButtonBackgroundColor}
            buttonBorderColor={theme.paletteButtonBorderColor}
            selectedBorderColor={theme.paletteSelectedBorderColor}
            swatchBorderColor={theme.paletteSwatchBorderColor}
            testIDPrefix="capture-doodle-color"
          />
        </>
      ) : isShowingStickerControls ? (
        <>
          <CaptureAnimatedPressable
            testID="capture-sticker-import"
            onPress={handleShowStickerSourceOptions}
            disabled={importingSticker}
            disabledOpacity={0.45}
            style={[
              styles.textCardActionPill,
              {
                backgroundColor: theme.detailBackgroundColor,
                borderColor: theme.detailBorderColor,
              },
            ]}
          >
            {importingSticker ? (
              <ActivityIndicator
                testID="capture-sticker-import-loading"
                size="small"
                color={theme.detailIconColor}
              />
            ) : (
              <Ionicons name="add-outline" size={14} color={theme.detailIconColor} />
            )}
          </CaptureAnimatedPressable>
          <CaptureAnimatedPressable
            testID="capture-sticker-remove"
            onPress={() => handleSelectedStickerAction('remove')}
            disabled={!selectedStickerId}
            disabledOpacity={0.45}
            style={[
              styles.textCardActionPill,
              {
                backgroundColor: theme.detailBackgroundColor,
                borderColor: theme.detailBorderColor,
              },
            ]}
          >
            <Ionicons name="trash-outline" size={14} color={theme.detailIconColor} />
          </CaptureAnimatedPressable>
        </>
      ) : (
        defaultActions
      )}
    </CaptureControlRail>
  );
}

interface TextCaptureBottomBarProps {
  colors: CaptureCardColors;
  doodleColor: string;
  doodleColorOptions: string[];
  doodleModeEnabled: boolean;
  doodleStrokes: DoodleStroke[];
  handleClearDoodle: () => void;
  handleInlinePasteStickerPress: () => void;
  handleNativeInlinePasteStickerPress: ComponentProps<
    typeof ClipboardPasteButton
  >['onPress'];
  handleSelectDoodleColor: (nextColor: string) => void;
  handleSelectedStickerAction: (action: StickerAction) => void;
  handleShowStickerSourceOptions: ComponentProps<
    typeof CaptureAnimatedPressable
  >['onPress'];
  handleToggleDoodleMode: () => void;
  handleToggleStickerMode: () => void;
  handleUndoDoodle: () => void;
  importingSticker: boolean;
  inlinePasteLoading: boolean;
  selectedStickerId: string | null;
  showInlinePasteButton: boolean;
  stickerModeEnabled: boolean;
  t: TFunction;
  textCardActiveIconColor: string;
  useNativeInlinePasteButton: boolean;
}

export function TextCaptureBottomBar({
  colors,
  doodleColor,
  doodleColorOptions,
  doodleModeEnabled,
  doodleStrokes,
  handleClearDoodle,
  handleInlinePasteStickerPress,
  handleNativeInlinePasteStickerPress,
  handleSelectDoodleColor,
  handleSelectedStickerAction,
  handleShowStickerSourceOptions,
  handleToggleDoodleMode,
  handleToggleStickerMode,
  handleUndoDoodle,
  importingSticker,
  inlinePasteLoading,
  selectedStickerId,
  showInlinePasteButton,
  stickerModeEnabled,
  t,
  textCardActiveIconColor,
  useNativeInlinePasteButton,
}: TextCaptureBottomBarProps) {
  return (
    <View style={styles.textBottomToolsWrap}>
      <CaptureDecorateRail
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
        importingSticker={importingSticker}
        selectedStickerId={selectedStickerId}
        stickerModeEnabled={stickerModeEnabled}
        t={t}
        theme={{
          activeBackgroundColor: colors.captureButtonBg,
          activeBorderColor: 'transparent',
          activeIconColor: textCardActiveIconColor,
          detailBackgroundColor: 'transparent',
          detailBorderColor: 'transparent',
          detailIconColor: colors.captureGlassText,
          inactiveBackgroundColor: colors.captureGlassFill,
          inactiveBorderColor: 'transparent',
          inactiveIconColor: colors.captureGlassText,
          paletteButtonBackgroundColor: colors.captureGlassFill,
          paletteButtonBorderColor: 'transparent',
          paletteSelectedBorderColor: colors.captureButtonBg,
          paletteSwatchBorderColor: 'rgba(43,38,33,0.16)',
          railBorderColor: colors.captureCardBorder,
        }}
        defaultActions={
          showInlinePasteButton ? (
            <View style={styles.inlinePasteStickerWrap}>
              {inlinePasteLoading ? (
                <CaptureAnimatedPressable
                  testID="capture-inline-paste-sticker"
                  accessibilityLabel={t('capture.pasteStickerAction', 'Paste sticker')}
                  disabled
                  disabledOpacity={1}
                  style={[
                    styles.textBottomToolsButton,
                    styles.textBottomToolsAction,
                    {
                      borderColor: 'transparent',
                      backgroundColor: colors.captureGlassFill,
                    },
                  ]}
                >
                  <ActivityIndicator
                    testID="capture-inline-paste-sticker-loading"
                    size="small"
                    color={colors.captureGlassText}
                  />
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
                  style={[
                    styles.nativeInlinePasteStickerButton,
                    {
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: 'transparent',
                    },
                  ]}
                />
              ) : (
                <CaptureAnimatedPressable
                  testID="capture-inline-paste-sticker"
                  accessibilityLabel={t('capture.pasteStickerAction', 'Paste sticker')}
                  onPress={handleInlinePasteStickerPress}
                  disabled={inlinePasteLoading}
                  disabledOpacity={1}
                  style={[
                    styles.textBottomToolsButton,
                    styles.textBottomToolsAction,
                    {
                      borderColor: 'transparent',
                      backgroundColor: colors.captureGlassFill,
                    },
                  ]}
                >
                  <Ionicons name="clipboard-outline" size={16} color={colors.captureGlassText} />
                </CaptureAnimatedPressable>
              )}
            </View>
          ) : null
        }
      />
    </View>
  );
}

interface LiveCameraActionBarProps {
  cameraInstructionText?: string | null;
  colors: CaptureCardColors;
  importingPhoto: boolean;
  libraryImportLocked: boolean;
  needsCameraPermission: boolean;
  onOpenPhotoLibrary: () => void;
  t: TFunction;
}

export function LiveCameraActionBar({
  cameraInstructionText = null,
  colors,
  importingPhoto,
  libraryImportLocked,
  needsCameraPermission,
  onOpenPhotoLibrary,
  t,
}: LiveCameraActionBarProps) {
  if (needsCameraPermission) {
    return null;
  }

  const showLivePhotoGuide = Boolean(cameraInstructionText);

  return (
    <View style={styles.captureActionBarWrap}>
      <CaptureControlRail
        borderColor={colors.captureCardBorder}
        colors={colors}
      >
        {showLivePhotoGuide ? (
          <View style={styles.cameraActionHintWrap}>
            <LivePhotoIcon size={15} color={colors.captureGlassText} />
            <Text style={[styles.cameraActionHintText, { color: colors.captureGlassText }]}>
              {t('capture.livePhotoCoachLiveHint', 'Hold for live photo')}
            </Text>
          </View>
        ) : null}
        {!showLivePhotoGuide ? (
          <CaptureAnimatedPressable
            testID="capture-library-button"
            accessibilityLabel={
              libraryImportLocked
                ? t('capture.plusLibraryLocked', 'Plus')
                : t('capture.importPhoto', 'Photos')
            }
            onPress={onOpenPhotoLibrary}
            active={importingPhoto}
            activeScale={1.015}
            activeTranslateY={0}
            contentActiveScale={1}
            style={[
              styles.textCardActionPill,
              styles.captureActionTextPill,
              {
                backgroundColor: colors.captureGlassFill,
                borderColor: 'transparent',
              },
            ]}
          >
            {importingPhoto ? (
              <ActivityIndicator size="small" color={colors.captureGlassText} />
            ) : (
              <>
                <Ionicons name="images-outline" size={16} color={colors.captureGlassText} />
                <Text style={[styles.captureActionPillLabel, { color: colors.captureGlassText }]}>
                  {libraryImportLocked
                    ? t('capture.plusLibraryLocked', 'Plus')
                    : t('capture.importPhoto', 'Photos')}
                </Text>
              </>
            )}
          </CaptureAnimatedPressable>
        ) : null}
      </CaptureControlRail>
    </View>
  );
}

interface PhotoCaptureBottomBarProps {
  colors: CaptureCardColors;
  doodleColor: string;
  doodleColorOptions: string[];
  doodleModeEnabled: boolean;
  doodleStrokes: DoodleStroke[];
  handleClearDoodle: () => void;
  handleSelectDoodleColor: (nextColor: string) => void;
  handleSelectedStickerAction: (action: StickerAction) => void;
  handleShowStickerSourceOptions: ComponentProps<
    typeof CaptureAnimatedPressable
  >['onPress'];
  handleToggleDoodleMode: () => void;
  handleToggleStickerMode: () => void;
  handleUndoDoodle: () => void;
  hasLivePhotoMotion: boolean;
  importingSticker: boolean;
  onImportMotionClip: () => void;
  onRemoveMotionClip: () => void;
  selectedStickerId: string | null;
  stickerModeEnabled: boolean;
  t: TFunction;
  textCardActiveIconColor: string;
}

export function PhotoCaptureBottomBar({
  colors,
  doodleColor,
  doodleColorOptions,
  doodleModeEnabled,
  doodleStrokes,
  handleClearDoodle,
  handleSelectDoodleColor,
  handleSelectedStickerAction,
  handleShowStickerSourceOptions,
  handleToggleDoodleMode,
  handleToggleStickerMode,
  handleUndoDoodle,
  hasLivePhotoMotion,
  importingSticker,
  onImportMotionClip,
  onRemoveMotionClip,
  selectedStickerId,
  stickerModeEnabled,
  t,
  textCardActiveIconColor,
}: PhotoCaptureBottomBarProps) {
  return (
    <View style={styles.captureActionBarWrap}>
      <CaptureDecorateRail
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
        importingSticker={importingSticker}
        selectedStickerId={selectedStickerId}
        stickerModeEnabled={stickerModeEnabled}
        t={t}
        theme={{
          activeBackgroundColor: colors.captureButtonBg,
          activeBorderColor: 'transparent',
          activeIconColor: textCardActiveIconColor,
          detailBackgroundColor: 'transparent',
          detailBorderColor: 'transparent',
          detailIconColor: colors.captureGlassText,
          inactiveBackgroundColor: colors.captureGlassFill,
          inactiveBorderColor: 'transparent',
          inactiveIconColor: colors.captureGlassText,
          paletteButtonBackgroundColor: colors.captureGlassFill,
          paletteButtonBorderColor: 'transparent',
          paletteSelectedBorderColor: colors.captureButtonBg,
          paletteSwatchBorderColor: 'rgba(43,38,33,0.16)',
          railBorderColor: colors.captureCardBorder,
        }}
        afterToggles={
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
              styles.textCardActionPill,
              styles.livePhotoTogglePill,
              {
                backgroundColor: hasLivePhotoMotion
                  ? colors.captureButtonBg
                  : colors.captureGlassFill,
                borderColor: 'transparent',
              },
            ]}
          >
            <LivePhotoIcon
              size={15}
              color={hasLivePhotoMotion ? textCardActiveIconColor : colors.captureGlassText}
            />
          </CaptureAnimatedPressable>
        }
      />
    </View>
  );
}

interface CaptureActionRowProps {
  animatedSaveHaloStyle: CaptureCardAnimatedStyle;
  animatedSaveIconStyle: CaptureCardAnimatedStyle;
  animatedSaveInnerStyle: CaptureCardAnimatedStyle;
  colors: CaptureCardColors;
  cameraUiStage: CameraUiStage;
  handleSavePressIn: () => void;
  handleSavePressOut: () => void;
  handleShutterLongPress: () => void;
  handleShutterPress: () => void;
  handleShutterRelease: () => void;
  handleSwitchCameraPress: () => void;
  isLivePhotoCaptureInProgress: boolean;
  isSaveBusy: boolean;
  isSaveDisabled: boolean;
  isSaveSuccessful: boolean;
  isSharedTarget: boolean;
  livePhotoCountdownSeconds: number;
  onChangeShareTarget: (nextTarget: 'private' | 'shared') => void;
  onRetakePhoto: () => void;
  onSaveNote: () => void;
  onShutterPressIn: () => void;
  permissionGranted: boolean;
  remainingPhotoSlots?: number | null;
  savePressAnimatedStyle: CaptureCardAnimatedStyle;
  shareTarget: 'private' | 'shared';
  showCameraUnavailableState: boolean;
  shutterCaptureHaloAnimatedStyle: CaptureCardAnimatedStyle;
  shutterInnerAnimatedStyle: CaptureCardAnimatedStyle;
  shutterOuterAnimatedStyle: CaptureCardAnimatedStyle;
  t: TFunction;
}

export function CaptureActionRow({
  animatedSaveHaloStyle,
  animatedSaveIconStyle,
  animatedSaveInnerStyle,
  colors,
  cameraUiStage,
  handleSavePressIn,
  handleSavePressOut,
  handleShutterLongPress,
  handleShutterPress,
  handleShutterRelease,
  handleSwitchCameraPress,
  isLivePhotoCaptureInProgress,
  isSaveBusy,
  isSaveDisabled,
  isSaveSuccessful,
  isSharedTarget,
  livePhotoCountdownSeconds,
  onChangeShareTarget,
  onRetakePhoto,
  onSaveNote,
  onShutterPressIn,
  permissionGranted,
  remainingPhotoSlots,
  savePressAnimatedStyle,
  shareTarget,
  showCameraUnavailableState,
  shutterCaptureHaloAnimatedStyle,
  shutterInnerAnimatedStyle,
  shutterOuterAnimatedStyle,
  t,
}: CaptureActionRowProps) {
  if (cameraUiStage === 'live' || cameraUiStage === 'capturing') {
    return (
      <View style={styles.cameraControlsWrap}>
        <View style={[styles.belowCardShutterRow, styles.liveCameraShutterRow]}>
          {permissionGranted ? (
            <CaptureShareTargetButton
              colors={colors}
              isSharedTarget={isSharedTarget}
              shareTarget={shareTarget}
              t={t}
              onChangeShareTarget={onChangeShareTarget}
              style={styles.belowCardLeadingAction}
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
              hitSlop={12}
              pressRetentionOffset={{ top: 40, right: 40, bottom: 40, left: 40 }}
              hapticStyle={null}
              pressedScale={0.985}
              style={[styles.shutterOuter, shutterOuterAnimatedStyle as never]}
            >
              <Reanimated.View
                pointerEvents="none"
                style={[
                  styles.shutterCaptureHalo,
                  { backgroundColor: `${colors.primary}28` },
                  shutterCaptureHaloAnimatedStyle,
                ]}
              />
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
              borderColor={colors.captureCardBorder}
              style={styles.belowCardTrailingAction}
            />
          ) : (
            <View style={[styles.belowCardSideActionSpacer, styles.belowCardTrailingAction]} />
          )}
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.belowCardShutterRow,
        cameraUiStage === 'review' ? styles.belowCardCapturedPhotoActions : null,
      ]}
    >
      <CaptureShareTargetButton
        colors={colors}
        isSharedTarget={isSharedTarget}
        shareTarget={shareTarget}
        t={t}
        onChangeShareTarget={onChangeShareTarget}
        style={styles.belowCardLeadingAction}
      />
      <CaptureSaveButton
        animatedSaveHaloStyle={animatedSaveHaloStyle}
        animatedSaveIconStyle={animatedSaveIconStyle}
        animatedSaveInnerStyle={animatedSaveInnerStyle}
        colors={colors}
        isSaveBusy={isSaveBusy}
        isSaveDisabled={isSaveDisabled}
        isSaveSuccessful={isSaveSuccessful}
        onSaveNote={onSaveNote}
        onPressIn={handleSavePressIn}
        onPressOut={handleSavePressOut}
        savePressAnimatedStyle={savePressAnimatedStyle}
      />
      {cameraUiStage === 'review' ? (
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
          borderColor={colors.captureCardBorder}
          style={styles.belowCardTrailingAction}
        />
      ) : (
        <View style={[styles.belowCardSideActionSpacer, styles.belowCardTrailingAction]} />
      )}
    </View>
  );
}
