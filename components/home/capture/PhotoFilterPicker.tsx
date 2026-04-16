import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { TFunction } from 'i18next';
import { PHOTO_FILTER_PRESETS, type PhotoFilterId } from '../../../services/photoFilters';
import type { ThemeColors } from '../../../hooks/useTheme';
import { CaptureAnimatedPressable } from './CaptureAnimatedPressable';
import { styles } from './captureCardStyles';

interface PhotoFilterPickerProps {
  colors: Pick<ThemeColors, 'captureGlassFill' | 'captureGlassBorder' | 'captureGlassText' | 'primary'>;
  lockedFilterIds?: PhotoFilterId[];
  onPressLockedFilter?: (filterId: PhotoFilterId) => void;
  onSelectFilter: (filterId: PhotoFilterId) => void;
  selectedFilterId: PhotoFilterId;
  t: TFunction;
}

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
              styles.liveFilterPill,
              {
                borderColor: isSelected ? colors.primary : colors.captureGlassBorder,
                backgroundColor: isSelected ? colors.primary : colors.captureGlassFill,
                opacity: isLocked ? 0.78 : 1,
              },
            ]}
          >
            <View style={styles.liveFilterPillContent}>
              <Text
                style={[
                  styles.liveFilterPillLabel,
                  { color: isSelected ? '#FFFDFC' : colors.captureGlassText },
                ]}
              >
                {label}
              </Text>
              {isLocked ? (
                <Ionicons
                  name="lock-closed"
                  size={11}
                  color={isSelected ? '#FFFDFC' : colors.captureGlassText}
                />
              ) : null}
            </View>
          </CaptureAnimatedPressable>
        );
      })}
    </ScrollView>
  );
});
