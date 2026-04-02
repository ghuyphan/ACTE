import { Ionicons } from '@expo/vector-icons';
import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import InfoPill from '../../ui/InfoPill';
import { Radii, Typography } from '../../../constants/theme';
import { useTheme } from '../../../hooks/useTheme';

interface RecapPlaceListRowProps {
  title: string;
  subtitle?: string;
  noteCountLabel?: string;
  accentColor?: string;
  onPress?: () => void;
}

function RecapPlaceListRow({
  title,
  subtitle,
  noteCountLabel,
  accentColor,
  onPress,
}: RecapPlaceListRowProps) {
  const { colors } = useTheme();

  const content = (
    <View style={[styles.row, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <View style={[styles.dot, { backgroundColor: accentColor ?? colors.primary }]} />
      <View style={styles.textBlock}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.secondaryText }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.metaWrap}>
        {noteCountLabel ? (
          <InfoPill style={styles.pill}>
            <Text style={[styles.pillText, { color: colors.text }]} numberOfLines={1}>
              {noteCountLabel}
            </Text>
          </InfoPill>
        ) : null}
        <Ionicons name="chevron-forward" size={16} color={colors.secondaryText} />
      </View>
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.pressable, pressed ? styles.pressed : null]}
    >
      {content}
    </Pressable>
  );
}

export default memo(RecapPlaceListRow);

const styles = StyleSheet.create({
  pressable: {
    borderRadius: Radii.lg,
  },
  pressed: {
    opacity: 0.92,
  },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...Typography.body,
    fontSize: 15,
    fontWeight: '800',
    fontFamily: 'Noto Sans',
  },
  subtitle: {
    ...Typography.body,
    fontSize: 12,
    lineHeight: 16,
  },
  metaWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pill: {
    minHeight: 32,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillText: {
    ...Typography.pill,
    fontSize: 12,
  },
});
