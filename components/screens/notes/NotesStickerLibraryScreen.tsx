import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Layout, Radii, Spacing, Typography } from '../../../constants/theme';
import { useNotesStore } from '../../../hooks/useNotes';
import { useTheme } from '../../../hooks/useTheme';
import StampStickerArtwork from '../../notes/StampStickerArtwork';
import {
  getStickerOutlineOffsets,
  getStickerOutlineSize,
} from '../../notes/stickerCanvasMetrics';
import {
  buildCreatedStickerLibrary,
  groupCreatedStickerLibrary,
  type CreatedStickerLibraryItem,
  type CreatedStickerLibrarySectionKey,
} from './stickerLibrary';

type StickerLibraryListItem =
  | {
      id: string;
      kind: 'section-header';
      sectionKey: CreatedStickerLibrarySectionKey;
      title: string;
    }
  | {
      id: string;
      kind: 'sticker';
      item: CreatedStickerLibraryItem;
      itemIndex: number;
    };

function fitPreviewWithinBounds(
  width: number,
  height: number,
  bounds: { maxWidth: number; maxHeight: number }
) {
  const safeWidth = Math.max(width, 1);
  const safeHeight = Math.max(height, 1);
  const widthScale = bounds.maxWidth / safeWidth;
  const heightScale = bounds.maxHeight / safeHeight;
  const scale = Math.min(widthScale, heightScale);

  return {
    width: safeWidth * scale,
    height: safeHeight * scale,
  };
}

function getCollectionTilt(item: CreatedStickerLibraryItem) {
  const seed = item.id.split('').reduce((total, character) => total + character.charCodeAt(0), 0);
  const tiltSteps = [-4, -3, -2, -1, 1, 2, 3, 4];

  return `${tiltSteps[seed % tiltSteps.length]}deg`;
}

function getPreviewMetrics(item: CreatedStickerLibraryItem, cardWidth: number) {
  const fitted = fitPreviewWithinBounds(item.asset.width, item.asset.height, {
    maxWidth: item.renderMode === 'stamp' ? cardWidth * 0.9 : cardWidth * 0.78,
    maxHeight: item.renderMode === 'stamp' ? cardWidth * 1.02 : cardWidth * 0.78,
  });

  return {
    previewWidth: fitted.width,
    previewHeight: fitted.height,
    frameHeight:
      item.renderMode === 'stamp'
        ? Math.max(cardWidth * 0.9, Math.min(cardWidth * 1.12, fitted.height + 18))
        : Math.max(cardWidth * 0.9, fitted.height + 22),
    rotation: getCollectionTilt(item),
  };
}

function StickerPreview({
  item,
  previewWidth,
  previewHeight,
  fallbackColor,
}: {
  item: CreatedStickerLibraryItem;
  previewWidth: number;
  previewHeight: number;
  fallbackColor: string;
}) {
  if (!item.asset.localUri) {
    return <Ionicons name="image-outline" size={28} color={fallbackColor} />;
  }

  if (item.renderMode === 'stamp') {
    return (
      <StampStickerArtwork
        localUri={item.asset.localUri}
        width={previewWidth}
        height={previewHeight}
        shadowEnabled={false}
      />
    );
  }

  const outlineSize = getStickerOutlineSize(previewWidth, previewHeight);
  const outlineOffsets = getStickerOutlineOffsets(outlineSize);

  return (
    <View style={[styles.stickerPreviewCanvas, { width: previewWidth, height: previewHeight }]}>
      {outlineOffsets.map((offset, index) => (
        <ExpoImage
          key={`${item.id}-outline-${index}`}
          source={{ uri: item.asset.localUri }}
          style={[
            styles.stickerPreviewImage,
            styles.stickerPreviewOutline,
            {
              transform: [
                { translateX: offset.x * outlineSize },
                { translateY: offset.y * outlineSize },
              ],
            },
          ]}
          contentFit="contain"
          transition={0}
        />
      ))}
      <ExpoImage
        source={{ uri: item.asset.localUri }}
        style={styles.stickerPreviewImage}
        contentFit="contain"
        transition={120}
      />
    </View>
  );
}

export default function NotesStickerLibraryScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { notes } = useNotesStore();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const items = useMemo(() => buildCreatedStickerLibrary(notes), [notes]);
  const sections = useMemo(() => groupCreatedStickerLibrary(items), [items]);
  const gridGap = 12;
  const cardWidth = Math.max(
    96,
    Math.floor((width - Layout.screenPadding * 2 - gridGap * 2) / 3)
  );
  const listData = useMemo<StickerLibraryListItem[]>(
    () =>
      sections.flatMap((section) => [
        {
          id: `section-${section.key}`,
          kind: 'section-header' as const,
          sectionKey: section.key,
          title: t(`notes.stickerLibrary.section.${section.key}`, section.key),
        },
        ...section.items.map((item, itemIndex) => ({
          id: item.id,
          kind: 'sticker' as const,
          item,
          itemIndex,
        })),
      ]),
    [sections, t]
  );
  const getItemType = useCallback(
    (item: StickerLibraryListItem) => item.kind,
    []
  );
  const overrideItemLayout = useCallback((layout: { span?: number }, item: StickerLibraryListItem) => {
    layout.span = item.kind === 'section-header' ? 3 : 1;
  }, []);
  const renderItem = useCallback(
    ({ item }: { item: StickerLibraryListItem }) => {
      if (item.kind === 'section-header') {
        return (
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {item.title}
            </Text>
          </View>
        );
      }

      const { frameHeight, previewWidth, previewHeight, rotation } = getPreviewMetrics(
        item.item,
        cardWidth
      );

      return (
        <View style={[styles.cardCell, { paddingHorizontal: gridGap / 2, marginBottom: gridGap + 8 }]}>
          <View style={styles.card}>
            <View
              style={[
                styles.previewWrap,
                {
                  height: frameHeight,
                  backgroundColor:
                    item.item.renderMode === 'stamp' ? 'transparent' : colors.surface,
                  borderColor:
                    item.item.renderMode === 'stamp' ? 'transparent' : colors.border,
                  transform: [
                    {
                      rotate: rotation,
                    },
                  ],
                },
              ]}
            >
              <StickerPreview
                item={item.item}
                previewWidth={previewWidth}
                previewHeight={previewHeight}
                fallbackColor={colors.secondaryText}
              />
            </View>
            <View
              style={[
                styles.usageChip,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.usageChipText, { color: colors.text }]}>
                {item.item.usageCount}x
              </Text>
            </View>
          </View>
        </View>
      );
    },
    [cardWidth, colors.border, colors.secondaryText, colors.surface, colors.text, gridGap]
  );

  return items.length > 0 ? (
    <FlashList
      data={listData}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      getItemType={getItemType}
      overrideItemLayout={overrideItemLayout as any}
      numColumns={3}
      estimatedItemSize={cardWidth + 28}
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingHorizontal: Layout.screenPadding,
        paddingTop: 12,
        paddingBottom: insets.bottom + 28,
      }}
      showsVerticalScrollIndicator={false}
    />
  ) : (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View
        style={[
          styles.emptyState,
          styles.emptyStateScreen,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            marginHorizontal: Layout.screenPadding,
            marginTop: 12,
            marginBottom: insets.bottom + 28,
          },
        ]}
      >
        <View
          style={[
            styles.emptyIconWrap,
            {
              backgroundColor: colors.primarySoft,
            },
          ]}
        >
          <Ionicons name="sparkles-outline" size={24} color={colors.primary} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          {t('notes.stickerLibrary.emptyTitle', 'No stamps yet')}
        </Text>
        <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>
          {t(
            'notes.stickerLibrary.emptyBody',
            'Create a sticker or stamp in a note and it will start filling this shelf.'
          )}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionHeaderRow: {
    width: '100%',
    paddingTop: 2,
    paddingBottom: 14,
  },
  sectionTitle: {
    fontFamily: 'Noto Sans',
    fontSize: 18,
    fontWeight: '800',
  },
  cardCell: {
    width: '100%',
  },
  card: {
    position: 'relative',
    width: '100%',
  },
  previewWrap: {
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    padding: 8,
  },
  stickerPreviewCanvas: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  stickerPreviewImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  stickerPreviewOutline: {
    tintColor: '#FFFFFF',
    opacity: 0.98,
  },
  usageChip: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    minWidth: 34,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  usageChipText: {
    fontFamily: 'Noto Sans',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radii.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
    marginTop: 4,
  },
  emptyStateScreen: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    ...Typography.screenTitle,
    fontSize: 20,
  },
  emptyBody: {
    ...Typography.body,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 240,
  },
});
