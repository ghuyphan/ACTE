import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import CaptureFooterFrame from './CaptureFooterFrame';

interface PlacePulseStripProps {
  label: string;
  accessibilityLabel?: string;
  iconName?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
}

function PlacePulseStrip({
  label,
  accessibilityLabel,
  iconName = 'chevron-down',
  onPress,
}: PlacePulseStripProps) {
  const { colors } = useTheme();

  return (
    <CaptureFooterFrame>
      <Pressable
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={accessibilityLabel ?? label}
        disabled={!onPress}
        hitSlop={10}
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          {
            opacity: pressed ? 0.72 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}
      >
        <Ionicons
          name={iconName}
          size={14}
          color={colors.captureGlassPlaceholder}
        />

        <Text
          numberOfLines={1}
          style={[styles.label, { color: colors.captureGlassPlaceholder }]}
        >
          {label}
        </Text>
      </Pressable>
    </CaptureFooterFrame>
  );
}

export default memo(PlacePulseStrip);

const styles = StyleSheet.create({
  button: {
    maxWidth: '88%',
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 6,
  },
  label: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
    textAlign: 'center',
  },
});
