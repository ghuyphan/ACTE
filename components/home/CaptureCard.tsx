import { Ionicons } from '@expo/vector-icons';
import { Canvas, Path as SkiaPath } from '@shopify/react-native-skia';
import {
  ClipboardPasteButton,
} from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { TFunction } from 'i18next';
import { forwardRef, type ComponentProps, type ReactNode, RefObject, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { Camera, type CameraDevice } from 'react-native-vision-camera';
import Reanimated, {
  Easing,
  LinearTransition,
  interpolateColor,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { STICKER_ARTBOARD_FRAME } from '../../constants/doodleLayout';
import { ENABLE_PHOTO_STICKERS } from '../../constants/experiments';
import { formatRadiusLabel, NOTE_RADIUS_OPTIONS } from '../../constants/noteRadius';
import { Layout, Radii, Shadows, Sheet, Typography } from '../../constants/theme';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import type { ThemeColors } from '../../hooks/useTheme';
import {
  DEFAULT_NOTE_COLOR_ID,
  getCaptureNoteGradient,
} from '../../services/noteAppearance';
import { type NoteStickerPlacement } from '../../services/noteStickers';
import { isOlderIOS } from '../../utils/platform';
import {
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
import DoodleIcon from '../ui/DoodleIcon';
import StickerIcon from '../ui/StickerIcon';
import {
  CaptureAnimatedPressable,
  CaptureGlassActionButton,
  CaptureToggleIconButton,
  DoodleColorPalette,
  FilteredPhotoCanvas,
  PhotoFilterCarousel,
  triggerCaptureCardHaptic,
} from './capture/CaptureControls';
import StampCutterEditor from './capture/StampCutterEditor';
import { useCaptureCardCameraController } from './useCaptureCardCameraController';
import { useCaptureCardDecorations } from './useCaptureCardDecorations';
import { useCaptureCardMetaSheets } from './useCaptureCardMetaSheets';
import { type StickerAction, useCaptureCardStickerFlow } from './useCaptureCardStickerFlow';
import { useCaptureCardTextInputState } from './useCaptureCardTextInputState';

const { width } = Dimensions.get('window');
const HORIZONTAL_PADDING = Layout.screenPadding - 8;
const CARD_SIZE = width - HORIZONTAL_PADDING * 2;
const TOP_CONTROL_INSET = 24;
const TOP_CONTROL_HEIGHT = 38;
const TOP_CONTROL_RADIUS = 19;
const DECORATE_OPTION_ACTIVE_SCALE = 1;
const DECORATE_OPTION_CONTENT_SCALE = 1;
const SHUTTER_OUTER_SIZE = 74;
const SHUTTER_INNER_SIZE = 58;
const SIDE_ACTION_SIZE = 46;
const SHUTTER_SIDE_ACTION_GAP = 24;
const SHUTTER_SIDE_ACTION_OFFSET =
  SHUTTER_OUTER_SIZE / 2 + SHUTTER_SIDE_ACTION_GAP + SIDE_ACTION_SIZE;
const PHOTO_DOODLE_DEFAULT_COLOR = '#FFFFFF';
const PHOTO_CAPTION_MAX_LENGTH = 60;
const LIVE_PHOTO_RING_SIZE = SHUTTER_OUTER_SIZE;
const LIVE_PHOTO_RING_STROKE_WIDTH = 4;
const DOCKED_HEADER_CONTENT_OVERLAP = 8;
const SHEET_HORIZONTAL_PADDING =
  Platform.OS === 'ios' ? Sheet.ios.horizontalPadding : Sheet.android.horizontalPadding;
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
  onTextEntryFocusChange?: (focused: boolean) => void;
  footerContent?: ReactNode;
}

type CaptureCardAnimatedStyle = ComponentProps<typeof Reanimated.View>['style'];
type CaptureCardTextInputStyle = ComponentProps<typeof TextInput>['style'];
type CaptureCardColors = CaptureCardProps['colors'];
type CaptureCardTextInputState = ReturnType<typeof useCaptureCardTextInputState>;
type CaptureCardDecorationState = ReturnType<typeof useCaptureCardDecorations>;
type CaptureCardStickerFlowState = ReturnType<typeof useCaptureCardStickerFlow>;
type CaptureCardCameraControllerState = ReturnType<typeof useCaptureCardCameraController>;

interface CaptureShareTargetButtonProps {
  colors: CaptureCardColors;
  isSharedTarget: boolean;
  shareTarget: CaptureCardProps['shareTarget'];
  t: TFunction;
  onChangeShareTarget: CaptureCardProps['onChangeShareTarget'];
  style: any;
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
      accessibilityLabel={isSharedTarget ? t('shared.captureShared', 'Friends') : t('shared.capturePrivate', 'Just me')}
      onPress={() => onChangeShareTarget(shareTarget === 'private' ? 'shared' : 'private')}
      iconName={isSharedTarget ? 'people' : 'lock-closed'}
      iconColor={colors.captureGlassText}
      glassColorScheme={colors.captureGlassColorScheme}
      fallbackColor={colors.card}
      borderColor={colors.captureGlassBorder}
      style={style}
    />
  );
}

interface CaptureSaveButtonProps {
  animatedSaveHaloStyle: CaptureCardAnimatedStyle;
  animatedSaveIconStyle: CaptureCardAnimatedStyle;
  animatedSaveInnerStyle: CaptureCardAnimatedStyle;
  colors: CaptureCardColors;
  isCameraSaveMode: boolean;
  isSaveBusy: boolean;
  isSaveDisabled: boolean;
  isSaveSuccessful: boolean;
  onSaveNote: CaptureCardProps['onSaveNote'];
  onPressIn: () => void;
  onPressOut: () => void;
  savePressAnimatedStyle: CaptureCardAnimatedStyle;
}

function CaptureSaveButton({
  animatedSaveHaloStyle,
  animatedSaveIconStyle,
  animatedSaveInnerStyle,
  colors,
  isCameraSaveMode,
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
            <ActivityIndicator size="small" color={isCameraSaveMode ? colors.captureCardText : '#FFFFFF'} />
          ) : (
            <Reanimated.View style={animatedSaveIconStyle}>
              <Ionicons
                name={isSaveSuccessful ? 'checkmark-done' : 'checkmark'}
                size={26}
                color={isCameraSaveMode ? colors.captureCardText : '#FFFFFF'}
              />
            </Reanimated.View>
          )}
        </Reanimated.View>
      </Reanimated.View>
    </CaptureAnimatedPressable>
  );
}

interface TextCaptureSurfaceProps {
  activeTextPlaceholder: CaptureCardTextInputState['activeTextPlaceholder'];
  animatedAutoEmojiPopStyle: CaptureCardAnimatedStyle;
  colors: CaptureCardColors;
  doodleColor: CaptureCardDecorationState['doodleColor'];
  doodleColorOptions: CaptureCardDecorationState['doodleColorOptions'];
  doodleModeEnabled: CaptureCardDecorationState['doodleModeEnabled'];
  doodleStrokes: CaptureCardDecorationState['doodleStrokes'];
  handleChangeNoteText: CaptureCardTextInputState['handleChangeNoteText'];
  handleChangeStickerPlacements: CaptureCardDecorationState['changeStickerPlacements'];
  handleClearDoodle: CaptureCardDecorationState['clearDoodle'];
  handleInlinePasteStickerPress: CaptureCardStickerFlowState['handleInlinePasteStickerPress'];
  handleNativeInlinePasteStickerPress: CaptureCardStickerFlowState['handleNativeInlinePasteStickerPress'];
  handleNoteInputBlur: CaptureCardTextInputState['handleNoteInputBlur'];
  handleNoteInputFocus: CaptureCardTextInputState['handleNoteInputFocus'];
  handlePressStickerCanvas: () => void;
  handleSelectDoodleColor: CaptureCardDecorationState['selectDoodleColor'];
  handleSelectedStickerAction: (action: StickerAction) => void;
  handleSelectSticker: CaptureCardStickerFlowState['handleSelectSticker'];
  handleShowStickerSourceOptions: CaptureCardStickerFlowState['handleShowStickerSourceOptions'];
  handleToggleDoodleMode: () => void;
  handleToggleStickerMode: CaptureCardStickerFlowState['handleToggleStickerMode'];
  handleUndoDoodle: CaptureCardDecorationState['undoDoodle'];
  importingSticker: CaptureCardStickerFlowState['importingSticker'];
  inlinePasteLoading: CaptureCardStickerFlowState['inlinePasteLoading'];
  interactionsDisabled: boolean;
  onCanvasGestureActiveChange: (active: boolean) => void;
  noteInputRef: RefObject<TextInput | null>;
  noteColor: CaptureCardProps['noteColor'];
  noteText: CaptureCardProps['noteText'];
  recentAutoEmoji: CaptureCardTextInputState['recentAutoEmoji'];
  selectedStickerId: CaptureCardDecorationState['selectedStickerId'];
  setTextDoodleStrokes: CaptureCardDecorationState['setTextDoodleStrokes'];
  showInlinePasteButton: CaptureCardStickerFlowState['showInlinePasteButton'];
  stickerModeEnabled: CaptureCardDecorationState['stickerModeEnabled'];
  stickerPlacements: CaptureCardDecorationState['stickerPlacements'];
  t: TFunction;
  textCardActiveIconColor: string;
  textDoodleStrokes: CaptureCardDecorationState['textDoodleStrokes'];
  textInputDynamicStyle: CaptureCardTextInputStyle;
  useNativeInlinePasteButton: CaptureCardStickerFlowState['useNativeInlinePasteButton'];
}

function TextCaptureSurface({
  activeTextPlaceholder,
  animatedAutoEmojiPopStyle,
  colors,
  doodleColor,
  doodleColorOptions,
  doodleModeEnabled,
  doodleStrokes,
  handleChangeNoteText,
  handleChangeStickerPlacements,
  handleClearDoodle,
  handleInlinePasteStickerPress,
  handleNativeInlinePasteStickerPress,
  handleNoteInputBlur,
  handleNoteInputFocus,
  handlePressStickerCanvas,
  handleSelectDoodleColor,
  handleSelectedStickerAction,
  handleSelectSticker,
  handleShowStickerSourceOptions,
  handleToggleDoodleMode,
  handleToggleStickerMode,
  handleUndoDoodle,
  importingSticker,
  inlinePasteLoading,
  interactionsDisabled,
  onCanvasGestureActiveChange,
  noteInputRef,
  noteColor,
  noteText,
  recentAutoEmoji,
  selectedStickerId,
  setTextDoodleStrokes,
  showInlinePasteButton,
  stickerModeEnabled,
  stickerPlacements,
  t,
  textCardActiveIconColor,
  textDoodleStrokes,
  textInputDynamicStyle,
  useNativeInlinePasteButton,
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
            onToggleSelectedPlacementMotionLock={() => handleSelectedStickerAction('motion-lock-toggle')}
            onToggleSelectedPlacementOutline={() => handleSelectedStickerAction('outline-toggle')}
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
  capturedPairedVideo: CaptureCardProps['capturedPairedVideo'];
  capturedPhoto: NonNullable<CaptureCardProps['capturedPhoto']>;
  colors: CaptureCardColors;
  doodleColor: CaptureCardDecorationState['doodleColor'];
  doodleModeEnabled: CaptureCardDecorationState['doodleModeEnabled'];
  doodleStrokes: CaptureCardDecorationState['doodleStrokes'];
  flashAnimatedStyle: CaptureCardAnimatedStyle;
  handleChangeStickerPlacements: CaptureCardDecorationState['changeStickerPlacements'];
  handleConfirmPasteFromPrompt: CaptureCardStickerFlowState['handleConfirmPasteFromPrompt'];
  handlePressStickerCanvas: () => void;
  handleSelectedStickerAction: (action: StickerAction) => void;
  handleSelectSticker: CaptureCardStickerFlowState['handleSelectSticker'];
  handleShowCardPastePrompt: CaptureCardStickerFlowState['handleShowCardPastePrompt'];
  hasLivePhotoMotion: boolean;
  interactionsDisabled: boolean;
  noteInputRef: RefObject<TextInput | null>;
  noteText: CaptureCardProps['noteText'];
  onChangePhotoFilter: CaptureCardProps['onChangePhotoFilter'];
  onChangeNoteText: CaptureCardProps['onChangeNoteText'];
  pastePrompt: CaptureCardStickerFlowState['pastePrompt'];
  photoDoodleStrokes: CaptureCardDecorationState['photoDoodleStrokes'];
  onPhotoCaptionBlur: () => void;
  onCanvasGestureActiveChange: (active: boolean) => void;
  onPhotoCaptionFocus: () => void;
  selectedPhotoFilterId: CaptureCardProps['selectedPhotoFilterId'];
  selectedStickerId: CaptureCardDecorationState['selectedStickerId'];
  setPhotoDoodleStrokes: CaptureCardDecorationState['setPhotoDoodleStrokes'];
  stickerModeEnabled: CaptureCardDecorationState['stickerModeEnabled'];
  stickerPlacements: CaptureCardDecorationState['stickerPlacements'];
  t: TFunction;
  dismissPastePrompt: CaptureCardStickerFlowState['dismissPastePrompt'];
}

function PhotoCaptureSurface({
  capturedPairedVideo,
  capturedPhoto,
  colors,
  doodleColor,
  doodleModeEnabled,
  doodleStrokes,
  flashAnimatedStyle,
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
  onChangePhotoFilter,
  onChangeNoteText,
  pastePrompt,
  photoDoodleStrokes,
  onPhotoCaptionBlur,
  onCanvasGestureActiveChange,
  onPhotoCaptionFocus,
  selectedPhotoFilterId,
  selectedStickerId,
  setPhotoDoodleStrokes,
  stickerModeEnabled,
  stickerPlacements,
  t,
  dismissPastePrompt,
}: PhotoCaptureSurfaceProps) {
  const photoPreviewControlBorder = hasLivePhotoMotion
    ? (colors.captureGlassColorScheme === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.42)')
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
            onToggleSelectedPlacementMotionLock={() => handleSelectedStickerAction('motion-lock-toggle')}
            onToggleSelectedPlacementOutline={() => handleSelectedStickerAction('outline-toggle')}
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
            onGestureActiveChange={onCanvasGestureActiveChange}
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
  cameraDevice: CaptureCardProps['cameraDevice'];
  cameraKey: CaptureCardCameraControllerState['cameraKey'];
  cameraPermissionRequiresSettings: boolean;
  cameraPreviewZoom: CaptureCardCameraControllerState['cameraPreviewZoom'];
  cameraRef: CaptureCardProps['cameraRef'];
  cameraTransitionMaskAnimatedStyle: CaptureCardAnimatedStyle;
  cameraUnavailableDetail: CaptureCardCameraControllerState['cameraUnavailableDetail'];
  cameraZoomGesture: CaptureCardCameraControllerState['cameraZoomGesture'];
  canShowLiveCameraPreview: CaptureCardCameraControllerState['canShowLiveCameraPreview'];
  colors: CaptureCardColors;
  facing: CaptureCardProps['facing'];
  flashAnimatedStyle: CaptureCardAnimatedStyle;
  handleCameraInitialized: CaptureCardCameraControllerState['handleCameraInitialized'];
  handleCameraPreviewStarted: CaptureCardCameraControllerState['handleCameraPreviewStarted'];
  handleCameraRetryPress: () => void;
  handleCameraStartupFailure: CaptureCardCameraControllerState['handleCameraStartupFailure'];
  handleRequestCameraPermissionPress: () => void;
  isLivePhotoCaptureInProgress: boolean;
  livePhotoProgressPath: CaptureCardCameraControllerState['livePhotoProgressPath'];
  livePhotoRingProgress: CaptureCardCameraControllerState['livePhotoRingProgress'];
  needsCameraPermission: boolean;
  shouldRenderCameraPreview: CaptureCardCameraControllerState['shouldRenderCameraPreview'];
  showCameraUnavailableState: CaptureCardCameraControllerState['showCameraUnavailableState'];
  t: TFunction;
}

function LiveCameraSurface({
  cameraDevice,
  cameraKey,
  cameraPermissionRequiresSettings,
  cameraPreviewZoom,
  cameraRef,
  cameraTransitionMaskAnimatedStyle,
  cameraUnavailableDetail,
  cameraZoomGesture,
  canShowLiveCameraPreview,
  colors,
  facing,
  flashAnimatedStyle,
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
  showCameraUnavailableState,
  t,
}: LiveCameraSurfaceProps) {
  return (
    <View
      style={[styles.cameraContainer, { backgroundColor: colors.captureCameraOverlay }]}
      collapsable={false}
    >
      {shouldRenderCameraPreview ? (
        <GestureDetector gesture={cameraZoomGesture}>
          <View style={styles.cameraGestureLayer}>
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
      <Reanimated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: colors.captureFlashOverlay, zIndex: 50 },
          flashAnimatedStyle,
        ]}
      />
    </View>
  );
}

interface TextCaptureBottomBarProps {
  colors: CaptureCardColors;
  doodleColor: CaptureCardDecorationState['doodleColor'];
  doodleColorOptions: CaptureCardDecorationState['doodleColorOptions'];
  doodleModeEnabled: CaptureCardDecorationState['doodleModeEnabled'];
  doodleStrokes: CaptureCardDecorationState['doodleStrokes'];
  handleClearDoodle: CaptureCardDecorationState['clearDoodle'];
  handleInlinePasteStickerPress: CaptureCardStickerFlowState['handleInlinePasteStickerPress'];
  handleNativeInlinePasteStickerPress: CaptureCardStickerFlowState['handleNativeInlinePasteStickerPress'];
  handleSelectDoodleColor: CaptureCardDecorationState['selectDoodleColor'];
  handleSelectedStickerAction: (action: StickerAction) => void;
  handleShowStickerSourceOptions: CaptureCardStickerFlowState['handleShowStickerSourceOptions'];
  handleToggleDoodleMode: () => void;
  handleToggleStickerMode: CaptureCardStickerFlowState['handleToggleStickerMode'];
  handleUndoDoodle: CaptureCardDecorationState['undoDoodle'];
  importingSticker: CaptureCardStickerFlowState['importingSticker'];
  inlinePasteLoading: CaptureCardStickerFlowState['inlinePasteLoading'];
  selectedStickerId: CaptureCardDecorationState['selectedStickerId'];
  showInlinePasteButton: CaptureCardStickerFlowState['showInlinePasteButton'];
  stickerModeEnabled: CaptureCardDecorationState['stickerModeEnabled'];
  t: TFunction;
  textCardActiveIconColor: string;
  useNativeInlinePasteButton: CaptureCardStickerFlowState['useNativeInlinePasteButton'];
}

interface CaptureControlRailProps {
  animationKey?: string;
  borderColor: string;
  colors: CaptureCardColors;
  children: ReactNode;
  style?: ComponentProps<typeof View>['style'];
  rowStyle?: ComponentProps<typeof View>['style'];
}

function CaptureControlRail({
  borderColor,
  colors,
  children,
  style,
  rowStyle,
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

interface CaptureDecorateRailProps {
  afterToggles?: ReactNode;
  animationKey?: string;
  colors: CaptureCardColors;
  defaultActions?: ReactNode;
  doodleColor: CaptureCardDecorationState['doodleColor'];
  doodleColorOptions: CaptureCardDecorationState['doodleColorOptions'];
  doodleModeEnabled: CaptureCardDecorationState['doodleModeEnabled'];
  doodleStrokes: CaptureCardDecorationState['doodleStrokes'];
  enableStickers?: boolean;
  handleClearDoodle: CaptureCardDecorationState['clearDoodle'];
  handleSelectDoodleColor: CaptureCardDecorationState['selectDoodleColor'];
  handleSelectedStickerAction: (action: StickerAction) => void;
  handleShowStickerSourceOptions: CaptureCardStickerFlowState['handleShowStickerSourceOptions'];
  handleToggleDoodleMode: () => void;
  handleToggleStickerMode: CaptureCardStickerFlowState['handleToggleStickerMode'];
  handleUndoDoodle: CaptureCardDecorationState['undoDoodle'];
  importingSticker: CaptureCardStickerFlowState['importingSticker'];
  railStyle?: ComponentProps<typeof View>['style'];
  rowStyle?: ComponentProps<typeof View>['style'];
  selectedStickerId: CaptureCardDecorationState['selectedStickerId'];
  stickerModeEnabled: CaptureCardDecorationState['stickerModeEnabled'];
  t: TFunction;
  theme: CaptureDecorateRailTheme;
}

function CaptureDecorateRail({
  afterToggles = null,
  animationKey,
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
      animationKey={animationKey}
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
          accessibilityLabel={stickerModeEnabled ? t('capture.doneStickers', 'Done') : t('capture.stickers', 'Stickers')}
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
            onPress={() => {
              void handleShowStickerSourceOptions();
            }}
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

function TextCaptureBottomBar({
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
        animationKey={
          doodleModeEnabled
            ? 'text-doodle'
            : stickerModeEnabled
              ? 'text-sticker'
              : showInlinePasteButton
                ? 'text-default-paste'
                : 'text-default'
        }
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
          activeBorderColor: 'rgba(255,255,255,0.18)',
          activeIconColor: textCardActiveIconColor,
          detailBackgroundColor: 'transparent',
          detailBorderColor: 'transparent',
          detailIconColor: colors.captureGlassText,
          inactiveBackgroundColor: colors.captureGlassFill,
          inactiveBorderColor: 'transparent',
          inactiveIconColor: colors.captureGlassText,
          paletteButtonBackgroundColor: colors.captureGlassFill,
          paletteButtonBorderColor: colors.captureGlassBorder,
          paletteSelectedBorderColor: colors.captureButtonBg,
          paletteSwatchBorderColor: 'rgba(43,38,33,0.16)',
          railBorderColor: colors.captureGlassBorder,
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
                  style={[styles.textBottomToolsButton, styles.textBottomToolsAction]}
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
                  style={styles.nativeInlinePasteStickerButton}
                />
              ) : (
                <CaptureAnimatedPressable
                  testID="capture-inline-paste-sticker"
                  accessibilityLabel={t('capture.pasteStickerAction', 'Paste sticker')}
                  onPress={handleInlinePasteStickerPress}
                  disabled={inlinePasteLoading}
                  disabledOpacity={1}
                  style={[styles.textBottomToolsButton, styles.textBottomToolsAction]}
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
  onOpenPhotoLibrary: CaptureCardProps['onOpenPhotoLibrary'];
  t: TFunction;
}

function LiveCameraActionBar({
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
        animationKey={importingPhoto ? 'camera-live-importing' : libraryImportLocked ? 'camera-live-locked' : 'camera-live'}
        borderColor={colors.captureGlassBorder}
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
            accessibilityLabel={libraryImportLocked ? t('capture.plusLibraryLocked', 'Plus') : t('capture.importPhoto', 'Photos')}
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
                <Ionicons
                  name="images-outline"
                  size={16}
                  color={colors.captureGlassText}
                />
                <Text style={[styles.captureActionPillLabel, { color: colors.captureGlassText }]}>
                  {libraryImportLocked ? t('capture.plusLibraryLocked', 'Plus') : t('capture.importPhoto', 'Photos')}
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
  doodleColor: CaptureCardDecorationState['doodleColor'];
  doodleColorOptions: CaptureCardDecorationState['doodleColorOptions'];
  doodleModeEnabled: CaptureCardDecorationState['doodleModeEnabled'];
  doodleStrokes: CaptureCardDecorationState['doodleStrokes'];
  handleClearDoodle: CaptureCardDecorationState['clearDoodle'];
  handleSelectDoodleColor: CaptureCardDecorationState['selectDoodleColor'];
  handleSelectedStickerAction: (action: StickerAction) => void;
  handleShowStickerSourceOptions: CaptureCardStickerFlowState['handleShowStickerSourceOptions'];
  handleToggleDoodleMode: () => void;
  handleToggleStickerMode: CaptureCardStickerFlowState['handleToggleStickerMode'];
  handleUndoDoodle: CaptureCardDecorationState['undoDoodle'];
  hasLivePhotoMotion: boolean;
  importingSticker: CaptureCardStickerFlowState['importingSticker'];
  onImportMotionClip: NonNullable<CaptureCardProps['onImportMotionClip']>;
  onRemoveMotionClip: NonNullable<CaptureCardProps['onRemoveMotionClip']>;
  selectedStickerId: CaptureCardDecorationState['selectedStickerId'];
  stickerModeEnabled: CaptureCardDecorationState['stickerModeEnabled'];
  t: TFunction;
  textCardActiveIconColor: string;
}

function PhotoCaptureBottomBar({
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
        animationKey={
          doodleModeEnabled
            ? 'photo-doodle'
            : stickerModeEnabled
              ? 'photo-sticker'
              : hasLivePhotoMotion
                ? 'photo-live'
                : 'photo-filter'
        }
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
          activeBorderColor: 'rgba(255,255,255,0.18)',
          activeIconColor: textCardActiveIconColor,
          detailBackgroundColor: 'transparent',
          detailBorderColor: 'transparent',
          detailIconColor: colors.captureGlassText,
          inactiveBackgroundColor: colors.captureGlassFill,
          inactiveBorderColor: 'transparent',
          inactiveIconColor: colors.captureGlassText,
          paletteButtonBackgroundColor: colors.captureGlassFill,
          paletteButtonBorderColor: colors.captureGlassBorder,
          paletteSelectedBorderColor: colors.captureButtonBg,
          paletteSwatchBorderColor: 'rgba(43,38,33,0.16)',
          railBorderColor: colors.captureGlassBorder,
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
                backgroundColor: hasLivePhotoMotion ? colors.captureButtonBg : colors.captureGlassFill,
                borderColor: hasLivePhotoMotion ? colors.captureButtonBg : 'transparent',
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
  handleSavePressIn: () => void;
  handleSavePressOut: () => void;
  handleShutterLongPress: CaptureCardCameraControllerState['handleShutterLongPress'];
  handleShutterPress: CaptureCardCameraControllerState['handleShutterPress'];
  handleShutterRelease: CaptureCardCameraControllerState['handleShutterRelease'];
  handleSwitchCameraPress: CaptureCardCameraControllerState['handleSwitchCameraPress'];
  isCameraSaveMode: boolean;
  isLivePhotoCaptureInProgress: boolean;
  isSaveBusy: boolean;
  isSaveDisabled: boolean;
  isSaveSuccessful: boolean;
  isSharedTarget: boolean;
  livePhotoCountdownSeconds: CaptureCardCameraControllerState['livePhotoCountdownSeconds'];
  onChangeShareTarget: CaptureCardProps['onChangeShareTarget'];
  onRetakePhoto: CaptureCardProps['onRetakePhoto'];
  onSaveNote: CaptureCardProps['onSaveNote'];
  onShutterPressIn: CaptureCardProps['onShutterPressIn'];
  permissionGranted: boolean;
  remainingPhotoSlots: CaptureCardProps['remainingPhotoSlots'];
  savePressAnimatedStyle: CaptureCardAnimatedStyle;
  shareTarget: CaptureCardProps['shareTarget'];
  showCameraUnavailableState: CaptureCardCameraControllerState['showCameraUnavailableState'];
  shutterCaptureHaloAnimatedStyle: CaptureCardAnimatedStyle;
  shutterInnerAnimatedStyle: CaptureCardAnimatedStyle;
  shutterOuterAnimatedStyle: CaptureCardAnimatedStyle;
  t: TFunction;
  capturedPhoto: CaptureCardProps['capturedPhoto'];
  captureMode: CaptureCardProps['captureMode'];
}

function CaptureActionRow({
  animatedSaveHaloStyle,
  animatedSaveIconStyle,
  animatedSaveInnerStyle,
  colors,
  handleSavePressIn,
  handleSavePressOut,
  handleShutterLongPress,
  handleShutterPress,
  handleShutterRelease,
  handleSwitchCameraPress,
  isCameraSaveMode,
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
  capturedPhoto,
  captureMode,
}: CaptureActionRowProps) {
  if (captureMode === 'camera' && !capturedPhoto) {
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
              style={[
                styles.shutterOuter,
                shutterOuterAnimatedStyle as never,
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
        capturedPhoto ? styles.belowCardCapturedPhotoActions : null,
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
        isCameraSaveMode={isCameraSaveMode}
        isSaveBusy={isSaveBusy}
        isSaveDisabled={isSaveDisabled}
        isSaveSuccessful={isSaveSuccessful}
        onSaveNote={onSaveNote}
        onPressIn={handleSavePressIn}
        onPressOut={handleSavePressOut}
        savePressAnimatedStyle={savePressAnimatedStyle}
      />
      {capturedPhoto ? (
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
          style={styles.belowCardTrailingAction}
        />
      ) : (
        <View style={[styles.belowCardSideActionSpacer, styles.belowCardTrailingAction]} />
      )}
    </View>
  );
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
  const isCameraSaveMode = captureMode === 'camera';
  const isSharedTarget = shareTarget === 'shared';
  const isDarkCaptureTheme = colors.captureGlassColorScheme === 'dark';
  const textCardActiveIconColor = isDarkCaptureTheme ? colors.captureCardText : '#FFFFFF';
  const textCaptureNoteColor = DEFAULT_NOTE_COLOR_ID;
  const effectiveTextModeNoteColor = captureMode === 'text' ? textCaptureNoteColor : noteColor;
  const hasLivePhotoMotion = Boolean(capturedPairedVideo);
  const saveStateScale = useSharedValue(1);
  const saveSuccessProgress = useSharedValue(saveState === 'success' ? 1 : 0);
  const savePressScale = useSharedValue(1);
  const autoEmojiPopOpacity = useSharedValue(0);
  const autoEmojiPopTranslateY = useSharedValue(12);
  const autoEmojiPopScale = useSharedValue(0.86);
  const [isPhotoCaptionFocused, setIsPhotoCaptionFocused] = useState(false);
  const previousTextDraftEmptyRef = useRef(noteText.length === 0);
  const previousCaptureModeRef = useRef(captureMode);
  const placeholderVariants = useMemo(() => getCaptureTextPlaceholderVariants(t), [t]);
  const textInputDynamicStyle = useMemo(
    () =>
      noteText.length > 200 ? { fontSize: 16, lineHeight: 22 } :
        noteText.length > 100 ? { fontSize: 20, lineHeight: 28 } : null,
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
  const noteInputRef = useRef<TextInput | null>(null);
  const restaurantInputRef = useRef<TextInput | null>(null);
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
    minimumVisibleInputY: topInset + 24,
    noteText,
    noteInputRef,
    onChangeNoteText,
    placeholderVariants,
    reduceMotionEnabled,
    restaurantInputRef,
  });
  const isCaptureTextEntryFocused = isTextEntryFocused || isPhotoCaptionFocused;
  const handlePhotoCaptionFocus = useCallback(() => {
    setIsPhotoCaptionFocused(true);
  }, []);
  const handlePhotoCaptionBlur = useCallback(() => {
    setIsPhotoCaptionFocused(false);
  }, []);
  useEffect(() => {
    onTextEntryFocusChange?.(isCaptureTextEntryFocused);
  }, [isCaptureTextEntryFocused, onTextEntryFocusChange]);
  useEffect(() => {
    if (captureMode !== 'text' || !onChangeNoteColor) {
      return;
    }

    if (noteColor !== textCaptureNoteColor) {
      onChangeNoteColor(textCaptureNoteColor);
    }
  }, [captureMode, noteColor, onChangeNoteColor, textCaptureNoteColor]);
  useEffect(
    () => () => {
      onTextEntryFocusChange?.(false);
    },
    [onTextEntryFocusChange]
  );
  useEffect(() => {
    if (captureMode === 'camera' && capturedPhoto) {
      return;
    }

    setIsPhotoCaptionFocused(false);
  }, [captureMode, capturedPhoto]);
  const dismissCaptureInputs = useCallback(() => {
    noteInputRef.current?.blur();
    restaurantInputRef.current?.blur();
    setIsPhotoCaptionFocused(false);
    dismissCaptureInputsState();
  }, [dismissCaptureInputsState]);
  const {
    applyImportedSticker,
    changeStickerPlacements: handleChangeStickerPlacements,
    clearDoodle: handleClearDoodle,
    closeDecorateControls,
    doodleColor,
    doodleColorOptions,
    doodleModeEnabled,
    doodleStrokes,
    photoDoodleStrokes,
    pressStickerCanvas: handlePressStickerCanvasInternal,
    resetDoodle,
    resetStickers,
    selectDoodleColor: handleSelectDoodleColor,
    selectedStickerId,
    selectSticker: selectStickerPlacement,
    stickerModeEnabled,
    stickerPlacements,
    textDoodleStrokes,
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
    handleCloseStickerSourceSheet,
    handleConfirmStampCutter,
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
    showStickerSourceSheet,
    stampCutterDraft,
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
  const {
    handleCloseNoteColorSheet,
    handleCloseRadiusSheet,
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
    cameraKey,
    cameraPreviewZoom,
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
    shutterCaptureHaloAnimatedStyle,
    shutterInnerAnimatedStyle,
    shutterOuterAnimatedStyle,
  } = useCaptureCardCameraController({
    captureMode,
    capturedPhoto,
    cameraDevice,
    cameraSessionKey,
    permissionGranted,
    isCameraPreviewActive,
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
  const saveIdleBackground = isCameraSaveMode ? colors.primary : colors.captureButtonBg;
  const disableAndroidCaptureTransforms =
    Platform.OS === 'android' &&
    !isModeSwitchAnimating &&
    (captureMode === 'camera' || (captureMode === 'text' && isTextEntryFocused));
  const shouldUseSimpleKeyboardAvoidance =
    Platform.OS === 'ios' && isCaptureTextEntryFocused;
  const androidTextEntryBottomInset =
    Platform.OS === 'android' && isCaptureTextEntryFocused ? 96 : 0;
  const captureKeyboardVerticalOffset = topInset + 76;
  const [canvasGestureActive, setCanvasGestureActive] = useState(false);

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

  useEffect(() => {
    if (!recentAutoEmoji) {
      autoEmojiPopOpacity.value = 0;
      autoEmojiPopTranslateY.value = 12;
      autoEmojiPopScale.value = 0.86;
      return;
    }

    autoEmojiPopOpacity.value = withSequence(
      withTiming(1, {
        duration: reduceMotionEnabled ? 90 : 180,
        easing: Easing.out(Easing.cubic),
      }),
      withTiming(1, {
        duration: reduceMotionEnabled ? 140 : 520,
      }),
      withTiming(0, {
        duration: reduceMotionEnabled ? 140 : 240,
        easing: Easing.in(Easing.quad),
      })
    );
    autoEmojiPopTranslateY.value = withSequence(
      withTiming(reduceMotionEnabled ? 0 : -12, {
        duration: reduceMotionEnabled ? 90 : 220,
        easing: Easing.out(Easing.cubic),
      }),
      withTiming(reduceMotionEnabled ? 0 : -18, {
        duration: reduceMotionEnabled ? 180 : 620,
        easing: Easing.out(Easing.quad),
      })
    );
    autoEmojiPopScale.value = withSequence(
      withTiming(1.06, {
        duration: reduceMotionEnabled ? 90 : 180,
        easing: Easing.out(Easing.back(1.2)),
      }),
      withTiming(1, {
        duration: reduceMotionEnabled ? 140 : 220,
        easing: Easing.out(Easing.cubic),
      })
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
  }, [captureMode, capturedPhoto, closeDecorateControls, closeStickerOverlays]);

  useEffect(() => {
    if (!doodleModeEnabled && !stickerModeEnabled) {
      setCanvasGestureActive(false);
    }
  }, [doodleModeEnabled, stickerModeEnabled]);

  useEffect(() => {
    const wasTextDraftEmpty = previousTextDraftEmptyRef.current;
    const previousCaptureMode = previousCaptureModeRef.current;
    previousTextDraftEmptyRef.current = rotatePlaceholderIfNeeded(previousCaptureMode, wasTextDraftEmpty);
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
      canvasGestureActive || isLivePhotoCaptureInProgress
    );
  }, [
    canvasGestureActive,
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
  const animatedAutoEmojiPopStyle = useAnimatedStyle(() => ({
    opacity: autoEmojiPopOpacity.value,
    transform: [
      { translateY: autoEmojiPopTranslateY.value },
      { scale: autoEmojiPopScale.value },
    ],
  }), [autoEmojiPopOpacity, autoEmojiPopScale, autoEmojiPopTranslateY]);
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
  const savePressAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: savePressScale.value }],
  }), [savePressScale]);
  const handleCameraRetryPress = useCallback(() => {
    triggerCaptureCardHaptic();
    restartCameraPreview(true);
  }, [restartCameraPreview]);
  const handleRequestCameraPermissionPress = useCallback(() => {
    triggerCaptureCardHaptic();
    onRequestCameraPermission();
  }, [onRequestCameraPermission]);

  const noteColorSheetBody = onChangeNoteColor ? (
    <AppSheetScaffold
      headerVariant="standard"
      title={t('capture.noteColor', 'Card color')}
      subtitle={t('capture.noteColorHint', 'Pick the gradient you want before saving this note.')}
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
      <View
        style={[
          styles.snapItem,
          {
            height: snapHeight,
            paddingTop: topInset + Layout.headerHeight - DOCKED_HEADER_CONTENT_OVERLAP,
            paddingBottom: androidTextEntryBottomInset,
          },
        ]}
      >
        <KeyboardAvoidingView
          enabled={shouldUseSimpleKeyboardAvoidance}
          behavior="padding"
          keyboardVerticalOffset={captureKeyboardVerticalOffset}
          style={styles.captureKeyboardAvoiding}
        >
          <Reanimated.View
            testID="capture-card-area"
            style={[
              styles.captureArea,
              disableAndroidCaptureTransforms ? null : captureAreaAnimatedStyle,
            ]}
            pointerEvents={isSearching || interactionsDisabled ? 'none' : 'auto'}
          >
            {captureMode === 'text' ? (
              <TextCaptureSurface
                activeTextPlaceholder={activeTextPlaceholder}
                animatedAutoEmojiPopStyle={animatedAutoEmojiPopStyle}
                colors={colors}
                doodleColor={doodleColor}
                doodleColorOptions={doodleColorOptions}
                doodleModeEnabled={doodleModeEnabled}
                doodleStrokes={doodleStrokes}
                handleChangeNoteText={handleChangeNoteText}
                handleChangeStickerPlacements={handleChangeStickerPlacements}
                handleClearDoodle={handleClearDoodle}
                handleInlinePasteStickerPress={handleInlinePasteStickerPress}
                handleNativeInlinePasteStickerPress={handleNativeInlinePasteStickerPress}
                handleNoteInputBlur={handleNoteInputBlur}
                handleNoteInputFocus={handleNoteInputFocus}
                handlePressStickerCanvas={handlePressStickerCanvas}
                handleSelectDoodleColor={handleSelectDoodleColor}
                handleSelectedStickerAction={handleSelectedStickerAction}
                handleSelectSticker={handleSelectSticker}
                handleShowStickerSourceOptions={handleShowStickerSourceOptions}
                handleToggleDoodleMode={handleToggleDoodleMode}
                handleToggleStickerMode={handleToggleStickerMode}
                handleUndoDoodle={handleUndoDoodle}
                importingSticker={importingSticker}
                inlinePasteLoading={inlinePasteLoading}
                interactionsDisabled={interactionsDisabled}
                onCanvasGestureActiveChange={setCanvasGestureActive}
                noteInputRef={noteInputRef}
                noteColor={effectiveTextModeNoteColor}
                noteText={noteText}
                recentAutoEmoji={recentAutoEmoji}
                selectedStickerId={selectedStickerId}
                setTextDoodleStrokes={setTextDoodleStrokes}
                showInlinePasteButton={showInlinePasteButton}
                stickerModeEnabled={stickerModeEnabled}
                stickerPlacements={stickerPlacements}
                t={t}
                textCardActiveIconColor={textCardActiveIconColor}
                textDoodleStrokes={textDoodleStrokes}
                textInputDynamicStyle={textInputDynamicStyle}
                useNativeInlinePasteButton={useNativeInlinePasteButton}
              />
            ) : capturedPhoto ? (
              <PhotoCaptureSurface
                capturedPairedVideo={capturedPairedVideo}
                capturedPhoto={capturedPhoto}
                colors={colors}
                doodleColor={doodleColor}
                doodleModeEnabled={doodleModeEnabled}
                doodleStrokes={doodleStrokes}
                flashAnimatedStyle={flashAnimatedStyle}
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
                onChangePhotoFilter={onChangePhotoFilter}
                onChangeNoteText={onChangeNoteText}
                onCanvasGestureActiveChange={setCanvasGestureActive}
                onPhotoCaptionBlur={handlePhotoCaptionBlur}
                onPhotoCaptionFocus={handlePhotoCaptionFocus}
                pastePrompt={pastePrompt}
                photoDoodleStrokes={photoDoodleStrokes}
                selectedPhotoFilterId={selectedPhotoFilterId}
                selectedStickerId={selectedStickerId}
                setPhotoDoodleStrokes={setPhotoDoodleStrokes}
                stickerModeEnabled={stickerModeEnabled}
                stickerPlacements={stickerPlacements}
                t={t}
                dismissPastePrompt={dismissPastePrompt}
              />
            ) : shouldShowCameraCard ? (
              <LiveCameraSurface
                cameraDevice={cameraDevice}
                cameraKey={cameraKey}
                cameraPermissionRequiresSettings={cameraPermissionRequiresSettings}
                cameraPreviewZoom={cameraPreviewZoom}
                cameraRef={cameraRef}
                cameraTransitionMaskAnimatedStyle={cameraTransitionMaskAnimatedStyle}
                cameraUnavailableDetail={cameraUnavailableDetail}
                cameraZoomGesture={cameraZoomGesture}
                canShowLiveCameraPreview={canShowLiveCameraPreview}
                colors={colors}
                facing={facing}
                flashAnimatedStyle={flashAnimatedStyle}
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
                showCameraUnavailableState={showCameraUnavailableState}
                t={t}
              />
            ) : null}
          </Reanimated.View>

          <Reanimated.View
            style={[
              styles.belowCardSection,
              disableAndroidCaptureTransforms ? null : belowCardAnimatedStyle,
            ]}
            pointerEvents={interactionsDisabled ? 'none' : 'auto'}
          >
            {captureMode === 'text' ? (
              <TextCaptureBottomBar
                colors={colors}
                doodleColor={doodleColor}
                doodleColorOptions={doodleColorOptions}
                doodleModeEnabled={doodleModeEnabled}
                doodleStrokes={doodleStrokes}
                handleClearDoodle={handleClearDoodle}
                handleInlinePasteStickerPress={handleInlinePasteStickerPress}
                handleNativeInlinePasteStickerPress={handleNativeInlinePasteStickerPress}
                handleSelectDoodleColor={handleSelectDoodleColor}
                handleSelectedStickerAction={handleSelectedStickerAction}
                handleShowStickerSourceOptions={handleShowStickerSourceOptions}
                handleToggleDoodleMode={handleToggleDoodleMode}
                handleToggleStickerMode={handleToggleStickerMode}
                handleUndoDoodle={handleUndoDoodle}
                importingSticker={importingSticker}
                inlinePasteLoading={inlinePasteLoading}
                selectedStickerId={selectedStickerId}
                showInlinePasteButton={showInlinePasteButton}
                stickerModeEnabled={stickerModeEnabled}
                t={t}
                textCardActiveIconColor={textCardActiveIconColor}
                useNativeInlinePasteButton={useNativeInlinePasteButton}
              />
            ) : capturedPhoto ? (
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
                selectedStickerId={selectedStickerId}
                stickerModeEnabled={stickerModeEnabled}
                t={t}
                textCardActiveIconColor={textCardActiveIconColor}
              />
            ) : (
              <LiveCameraActionBar
                cameraInstructionText={cameraInstructionText}
                colors={colors}
                importingPhoto={importingPhoto}
                libraryImportLocked={libraryImportLocked}
                needsCameraPermission={needsCameraPermission}
                onOpenPhotoLibrary={onOpenPhotoLibrary}
                t={t}
              />
            )}
            <CaptureActionRow
              animatedSaveHaloStyle={animatedSaveHaloStyle}
              animatedSaveIconStyle={animatedSaveIconStyle}
              animatedSaveInnerStyle={animatedSaveInnerStyle}
              colors={colors}
              handleSavePressIn={handleSavePressIn}
              handleSavePressOut={handleSavePressOut}
              handleShutterLongPress={handleShutterLongPress}
              handleShutterPress={handleShutterPress}
              handleShutterRelease={handleShutterRelease}
              handleSwitchCameraPress={handleSwitchCameraPress}
              isCameraSaveMode={isCameraSaveMode}
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
              capturedPhoto={capturedPhoto}
              captureMode={captureMode}
            />
          {footerContent ? <View style={styles.footerSlot}>{footerContent}</View> : null}
          </Reanimated.View>
        </KeyboardAvoidingView>
      </View>
      <StickerSourceSheet
        visible={showStickerSourceSheet}
        title={t('capture.addStickerTitle', 'Add sticker')}
        subtitle={t('capture.addStickerHint', 'Choose a floating sticker or a photo stamp.')}
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
        subtitle={t('capture.stampCutterHint', 'Drag, pinch, or use the controls to frame the part of the photo you want on the stamp.')}
        cancelLabel={t('common.cancel', 'Cancel')}
        confirmLabel={t('capture.stampCutterConfirm', 'Cut stamp')}
        onClose={handleCloseStampCutterEditor}
        onConfirm={handleConfirmStampCutter}
      />
    </>
  );
});

export default CaptureCard;

const styles = StyleSheet.create({
  captureKeyboardAvoiding: {
    width: '100%',
  },
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
    padding: 28,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    ...(Platform.OS === 'android' ? {} : Shadows.card),
  },
  textCardLightContrast: {
    borderWidth: 1,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 10,
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
  autoEmojiPopWrap: {
    position: 'absolute',
    top: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 4,
    zIndex: 2,
  },
  autoEmojiPopEmoji: {
    fontSize: 18,
    lineHeight: 20,
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
    alignItems: 'center',
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
  cardTopOverlayRowWrap: {
    flexWrap: 'wrap',
  },
  photoTopToolsBar: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  photoTopToolsRow: {
    justifyContent: 'flex-start',
    alignSelf: 'flex-start',
  },
  photoTopDetailAction: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
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
  textCardInlineColorPreview: {
    width: 18,
    height: 18,
    borderRadius: 9,
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
  captureActionTextPill: {
    width: 'auto',
    minWidth: 58,
    paddingHorizontal: 12,
  },
  captureActionPillLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  livePhotoTogglePill: {
    width: TOP_CONTROL_HEIGHT,
    minWidth: TOP_CONTROL_HEIGHT,
    paddingHorizontal: 0,
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
  cardRestaurantPillOverlay: {
    width: 'auto',
    maxWidth: CARD_SIZE - 140,
    minWidth: 210,
    alignSelf: 'center',
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  cardRestaurantPillBelow: {
    marginTop: 0,
  },
  captureMetaComposite: {
    width: '100%',
    maxWidth: 344,
    alignSelf: 'center',
    paddingHorizontal: 12,
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
  cameraLiveProgressOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 3,
  },
  cameraLiveProgressCanvas: {
    width: '100%',
    height: '100%',
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
    justifyContent: 'flex-start',
    minHeight: 162,
    gap: 10,
  },
  belowCardMetaRow: {
    width: '100%',
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  photoCaptionIcon: {
    marginTop: 0,
  },
  photoCaptionOverlayField: {
    width: '84%',
    minHeight: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  photoCaptionOverlayInput: {
    flex: 1,
    height: 20,
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '600',
    fontFamily: 'Noto Sans',
    paddingVertical: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  photoCaptionClearButton: {
    marginLeft: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBottomToolsWrap: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },
  captureActionBarWrap: {
    width: '100%',
    alignItems: 'center',
  },
  textBottomToolsBar: {
    alignSelf: 'center',
    minHeight: 46,
    borderRadius: Radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  textBottomToolsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    flexWrap: 'nowrap',
    minHeight: TOP_CONTROL_HEIGHT,
    gap: 8,
  },
  textBottomToolsButton: {
    width: TOP_CONTROL_HEIGHT,
    height: TOP_CONTROL_HEIGHT,
    borderRadius: TOP_CONTROL_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBottomToolsAction: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBottomDetailAction: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
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
  cameraActionHintWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  cameraActionHintText: {
    ...Typography.pill,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    fontWeight: '700',
  },
  cameraControlsWrap: {
    width: '100%',
    position: 'relative',
    alignItems: 'center',
  },
  cameraMetaSlot: {
    width: '100%',
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraMetaHintLayer: {
    position: 'absolute',
    alignSelf: 'center',
  },
  cameraMetaButtonLayer: {
    position: 'absolute',
    alignSelf: 'center',
  },
  cameraHintPill: {
    minHeight: 34,
    maxWidth: '100%',
    borderRadius: Radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    justifyContent: 'center',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cameraHintContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cameraHintText: {
    ...Typography.pill,
    fontSize: 13,
    lineHeight: 16,
    textAlign: 'center',
  },
  cameraHintSeparator: {
    fontSize: 12,
    lineHeight: 16,
  },
  cameraHintAccentText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
    fontFamily: 'Noto Sans',
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
    minHeight: 92,
    paddingTop: 12,
    paddingBottom: 14,
  },
  liveCameraShutterRow: {
    minHeight: 92,
    paddingTop: 12,
    paddingBottom: 14,
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
    marginLeft: SHUTTER_OUTER_SIZE / 2 + SHUTTER_SIDE_ACTION_GAP,
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
  shutterInner: {
    width: SHUTTER_INNER_SIZE,
    height: SHUTTER_INNER_SIZE,
    borderRadius: SHUTTER_INNER_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveInner: {
    transform: [{ scale: 1 }],
    overflow: 'hidden',
  },
  saveHalo: {
    ...StyleSheet.absoluteFill,
    borderRadius: SHUTTER_INNER_SIZE / 2,
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
  stickerActionsSheet: {
    paddingTop: 6,
  },
  stickerActionsSheetHeader: {
    paddingHorizontal: SHEET_HORIZONTAL_PADDING,
    paddingBottom: 10,
  },
  stickerActionsSheetTitle: {
    ...Typography.screenTitle,
    textAlign: 'left',
  },
  stickerActionsSheetList: {
    paddingBottom: 0,
  },
  stickerActionsSheetFooter: {
    marginTop: 0,
  },
  stickerActionsSheetRow: {
    minHeight: 68,
    paddingHorizontal: SHEET_HORIZONTAL_PADDING,
    justifyContent: 'center',
  },
  stickerActionsSheetRowPressed: {
    opacity: 0.82,
  },
  stickerActionsSheetRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  stickerActionsSheetIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerActionsSheetLabel: {
    ...Typography.body,
    flex: 1,
    fontWeight: '600',
  },
  stickerActionsSheetDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: SHEET_HORIZONTAL_PADDING + 54,
  },
  radiusSheetDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Sheet.android.horizontalPadding,
  },
});
