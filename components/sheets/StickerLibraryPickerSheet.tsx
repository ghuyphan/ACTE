import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  Image,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Sheet, Typography } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { useOptionalStickerPacks } from '../../hooks/useStickerPacks';
import StickerIcon from '../ui/StickerIcon';
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
  const router = useRouter();
  const stickerPacksContext = useOptionalStickerPacks();
  const installedPacks = stickerPacksContext?.installedPacks ?? [];

  const [activeIndex, setActiveIndex] = useState(0);
  const [pagerWidth, setPagerWidth] = useState(width);
  const tabBarScrollRef = useRef<ScrollView>(null);
  const pagerRef = useRef<ScrollView>(null);
  const cardSize = Math.max(88, Math.min(116, Math.floor(pagerWidth * 0.28)));

  useEffect(() => {
    if (visible) {
      setActiveIndex(0);
      pagerRef.current?.scrollTo({ x: 0, animated: false });
    }
  }, [visible]);

  useEffect(() => {
    const tabWidth = 56;
    const targetX = Math.max(0, activeIndex * tabWidth - 100);
    tabBarScrollRef.current?.scrollTo({ x: targetX, animated: true });
  }, [activeIndex]);

  if (!visible) {
    return null;
  }

  const pages = [
    { id: 'local', type: 'local' as const },
    ...installedPacks.map((pack) => ({ id: pack.id, type: 'pack' as const, pack })),
  ];

  const handleTabPress = (index: number) => {
    setActiveIndex(index);
    pagerRef.current?.scrollTo({ x: index * pagerWidth, animated: true });
  };

  const handleStorePress = () => {
    onClose();
    router.push('/sticker-packs' as any);
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffset / pagerWidth);
    if (index >= 0 && index < pages.length && index !== activeIndex) {
      setActiveIndex(index);
    }
  };

  return (
    <AppSheet visible={visible} onClose={onClose}>
      <AppSheetScaffold
        headerVariant="standard"
        title={title}
        subtitle={subtitle}
        useHorizontalPadding={false}
        scrollable={false}
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
        <View style={[styles.tabBarContainer, { borderBottomColor: colors.border }]}>
          <ScrollView
            ref={tabBarScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabBarContent}
          >
            {/* Local Custom Stickers Tab */}
            <Pressable
              onPress={() => handleTabPress(0)}
              style={[
                styles.tabItem,
                activeIndex === 0 && { backgroundColor: colors.primarySoft },
              ]}
              testID="sticker-picker-tab-local"
            >
              <StickerIcon
                size={20}
                color={activeIndex === 0 ? colors.primary : colors.secondaryText}
              />
            </Pressable>

            {/* Sticker Pack Tabs */}
            {installedPacks.map((pack, idx) => {
              const tabIndex = idx + 1;
              const isSelected = activeIndex === tabIndex;
              return (
                <Pressable
                  key={pack.id}
                  onPress={() => handleTabPress(tabIndex)}
                  style={[
                    styles.tabItem,
                    isSelected && { backgroundColor: colors.primarySoft },
                  ]}
                  testID={`sticker-picker-tab-${pack.id}`}
                >
                  {pack.thumbnail.localUri ? (
                    <Image
                      source={{ uri: pack.thumbnail.localUri }}
                      style={styles.tabThumbnail}
                    />
                  ) : (
                    <Ionicons
                      name="image-outline"
                      size={20}
                      color={isSelected ? colors.primary : colors.secondaryText}
                    />
                  )}
                </Pressable>
              );
            })}

            {/* Store Tab */}
            <Pressable
              onPress={handleStorePress}
              style={[
                styles.tabItem,
                styles.storeTabItem,
                { borderColor: colors.border },
              ]}
              testID="sticker-picker-tab-store"
            >
              <Ionicons
                name="storefront-outline"
                size={20}
                color={colors.primary}
              />
            </Pressable>
          </ScrollView>
        </View>

        <View
          style={styles.pagerViewport}
          onLayout={(event) => {
            const nextWidth = Math.max(1, event.nativeEvent.layout.width);
            if (nextWidth !== pagerWidth) {
              setPagerWidth(nextWidth);
              pagerRef.current?.scrollTo({
                x: activeIndex * nextWidth,
                animated: false,
              });
            }
          }}
        >
          <ScrollView
            ref={pagerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleScroll}
            style={[styles.pager, { width: pagerWidth }]}
            contentContainerStyle={{ width: pagerWidth * pages.length }}
          >
            {pages.map((page) => {
              if (page.type === 'local') {
                return (
                  <ScrollView
                    key="local-page"
                    style={{ width: pagerWidth, height: 320 }}
                    contentContainerStyle={styles.localPageContent}
                    showsVerticalScrollIndicator={false}
                  >
                    <View style={styles.sections}>
                      {sections.map((section) => (
                        <View key={section.key} style={styles.section}>
                          <Text style={[styles.sectionTitle, { color: colors.text }]}>
                            {getSectionTitle(section.key, t)}
                          </Text>
                          <FlashList
                            horizontal
                            data={section.items}
                            keyExtractor={(item) => `${section.key}-${item.id}`}
                            renderItem={({ item }) => (
                              <StickerLibraryPickerCard
                                item={item}
                                cardSize={cardSize}
                                onPress={() => onSelectItem(item)}
                              />
                            )}
                            style={{ height: cardSize + 8 }}
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.sectionContent}
                          />
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                );
              }

              const pack = page.pack!;
              return (
                <FlashList
                  key={pack.id}
                  data={pack.items}
                  keyExtractor={(packItem) => packItem.asset.id}
                  numColumns={3}
                  renderItem={({ item: packItem }) => {
                    const compatibleItem: CreatedStickerLibraryItem = {
                      id: packItem.asset.id,
                      asset: packItem.asset,
                      assetId: packItem.asset.id,
                      renderMode: 'default',
                      usageCount: 0,
                      lastUsedAt: packItem.asset.updatedAt ?? packItem.asset.createdAt,
                    };
                    return (
                      <View style={styles.packGridCell}>
                        <StickerLibraryPickerCard
                          item={compatibleItem}
                          cardSize={cardSize}
                          onPress={() => onSelectItem(compatibleItem)}
                        />
                      </View>
                    );
                  }}
                  style={{ width: pagerWidth, height: 320 }}
                  contentContainerStyle={styles.packPageContent}
                  showsVerticalScrollIndicator={false}
                />
              );
            })}
          </ScrollView>
        </View>
      </AppSheetScaffold>
    </AppSheet>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    marginBottom: 8,
  },
  tabBarContent: {
    paddingHorizontal: Sheet.android.horizontalPadding,
    gap: 8,
    alignItems: 'center',
  },
  tabItem: {
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
  },
  tabThumbnail: {
    width: 24,
    height: 24,
    borderRadius: 4,
  },
  storeTabItem: {
    borderWidth: 1,
    borderStyle: 'dashed',
    marginLeft: 4,
  },
  pager: {
    height: 320,
  },
  pagerViewport: {
    width: '100%',
    height: 320,
    overflow: 'hidden',
  },
  localPageContent: {
    paddingBottom: 24,
  },
  packPageContent: {
    paddingHorizontal: Sheet.android.horizontalPadding,
    paddingBottom: 24,
  },
  packGridCell: {
    alignItems: 'center',
    paddingBottom: 12,
  },
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
    marginTop: 8,
  },
});
