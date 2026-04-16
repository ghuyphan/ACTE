import type { TFunction } from 'i18next';
import { ActivityIndicator, Text, View } from 'react-native';
import type { PhotoFilterId } from '../../../services/photoFilters';
import type { CaptureCardColors } from './captureShared';
import { CaptureAnimatedPressable } from './CaptureAnimatedPressable';
import { CaptureControlRail } from './CaptureControlRail';
import { PhotoFilterPicker } from './PhotoFilterPicker';
import { styles } from './captureCardStyles';
import LivePhotoIcon from '../../ui/LivePhotoIcon';
import { Ionicons } from '@expo/vector-icons';

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
          <CaptureAnimatedPressable
            testID="capture-library-button"
            accessibilityLabel={
              libraryImportLocked
                ? t('capture.plusLibraryLocked', 'Plus')
                : t('capture.importPhoto', 'Photos')
            }
            onPress={onOpenPhotoLibrary}
            disabled={importingPhoto}
            disabledOpacity={0.55}
            pressedScale={0.96}
            style={styles.actionStripIconButton}
          >
            {importingPhoto ? (
              <ActivityIndicator size="small" color={colors.captureGlassText} />
            ) : (
              <Ionicons name="images-outline" size={19} color={colors.captureGlassText} />
            )}
          </CaptureAnimatedPressable>
        </View>
      </CaptureControlRail>
    </View>
  );
}
