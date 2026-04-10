import { Ionicons } from '@expo/vector-icons';
import { Canvas, Path as SkiaPath } from '@shopify/react-native-skia';
import { LinearGradient } from 'expo-linear-gradient';
import type { TFunction } from 'i18next';
import { type ComponentProps, type RefObject } from 'react';
import {
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { Camera, type CameraDevice } from 'react-native-vision-camera';
import Reanimated from 'react-native-reanimated';
import { ENABLE_PHOTO_STICKERS } from '../../../constants/experiments';
import {
  DEFAULT_NOTE_COLOR_ID,
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
import { FilteredPhotoCanvas, PhotoFilterCarousel } from './CaptureControls';
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

const LIVE_PHOTO_BORDER_DARK = 'rgba(255,255,255,0.14)';
const LIVE_PHOTO_BORDER_LIGHT = 'rgba(255,255,255,0.42)';
const STICKER_PASTE_POPOVER_BACKGROUND = 'rgba(255, 250, 242, 0.96)';

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
  stickerEntryAnimation,
  stickerModeEnabled,
  stickerPlacements,
  textInputDynamicStyle,
  onStickerEntryAnimationComplete,
}: TextCaptureSurfaceProps) {
  const captureGradient = getCaptureNoteGradient({ noteColor });
  const usesLightCaptureChrome = colors.captureGlassColorScheme === 'light';

  return (
    <View
      style={[
        styles.textCardShadow,
        usesLightCaptureChrome ? styles.textCardShadowLightContrast : null,
        {
          shadowColor: usesLightCaptureChrome ? colors.text : '#000000',
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
              onToggleSelectedPlacementMotionLock={() =>
                handleSelectedStickerAction('motion-lock-toggle')
              }
              onToggleSelectedPlacementOutline={() =>
                handleSelectedStickerAction('outline-toggle')
              }
              onRemoveSelectedPlacement={() =>
                handleSelectedStickerAction('remove')
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
    </View>
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
  lockedPhotoFilterIds?: PhotoFilterId[];
  onPressLockedPhotoFilter?: (filterId: PhotoFilterId) => void;
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
  lockedPhotoFilterIds = [],
  onPressLockedPhotoFilter,
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
      ? LIVE_PHOTO_BORDER_DARK
      : LIVE_PHOTO_BORDER_LIGHT
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
            entryAnimation={stickerEntryAnimation}
            onEntryAnimationComplete={onStickerEntryAnimationComplete}
            onToggleSelectedPlacementMotionLock={() =>
              handleSelectedStickerAction('motion-lock-toggle')
            }
            onToggleSelectedPlacementOutline={() =>
              handleSelectedStickerAction('outline-toggle')
            }
            onRemoveSelectedPlacement={() =>
              handleSelectedStickerAction('remove')
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
        backgroundColor={STICKER_PASTE_POPOVER_BACKGROUND}
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
            lockedFilterIds={lockedPhotoFilterIds}
            onSelectFilter={onChangePhotoFilter}
            onPressLockedFilter={onPressLockedPhotoFilter}
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
