import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Layout, Typography } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import AppSheet from './AppSheet';
import AppSheetScaffold from './AppSheetScaffold';
import PrimaryButton from './ui/PrimaryButton';

interface StickerSourceSheetProps {
  visible: boolean;
  canPasteFromClipboard: boolean;
  title: string;
  pasteLabel: string;
  photoLabel: string;
  cancelLabel: string;
  onSelectClipboard: () => void;
  onSelectPhotos: () => void;
  onClose: () => void;
}

function StickerSourceSheetBody({
  canPasteFromClipboard,
  title,
  pasteLabel,
  photoLabel,
  cancelLabel,
  onSelectClipboard,
  onSelectPhotos,
  onClose,
}: Omit<StickerSourceSheetProps, 'visible'>) {
  const { colors } = useTheme();
  const optionBackground = colors.surface ?? colors.card ?? '#FCF9F5';
  const borderColor = colors.border ?? 'rgba(0,0,0,0.08)';
  const primaryTextColor = colors.text ?? '#2B2621';
  const secondaryTextColor = colors.secondaryText ?? primaryTextColor;
  const accentColor = colors.primary ?? '#E0B15B';

  return (
    <AppSheetScaffold
      headerVariant="standard"
      title={title}
      subtitle={canPasteFromClipboard ? pasteLabel : photoLabel}
    >
      <View
        style={[
          styles.optionCard,
          {
            backgroundColor: optionBackground,
            borderColor,
          },
        ]}
      >
        {canPasteFromClipboard ? (
          <>
            <Pressable
              accessibilityRole="button"
              onPress={onSelectClipboard}
              style={({ pressed }) => [styles.optionRow, pressed ? styles.optionRowPressed : null]}
              testID="sticker-source-option-clipboard"
            >
              <View style={[styles.optionIconBadge, { backgroundColor: `${accentColor}18` }]}>
                <Ionicons name="clipboard-outline" size={18} color={accentColor} />
              </View>
              <Text style={[styles.optionLabel, { color: primaryTextColor }]}>{pasteLabel}</Text>
              <Ionicons name="chevron-forward" size={18} color={secondaryTextColor} />
            </Pressable>
            <View style={[styles.optionDivider, { backgroundColor: borderColor }]} />
          </>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={onSelectPhotos}
          style={({ pressed }) => [styles.optionRow, pressed ? styles.optionRowPressed : null]}
          testID="sticker-source-option-photos"
        >
          <View style={[styles.optionIconBadge, { backgroundColor: `${accentColor}18` }]}>
            <Ionicons name="images-outline" size={18} color={accentColor} />
          </View>
          <Text style={[styles.optionLabel, { color: primaryTextColor }]}>{photoLabel}</Text>
          <Ionicons name="chevron-forward" size={18} color={secondaryTextColor} />
        </Pressable>
      </View>
      <PrimaryButton
        label={cancelLabel}
        onPress={onClose}
        variant="secondary"
        style={styles.cancelButton}
        testID="sticker-source-cancel"
      />
    </AppSheetScaffold>
  );
}

export default function StickerSourceSheet({
  visible,
  canPasteFromClipboard,
  title,
  pasteLabel,
  photoLabel,
  cancelLabel,
  onSelectClipboard,
  onSelectPhotos,
  onClose,
}: StickerSourceSheetProps) {
  return (
    <AppSheet visible={visible} onClose={onClose}>
      <StickerSourceSheetBody
        canPasteFromClipboard={canPasteFromClipboard}
        title={title}
        pasteLabel={pasteLabel}
        photoLabel={photoLabel}
        cancelLabel={cancelLabel}
        onSelectClipboard={onSelectClipboard}
        onSelectPhotos={onSelectPhotos}
        onClose={onClose}
      />
    </AppSheet>
  );
}

const styles = StyleSheet.create({
  optionCard: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  optionRow: {
    minHeight: 68,
    paddingHorizontal: 18,
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
    flex: 1,
    fontWeight: '600',
  },
  optionDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 72,
  },
  cancelButton: {
    width: '100%',
    marginTop: 14,
    borderRadius: Layout.pillRadius,
  },
});
