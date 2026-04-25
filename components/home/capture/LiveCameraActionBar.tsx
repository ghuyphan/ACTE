import type { TFunction } from 'i18next';
import { ActivityIndicator, View } from 'react-native';
import type { PhotoFilterId } from '../../../services/photoFilters';
import type { CaptureCardColors } from './captureShared';
import { CaptureAnimatedPressable } from './CaptureAnimatedPressable';
import { CaptureControlRail } from './CaptureControlRail';
import { CaptureToggleIconButton } from './CaptureToggleIconButton';
import { PhotoFilterPicker } from './PhotoFilterPicker';
import { Ionicons } from '@expo/vector-icons';
import {
  DECORATE_OPTION_ACTIVE_SCALE,
  DECORATE_OPTION_CONTENT_SCALE,
  styles,
} from './captureCardStyles';
import {
  getCaptureChromePalette,
  getCaptureControlVisualState,
  getCaptureGlassActionVisuals,
} from './captureControlVisuals';

interface LiveCameraActionBarProps {
  cameraSubmode: 'single' | 'dual';
  colors: CaptureCardColors;
  dualCaptureSupported: boolean;
  filterModeEnabled: boolean;
  importingPhoto: boolean;
  libraryImportLocked: boolean;
  lockedPhotoFilterIds?: PhotoFilterId[];
  needsCameraPermission: boolean;
  onChangeCameraSubmode: (nextSubmode: 'single' | 'dual') => void;
  onChangePhotoFilter: (filterId: PhotoFilterId) => void;
  onOpenPhotoLibrary: () => void;
  onPressLockedPhotoFilter?: (filterId: PhotoFilterId) => void;
  onToggleFilterMode: () => void;
  selectedPhotoFilterId: PhotoFilterId;
  t: TFunction;
}

export function LiveCameraActionBar({
  cameraSubmode,
  colors,
  dualCaptureSupported,
  filterModeEnabled,
  importingPhoto,
  libraryImportLocked,
  lockedPhotoFilterIds = [],
  needsCameraPermission,
  onChangeCameraSubmode,
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

  const dualModeEnabled = cameraSubmode === 'dual';
  const importDisabled = importingPhoto || dualModeEnabled;
  const glassPalette = getCaptureChromePalette(colors);
  const importVisuals = getCaptureGlassActionVisuals(
    colors,
    getCaptureControlVisualState({
      busy: importingPhoto,
      disabled: importDisabled && !importingPhoto,
    })
  );

  return (
    <View style={styles.captureActionBarWrap}>
      <CaptureControlRail borderColor={colors.captureCardBorder} colors={colors}>
        <View style={styles.liveCameraActionRow}>
          {dualCaptureSupported ? (
            <CaptureToggleIconButton
              testID="capture-dual-toggle"
              accessibilityLabel={
                dualModeEnabled
                  ? t('capture.dualModeOn', 'Dual on')
                  : t('capture.dualMode', 'Dual')
              }
              onPress={() => onChangeCameraSubmode(dualModeEnabled ? 'single' : 'dual')}
              active={dualModeEnabled}
              activeIconName="camera-outline"
              inactiveIconName="camera-outline"
              renderActiveIcon={({ color, size }) => (
                <Ionicons name="copy-outline" size={size} color={color} />
              )}
              renderInactiveIcon={({ color, size }) => (
                <Ionicons name="copy-outline" size={size} color={color} />
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
          ) : null}
          <CaptureToggleIconButton
            testID="capture-filter-toggle"
            accessibilityLabel={
              filterModeEnabled
                ? t('capture.doneFilters', 'Done')
                : t('capture.filters', 'Filters')
            }
            onPress={onToggleFilterMode}
            active={filterModeEnabled && !dualModeEnabled}
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
            disabled={dualModeEnabled}
          />
          {filterModeEnabled && !dualModeEnabled ? (
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
          <CaptureAnimatedPressable
            testID="capture-library-button"
            accessibilityLabel={
              libraryImportLocked
                ? t('capture.plusLibraryLocked', 'Plus')
                : t('capture.importPhoto', 'Photos')
            }
            accessibilityRole="button"
            onPress={onOpenPhotoLibrary}
            accessibilityState={{
              busy: importingPhoto,
              disabled: importDisabled,
            }}
            active={importingPhoto}
            disabled={importDisabled}
            disabledOpacity={importVisuals.disabledOpacity}
            pressedScale={0.96}
            style={[
              styles.liveCameraImportButton,
              {
                backgroundColor: importingPhoto
                  ? importVisuals.fallbackColor
                  : colors.captureGlassFill,
                borderColor: importingPhoto
                  ? importVisuals.borderColor
                  : colors.captureGlassBorder,
              },
            ]}
          >
            {importingPhoto ? (
              <ActivityIndicator size="small" color={colors.captureGlassText} animating />
            ) : libraryImportLocked ? (
              <Ionicons name="lock-closed-outline" size={17} color={colors.captureGlassText} />
            ) : (
              <Ionicons name="images-outline" size={19} color={colors.captureGlassText} />
            )}
          </CaptureAnimatedPressable>
        </View>
      </CaptureControlRail>
    </View>
  );
}
