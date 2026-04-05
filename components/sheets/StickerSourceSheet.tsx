import { Ionicons } from '@expo/vector-icons';
import { type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Sheet, Typography } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import StampIcon from '../ui/StampIcon';
import StickerIcon from '../ui/StickerIcon';
import AppSheet from './AppSheet';
import AppSheetScaffold from './AppSheetScaffold';
import SheetFooterButton from './SheetFooterButton';

export interface StickerSourceSheetAction {
  key: string;
  iconName: ComponentProps<typeof Ionicons>['name'];
  renderIcon?: (props: { color: string; size: number }) => ReactNode;
  label: string;
  description?: string;
  onPress: () => void;
  testID?: string;
}

interface StickerSourceSheetProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  cancelLabel: string;
  actions: StickerSourceSheetAction[];
  onClose: () => void;
}

function StickerSourceSheetBody({
  title,
  subtitle,
  cancelLabel,
  actions,
  onClose,
}: Omit<StickerSourceSheetProps, 'visible'>) {
  const { colors } = useTheme();
  const borderColor = colors.border ?? 'rgba(0,0,0,0.08)';
  const primaryTextColor = colors.text ?? '#2B2621';
  const secondaryTextColor = colors.secondaryText ?? primaryTextColor;
  const accentColor = colors.primary ?? '#E0B15B';

  return (
    <AppSheetScaffold
      headerVariant="standard"
      title={title}
      subtitle={subtitle}
      useHorizontalPadding={false}
      footer={(
        <View style={styles.footer}>
          <SheetFooterButton
            label={cancelLabel}
            onPress={onClose}
            testID="sticker-source-cancel"
          />
        </View>
      )}
    >
      <View>
        {actions.map((action, index) => (
          <View key={action.key}>
            <Pressable
              accessibilityRole="button"
              onPress={action.onPress}
              style={({ pressed }) => [styles.optionRow, pressed ? styles.optionRowPressed : null]}
              testID={action.testID}
            >
              <View style={[styles.optionIconBadge, { backgroundColor: `${accentColor}18` }]}>
                {action.renderIcon
                  ? action.renderIcon({ color: accentColor, size: 18 })
                  : <Ionicons name={action.iconName} size={18} color={accentColor} />}
              </View>
              <View style={styles.optionContent}>
                <Text style={[styles.optionLabel, { color: primaryTextColor }]}>{action.label}</Text>
                {action.description ? (
                  <Text style={[styles.optionDescription, { color: secondaryTextColor }]}>
                    {action.description}
                  </Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={secondaryTextColor} />
            </Pressable>
            {index < actions.length - 1 ? (
              <View style={[styles.optionDivider, { backgroundColor: borderColor }]} />
            ) : null}
          </View>
        ))}
      </View>
    </AppSheetScaffold>
  );
}

export default function StickerSourceSheet({
  visible,
  title,
  subtitle,
  cancelLabel,
  actions,
  onClose,
}: StickerSourceSheetProps) {
  return (
    <AppSheet visible={visible} onClose={onClose}>
      <StickerSourceSheetBody
        title={title}
        subtitle={subtitle}
        cancelLabel={cancelLabel}
        actions={actions}
        onClose={onClose}
      />
    </AppSheet>
  );
}

export const renderStickerSourceSheetStickerIcon = ({
  color,
  size,
}: {
  color: string;
  size: number;
}) => <StickerIcon color={color} size={size} />;

export const renderStickerSourceSheetStampIcon = ({
  color,
  size,
}: {
  color: string;
  size: number;
}) => <StampIcon color={color} size={size} />;

const styles = StyleSheet.create({
  optionRow: {
    minHeight: 68,
    paddingHorizontal: Sheet.android.horizontalPadding,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  optionRowPressed: {
    opacity: 0.82,
  },
  optionIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    ...Typography.body,
    fontWeight: '600',
  },
  optionContent: {
    flex: 1,
    gap: 2,
  },
  optionDescription: {
    ...Typography.pill,
    fontWeight: '500',
    lineHeight: 18,
  },
  optionDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Sheet.android.horizontalPadding + 54, // Icon (40) + Gap (14)
  },
  footer: {
    marginTop: 16,
  },
});
