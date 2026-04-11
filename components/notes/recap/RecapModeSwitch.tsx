import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '../../../hooks/useHaptics';
import React, { memo, useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { Layout, Typography } from '../../../constants/theme';
import { useTheme } from '../../../hooks/useTheme';
import StickerIcon from '../../ui/StickerIcon';
import { GlassView } from '../../ui/GlassView';

export type RecapMode = 'all' | 'collection' | 'recap';
const TRACK_PADDING = 4;
const TRACK_GAP = 6;

interface RecapModeSwitchProps {
  value: RecapMode;
  onChange: (mode: RecapMode) => void;
  showCollection?: boolean;
  allLabel?: string;
  collectionLabel?: string;
  recapLabel?: string;
  trackWidth?: number;
}

function RecapModeSwitch({
  value,
  onChange,
  showCollection = true,
  allLabel = 'All',
  collectionLabel = 'Collection',
  recapLabel = 'Recap',
  trackWidth,
}: RecapModeSwitchProps) {
  const { colors, isDark } = useTheme();
  const [measuredTrackWidth, setMeasuredTrackWidth] = useState(0);
  const isAndroid = Platform.OS === 'android';
  const trackBackground = isAndroid
    ? colors.androidTabShellBackground
    : isDark
      ? 'rgba(255,255,255,0.06)'
      : 'rgba(255,255,255,0.72)';
  const trackBorderColor = isAndroid ? colors.androidTabShellBorder : colors.border;
  const activePillColor = isAndroid ? colors.androidTabShellSelectedBackground : colors.primarySoft;
  const activeForegroundColor = isAndroid ? colors.androidTabShellActive : colors.primary;
  const inactiveForegroundColor = isAndroid ? colors.androidTabShellInactive : colors.secondaryText;
  const segments = useMemo(
    () => [
      {
        mode: 'all' as const,
        iconName: 'grid-outline' as const,
        label: allLabel,
        testID: 'notes-mode-all',
      },
      ...(showCollection
        ? [
            {
              mode: 'collection' as const,
              label: collectionLabel,
              testID: 'notes-mode-collection',
            },
          ]
        : []),
      {
        mode: 'recap' as const,
        iconName: 'calendar-outline' as const,
        label: recapLabel,
        testID: 'notes-mode-recap',
      },
    ],
    [allLabel, collectionLabel, recapLabel, showCollection]
  );
  const resolvedTrackWidth = trackWidth ?? measuredTrackWidth;
  const segmentMetrics = useMemo(() => {
    if (resolvedTrackWidth <= 0) {
      return {
        width: 0,
        offset: 0,
      };
    }

    const innerWidth = Math.max(resolvedTrackWidth - TRACK_PADDING * 2, 0);
    const width = Math.max((innerWidth - TRACK_GAP * (segments.length - 1)) / segments.length, 0);
    return {
      width,
      offset: width + TRACK_GAP,
    };
  }, [resolvedTrackWidth, segments.length]);
  const activeSegmentIndex = Math.max(
    0,
    segments.findIndex((segment) => segment.mode === value)
  );
  const indicatorStyle = useAnimatedStyle(
    () => ({
      opacity: withTiming(segmentMetrics.width > 0 ? 1 : 0, { duration: 120 }),
      width: withTiming(segmentMetrics.width, { duration: 120 }),
      transform: [
        {
          translateX: withSpring(activeSegmentIndex * segmentMetrics.offset, {
            damping: 20,
            mass: 0.7,
            stiffness: 220,
          }),
        },
      ],
    }),
    [activeSegmentIndex, segmentMetrics.offset, segmentMetrics.width]
  );
  const handleChange = (mode: RecapMode) => {
    if (mode === value) {
      return;
    }

    void Haptics.selectionAsync();
    onChange(mode);
  };
  const handleTrackLayout = useCallback((event: LayoutChangeEvent) => {
    if (trackWidth !== undefined) {
      return;
    }

    const nextWidth = event.nativeEvent.layout.width;
    setMeasuredTrackWidth((currentWidth) => (currentWidth === nextWidth ? currentWidth : nextWidth));
  }, [trackWidth]);

  const trackContent = (
    <>
      <Animated.View
        testID="notes-mode-pill"
        pointerEvents="none"
        style={[
          styles.activePill,
          {
            backgroundColor: activePillColor,
          },
          indicatorStyle,
        ]}
      />
      {segments.map((segment) => {
        const isSelected = value === segment.mode;

        return (
          <Pressable
            key={segment.mode}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            onPress={() => handleChange(segment.mode)}
            testID={segment.testID}
            style={({ pressed }) => [
              styles.segment,
              pressed ? styles.segmentPressed : null,
            ]}
          >
            {segment.mode === 'collection' ? (
              <StickerIcon
                size={14}
                color={isSelected ? activeForegroundColor : inactiveForegroundColor}
              />
            ) : (
              <Ionicons
                name={segment.iconName}
                size={14}
                color={isSelected ? activeForegroundColor : inactiveForegroundColor}
              />
            )}
            <Text
              style={[
                styles.label,
                { color: isSelected ? activeForegroundColor : inactiveForegroundColor },
              ]}
            >
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </>
  );

  return isAndroid ? (
    <GlassView
      onLayout={handleTrackLayout}
      style={[
        styles.track,
        {
          borderColor: trackBorderColor,
          width: trackWidth,
        },
      ]}
      fallbackColor={trackBackground}
      glassEffectStyle="regular"
      colorScheme={isDark ? 'dark' : 'light'}
    >
      {trackContent}
    </GlassView>
  ) : (
    <View
      onLayout={handleTrackLayout}
      style={[
        styles.track,
        {
          backgroundColor: trackBackground,
          borderColor: trackBorderColor,
          width: trackWidth,
        },
      ]}
    >
      {trackContent}
    </View>
  );
}

export default memo(RecapModeSwitch);

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: TRACK_GAP,
    padding: TRACK_PADDING,
    borderRadius: Layout.pillRadius,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  activePill: {
    position: 'absolute',
    top: TRACK_PADDING,
    left: TRACK_PADDING,
    bottom: TRACK_PADDING,
    borderRadius: Layout.pillRadius - 4,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    borderRadius: Layout.pillRadius - 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  segmentPressed: {
    opacity: 0.8,
  },
  label: {
    ...Typography.pill,
  },
});
