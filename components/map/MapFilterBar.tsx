import { GlassView } from '../ui/GlassView';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../hooks/useTheme';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { isOlderIOS } from '../../utils/platform';
import {
  getOverlayBorderColor,
  getOverlayFallbackColor,
  getOverlayScrimColor,
  mapOverlayTokens,
} from './overlayTokens';
import type { MapFilterState, MapFilterType } from '../../hooks/map/mapDomain';
import { Shadows } from '../../constants/theme';

const CONTROL_SIZE = 36;
const PRIMARY_CONTROL_WIDTH = 72;
const CONTROL_GAP = 2;
const CONTENT_INSET = 5;
const PRIMARY_FILTER_TYPES: MapFilterType[] = ['all', 'recent', 'photo'];
const ACTIVE_CAPSULE_SPRING = {
  damping: 20,
  mass: 0.76,
  overshootClamping: true,
  stiffness: 240,
} as const;
const ACTIVE_CAPSULE_SETTLE_SPRING = {
  damping: 16,
  mass: 0.7,
  overshootClamping: true,
  stiffness: 260,
} as const;

function getPrimaryFilterIndex(type: MapFilterType) {
  const index = PRIMARY_FILTER_TYPES.indexOf(type);
  return index === -1 ? 0 : index;
}

interface MapFilterBarProps {
  filterState: MapFilterState;
  onChangeType: (type: MapFilterType) => void;
  onToggleFavorites?: () => void;
  friendLayerVisible?: boolean;
  onToggleFriendLayer?: () => void;
  onInteraction?: () => void;
  top?: number;
}

interface FilterChipProps {
  accessibilityLabel: string;
  active: boolean;
  onPress: () => void;
  icon: keyof typeof Ionicons.glyphMap;
  label?: string;
  compact?: boolean;
  testID?: string;
}

type FilterChipItem = FilterChipProps & {
  id: string;
};

function FilterChip({
  accessibilityLabel,
  active,
  onPress,
  icon,
  label,
  compact = false,
  testID,
}: FilterChipProps) {
  const { colors } = useTheme();
  const chipContentColor = active ? colors.primary : colors.text;

  return (
    <Pressable
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chipOuter,
        compact ? styles.compactChipOuter : styles.primaryChipOuter,
        {
          backgroundColor: compact && active ? `${colors.primary}12` : 'transparent',
          opacity: pressed ? 0.72 : 1,
        },
      ]}
      hitSlop={4}
    >
      <Ionicons name={icon} size={compact ? 17 : 15} color={chipContentColor} />
      {!compact && label ? (
        <Text style={[styles.chipText, { color: chipContentColor }]} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

export default function MapFilterBar({
  filterState,
  onChangeType,
  onToggleFavorites,
  friendLayerVisible = true,
  onToggleFriendLayer,
  onInteraction,
  top = 0,
}: MapFilterBarProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const reduceMotionEnabled = useReducedMotion();
  const isAndroid = Platform.OS === 'android';

  const chips = useMemo<FilterChipItem[]>(
    () => [
      {
        id: 'all',
        accessibilityLabel: t('map.filterAll', 'All'),
        label: t('map.filterAll', 'All'),
        active: filterState.type === 'all',
        icon: filterState.type === 'all' ? 'albums' : 'albums-outline',
        onPress: () => {
          onInteraction?.();
          onChangeType('all');
        },
        testID: 'map-filter-all',
      },
      {
        id: 'recent',
        accessibilityLabel: t('map.filterRecent', 'Recent'),
        label: t('map.filterRecent', 'Recent'),
        active: filterState.type === 'recent',
        icon: filterState.type === 'recent' ? 'time' : 'time-outline',
        onPress: () => {
          onInteraction?.();
          onChangeType('recent');
        },
        testID: 'map-filter-recent',
      },
      {
        id: 'photo',
        accessibilityLabel: t('map.filterPhoto', 'Photos'),
        label: t('map.filterPhoto', 'Photos'),
        active: filterState.type === 'photo',
        icon: filterState.type === 'photo' ? 'image' : 'image-outline',
        onPress: () => {
          onInteraction?.();
          onChangeType('photo');
        },
        testID: 'map-filter-photo',
      },
      {
        id: 'favorites',
        accessibilityLabel: t('map.filterFavorites', 'Favorites'),
        active: filterState.favoritesOnly,
        icon: filterState.favoritesOnly ? 'heart' : 'heart-outline',
        compact: true,
        onPress: () => {
          onInteraction?.();
          onToggleFavorites?.();
        },
        testID: 'map-filter-favorites',
      },
      {
        id: 'friends',
        accessibilityLabel: t('map.friendsLayer', 'Friends'),
        active: friendLayerVisible,
        icon: friendLayerVisible ? 'people' : 'people-outline',
        compact: true,
        onPress: () => {
          onInteraction?.();
          onToggleFriendLayer?.();
        },
        testID: 'map-layer-friends',
      },
    ],
    [
      filterState.type,
      filterState.favoritesOnly,
      friendLayerVisible,
      onChangeType,
      onInteraction,
      onToggleFavorites,
      onToggleFriendLayer,
      t,
    ]
  );
  const activeChipIndex = getPrimaryFilterIndex(filterState.type);
  const activeCapsuleX = useSharedValue(activeChipIndex * (PRIMARY_CONTROL_WIDTH + CONTROL_GAP));
  const activeCapsuleScale = useSharedValue(1);

  useEffect(() => {
    const nextOffset = activeChipIndex * (PRIMARY_CONTROL_WIDTH + CONTROL_GAP);
    if (reduceMotionEnabled) {
      activeCapsuleX.value = withTiming(nextOffset, { duration: 0 });
      activeCapsuleScale.value = 1;
      return;
    }

    activeCapsuleScale.value = withTiming(0.96, { duration: 70 }, (finished) => {
      if (finished) {
        activeCapsuleScale.value = withSpring(1, ACTIVE_CAPSULE_SETTLE_SPRING);
      }
    });
    activeCapsuleX.value = withSpring(nextOffset, ACTIVE_CAPSULE_SPRING);
  }, [activeCapsuleScale, activeCapsuleX, activeChipIndex, reduceMotionEnabled]);

  const activeCapsuleStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: activeCapsuleX.value },
      { scaleX: activeCapsuleScale.value },
      { scaleY: 0.98 + activeCapsuleScale.value * 0.02 },
    ],
  }));

  return (
    <View style={[styles.wrapper, top > 0 ? { marginTop: top } : null]} pointerEvents="box-none">
      <View
        testID="map-top-header"
        style={[
          styles.container,
          isAndroid ? styles.containerAndroidShadow : null,
          {
            borderColor: getOverlayBorderColor(isDark, colors),
            backgroundColor: getOverlayFallbackColor(isDark, colors),
            shadowColor: isAndroid ? colors.androidTabShellShadow : undefined,
          },
        ]}
      >
        <GlassView
          pointerEvents="none"
          glassEffectStyle="regular"
          colorScheme={isDark ? 'dark' : 'light'}
          fallbackColor="transparent"
          tintColor={colors.glassOverlaySurface}
          style={StyleSheet.absoluteFill}
        />
        {Platform.OS === 'android' ? (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              styles.androidScrim,
              {
                backgroundColor: getOverlayScrimColor(isDark, colors),
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
                backgroundColor: getOverlayFallbackColor(isDark, colors),
              },
            ]}
          />
        ) : null}

        <View style={styles.content}>
          <Reanimated.View
            pointerEvents="none"
            style={[
              styles.activeCapsule,
              {
                backgroundColor: isAndroid
                  ? colors.androidTabShellSelectedBackground
                  : `${colors.primary}18`,
                borderColor: isAndroid
                  ? colors.androidTabShellSelectedBorder
                  : `${colors.primary}33`,
              },
              activeCapsuleStyle,
            ]}
          >
            {isAndroid ? (
              <LinearGradient
                pointerEvents="none"
                colors={colors.androidTabShellSelectedGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
          </Reanimated.View>
          <View style={styles.row}>
            {chips.map((chip) => (
              <FilterChip
                key={chip.id}
                accessibilityLabel={chip.accessibilityLabel}
                active={chip.active}
                icon={chip.icon}
                label={chip.label}
                compact={chip.compact}
                onPress={chip.onPress}
                testID={chip.testID}
              />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    alignItems: 'center',
  },
  container: {
    borderWidth: Platform.OS === 'android' ? 1 : StyleSheet.hairlineWidth,
    borderRadius: mapOverlayTokens.overlayRadius,
    overflow: 'hidden',
    alignSelf: 'center',
    ...mapOverlayTokens.overlayShadow,
  },
  containerAndroidShadow: {
    ...Shadows.androidChrome,
  },
  androidScrim: {
    borderRadius: mapOverlayTokens.overlayRadius,
  },
  content: {
    paddingHorizontal: CONTENT_INSET,
    paddingVertical: CONTENT_INSET,
    position: 'relative',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  chipOuter: {
    height: CONTROL_SIZE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: CONTROL_SIZE / 2,
    zIndex: 1,
  },
  primaryChipOuter: {
    width: PRIMARY_CONTROL_WIDTH,
    gap: 5,
  },
  compactChipOuter: {
    width: CONTROL_SIZE,
  },
  activeCapsule: {
    position: 'absolute',
    top: CONTENT_INSET,
    left: CONTENT_INSET,
    width: PRIMARY_CONTROL_WIDTH,
    height: CONTROL_SIZE,
    borderRadius: CONTROL_SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
  },
});
