import { memo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { TFunction } from 'i18next';
import { PHOTO_FILTER_PRESETS, type PhotoFilterId } from '../../../services/photoFilters';
import type { ThemeColors } from '../../../hooks/useTheme';
import { CaptureAnimatedPressable } from './CaptureAnimatedPressable';
import { FilteredPhotoCanvas } from './FilteredPhotoCanvas';

export type PhotoFilterCarouselProps = {
  sourceUri: string;
  selectedFilterId: PhotoFilterId;
  onSelectFilter: (filterId: PhotoFilterId) => void;
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
      width={34}
      height={34}
      style={styles.photoFilterPreviewCanvas}
    />
  );
});

export const PhotoFilterCarousel = memo(function PhotoFilterCarousel({
  sourceUri,
  selectedFilterId,
  onSelectFilter,
  t,
  colors,
}: PhotoFilterCarouselProps) {
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.photoFilterRow}
      >
        {PHOTO_FILTER_PRESETS.map((preset) => {
          const isSelected = preset.id === selectedFilterId;

          return (
            <CaptureAnimatedPressable
              key={preset.id}
              testID={`capture-filter-${preset.id}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={t(preset.labelKey, preset.defaultLabel)}
              onPress={() => onSelectFilter(preset.id)}
              pressedScale={0.985}
              style={[
                styles.photoFilterButton,
                {
                  borderColor: isSelected ? colors.primary : colors.captureGlassBorder,
                  backgroundColor: colors.captureGlassFill,
                },
              ]}
            >
              <View style={styles.photoFilterPreviewClip}>
                <PhotoFilterSwatch sourceUri={sourceUri} filterId={preset.id} />
              </View>
            </CaptureAnimatedPressable>
          );
        })}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  photoFilterTray: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    overflow: 'hidden',
  },
  photoFilterRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  photoFilterButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 3,
  },
  photoFilterPreviewClip: {
    overflow: 'hidden',
    borderRadius: 12,
  },
  photoFilterPreviewCanvas: {
    borderRadius: 12,
  },
});
