import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GlassView } from 'expo-glass-effect';
import { useTheme } from '../../hooks/useTheme';
import type { MapFilterState, MapFilterType } from '../../hooks/map/mapDomain';

interface MapFilterBarProps {
  filterState: MapFilterState;
  onChangeType: (type: MapFilterType) => void;
  onToggleFavorites: () => void;
  onInteraction?: () => void;
  top?: number;
}

interface FilterChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  testID?: string;
}

function FilterChip({ label, active, onPress, icon, testID }: FilterChipProps) {
  const { colors, isDark } = useTheme();
  const pressScale = useRef(new Animated.Value(1)).current;

  const animatePressScale = (toValue: number) => {
    Animated.spring(pressScale, {
      toValue,
      tension: 280,
      friction: 20,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: pressScale }] }}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        onPress={onPress}
        onPressIn={() => animatePressScale(0.96)}
        onPressOut={() => animatePressScale(1)}
      >
        <GlassView
          glassEffectStyle="regular"
          colorScheme={isDark ? 'dark' : 'light'}
          style={[
            styles.chipOuter,
            {
              backgroundColor: active
                ? `${colors.primary}20`
                : 'transparent',
              borderColor: active ? `${colors.primary}50` : isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
            },
          ]}
        >
          {icon ? (
            <Ionicons
              name={icon}
              size={13}
              color={active ? colors.primary : colors.secondaryText}
              style={styles.chipIcon}
            />
          ) : null}
          <Text style={[styles.chipText, { color: active ? colors.primary : colors.text }]} numberOfLines={1}>
            {label}
          </Text>
        </GlassView>
      </Pressable>
    </Animated.View>
  );
}

export default function MapFilterBar({
  filterState,
  onChangeType,
  onToggleFavorites,
  onInteraction,
  top = 0,
}: MapFilterBarProps) {
  const { t } = useTranslation();

  const chips = useMemo(
    () => [
      {
        id: 'all',
        label: t('map.filterAll', 'All'),
        active: filterState.type === 'all',
        onPress: () => {
          onInteraction?.();
          onChangeType('all');
        },
        testID: 'map-filter-all',
      },
      {
        id: 'text',
        label: t('map.filterText', 'Text'),
        active: filterState.type === 'text',
        onPress: () => {
          onInteraction?.();
          onChangeType('text');
        },
        testID: 'map-filter-text',
      },
      {
        id: 'photo',
        label: t('map.filterPhoto', 'Photo'),
        active: filterState.type === 'photo',
        onPress: () => {
          onInteraction?.();
          onChangeType('photo');
        },
        testID: 'map-filter-photo',
      },
      {
        id: 'favorites',
        label: t('map.filterFavorites', 'Favorites'),
        icon: 'heart' as const,
        active: filterState.favoritesOnly,
        onPress: () => {
          onInteraction?.();
          onToggleFavorites();
        },
        testID: 'map-filter-favorites',
      },
    ],
    [filterState.favoritesOnly, filterState.type, onChangeType, onInteraction, onToggleFavorites, t]
  );

  return (
    <View style={[styles.container, { top }]} pointerEvents="box-none">
      <View style={styles.panelWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {chips.map((chip) => (
            <FilterChip
              key={chip.id}
              label={chip.label}
              active={chip.active}
              icon={chip.icon}
              onPress={chip.onPress}
              testID={chip.testID}
            />
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 12,
  },
  panelWrap: {
    borderRadius: 20,
    marginLeft: -4,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  labelText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
    fontFamily: 'System',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 2,
  },
  chipOuter: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'System',
  },
  chipIcon: {
    marginRight: 4,
  },
});
