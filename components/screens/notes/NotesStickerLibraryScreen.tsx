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
import { Layout } from '../../../constants/theme';
import { useNotesStore } from '../../../hooks/useNotes';
import { useTheme } from '../../../hooks/useTheme';
import type { Note } from '../../../services/database';
import StampStickerArtwork from '../../notes/StampStickerArtwork';
import {
  getStickerOutlineOffsets,
  getStickerOutlineSize,
} from '../../notes/stickerCanvasMetrics';
import { getStampFrameMetrics } from '../../notes/stampFrameMetrics';
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

type CollectionAlignment = 'flex-start' | 'center' | 'flex-end';

interface CollectionPose {
  align: CollectionAlignment;
  badgeAlign: CollectionAlignment;
  scale: number;
  translateY: number;
}

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

function getCollectionPose(item: CreatedStickerLibraryItem, itemIndex: number): CollectionPose {
  const seed =
    item.id.split('').reduce((total, character) => total + character.charCodeAt(0), 0) + itemIndex * 17;

  const poses: CollectionPose[] =
    item.renderMode === 'stamp'
      ? [
          { align: 'flex-start', badgeAlign: 'center', scale: 0.92, translateY: 5 },
          { align: 'center', badgeAlign: 'flex-start', scale: 1.04, translateY: -2 },
          { align: 'flex-end', badgeAlign: 'flex-end', scale: 0.96, translateY: 7 },
          { align: 'center', badgeAlign: 'flex-end', scale: 1.08, translateY: 1 },
        ]
      : [
          { align: 'flex-start', badgeAlign: 'flex-start', scale: 1.06, translateY: 6 },
          { align: 'center', badgeAlign: 'flex-end', scale: 0.9, translateY: -3 },
          { align: 'flex-end', badgeAlign: 'center', scale: 1, translateY: 8 },
          { align: 'center', badgeAlign: 'flex-start', scale: 0.96, translateY: 2 },
          { align: 'flex-start', badgeAlign: 'flex-end', scale: 1.1, translateY: 4 },
        ];

  return poses[seed % poses.length] ?? poses[0];
}

function getPreviewMetrics(item: CreatedStickerLibraryItem, cardWidth: number, pose: CollectionPose) {
  const fitted = fitPreviewWithinBounds(item.asset.width, item.asset.height, {
    maxWidth:
      (item.renderMode === 'stamp' ? cardWidth * 0.64 : cardWidth * 0.72) * pose.scale,
    maxHeight:
      (item.renderMode === 'stamp' ? cardWidth * 0.72 : cardWidth * 0.72) * pose.scale,
  });
  const stampMetrics =
    item.renderMode === 'stamp' ? getStampFrameMetrics(fitted.width, fitted.height) : null;
  const previewFrameWidth = stampMetrics?.outerWidth ?? fitted.width;
  const previewFrameHeight = stampMetrics?.outerHeight ?? fitted.height;

  return {
    previewWidth: fitted.width,
    previewHeight: fitted.height,
    previewFrameWidth,
    previewFrameHeight,
    frameHeight:
      item.renderMode === 'stamp'
        ? Math.max(cardWidth * 0.92, previewFrameHeight + 28)
        : Math.max(cardWidth * 0.88, previewFrameHeight + 26),
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

export function NotesStickerLibraryContent({
  notes,
  bottomInset,
}: {
  notes: readonly Note[];
  bottomInset?: number;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const resolvedBottomInset = bottomInset ?? insets.bottom;
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

      const pose = getCollectionPose(item.item, item.itemIndex);
      const { frameHeight, previewFrameWidth, previewFrameHeight, previewWidth, previewHeight, rotation } = getPreviewMetrics(
        item.item,
        cardWidth,
        pose
      );

      return (
        <View style={[styles.cardCell, { paddingHorizontal: gridGap / 2, marginBottom: gridGap + 8 }]}>
          <View style={styles.card}>
            <View
              style={[
                styles.previewWrap,
                {
                  height: frameHeight,
                  width: '100%',
                  alignItems: pose.align,
                  transform: [
                    {
                      rotate: rotation,
                    },
                  ],
                },
              ]}
            >
              <View
                style={[
                  styles.previewArtworkWrap,
                  {
                    width: previewFrameWidth,
                    height: previewFrameHeight,
                    transform: [{ translateY: pose.translateY }],
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
            </View>
            <View
              style={[
                styles.usageChip,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  alignSelf: pose.badgeAlign,
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
      testID="notes-collection-mode"
      data={listData}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      getItemType={getItemType}
      overrideItemLayout={overrideItemLayout as any}
      numColumns={3}
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingHorizontal: Layout.screenPadding,
        paddingTop: 12,
        paddingBottom: resolvedBottomInset + 28,
      }}
      showsVerticalScrollIndicator={false}
    />
  ) : (
    <View
      testID="notes-collection-mode"
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View
        testID="notes-collection-empty-state"
        style={[
          styles.emptyStateScreen,
          styles.emptyScreen,
          {
            paddingBottom: resolvedBottomInset + 28,
          },
        ]}
      >
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="sparkles-outline" size={44} color={colors.secondaryText} />
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
    </View>
  );
}

export default function NotesStickerLibraryScreen() {
  const { notes } = useNotesStore();
  return <NotesStickerLibraryContent notes={notes} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyScreen: {
    flex: 1,
    paddingHorizontal: Layout.screenPadding,
    justifyContent: 'center',
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
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  previewArtworkWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
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
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyStateScreen: {
    flex: 1,
  },
  emptyIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    fontFamily: 'Noto Sans',
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    fontFamily: 'Noto Sans',
    marginTop: 8,
    maxWidth: 240,
  },
});
