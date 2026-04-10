import { Ionicons } from '@expo/vector-icons';
import { ClipboardPasteButton } from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import type { TFunction } from 'i18next';
import { type ComponentProps, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View, type ViewStyle } from 'react-native';
import { ENABLE_PHOTO_STICKERS } from '../../../constants/experiments';
import { DEFAULT_NOTE_COLOR_ID, getCaptureNoteGradient } from '../../../services/noteAppearance';
import DoodleIcon from '../../ui/DoodleIcon';
import LivePhotoIcon from '../../ui/LivePhotoIcon';
import StickerIcon from '../../ui/StickerIcon';
import {
  CaptureAnimatedPressable,
  CaptureToggleIconButton,
  DoodleColorPalette,
} from './CaptureControls';
import { CaptureControlRail } from './CaptureControlRail';
import {
  DECORATE_OPTION_ACTIVE_SCALE,
  DECORATE_OPTION_CONTENT_SCALE,
  styles,
} from './captureCardStyles';
import type { CaptureCardColors, StickerAction } from './captureShared';
import type { DoodleStroke } from '../../notes/NoteDoodleCanvas';

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

interface CaptureTextColorButtonProps {
  colors: CaptureCardColors;
  noteColor?: string | null;
  onPress: () => void;
  t: TFunction;
}

function CaptureTextColorButton({
  colors,
  noteColor = DEFAULT_NOTE_COLOR_ID,
  onPress,
  t,
}: CaptureTextColorButtonProps) {
  return (
    <CaptureAnimatedPressable
      testID="capture-note-color-trigger"
      accessibilityLabel={t('capture.noteColor', 'Card color')}
      onPress={onPress}
      style={[
        styles.textBottomToolsButton,
        {
          backgroundColor: 'transparent',
        },
      ]}
    >
      <View
        style={[
          styles.textBottomToolsAction,
          {
            width: 30,
            height: 30,
            borderRadius: 15,
            overflow: 'hidden',
          },
        ]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={getCaptureNoteGradient({ noteColor })}
          start={{ x: 0.08, y: 0.06 }}
          end={{ x: 0.94, y: 0.94 }}
          style={StyleSheet.absoluteFillObject}
        />
      </View>
    </CaptureAnimatedPressable>
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
  handleShowStickerSourceOptions: ComponentProps<typeof CaptureAnimatedPressable>['onPress'];
  handleToggleDoodleMode: () => void;
  handleToggleStickerMode: () => void;
  handleUndoDoodle: () => void;
  importingSticker: boolean;
  railStyle?: ViewStyle;
  rowStyle?: ViewStyle;
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
      {!isShowingDoodleControls && !isShowingStickerControls ? afterToggles : null}
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
  handleNativeInlinePasteStickerPress: ComponentProps<typeof ClipboardPasteButton>['onPress'];
  handleOpenNoteColorSheet: () => void;
  handleSelectDoodleColor: (nextColor: string) => void;
  handleSelectedStickerAction: (action: StickerAction) => void;
  handleShowStickerSourceOptions: ComponentProps<typeof CaptureAnimatedPressable>['onPress'];
  handleToggleDoodleMode: () => void;
  handleToggleStickerMode: () => void;
  handleUndoDoodle: () => void;
  importingSticker: boolean;
  inlinePasteLoading: boolean;
  noteColor?: string | null;
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
  handleOpenNoteColorSheet,
  handleSelectDoodleColor,
  handleSelectedStickerAction,
  handleShowStickerSourceOptions,
  handleToggleDoodleMode,
  handleToggleStickerMode,
  handleUndoDoodle,
  importingSticker,
  inlinePasteLoading,
  noteColor,
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
          <>
            <CaptureTextColorButton
              colors={colors}
              noteColor={noteColor}
              onPress={handleOpenNoteColorSheet}
              t={t}
            />
            {showInlinePasteButton ? (
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
            ) : null}
          </>
        }
      />
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
  handleShowStickerSourceOptions: ComponentProps<typeof CaptureAnimatedPressable>['onPress'];
  handleToggleDoodleMode: () => void;
  handleToggleStickerMode: () => void;
  handleUndoDoodle: () => void;
  hasLivePhotoMotion: boolean;
  importingSticker: boolean;
  onImportMotionClip: () => void;
  onRemoveMotionClip: () => void;
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
