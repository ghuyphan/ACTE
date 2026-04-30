import { GlassView } from '../ui/GlassView';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { isOlderIOS } from '../../utils/platform';
import {
  getOverlayBorderColor,
  getOverlayFallbackColor,
  getOverlayScrimColor,
  mapOverlayTokens,
} from './overlayTokens';
import type { MapFilterState, MapFilterType } from '../../hooks/map/mapDomain';
import { Shadows } from '../../constants/theme';

interface MapFilterBarProps {
  filterState: MapFilterState;
  onChangeType: (type: MapFilterType) => void;
  onInteraction?: () => void;
  top?: number;
}

interface FilterChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
  testID?: string;
}

function FilterChip({ label, active, onPress, testID }: FilterChipProps) {
  const { colors } = useTheme();
  const isAndroid = Platform.OS === 'android';
  const chipBackground = active
    ? isAndroid
      ? colors.androidTabShellSelectedBackground
      : `${colors.primary}18`
    : 'transparent';
  const chipBorderColor = active
    ? isAndroid
      ? colors.androidTabShellSelectedBorder
      : `${colors.primary}44`
    : 'transparent';
  const chipContentColor = active ? colors.primary : colors.text;

  return (
    <Pressable
      testID={testID}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chipOuter,
        {
          backgroundColor: chipBackground,
          borderColor: chipBorderColor,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
      hitSlop={4}
    >
      <Text style={[styles.chipText, { color: chipContentColor }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function MapFilterBar({
  filterState,
  onChangeType,
  onInteraction,
  top = 0,
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
        id: 'recent',
        label: t('map.filterRecent', 'Recent'),
        active: filterState.type === 'recent',
        onPress: () => {
          onInteraction?.();
          onChangeType('recent');
        },
        testID: 'map-filter-recent',
      },
      {
        id: 'photo',
        label: t('map.filterPhoto', 'Photos'),
        active: filterState.type === 'photo',
        onPress: () => {
          onInteraction?.();
          onChangeType('photo');
        },
        testID: 'map-filter-photo',
      },
    ],
    [
      filterState.type,
      onChangeType,
      onInteraction,
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
          <View style={styles.row}>
            {chips.map((chip) => (
              <FilterChip
                key={chip.id}
                label={chip.label}
                active={chip.active}
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
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  chipOuter: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
  },
});
