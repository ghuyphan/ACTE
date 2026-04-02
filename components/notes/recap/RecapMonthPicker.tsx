import { Ionicons } from '@expo/vector-icons';
import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Typography } from '../../../constants/theme';
import { useTheme } from '../../../hooks/useTheme';

interface RecapMonthPickerProps {
  label: string;
  onPrevious: () => void;
  onNext: () => void;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
  previousAccessibilityLabel?: string;
  nextAccessibilityLabel?: string;
}

function RecapMonthPicker({
  label,
  onPrevious,
  onNext,
  previousDisabled = false,
  nextDisabled = false,
  previousAccessibilityLabel = 'Previous month',
  nextAccessibilityLabel = 'Next month',
}: RecapMonthPickerProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.row,
        {
          borderColor: `${colors.border}88`,
          backgroundColor: colors.card,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={previousAccessibilityLabel}
        disabled={previousDisabled}
        onPress={onPrevious}
        testID="notes-recap-previous-month"
        style={({ pressed }) => [
          styles.arrowButton,
          {
            backgroundColor: pressed && !previousDisabled ? `${colors.primary}12` : 'transparent',
            opacity: previousDisabled ? 0.45 : 1,
          },
        ]}
      >
        <Ionicons name="chevron-back" size={18} color={colors.text} />
      </Pressable>

      <View style={styles.labelWrap}>
        <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
          {label}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={nextAccessibilityLabel}
        disabled={nextDisabled}
        onPress={onNext}
        testID="notes-recap-next-month"
        style={({ pressed }) => [
          styles.arrowButton,
          {
            backgroundColor: pressed && !nextDisabled ? `${colors.primary}12` : 'transparent',
            opacity: nextDisabled ? 0.45 : 1,
          },
        ]}
      >
        <Ionicons name="chevron-forward" size={18} color={colors.text} />
      </Pressable>
    </View>
  );
}

export default memo(RecapMonthPicker);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderRadius: 22,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 6,
  },
  arrowButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  label: {
    ...Typography.pill,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 1,
  },
});
