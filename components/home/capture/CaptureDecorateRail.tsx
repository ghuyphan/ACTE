import { Ionicons } from '@expo/vector-icons';
import { ClipboardPasteButton } from 'expo-clipboard';
import type { TFunction } from 'i18next';
import { type ComponentProps, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { ENABLE_PHOTO_STICKERS } from '../../../constants/experiments';
import type { NoteStickerPlacement } from '../../../services/noteStickers';
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
  handleNativeInlinePasteStickerPress: ComponentProps<typeof ClipboardPasteButton>['onPress'];
  handleSelectDoodleColor: (nextColor: string) => void;
  handleSelectedStickerAction: (action: StickerAction) => void;
  handleShowStickerSourceOptions: ComponentProps<typeof CaptureAnimatedPressable>['onPress'];
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
