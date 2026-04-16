import type { TFunction } from 'i18next';
import { ActivityIndicator, View } from 'react-native';
import type { PhotoFilterId } from '../../../services/photoFilters';
import type { CaptureCardColors } from './captureShared';
import { CaptureAnimatedPressable } from './CaptureAnimatedPressable';
import { CaptureControlRail } from './CaptureControlRail';
import { CaptureToggleIconButton } from './CaptureToggleIconButton';
import { PhotoFilterPicker } from './PhotoFilterPicker';
import { Ionicons } from '@expo/vector-icons';
import { getGlassSurfacePalette } from '../../ui/glassTokens';
import {
  DECORATE_OPTION_ACTIVE_SCALE,
  DECORATE_OPTION_CONTENT_SCALE,
  styles,
} from './captureCardStyles';

interface LiveCameraActionBarProps {
  colors: CaptureCardColors;
  filterModeEnabled: boolean;
  importingPhoto: boolean;
  libraryImportLocked: boolean;
  lockedPhotoFilterIds?: PhotoFilterId[];
  needsCameraPermission: boolean;
  onChangePhotoFilter: (filterId: PhotoFilterId) => void;
  onOpenPhotoLibrary: () => void;
  onPressLockedPhotoFilter?: (filterId: PhotoFilterId) => void;
  onToggleFilterMode: () => void;
  selectedPhotoFilterId: PhotoFilterId;
  t: TFunction;
}

export function LiveCameraActionBar({
  colors,
  filterModeEnabled,
  importingPhoto,
  libraryImportLocked,
  lockedPhotoFilterIds = [],
  needsCameraPermission,
  onChangePhotoFilter,
  onOpenPhotoLibrary,
  onPressLockedPhotoFilter,
  onToggleFilterMode,
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

  return (
    <View style={styles.captureActionBarWrap}>
      <CaptureControlRail borderColor={colors.captureCardBorder} colors={colors}>
        <View style={styles.liveCameraActionRow}>
          <CaptureToggleIconButton
            testID="capture-filter-toggle"
            accessibilityLabel={
              filterModeEnabled
                ? t('capture.doneFilters', 'Done')
                : t('capture.filters', 'Filters')
            }
            onPress={onToggleFilterMode}
            active={filterModeEnabled}
            activeIconName="options-outline"
            inactiveIconName="options-outline"
            renderActiveIcon={({ color, size }) => (
              <Ionicons name="color-filter-outline" size={size} color={color} />
            )}
            renderInactiveIcon={({ color, size }) => (
              <Ionicons name="color-filter-outline" size={size} color={color} />
            )}
            activeBackgroundColor={glassPalette.activeControlBackgroundColor}
            inactiveBackgroundColor="transparent"
            activeBorderColor={glassPalette.controlBorderColor}
            inactiveBorderColor="transparent"
            activeIconColor={colors.captureGlassText}
            inactiveIconColor={colors.captureGlassText}
            activeScale={DECORATE_OPTION_ACTIVE_SCALE}
            activeTranslateY={0}
            contentActiveScale={DECORATE_OPTION_CONTENT_SCALE}
            contentActiveTranslateY={0}
            style={styles.textBottomToolsButton}
          />
          {filterModeEnabled ? (
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
          ) : null}
          <View
            pointerEvents="none"
            style={[
              styles.liveCameraActionDivider,
              { backgroundColor: colors.captureGlassBorder },
            ]}
          />
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
            style={[
              styles.liveCameraImportButton,
              {
                backgroundColor: colors.captureGlassFill,
                borderColor: colors.captureGlassBorder,
              },
            ]}
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
