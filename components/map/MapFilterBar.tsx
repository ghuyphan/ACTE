import { Ionicons } from '@expo/vector-icons';
import { GlassView } from 'expo-glass-effect';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Reanimated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../hooks/useTheme';
import { isOlderIOS } from '../../utils/platform';
import {
  getMapLayoutTransition,
  getMapOverlayEnter,
  getMapOverlayExit,
  mapMotionDurations,
  mapMotionPressSpring,
} from './mapMotion';
import { getOverlayBorderColor, getOverlayFallbackColor, mapOverlayTokens } from './overlayTokens';
import type { MapFilterState, MapFilterType } from '../../hooks/map/mapDomain';

interface MapFilterBarProps {
  filterState: MapFilterState;
  onChangeType: (type: MapFilterType) => void;
  onToggleFavorites: () => void;
  onInteraction?: () => void;
  top?: number;
  countLabel: string;
  reduceMotionEnabled: boolean;
}

interface FilterChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  testID?: string;
  reduceMotionEnabled: boolean;
}

const AnimatedIonicons = Reanimated.createAnimatedComponent(Ionicons);

function FilterChip({ label, active, onPress, icon, testID, reduceMotionEnabled }: FilterChipProps) {
  const { colors, isDark } = useTheme();
  const activeProgress = useSharedValue(active ? 1 : 0);
  const pressScale = useSharedValue(1);
  const inactiveChipBackground = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.72)';
  const inactiveChipBorderColor = getOverlayBorderColor(isDark);

  useEffect(() => {
    activeProgress.value = reduceMotionEnabled
      ? withTiming(active ? 1 : 0, { duration: mapMotionDurations.fast })
      : withTiming(active ? 1 : 0, { duration: mapMotionDurations.standard });
  }, [active, activeProgress, reduceMotionEnabled]);

  const animatedWrapperStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const animatedChipStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      activeProgress.value,
      [0, 1],
      [
        inactiveChipBackground,
        `${colors.primary}1A`,
      ]
    ),
    borderColor: interpolateColor(
      activeProgress.value,
      [0, 1],
      [inactiveChipBorderColor, `${colors.primary}55`]
    ),
  }));

  const animatedIconStyle = useAnimatedStyle(() => ({
    color: interpolateColor(activeProgress.value, [0, 1], [colors.secondaryText, colors.primary]),
  }));

  const animatedTextStyle = useAnimatedStyle(() => ({
    color: interpolateColor(activeProgress.value, [0, 1], [colors.text, colors.primary]),
  }));

  return (
    <Reanimated.View style={animatedWrapperStyle}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        onPress={onPress}
        onPressIn={() => {
          pressScale.value = withSpring(0.96, mapMotionPressSpring);
        }}
        onPressOut={() => {
          pressScale.value = withSpring(1, mapMotionPressSpring);
        }}
      >
        <Reanimated.View style={[styles.chipOuter, animatedChipStyle]}>
          {icon ? (
            <AnimatedIonicons
              name={icon}
              size={13}
              color={active ? colors.primary : colors.secondaryText}
              style={[styles.chipIcon, animatedIconStyle]}
            />
          ) : null}
          <Reanimated.Text style={[styles.chipText, animatedTextStyle]} numberOfLines={1}>
            {label}
          </Reanimated.Text>
        </Reanimated.View>
      </Pressable>
    </Reanimated.View>
  );
}

export default function MapFilterBar({
  filterState,
  onChangeType,
  onToggleFavorites,
  onInteraction,
  top = 0,
  countLabel,
  reduceMotionEnabled,
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
    <Reanimated.View
      style={[styles.wrapper, top > 0 ? { marginTop: top } : null]}
      pointerEvents="box-none"
      layout={getMapLayoutTransition(reduceMotionEnabled)}
    >
      <View testID="map-top-header" style={[styles.container, { borderColor: getOverlayBorderColor(isDark) }]}>
        <GlassView
          pointerEvents="none"
          glassEffectStyle="regular"
          colorScheme={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFillObject}
        />
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

        <View style={styles.content}>
          <View style={styles.countRow}>
          <Ionicons name="pin" size={14} color={colors.primary} />
          <View style={styles.countLabelWrap}>
            <Reanimated.Text
              key={countLabel}
              testID="map-inline-count"
              entering={getMapOverlayEnter(reduceMotionEnabled)}
              exiting={getMapOverlayExit(reduceMotionEnabled)}
              style={[styles.countText, { color: colors.text }]}
            >
              {countLabel}
            </Reanimated.Text>
          </View>
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
                reduceMotionEnabled={reduceMotionEnabled}
              />
            ))}
          </ScrollView>
        </View>
      </View>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  container: {
    borderWidth: 1,
    borderRadius: mapOverlayTokens.overlayRadius,
    minHeight: mapOverlayTokens.overlayMinHeight,
    overflow: 'hidden',
    ...mapOverlayTokens.overlayShadow,
  },
  content: {
    padding: mapOverlayTokens.overlayPadding,
    gap: mapOverlayTokens.overlayGap,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countLabelWrap: {
    minHeight: 18,
    justifyContent: 'center',
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
  chipIcon: {
    marginRight: 6,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'System',
  },
});
