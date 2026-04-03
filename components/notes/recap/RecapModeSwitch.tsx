import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { memo, useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { Layout, Typography } from '../../../constants/theme';
import { useTheme } from '../../../hooks/useTheme';

export type RecapMode = 'all' | 'recap';
const TRACK_PADDING = 4;
const TRACK_GAP = 6;

interface RecapModeSwitchProps {
  value: RecapMode;
  onChange: (mode: RecapMode) => void;
  allLabel?: string;
  recapLabel?: string;
}

function RecapModeSwitch({
  value,
  onChange,
  allLabel = 'All',
  recapLabel = 'Recap',
}: RecapModeSwitchProps) {
  const { colors, isDark } = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const trackBackground = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.72)';
  const segmentMetrics = useMemo(() => {
    if (trackWidth <= 0) {
      return {
        width: 0,
        offset: 0,
      };
    }

    const innerWidth = Math.max(trackWidth - TRACK_PADDING * 2, 0);
    const width = Math.max((innerWidth - TRACK_GAP) / 2, 0);
    return {
      width,
      offset: width + TRACK_GAP,
    };
  }, [trackWidth]);
  const indicatorStyle = useAnimatedStyle(
    () => ({
      opacity: withTiming(segmentMetrics.width > 0 ? 1 : 0, { duration: 120 }),
      width: withTiming(segmentMetrics.width, { duration: 120 }),
      transform: [
        {
          translateX: withSpring(value === 'all' ? 0 : segmentMetrics.offset, {
            damping: 20,
            mass: 0.7,
            stiffness: 220,
          }),
        },
      ],
    }),
    [segmentMetrics.offset, segmentMetrics.width, value]
  );
  const handleChange = (mode: RecapMode) => {
    if (mode === value) {
      return;
    }

    void Haptics.selectionAsync();
    onChange(mode);
  };
  const handleTrackLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    setTrackWidth((currentWidth) => (currentWidth === nextWidth ? currentWidth : nextWidth));
  }, []);

  return (
    <View
      onLayout={handleTrackLayout}
      style={[
        styles.track,
        {
          backgroundColor: trackBackground,
          borderColor: colors.border,
        },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.activePill,
          {
            backgroundColor: colors.primarySoft,
          },
          indicatorStyle,
        ]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: value === 'all' }}
        onPress={() => handleChange('all')}
        testID="notes-mode-all"
        style={({ pressed }) => [
          styles.segment,
          pressed ? styles.segmentPressed : null,
        ]}
      >
        <Ionicons
          name="grid-outline"
          size={14}
          color={value === 'all' ? colors.primary : colors.secondaryText}
        />
        <Text
          style={[
            styles.label,
            { color: value === 'all' ? colors.primary : colors.secondaryText },
          ]}
        >
          {allLabel}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: value === 'recap' }}
        onPress={() => handleChange('recap')}
        testID="notes-mode-recap"
        style={({ pressed }) => [
          styles.segment,
          pressed ? styles.segmentPressed : null,
        ]}
      >
        <Ionicons
          name="calendar-outline"
          size={14}
          color={value === 'recap' ? colors.primary : colors.secondaryText}
        />
        <Text
          style={[
            styles.label,
            { color: value === 'recap' ? colors.primary : colors.secondaryText },
          ]}
        >
          {recapLabel}
        </Text>
      </Pressable>
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
