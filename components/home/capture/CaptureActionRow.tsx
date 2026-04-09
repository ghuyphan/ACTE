import type { TFunction } from 'i18next';
import { Text, View } from 'react-native';
import Reanimated from 'react-native-reanimated';
import type { CaptureCardAnimatedStyle, CaptureCardColors, CameraUiStage } from './captureShared';
import { CaptureAnimatedPressable, CaptureGlassActionButton } from './CaptureControls';
import { styles } from './captureCardStyles';
import { CaptureSaveButton } from './CaptureSaveButton';

interface CaptureShareTargetButtonProps {
  colors: CaptureCardColors;
  isSharedTarget: boolean;
  shareTarget: 'private' | 'shared';
  t: TFunction;
  onChangeShareTarget: (nextTarget: 'private' | 'shared') => void;
  style?: object;
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
      onPress={() => onChangeShareTarget(shareTarget === 'private' ? 'shared' : 'private')}
      iconName={isSharedTarget ? 'people' : 'lock-closed'}
      iconColor={colors.captureGlassText}
      glassColorScheme={colors.captureGlassColorScheme}
      fallbackColor={colors.card}
      borderColor={colors.captureCardBorder}
      style={style}
    />
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
