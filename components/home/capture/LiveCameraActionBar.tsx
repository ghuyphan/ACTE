import type { TFunction } from 'i18next';
import { Text, View } from 'react-native';
import type { PhotoFilterId } from '../../../services/photoFilters';
import type { CaptureCardColors } from './captureShared';
import { CaptureGlassActionButton } from './CaptureGlassActionButton';
import { CaptureControlRail } from './CaptureControlRail';
import { PhotoFilterPicker } from './PhotoFilterPicker';
import { styles } from './captureCardStyles';
import { getGlassSurfacePalette } from '../../ui/glassTokens';
import LivePhotoIcon from '../../ui/LivePhotoIcon';

interface LiveCameraActionBarProps {
  cameraInstructionText?: string | null;
  colors: CaptureCardColors;
  importingPhoto: boolean;
  libraryImportLocked: boolean;
  lockedPhotoFilterIds?: PhotoFilterId[];
  needsCameraPermission: boolean;
  onChangePhotoFilter: (filterId: PhotoFilterId) => void;
  onOpenPhotoLibrary: () => void;
  onPressLockedPhotoFilter?: (filterId: PhotoFilterId) => void;
  selectedPhotoFilterId: PhotoFilterId;
  t: TFunction;
}

export function LiveCameraActionBar({
  cameraInstructionText = null,
  colors,
  importingPhoto,
  libraryImportLocked,
  lockedPhotoFilterIds = [],
  needsCameraPermission,
  onChangePhotoFilter,
  onOpenPhotoLibrary,
  onPressLockedPhotoFilter,
  selectedPhotoFilterId,
  t,
}: LiveCameraActionBarProps) {
  if (needsCameraPermission) {
    return null;
  }

  const glassPalette = getGlassSurfacePalette({
    isDark: colors.captureGlassColorScheme === 'dark',
    borderColor: colors.captureCardBorder,
  });
  const showLivePhotoGuide = Boolean(cameraInstructionText);

  return (
    <View style={styles.captureActionBarWrap}>
      {showLivePhotoGuide ? (
        <View style={styles.cameraActionHintWrap}>
          <LivePhotoIcon size={15} color={colors.captureGlassText} />
          <Text style={[styles.cameraActionHintText, { color: colors.captureGlassText }]}>
            {t('capture.livePhotoCoachLiveHint', 'Hold for live photo')}
          </Text>
        </View>
      ) : null}
      <CaptureControlRail borderColor={colors.captureCardBorder} colors={colors}>
        <View style={styles.liveCameraActionRow}>
          <View style={styles.liveCameraFilterRail}>
            <PhotoFilterPicker
              colors={colors}
              lockedFilterIds={lockedPhotoFilterIds}
              onSelectFilter={onChangePhotoFilter}
              onPressLockedFilter={onPressLockedPhotoFilter}
              selectedFilterId={selectedPhotoFilterId}
              t={t}
            />
          </View>
          <CaptureGlassActionButton
            testID="capture-library-button"
            accessibilityLabel={
              libraryImportLocked
                ? t('capture.plusLibraryLocked', 'Plus')
                : t('capture.importPhoto', 'Photos')
            }
            onPress={onOpenPhotoLibrary}
            disabled={importingPhoto}
            iconName="images-outline"
            iconColor={colors.captureGlassText}
            glassColorScheme={colors.captureGlassColorScheme}
            fallbackColor={glassPalette.controlBackgroundColor}
            borderColor={glassPalette.controlBorderColor}
            style={styles.liveCameraLibraryButton}
          />
        </View>
      </CaptureControlRail>
    </View>
  );
}
