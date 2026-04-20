import { Ionicons } from '@expo/vector-icons';
import { GlassView } from '../ui/GlassView';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Reanimated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../hooks/useTheme';
import { isOlderIOS } from '../../utils/platform';
import {
  mapMotionDurations,
  mapMotionPressTiming,
} from './mapMotion';
import {
  getOverlayBorderColor,
  getOverlayFallbackColor,
  getOverlayMutedFillColor,
  getOverlayScrimColor,
  mapOverlayTokens,
} from './overlayTokens';
import type { MapFilterState, MapFilterType } from '../../hooks/map/mapDomain';
import { Shadows } from '../../constants/theme';

interface MapFilterBarProps {
  filterState: MapFilterState;
  onChangeType: (type: MapFilterType) => void;
  onToggleFavorites: () => void;
  onClearFilters?: () => void;
  onInteraction?: () => void;
  top?: number;
  hasActiveFilters?: boolean;
  reduceMotionEnabled: boolean;
  friendsChip?: {
    active: boolean;
    label: string;
    onPress: () => void;
    testID: string;
  } | null;
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
  const isAndroid = Platform.OS === 'android';
  const inactiveChipBackground = isAndroid
    ? colors.androidTabShellMutedBackground
    : getOverlayMutedFillColor(isDark);
  const inactiveChipBorderColor = isAndroid
    ? colors.androidTabShellMutedBorder
    : getOverlayBorderColor(isDark);

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
        isAndroid ? colors.androidTabShellSelectedBackground : `${colors.primary}1A`,
      ]
    ),
    borderColor: interpolateColor(
      activeProgress.value,
      [0, 1],
      [inactiveChipBorderColor, isAndroid ? colors.androidTabShellSelectedBorder : `${colors.primary}55`]
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
          pressScale.value = withTiming(0.96, mapMotionPressTiming);
        }}
        onPressOut={() => {
          pressScale.value = withTiming(1, mapMotionPressTiming);
        }}
        hitSlop={4}
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
  onClearFilters,
  onInteraction,
  top = 0,
  hasActiveFilters = false,
  reduceMotionEnabled,
  friendsChip,
}: MapFilterBarProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const isAndroid = Platform.OS === 'android';

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
    [
      filterState.favoritesOnly,
      filterState.type,
      onChangeType,
      onInteraction,
      onToggleFavorites,
      t,
    ]
  );

  return (
    <View style={[styles.wrapper, top > 0 ? { marginTop: top } : null]} pointerEvents="box-none">
      <View
        testID="map-top-header"
        style={[
          styles.container,
          isAndroid ? styles.containerAndroidShadow : null,
          {
            borderColor: getOverlayBorderColor(isDark),
            backgroundColor: getOverlayFallbackColor(isDark),
            shadowColor: isAndroid ? colors.androidTabShellShadow : undefined,
          },
        ]}
      >
        <GlassView
          pointerEvents="none"
          glassEffectStyle="regular"
          colorScheme={isDark ? 'dark' : 'light'}
          fallbackColor="transparent"
          style={StyleSheet.absoluteFill}
        />
        {Platform.OS === 'android' ? (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              styles.androidScrim,
              {
                backgroundColor: getOverlayScrimColor(isDark),
              },
            ]}
          />
        ) : null}
        {isOlderIOS ? (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: mapOverlayTokens.overlayRadius,
                backgroundColor: getOverlayFallbackColor(isDark),
              },
            ]}
          />
        ) : null}

        <View style={styles.content}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
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

            {hasActiveFilters && onClearFilters ? (
              <Pressable
                testID="map-filter-clear-inline"
                accessibilityRole="button"
                onPress={() => {
                  onInteraction?.();
                  onClearFilters();
                }}
                style={({ pressed }) => [
                  styles.inlineAction,
                  {
                    opacity: pressed ? 0.72 : 1,
                    backgroundColor: isAndroid
                      ? colors.androidTabShellMutedBackground
                      : `${colors.primary}12`,
                    borderColor: isAndroid
                      ? colors.androidTabShellMutedBorder
                      : `${colors.primary}24`,
                  },
                ]}
              >
                <Ionicons name="close-circle-outline" size={13} color={colors.primary} />
                <Text style={[styles.inlineActionText, { color: colors.primary }]} numberOfLines={1}>
                  {t('map.clearFilters', 'Clear')}
                </Text>
              </Pressable>
            ) : null}

            {friendsChip ? (
              <Pressable
                testID={friendsChip.testID}
                accessibilityRole="button"
                accessibilityState={{ selected: friendsChip.active }}
                onPress={() => {
                  onInteraction?.();
                  friendsChip.onPress();
                }}
                style={({ pressed }) => [
                  styles.inlineAction,
                  {
                    opacity: pressed ? 0.72 : 1,
                    backgroundColor: friendsChip.active
                      ? isAndroid
                        ? colors.androidTabShellSelectedBackground
                        : `${colors.primary}18`
                      : isAndroid
                        ? colors.androidTabShellMutedBackground
                        : getOverlayMutedFillColor(isDark),
                    borderColor: friendsChip.active
                      ? isAndroid
                        ? colors.androidTabShellSelectedBorder
                        : `${colors.primary}36`
                      : isAndroid
                        ? colors.androidTabShellMutedBorder
                        : getOverlayBorderColor(isDark),
                  },
                ]}
              >
                <Ionicons
                  name="sparkles-outline"
                  size={13}
                  color={friendsChip.active ? colors.primary : colors.secondaryText}
                />
                <Text
                  style={[
                    styles.inlineActionText,
                    { color: friendsChip.active ? colors.primary : colors.text },
                  ]}
                  numberOfLines={1}
                >
                  {friendsChip.label}
                </Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  container: {
    borderWidth: Platform.OS === 'android' ? 1 : StyleSheet.hairlineWidth,
    borderRadius: mapOverlayTokens.overlayRadius,
    overflow: 'hidden',
    ...mapOverlayTokens.overlayShadow,
  },
  containerAndroidShadow: {
    ...Shadows.androidChrome,
  },
  androidScrim: {
    borderRadius: mapOverlayTokens.overlayRadius,
  },
  content: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inlineAction: {
    minHeight: 34,
    paddingHorizontal: 11,
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  inlineActionText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
    flexShrink: 1,
  },
  chipsScroll: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 8,
  },
  chipOuter: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 17,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  chipIcon: {
    marginRight: 5,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
  },
});
