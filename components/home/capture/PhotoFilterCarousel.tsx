import { memo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { TFunction } from 'i18next';
import { PHOTO_FILTER_PRESETS, type PhotoFilterId } from '../../../services/photoFilters';
import type { ThemeColors } from '../../../hooks/useTheme';
import { CaptureAnimatedPressable } from './CaptureAnimatedPressable';
import { FilteredPhotoCanvas } from './FilteredPhotoCanvas';

const PHOTO_FILTER_BUTTON_SIZE = 38;
const PHOTO_FILTER_PREVIEW_SIZE = 34;

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
    maxWidth: '100%',
    paddingHorizontal: 5,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    overflow: 'hidden',
  },
  photoFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  photoFilterButton: {
    width: PHOTO_FILTER_BUTTON_SIZE,
    height: PHOTO_FILTER_BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: PHOTO_FILTER_BUTTON_SIZE / 2,
    borderWidth: 2,
    padding: 1,
  },
  photoFilterPreviewClip: {
    width: PHOTO_FILTER_PREVIEW_SIZE,
    height: PHOTO_FILTER_PREVIEW_SIZE,
    overflow: 'hidden',
    borderRadius: PHOTO_FILTER_PREVIEW_SIZE / 2,
  },
  photoFilterPreviewCanvas: {
    width: '100%',
    height: '100%',
  },
});
