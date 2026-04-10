import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView,
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
import { buildCreatedStickerLibrary } from './stickerLibrary';

function StickerPreview({
  localUri,
  previewSize,
  renderMode,
  fallbackColor,
}: {
  localUri: string;
  previewSize: number;
  renderMode: 'default' | 'stamp';
  fallbackColor: string;
}) {
  if (!localUri) {
    return <Ionicons name="image-outline" size={28} color={fallbackColor} />;
  }

  if (renderMode === 'stamp') {
    return (
      <StampStickerArtwork
        localUri={localUri}
        width={previewSize * 0.7}
        height={previewSize * 0.82}
        shadowEnabled={false}
      />
    );
  }

  return (
    <ExpoImage
      source={{ uri: localUri }}
      style={styles.previewImage}
      contentFit="contain"
      transition={120}
    />
  );
}

export default function NotesStickerLibraryScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { notes } = useNotesStore();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const items = useMemo(() => buildCreatedStickerLibrary(notes), [notes]);
  const gridGap = 12;
  const cardSize = Math.max(
    96,
    Math.floor((width - Layout.screenPadding * 2 - gridGap * 2) / 3)
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingHorizontal: Layout.screenPadding,
        paddingTop: 18,
        paddingBottom: insets.bottom + 28,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={[
          styles.heroCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <View
          style={[
            styles.countChip,
            {
              backgroundColor: colors.primarySoft,
              borderColor: colors.border,
            },
          ]}
        >
          <Ionicons name="sparkles-outline" size={14} color={colors.primary} />
          <Text style={[styles.countChipText, { color: colors.primary }]}>
            {t('notes.stickerLibrary.savedCount', {
              count: items.length,
              defaultValue: '{{count}} saved',
            })}
          </Text>
        </View>
        <Text style={[styles.heroTitle, { color: colors.text }]}>
          {t('notes.stickerLibrary.title', 'Your stickers & stamps')}
        </Text>
        <Text style={[styles.heroBody, { color: colors.secondaryText }]}>
          {t(
            'notes.stickerLibrary.subtitle',
            'Tiny cutouts and stamp-style pieces you already made for your notes.'
          )}
        </Text>
      </View>

      {items.length > 0 ? (
        <View style={styles.grid}>
          {items.map((item, index) => (
            <View
              key={item.id}
              style={[
                styles.card,
                {
                  width: cardSize,
                  marginRight: index % 3 === 2 ? 0 : gridGap,
                  marginBottom: gridGap,
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.previewWrap,
                  {
                    backgroundColor: colors.card,
                  },
                ]}
              >
                <StickerPreview
                  localUri={item.asset.localUri}
                  previewSize={cardSize}
                  renderMode={item.renderMode}
                  fallbackColor={colors.secondaryText}
                />
              </View>
              <View style={styles.cardMeta}>
                <Text numberOfLines={1} style={[styles.cardLabel, { color: colors.text }]}>
                  {item.renderMode === 'stamp'
                    ? t('notes.stickerLibrary.stampLabel', 'Stamp')
                    : t('notes.stickerLibrary.stickerLabel', 'Sticker')}
                </Text>
                <Text numberOfLines={1} style={[styles.cardUsage, { color: colors.secondaryText }]}>
                  {t('notes.stickerLibrary.usedCount', {
                    count: item.usageCount,
                    defaultValue_one: 'Used {{count}} time',
                    defaultValue_other: 'Used {{count}} times',
                  })}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View
          style={[
            styles.emptyState,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
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
            {t('notes.stickerLibrary.emptyTitle', 'No stickers yet')}
          </Text>
          <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>
            {t(
              'notes.stickerLibrary.emptyBody',
              'Create a sticker or stamp in a note and it will show up here.'
            )}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroCard: {
    borderRadius: Radii.lg,
    borderWidth: 1,
    padding: 18,
    marginBottom: 18,
  },
  countChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radii.pill,
    borderWidth: 1,
    marginBottom: 14,
  },
  countChipText: {
    ...Typography.pill,
    fontSize: 13,
  },
  heroTitle: {
    ...Typography.screenTitle,
    marginBottom: 6,
  },
  heroBody: {
    ...Typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  card: {
    borderRadius: Radii.lg,
    borderWidth: 1,
    padding: 10,
  },
  previewWrap: {
    height: 96,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  previewImage: {
    width: '76%',
    height: '76%',
  },
  cardMeta: {
    marginTop: 10,
    gap: 2,
  },
  cardLabel: {
    fontFamily: 'Noto Sans',
    fontSize: 14,
    fontWeight: '700',
  },
  cardUsage: {
    fontFamily: 'Noto Sans',
    fontSize: 12,
    lineHeight: 16,
  },
  emptyState: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radii.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
    marginTop: 4,
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
