import { Ionicons } from '@expo/vector-icons';
import type { TFunction } from 'i18next';
import { ActivityIndicator, Text, View } from 'react-native';
import type { CaptureCardColors } from './captureShared';
import { CaptureAnimatedPressable } from './CaptureAnimatedPressable';
import { CaptureControlRail } from './CaptureControlRail';
import { styles } from './captureCardStyles';
import LivePhotoIcon from '../../ui/LivePhotoIcon';

interface LiveCameraActionBarProps {
  cameraInstructionText?: string | null;
  colors: CaptureCardColors;
  importingPhoto: boolean;
  libraryImportLocked: boolean;
  needsCameraPermission: boolean;
  onOpenPhotoLibrary: () => void;
  remainingPhotoSlots?: number | null;
  t: TFunction;
}

export function LiveCameraActionBar({
  cameraInstructionText = null,
  colors,
  importingPhoto,
  libraryImportLocked,
  needsCameraPermission,
  onOpenPhotoLibrary,
  remainingPhotoSlots = null,
  t,
}: LiveCameraActionBarProps) {
  if (needsCameraPermission) {
    return null;
  }

  const showLivePhotoGuide = Boolean(cameraInstructionText);
  const photoQuotaHint =
    typeof remainingPhotoSlots === 'number'
      ? remainingPhotoSlots > 0
        ? t(
            'capture.photoSlotsRemainingIncludingImports',
            '{{count}} free photo notes left. Imports count when saved.',
            { count: remainingPhotoSlots }
          )
        : t('capture.photoLimitReachedHint', 'Free photo limit reached')
      : null;

  return (
    <View style={styles.captureActionBarWrap}>
      <CaptureControlRail borderColor={colors.captureCardBorder} colors={colors}>
        {showLivePhotoGuide ? (
          <View style={styles.cameraActionHintWrap}>
            <LivePhotoIcon size={15} color={colors.captureGlassText} />
            <Text style={[styles.cameraActionHintText, { color: colors.captureGlassText }]}>
              {t('capture.livePhotoCoachLiveHint', 'Hold for live photo')}
            </Text>
          </View>
        ) : null}
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
      </CaptureControlRail>
      {photoQuotaHint ? (
        <Text style={[styles.cameraInstructionText, styles.captureQuotaHintText, { color: colors.captureGlassText }]}>
          {photoQuotaHint}
        </Text>
      ) : null}
    </View>
  );
}
