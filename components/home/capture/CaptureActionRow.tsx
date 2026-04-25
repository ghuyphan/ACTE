import type { TFunction } from 'i18next';
import { Text, View } from 'react-native';
import Reanimated from 'react-native-reanimated';
import type { CaptureCardAnimatedStyle, CaptureCardColors, CameraUiStage } from './captureShared';
import {
  getCaptureControlVisualState,
  getCaptureGlassActionVisuals,
  getCaptureShutterVisuals,
} from './captureControlVisuals';
import { CaptureAnimatedPressable, CaptureGlassActionButton } from './CaptureControls';
import { styles } from './captureCardStyles';
import { CaptureSaveButton } from './CaptureSaveButton';

interface CaptureShareTargetButtonProps {
  colors: CaptureCardColors;
  disabled?: boolean;
  isSharedTarget: boolean;
  shareTarget: 'private' | 'shared';
  t: TFunction;
  onChangeShareTarget: (nextTarget: 'private' | 'shared') => void;
  style?: object;
}

function CaptureShareTargetButton({
  colors,
  disabled = false,
  isSharedTarget,
  shareTarget,
  t,
  onChangeShareTarget,
  style,
}: CaptureShareTargetButtonProps) {
  const visualState = getCaptureControlVisualState({
    active: isSharedTarget,
    disabled,
  });
  const actionVisuals = getCaptureGlassActionVisuals(colors, visualState);

  return (
    <CaptureGlassActionButton
      testID="capture-share-target-toggle"
      accessibilityRole="button"
      accessibilityState={{ selected: isSharedTarget, disabled }}
      accessibilityLabel={
        isSharedTarget
          ? t('shared.captureShared', 'Friends')
          : t('shared.capturePrivate', 'Just me')
      }
      onPress={() => onChangeShareTarget(shareTarget === 'private' ? 'shared' : 'private')}
      disabled={disabled}
      disabledOpacity={actionVisuals.disabledOpacity}
      iconName={isSharedTarget ? 'people' : 'lock-closed'}
      iconColor={actionVisuals.iconColor}
      active={actionVisuals.active}
      glassColorScheme={actionVisuals.glassColorScheme}
      fallbackColor={actionVisuals.fallbackColor}
      borderColor={actionVisuals.borderColor}
      style={style}
    />
  );
}

interface CaptureActionRowProps {
  animatedSaveHaloStyle: CaptureCardAnimatedStyle;
  animatedSaveIconStyle: CaptureCardAnimatedStyle;
  animatedSaveInnerStyle: CaptureCardAnimatedStyle;
  animatedSaveSpinnerStyle: CaptureCardAnimatedStyle;
  animatedSaveSuccessStyle: CaptureCardAnimatedStyle;
  colors: CaptureCardColors;
  cameraUiStage: CameraUiStage;
  controlsDisabled?: boolean;
  handleSavePressIn: () => void;
  handleSavePressOut: () => void;
  handleShutterLongPress: () => void;
  handleShutterPress: () => void;
  handleShutterRelease: () => void;
  handleSwitchCameraPress: () => void;
  dualCaptureAwaitingSecondShot?: boolean;
  isLivePhotoCaptureInProgress: boolean;
  isSaveBusy: boolean;
  isSaveDisabled: boolean;
  isSaveSuccessful: boolean;
  isSharedTarget: boolean;
  livePhotoCountdownSeconds: number;
  onChangeShareTarget: (nextTarget: 'private' | 'shared') => void;
  onResetDualCaptureSequence?: () => void;
  onRetakePhoto: () => void;
  onSaveNote: () => void;
  onShutterPressIn: () => void;
  permissionGranted: boolean;
  remainingPhotoSlots?: number | null;
  savePressAnimatedStyle: CaptureCardAnimatedStyle;
  shareTarget: 'private' | 'shared';
  showCameraUnavailableState: boolean;
  shutterInnerAnimatedStyle: CaptureCardAnimatedStyle;
  shutterOuterAnimatedStyle: CaptureCardAnimatedStyle;
  t: TFunction;
}

export function CaptureActionRow({
  animatedSaveHaloStyle,
  animatedSaveIconStyle,
  animatedSaveInnerStyle,
  animatedSaveSpinnerStyle,
  animatedSaveSuccessStyle,
  colors,
  cameraUiStage,
  controlsDisabled = false,
  handleSavePressIn,
  handleSavePressOut,
  handleShutterLongPress,
  handleShutterPress,
  handleShutterRelease,
  handleSwitchCameraPress,
  dualCaptureAwaitingSecondShot = false,
  isLivePhotoCaptureInProgress,
  isSaveBusy,
  isSaveDisabled,
  isSaveSuccessful,
  isSharedTarget,
  livePhotoCountdownSeconds,
  onChangeShareTarget,
  onResetDualCaptureSequence = () => undefined,
  onRetakePhoto,
  onSaveNote,
  onShutterPressIn,
  permissionGranted,
  remainingPhotoSlots,
  savePressAnimatedStyle,
  shareTarget,
  showCameraUnavailableState,
  shutterInnerAnimatedStyle,
  shutterOuterAnimatedStyle,
  t,
}: CaptureActionRowProps) {
  const remainingPhotoSlotsLabel =
    typeof remainingPhotoSlots === 'number' && remainingPhotoSlots > 0
      ? t('capture.photoSlotsRemainingCompact', '{{count}} left', { count: remainingPhotoSlots })
      : null;
  const remainingPhotoSlotsCaption =
    typeof remainingPhotoSlots === 'number' && remainingPhotoSlots > 0
      ? t('capture.photoSlotsRemainingCompactSuffix', 'left today')
      : null;
  const liveCameraControlsDisabled =
    controlsDisabled || !permissionGranted || showCameraUnavailableState;
  const saveControlsDisabled = controlsDisabled || isSaveDisabled;
  const retakeControlsDisabled = controlsDisabled || isSaveBusy || isSaveSuccessful;
  const shutterVisuals = getCaptureShutterVisuals(colors);
  const trailingActionVisuals = getCaptureGlassActionVisuals(
    colors,
    getCaptureControlVisualState({ disabled: liveCameraControlsDisabled })
  );
  const retakeVisuals = getCaptureGlassActionVisuals(
    colors,
    getCaptureControlVisualState({
      disabled: retakeControlsDisabled,
    })
  );

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
              disabled={controlsDisabled}
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
              disabled={liveCameraControlsDisabled}
              accessibilityState={{ disabled: liveCameraControlsDisabled }}
              delayLongPress={380}
              hitSlop={12}
              pressRetentionOffset={{ top: 40, right: 40, bottom: 40, left: 40 }}
              hapticStyle={null}
              pressedScale={1}
              style={[styles.shutterOuter, shutterOuterAnimatedStyle as never]}
            >
              <Reanimated.View
                testID="capture-shutter-inner"
                style={[
                  styles.shutterInner,
                  {
                    backgroundColor: shutterVisuals.fillColor,
                  },
                  shutterInnerAnimatedStyle,
                ]}
              >
                {isLivePhotoCaptureInProgress ? (
                  <Text
                    style={[
                      styles.shutterInnerCountText,
                      { color: shutterVisuals.contentColor },
                    ]}
                  >
                    {livePhotoCountdownSeconds}s
                  </Text>
                ) : remainingPhotoSlotsLabel ? (
                  <View style={styles.shutterInnerQuotaWrap}>
                    <Text
                      style={[
                        styles.shutterInnerQuotaCountText,
                        { color: shutterVisuals.contentColor },
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                    >
                      {remainingPhotoSlots}
                    </Text>
                    {remainingPhotoSlotsCaption ? (
                      <Text
                        style={[
                          styles.shutterInnerQuotaCaptionText,
                          { color: shutterVisuals.contentColor },
                        ]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.75}
                      >
                        {remainingPhotoSlotsCaption}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </Reanimated.View>
            </CaptureAnimatedPressable>
          ) : null}
          {!showCameraUnavailableState && permissionGranted ? (
            <CaptureGlassActionButton
              testID={
                dualCaptureAwaitingSecondShot
                  ? 'capture-dual-reset-button'
                  : 'capture-camera-switch-button'
              }
              accessibilityLabel={
                dualCaptureAwaitingSecondShot
                  ? t('capture.dualReset', 'Start over')
                  : t('capture.switchCamera', 'Switch camera')
              }
              onPress={
                dualCaptureAwaitingSecondShot
                  ? onResetDualCaptureSequence
                  : handleSwitchCameraPress
              }
              disabled={liveCameraControlsDisabled}
              disabledOpacity={trailingActionVisuals.disabledOpacity}
              accessibilityState={{ disabled: liveCameraControlsDisabled }}
              iconName={dualCaptureAwaitingSecondShot ? 'refresh' : 'camera-reverse'}
              iconColor={trailingActionVisuals.iconColor}
              glassColorScheme={trailingActionVisuals.glassColorScheme}
              fallbackColor={trailingActionVisuals.fallbackColor}
              borderColor={trailingActionVisuals.borderColor}
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
        disabled={controlsDisabled}
        onChangeShareTarget={onChangeShareTarget}
        style={styles.belowCardLeadingAction}
      />
      <CaptureSaveButton
        accessibilityHint={t('capture.saveHint', 'Save this memory to your journal')}
        accessibilityLabel={
          isSaveBusy
            ? t('common.loading', 'Loading')
            : isSaveSuccessful
              ? t('capture.savedQuick', 'Saved to your journal')
              : t('capture.save', 'Save Memory 💛')
        }
        animatedSaveHaloStyle={animatedSaveHaloStyle}
        animatedSaveIconStyle={animatedSaveIconStyle}
        animatedSaveInnerStyle={animatedSaveInnerStyle}
        animatedSaveSpinnerStyle={animatedSaveSpinnerStyle}
        animatedSaveSuccessStyle={animatedSaveSuccessStyle}
        colors={colors}
        isSaveBusy={isSaveBusy}
        isSaveDisabled={saveControlsDisabled}
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
          disabled={retakeControlsDisabled}
          disabledOpacity={retakeVisuals.disabledOpacity}
          iconName="refresh"
          iconColor={retakeVisuals.iconColor}
          glassColorScheme={retakeVisuals.glassColorScheme}
          fallbackColor={retakeVisuals.fallbackColor}
          borderColor={retakeVisuals.borderColor}
          style={styles.belowCardTrailingAction}
        />
      ) : (
        <View style={[styles.belowCardSideActionSpacer, styles.belowCardTrailingAction]} />
      )}
    </View>
  );
}
