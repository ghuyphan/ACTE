import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Sheet, Typography } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import type {
  CollectibleStickerLibrarySection,
  CollectibleStickerLibrarySectionKey,
  CreatedStickerLibraryItem,
} from '../screens/notes/stickerLibrary';
import StickerLibraryPreview from '../notes/StickerLibraryPreview';
import { getStampFrameMetrics } from '../notes/stampFrameMetrics';
import AppSheet from './AppSheet';
import AppSheetScaffold from './AppSheetScaffold';
import SheetFooterButton from './SheetFooterButton';

interface StickerLibraryPickerSheetProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  cancelLabel: string;
  sections: CollectibleStickerLibrarySection[];
  onSelectItem: (item: CreatedStickerLibraryItem) => void;
  onClose: () => void;
}

function getSectionTitle(
  sectionKey: CollectibleStickerLibrarySectionKey,
  t: ReturnType<typeof useTranslation>['t']
) {
  switch (sectionKey) {
    case 'mostUsed':
      return t('notes.stickerLibrary.section.mostUsed', 'Used most');
    case 'stickers':
      return t('notes.stickerLibrary.section.stickers', 'Stickers');
    case 'stamps':
      return t('notes.stickerLibrary.section.stamps', 'Stamps');
    case 'recent':
    default:
      return t('notes.stickerLibrary.section.recent', 'Recent');
  }
}

function fitPreviewWithinBounds(
  width: number,
  height: number,
  bounds: { maxWidth: number; maxHeight: number }
) {
  const safeWidth = Math.max(width, 1);
  const safeHeight = Math.max(height, 1);
  const scale = Math.min(bounds.maxWidth / safeWidth, bounds.maxHeight / safeHeight);

  return {
    width: safeWidth * scale,
    height: safeHeight * scale,
  };
}

function getPickerPreviewMetrics(item: CreatedStickerLibraryItem, cardSize: number) {
  const fitted = fitPreviewWithinBounds(item.asset.width, item.asset.height, {
    maxWidth: item.renderMode === 'stamp' ? cardSize * 0.7 : cardSize * 0.78,
    maxHeight: item.renderMode === 'stamp' ? cardSize * 0.74 : cardSize * 0.78,
  });
  const stampMetrics =
    item.renderMode === 'stamp'
      ? getStampFrameMetrics(fitted.width, fitted.height, item.stampStyle ?? 'classic')
      : null;

  return {
    previewWidth: fitted.width,
    previewHeight: fitted.height,
    previewFrameWidth: stampMetrics?.outerWidth ?? fitted.width,
    previewFrameHeight: stampMetrics?.outerHeight ?? fitted.height,
  };
}

function StickerLibraryPickerCard({
  item,
  cardSize,
  onPress,
}: {
  item: CreatedStickerLibraryItem;
  cardSize: number;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const metrics = getPickerPreviewMetrics(item, cardSize);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        item.renderMode === 'stamp'
          ? t('capture.useSavedStampA11y', 'Use saved stamp')
          : t('capture.useSavedStickerA11y', 'Use saved sticker')
      }
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          width: cardSize,
          opacity: pressed ? 0.82 : 1,
        },
      ]}
      testID={`sticker-library-picker-item-${item.id}`}
    >
      <View style={styles.previewStage}>
        {item.asset.localUri ? (
          <View
            style={[
              styles.previewArtworkWrap,
              {
                width: metrics.previewFrameWidth,
                height: metrics.previewFrameHeight,
                shadowColor: colors.text,
              },
            ]}
          >
            <StickerLibraryPreview
              item={item}
              previewWidth={metrics.previewWidth}
              previewHeight={metrics.previewHeight}
              outlineScale={1.45}
              stampShadowEnabled
            />
          </View>
        ) : (
          <Ionicons name="image-outline" size={24} color={colors.secondaryText} />
        )}
      </View>
    </Pressable>
  );
}

export default function StickerLibraryPickerSheet({
  visible,
  title,
  subtitle,
  cancelLabel,
  sections,
  onSelectItem,
  onClose,
}: StickerLibraryPickerSheetProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const cardSize = Math.max(96, Math.min(124, Math.floor(width * 0.28)));

  if (!visible) {
    return null;
  }

  return (
    <AppSheet visible={visible} onClose={onClose}>
      <AppSheetScaffold
        headerVariant="standard"
        title={title}
        subtitle={subtitle}
        useHorizontalPadding={false}
        scrollable
        footer={(
          <View style={styles.footer}>
            <SheetFooterButton
              label={cancelLabel}
              onPress={onClose}
              testID="sticker-library-picker-cancel"
            />
          </View>
        )}
      >
        <View style={styles.sections}>
          {sections.map((section) => (
            <View key={section.key} style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {getSectionTitle(section.key, t)}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.sectionContent}
              >
                {section.items.map((item) => (
                  <StickerLibraryPickerCard
                    key={`${section.key}-${item.id}`}
                    item={item}
                    cardSize={cardSize}
                    onPress={() => onSelectItem(item)}
                  />
                ))}
              </ScrollView>
            </View>
          ))}
        </View>
      </AppSheetScaffold>
    </AppSheet>
  );
}

const styles = StyleSheet.create({
  sections: {
    gap: 22,
    paddingLeft: Sheet.android.horizontalPadding,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    ...Typography.pill,
    fontSize: 16,
    fontWeight: '800',
  },
  sectionContent: {
    gap: 12,
    paddingRight: Sheet.android.horizontalPadding,
  },
  card: {
    padding: 4,
  },
  previewStage: {
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewArtworkWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  footer: {
    marginTop: 16,
  },
});
