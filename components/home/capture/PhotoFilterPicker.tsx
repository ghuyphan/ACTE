import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { ScrollView, View } from 'react-native';
import type { TFunction } from 'i18next';
import { PHOTO_FILTER_PRESETS, type PhotoFilterId } from '../../../services/photoFilters';
import type { ThemeColors } from '../../../hooks/useTheme';
import { CaptureAnimatedPressable } from './CaptureAnimatedPressable';
import { styles } from './captureCardStyles';

interface PhotoFilterPickerProps {
  colors: Pick<
    ThemeColors,
    'captureGlassBorder' | 'captureGlassText' | 'primary' | 'primarySoft'
  >;
  lockedFilterIds?: PhotoFilterId[];
  onPressLockedFilter?: (filterId: PhotoFilterId) => void;
  onSelectFilter: (filterId: PhotoFilterId) => void;
  selectedFilterId: PhotoFilterId;
  t: TFunction;
}

const FILTER_SWATCHES: Record<
  PhotoFilterId,
  {
    backgroundColor: string;
    accentColor: string;
    borderColor: string;
  }
> = {
  original: {
    backgroundColor: '#F8F4EE',
    accentColor: '#D4C6B2',
    borderColor: 'rgba(126, 106, 82, 0.2)',
  },
  soft: {
    backgroundColor: '#E9DCCF',
    accentColor: '#C6A98B',
    borderColor: 'rgba(130, 99, 72, 0.16)',
  },
  warm: {
    backgroundColor: '#EAC796',
    accentColor: '#B87843',
    borderColor: 'rgba(144, 90, 42, 0.12)',
  },
  cool: {
    backgroundColor: '#D8E5F2',
    accentColor: '#6F8DAE',
    borderColor: 'rgba(71, 96, 126, 0.12)',
  },
  mono: {
    backgroundColor: '#DBD6CF',
    accentColor: '#57524C',
    borderColor: 'rgba(68, 62, 56, 0.12)',
  },
  vivid: {
    backgroundColor: '#F4C59A',
    accentColor: '#2F93A4',
    borderColor: 'rgba(112, 91, 56, 0.12)',
  },
  vintage: {
    backgroundColor: '#D7C5AB',
    accentColor: '#71715B',
    borderColor: 'rgba(98, 86, 66, 0.12)',
  },
};

export const PhotoFilterPicker = memo(function PhotoFilterPicker({
  colors,
  lockedFilterIds = [],
  onPressLockedFilter,
  onSelectFilter,
  selectedFilterId,
  t,
}: PhotoFilterPickerProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.liveFilterRow}
      style={styles.liveFilterScroll}
    >
      {PHOTO_FILTER_PRESETS.map((preset) => {
        const isSelected = preset.id === selectedFilterId;
        const isLocked = lockedFilterIds.includes(preset.id);
        const label = t(preset.labelKey, preset.defaultLabel);
        const swatch = FILTER_SWATCHES[preset.id];

        return (
          <CaptureAnimatedPressable
            key={preset.id}
            testID={`capture-filter-${preset.id}`}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={isLocked ? `${label}, ${t('plus.badge', 'Plus')}` : label}
            onPress={() => {
              if (isLocked) {
                onPressLockedFilter?.(preset.id);
                return;
              }

              onSelectFilter(preset.id);
            }}
            pressedScale={0.985}
            style={[
              styles.liveFilterOption,
              {
                backgroundColor: isSelected ? colors.primarySoft : 'transparent',
                borderColor: isSelected ? colors.captureGlassBorder : 'transparent',
              },
            ]}
          >
            <View
              style={[
                styles.liveFilterSwatch,
                {
                  backgroundColor: swatch.backgroundColor,
                  borderColor: isSelected ? colors.primary : swatch.borderColor,
                  opacity: isLocked ? 0.72 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.liveFilterSwatchAccent,
                  {
                    backgroundColor: swatch.accentColor,
                  },
                ]}
              />
              {isLocked ? (
                <View
                  style={[
                    styles.liveFilterLockBadge,
                    {
                      backgroundColor: colors.captureGlassText,
                    },
                  ]}
                >
                  <Ionicons name="lock-closed" size={8} color="#FFFDFC" />
                </View>
              ) : null}
            </View>
          </CaptureAnimatedPressable>
        );
      })}
    </ScrollView>
  );
});
