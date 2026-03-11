import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GlassView } from 'expo-glass-effect';
import { isOlderIOS } from '../../utils/platform';
import { getOverlayBorderColor, getOverlayFallbackColor, mapOverlayTokens } from './overlayTokens';
import { useTheme } from '../../hooks/useTheme';
import type { MapFilterState, MapFilterType } from '../../hooks/map/mapDomain';

interface MapFilterBarProps {
  filterState: MapFilterState;
  onChangeType: (type: MapFilterType) => void;
  onToggleFavorites: () => void;
  onInteraction?: () => void;
  top?: number;
  countLabel: string;
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
        <View
          style={[
            styles.chipOuter,
            {
              backgroundColor: active
                ? `${colors.primary}1A`
                : isDark
                  ? 'rgba(255,255,255,0.05)'
                  : 'rgba(255,255,255,0.58)',
              borderColor: active ? `${colors.primary}55` : getOverlayBorderColor(isDark),
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
        </View>
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
  countLabel,
}: MapFilterBarProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

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
    <View style={[styles.wrapper, top > 0 ? { marginTop: top } : null]} pointerEvents="box-none">
      <GlassView
        testID="map-top-header"
        glassEffectStyle="regular"
        colorScheme={isDark ? 'dark' : 'light'}
        style={[styles.container, { borderColor: getOverlayBorderColor(isDark) }]}
      >
        {isOlderIOS ? (
          <View
            style={[
              StyleSheet.absoluteFillObject,
              {
                borderRadius: mapOverlayTokens.overlayRadius,
                backgroundColor: getOverlayFallbackColor(isDark),
              },
            ]}
          />
        ) : null}
        <View style={styles.countRow}>
          <Ionicons name="pin" size={14} color={colors.primary} />
          <Text testID="map-inline-count" style={[styles.countText, { color: colors.text }]}>
            {countLabel}
          </Text>
        </View>

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
      </GlassView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  container: {
    borderWidth: 1,
    borderRadius: mapOverlayTokens.overlayRadius,
    padding: mapOverlayTokens.overlayPadding,
    gap: mapOverlayTokens.overlayGap,
    minHeight: mapOverlayTokens.overlayMinHeight,
    overflow: 'hidden',
    ...mapOverlayTokens.overlayShadow,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'System',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 2,
  },
  chipOuter: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 14,
    borderWidth: 1,
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
