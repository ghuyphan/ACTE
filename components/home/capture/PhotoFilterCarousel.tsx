import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { ScrollView, View } from 'react-native';
import type { TFunction } from 'i18next';
import { PHOTO_FILTER_PRESETS, type PhotoFilterId } from '../../../services/photoFilters';
import type { ThemeColors } from '../../../hooks/useTheme';
import { CaptureAnimatedPressable } from './CaptureAnimatedPressable';
import { FilteredPhotoCanvas } from './FilteredPhotoCanvas';
import {
  PHOTO_FILTER_PREVIEW_SIZE,
  styles,
} from './captureCardStyles';

export type PhotoFilterCarouselProps = {
  embedded?: boolean;
  sourceUri: string;
  selectedFilterId: PhotoFilterId;
  lockedFilterIds?: PhotoFilterId[];
  onSelectFilter: (filterId: PhotoFilterId) => void;
  onPressLockedFilter?: (filterId: PhotoFilterId) => void;
  t: TFunction;
  colors: Pick<ThemeColors, 'captureGlassFill' | 'captureGlassBorder' | 'captureGlassText' | 'primary'>;
};

const PhotoFilterSwatch = memo(function PhotoFilterSwatch({
  sourceUri,
  filterId,
}: {
  sourceUri: string;
  filterId: PhotoFilterId;
}) {
  return (
    <FilteredPhotoCanvas
      sourceUri={sourceUri}
      filterId={filterId}
      width={PHOTO_FILTER_PREVIEW_SIZE}
      height={PHOTO_FILTER_PREVIEW_SIZE}
      style={styles.photoFilterPreviewCanvas}
    />
  );
});

export const PhotoFilterCarousel = memo(function PhotoFilterCarousel({
  embedded = false,
  sourceUri,
  selectedFilterId,
  lockedFilterIds = [],
  onSelectFilter,
  onPressLockedFilter,
  t,
  colors,
}: PhotoFilterCarouselProps) {
  const content = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.photoFilterRow}
      style={[styles.photoFilterScroll, embedded ? styles.photoFilterEmbeddedScroll : undefined]}
    >
      {PHOTO_FILTER_PRESETS.map((preset) => {
        const isSelected = preset.id === selectedFilterId;
        const isLocked = lockedFilterIds.includes(preset.id);
        const filterLabel = t(preset.labelKey, preset.defaultLabel);

        return (
          <CaptureAnimatedPressable
            key={preset.id}
            testID={`capture-filter-${preset.id}`}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={
              isLocked ? `${filterLabel}, ${t('plus.badge', 'Plus')}` : filterLabel
            }
            onPress={() => {
              if (isLocked) {
                onPressLockedFilter?.(preset.id);
                return;
              }

              onSelectFilter(preset.id);
            }}
            pressedScale={0.985}
            style={[
              styles.photoFilterButton,
              isLocked ? styles.photoFilterButtonLocked : null,
              {
                borderColor: isSelected ? colors.primary : colors.captureGlassBorder,
                backgroundColor: colors.captureGlassFill,
              },
            ]}
          >
            <View style={styles.photoFilterPreviewClip}>
              <PhotoFilterSwatch sourceUri={sourceUri} filterId={preset.id} />
            </View>
            {isLocked ? (
              <View style={styles.photoFilterLockBadge}>
                <Ionicons name="lock-closed" size={10} color="#FFFDFC" />
              </View>
            ) : null}
          </CaptureAnimatedPressable>
        );
      })}
    </ScrollView>
  );

  if (embedded) {
    return content;
  }

  return (
    <View
      style={[
        styles.photoFilterTray,
        {
          borderColor: colors.captureGlassBorder,
          backgroundColor: colors.captureGlassFill,
        },
      ]}
    >
      {content}
    </View>
  );
});
