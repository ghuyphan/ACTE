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
  onInteraction?: () => void;
  top?: number;
  countLabel: string;
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
  onInteraction,
  top = 0,
  countLabel,
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
      ...(friendsChip
        ? [
            {
              id: 'friends',
              label: friendsChip.label,
              icon: 'sparkles-outline' as const,
              active: friendsChip.active,
              onPress: () => {
                onInteraction?.();
                friendsChip.onPress();
              },
              testID: friendsChip.testID,
            },
          ]
        : []),
    ],
    [
      filterState.favoritesOnly,
      filterState.type,
      friendsChip,
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
          <View style={styles.headerRow}>
            <View style={styles.countRow}>
              <View style={[styles.countDot, { backgroundColor: colors.primary }]} />
              <View style={styles.countLabelWrap}>
                <Text testID="map-inline-count" style={[styles.countText, { color: colors.text }]}>
                  {countLabel}
                </Text>
              </View>
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
    minHeight: mapOverlayTokens.overlayMinHeight,
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
    padding: mapOverlayTokens.overlayPadding,
    gap: mapOverlayTokens.overlayCardGap,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  countDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  countLabelWrap: {
    minHeight: 20,
    justifyContent: 'center',
  },
  countText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Noto Sans',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 2,
  },
  chipOuter: {
    minHeight: mapOverlayTokens.controlHeight,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: mapOverlayTokens.overlayCompactRadius,
    paddingHorizontal: 13,
    borderWidth: 1,
  },
  chipIcon: {
    marginRight: 6,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
  },
});
