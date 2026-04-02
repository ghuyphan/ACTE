import { Ionicons } from '@expo/vector-icons';
import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Layout, Typography } from '../../../constants/theme';
import { useTheme } from '../../../hooks/useTheme';

export type RecapMode = 'all' | 'recap';

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
  const trackBackground = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.72)';

  return (
    <View
      style={[
        styles.track,
        {
          backgroundColor: trackBackground,
          borderColor: colors.border,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: value === 'all' }}
        onPress={() => onChange('all')}
        testID="notes-mode-all"
        style={({ pressed }) => [
          styles.segment,
          value === 'all'
            ? { backgroundColor: colors.primarySoft }
            : null,
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
        onPress={() => onChange('recap')}
        testID="notes-mode-recap"
        style={({ pressed }) => [
          styles.segment,
          value === 'recap'
            ? { backgroundColor: colors.primarySoft }
            : null,
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
    gap: 6,
    padding: 4,
    borderRadius: Layout.pillRadius,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
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
