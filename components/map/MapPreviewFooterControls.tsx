import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface MapPreviewPositionPillProps {
  current: number;
  total: number;
  testID: string;
}

export function MapPreviewPositionPill({
  current,
  total,
  testID,
}: MapPreviewPositionPillProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const label = `${current}/${total}`;

  return (
    <View
      accessible
      accessibilityLabel={t(
        'map.previewPositionLabel',
        'Preview {{current}} of {{count}}. Swipe sideways to browse.',
        {
          current,
          count: total,
        }
      )}
      style={[
        mapPreviewFooterStyles.positionPill,
        {
          backgroundColor: colors.primarySoft,
          borderColor: `${colors.primary}3D`,
        },
      ]}
    >
      <Text testID={testID} style={[mapPreviewFooterStyles.positionText, { color: colors.primary }]}>
        {label}
      </Text>
    </View>
  );
}

interface MapPreviewExpandButtonProps {
  isExpanded: boolean;
  onPress: () => void;
}

export function MapPreviewExpandButton({ isExpanded, onPress }: MapPreviewExpandButtonProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        isExpanded
          ? t('map.collapseNearby', 'Collapse')
          : t('map.expandNearby', 'Expand')
      }
      onPress={onPress}
      style={({ pressed }) => [
        mapPreviewFooterStyles.expandButton,
        {
          backgroundColor: isExpanded ? colors.primarySoft : 'transparent',
          opacity: pressed ? 0.72 : 1,
        },
      ]}
      hitSlop={8}
    >
      <Ionicons
        name={isExpanded ? 'chevron-down' : 'chevron-up'}
        size={15}
        color={isExpanded ? colors.primary : colors.secondaryText}
      />
    </Pressable>
  );
}

export const mapPreviewFooterStyles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'space-between',
    marginTop: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  actionButton: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
    flexShrink: 1,
  },
  positionPill: {
    minHeight: 28,
    minWidth: 52,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  positionText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
  },
  expandButton: {
    minHeight: 30,
    minWidth: 30,
    paddingHorizontal: 8,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
