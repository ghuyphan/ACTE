import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Typography } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import AppSheet from './AppSheet';
import AppSheetScaffold from './AppSheetScaffold';

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
  const borderColor = colors.border ?? 'rgba(0,0,0,0.08)';
  const primaryTextColor = colors.text ?? '#2B2621';
  const secondaryTextColor = colors.secondaryText ?? primaryTextColor;
  const accentColor = colors.primary ?? '#E0B15B';

  return (
    <AppSheetScaffold
      headerVariant="standard"
      title={title}
      subtitle={canPasteFromClipboard ? pasteLabel : photoLabel}
      footer={(
        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            android_ripple={{ color: `${primaryTextColor}10`, borderless: false }}
            onPress={onClose}
            style={({ pressed }) => [
              styles.cancelAction,
              pressed ? styles.cancelActionPressed : null,
            ]}
            testID="sticker-source-cancel"
          >
            <Text style={[styles.cancelActionLabel, { color: primaryTextColor }]}>{cancelLabel}</Text>
          </Pressable>
        </View>
      )}
    >
      <View>
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
  optionRow: {
    minHeight: 68,
    paddingHorizontal: 4,
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
    marginLeft: 58,
  },
  footer: {
    alignItems: 'flex-end',
    marginTop: 8,
  },
  cancelAction: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelActionPressed: {
    opacity: 0.72,
  },
  cancelActionLabel: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'System',
  },
});
