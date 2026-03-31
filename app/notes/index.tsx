import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Href, Stack, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Reanimated from 'react-native-reanimated';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Layout } from '../../constants/theme';
import { DOODLE_ARTBOARD_FRAME } from '../../constants/doodleLayout';
import { useAuth } from '../../hooks/useAuth';
import { useFeedFocus } from '../../hooks/useFeedFocus';
import { useNotesStore } from '../../hooks/useNotes';
import { useSharedFeedStore } from '../../hooks/useSharedFeed';
import { useTheme } from '../../hooks/useTheme';
import DynamicStickerCanvas from '../../components/DynamicStickerCanvas';
import NoteDoodleCanvas from '../../components/NoteDoodleCanvas';
import {
  getGradientStickerMotionVariant,
  getNoteColorStickerMotion,
  getTextNoteCardGradient,
  type StickerMotionVariant,
} from '../../services/noteAppearance';
import { parseNoteDoodleStrokes } from '../../services/noteDoodles';
import { parseNoteStickerPlacements } from '../../services/noteStickers';
import { getNotePhotoUri } from '../../services/photoStorage';
import { downloadPhotoFromStorage, SHARED_POST_MEDIA_BUCKET } from '../../services/remoteMedia';
import { Note } from '../../services/database';
import { SharedPost } from '../../services/sharedFeedService';

type NoteGridItem =
  | { id: string; kind: 'note'; createdAt: string; note: Note }
  | { id: string; kind: 'shared-post'; createdAt: string; post: SharedPost };

const GRID_DOODLE_STROKE_WIDTH = 4.5;
const GRID_STICKER_MIN_SIZE = 0;

const GridTile = memo(function GridTile({
  item,
  size,
  gap,
  colors,
  onPress,
  index,
  photoFallbackLabel,
}: {
  item: NoteGridItem;
  size: number;
  gap: number;
  colors: {
    card: string;
    border: string;
    primary: string;
    primarySoft: string;
  };
  onPress: () => void;
  index: number;
  photoFallbackLabel: string;
}) {
  const [sharedPhotoUri, setSharedPhotoUri] = useState(
    item.kind === 'shared-post' ? item.post.photoLocalUri ?? null : null
  );

  useEffect(() => {
    if (item.kind !== 'shared-post') {
      setSharedPhotoUri(null);
      return;
    }

    setSharedPhotoUri(item.post.photoLocalUri ?? null);
  }, [item]);

  useEffect(() => {
    if (item.kind !== 'shared-post' || item.post.type !== 'photo' || sharedPhotoUri || !item.post.photoPath) {
      return;
    }

    let cancelled = false;

    void downloadPhotoFromStorage(
      SHARED_POST_MEDIA_BUCKET,
      item.post.photoPath,
      `shared-grid-${item.post.id}`
    )
      .then((nextUri) => {
        if (!cancelled && nextUri) {
          setSharedPhotoUri(nextUri);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn('[notes-grid] Failed to hydrate shared photo:', error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [item, sharedPhotoUri]);

  const imageUri =
    item.kind === 'note'
      ? getNotePhotoUri(item.note)
      : item.post.type === 'photo'
        ? sharedPhotoUri ?? ''
        : '';
  const isPhotoTile = (item.kind === 'note' ? item.note.type : item.post.type) === 'photo';
  const doodleStrokesJson =
    item.kind === 'note'
      ? item.note.doodleStrokesJson
      : item.post.doodleStrokesJson ?? null;
  const doodleStrokes = useMemo(
    () => parseNoteDoodleStrokes(doodleStrokesJson),
    [doodleStrokesJson]
  );
  const stickerPlacementsJson =
    item.kind === 'note'
      ? item.note.stickerPlacementsJson ?? null
      : item.post.stickerPlacementsJson ?? null;
  const stickerPlacements = useMemo(
    () => parseNoteStickerPlacements(stickerPlacementsJson),
    [stickerPlacementsJson]
  );
  const text =
    item.kind === 'note'
      ? item.note.content.trim()
      : (item.post.text || '').trim();
  const textGradient = useMemo(
    () =>
      getTextNoteCardGradient({
        text,
        noteId: item.kind === 'note' ? item.note.id : item.post.id,
        emoji: item.kind === 'note' ? item.note.moodEmoji : null,
        noteColor: item.kind === 'note' ? item.note.noteColor : item.post.noteColor,
      }),
    [item, text]
  );
  const stickerMotionVariant = useMemo<StickerMotionVariant>(() => {
    if (isPhotoTile) {
      return 'physics';
    }

    const noteColor = item.kind === 'note' ? item.note.noteColor : item.post.noteColor;
    return getNoteColorStickerMotion(noteColor) ?? getGradientStickerMotionVariant(textGradient);
  }, [isPhotoTile, item, textGradient]);
  const tileText = text || (isPhotoTile ? photoFallbackLabel : '');
  const showPhotoPlaceholder = item.kind === 'shared-post' && item.post.type === 'photo' && !imageUri;
  const sharedTransitionTag = item.kind === 'note' ? `feed-note-card-${item.note.id}` : undefined;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.tilePressable,
        {
          width: size,
          height: size,
          marginRight: index % 3 === 2 ? 0 : gap,
          marginBottom: gap,
        },
      ]}
    >
      <Reanimated.View
        sharedTransitionTag={sharedTransitionTag}
        style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        {imageUri ? (
          <View style={styles.tileMediaWrap}>
            <Image
              source={{ uri: imageUri }}
              style={styles.tileImage}
              contentFit="cover"
              transition={120}
            />
            {stickerPlacements.length > 0 ? (
              <View pointerEvents="none" style={styles.tileDoodleOverlay}>
                <DynamicStickerCanvas
                  placements={stickerPlacements}
                  remoteBucket={item.kind === 'shared-post' ? SHARED_POST_MEDIA_BUCKET : undefined}
                  sharedCache={item.kind === 'shared-post'}
                  minimumBaseSize={GRID_STICKER_MIN_SIZE}
                  motionVariant={stickerMotionVariant}
                />
              </View>
            ) : null}
            {doodleStrokes.length > 0 ? (
              <View pointerEvents="none" style={styles.tileDoodleOverlay}>
                <NoteDoodleCanvas strokes={doodleStrokes} strokeWidth={GRID_DOODLE_STROKE_WIDTH} />
              </View>
            ) : null}
          </View>
        ) : showPhotoPlaceholder ? (
          <View
            testID="shared-photo-grid-placeholder"
            style={[
              styles.photoPlaceholder,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.photoPlaceholderBadge,
                {
                  backgroundColor: colors.primarySoft,
                },
              ]}
            >
              <Text style={[styles.photoPlaceholderIcon, { color: colors.primary }]}>+</Text>
            </View>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : (
          <LinearGradient colors={textGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tileTextFill}>
            {stickerPlacements.length > 0 ? (
              <View pointerEvents="none" style={[styles.tileDoodleOverlay, styles.tileTextStickerOverlay]}>
                <DynamicStickerCanvas
                  placements={stickerPlacements}
                  remoteBucket={item.kind === 'shared-post' ? SHARED_POST_MEDIA_BUCKET : undefined}
                  sharedCache={item.kind === 'shared-post'}
                  minimumBaseSize={GRID_STICKER_MIN_SIZE}
                  motionVariant={stickerMotionVariant}
                />
              </View>
            ) : null}
            {doodleStrokes.length > 0 ? (
              <View pointerEvents="none" style={[styles.tileDoodleOverlay, styles.tileTextDoodleOverlay]}>
                <NoteDoodleCanvas strokes={doodleStrokes} strokeWidth={GRID_DOODLE_STROKE_WIDTH} />
              </View>
            ) : null}
            {tileText ? (
              <Text style={styles.tileText} numberOfLines={4}>
                {tileText}
              </Text>
            ) : null}
          </LinearGradient>
        )}
      </Reanimated.View>
    </Pressable>
  );
}, (prevProps, nextProps) => (
  prevProps.index === nextProps.index &&
  prevProps.size === nextProps.size &&
  prevProps.gap === nextProps.gap &&
  prevProps.colors === nextProps.colors &&
  prevProps.photoFallbackLabel === nextProps.photoFallbackLabel &&
  prevProps.item.id === nextProps.item.id &&
  prevProps.item.kind === nextProps.item.kind &&
  prevProps.item.createdAt === nextProps.item.createdAt &&
  (prevProps.item.kind === 'note' && nextProps.item.kind === 'note'
    ? prevProps.item.note === nextProps.item.note
    : prevProps.item.kind === 'shared-post' && nextProps.item.kind === 'shared-post'
      ? prevProps.item.post === nextProps.item.post
      : false)
));

export default function NotesIndexScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { requestFeedFocus } = useFeedFocus();
  const { notes, loading } = useNotesStore();
  const { sharedPosts, loading: sharedLoading } = useSharedFeedStore();

  const friendPosts = useMemo(
    () => sharedPosts.filter((post) => post.authorUid !== user?.uid),
    [sharedPosts, user?.uid]
  );
  const items = useMemo<NoteGridItem[]>(
    () =>
      [
        ...notes.map((note) => ({
          id: `note-${note.id}`,
          kind: 'note' as const,
          createdAt: note.createdAt,
          note,
        })),
        ...friendPosts.map((post) => ({
          id: `shared-${post.id}`,
          kind: 'shared-post' as const,
          createdAt: post.createdAt,
          post,
        })),
      ].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [friendPosts, notes]
  );

  const gridGap = 8;
  const gridSize = Math.floor((width - Layout.screenPadding * 2 - gridGap * 2) / 3);
  const contentTopInset = insets.top + 72;
  const isLoading = loading || (sharedLoading && items.length === 0);

  const openItem = useCallback(
    (item: NoteGridItem) => {
      if (item.kind === 'note') {
        requestFeedFocus({ kind: 'note', id: item.note.id });
        router.replace('/' as Href);
        return;
      }

      requestFeedFocus({ kind: 'shared-post', id: item.post.id });
      router.replace('/' as Href);
    },
    [requestFeedFocus, router]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerShadowVisible: false,
          title: t('notes.viewAllTitle', 'All notes'),
          headerBackTitle: t('tabs.home', 'Home'),
          headerTintColor: colors.text,
          headerBackButtonDisplayMode: 'minimal',
          headerBackButtonMenuEnabled: false,
        }}
      />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <View
          testID="notes-empty-state"
          style={[
            styles.center,
            styles.emptyScreen,
            {
              paddingTop: contentTopInset,
              paddingBottom: insets.bottom + 28,
            },
          ]}
        >
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="document-text-outline" size={44} color={colors.secondaryText} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {t('home.emptyTitle', 'No notes yet')}
            </Text>
            <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>
              {t('home.emptySubtitle', 'Write down what she likes or dislikes\nat each restaurant — we\'ll remind you!')}
            </Text>
          </View>
        </View>
      ) : (
        <FlashList
          data={items}
          keyExtractor={(item) => item.id}
          getItemType={(item) => `${item.kind}:${item.kind === 'note' ? item.note.type : item.post.type}`}
          drawDistance={gridSize * 4}
          renderItem={({ item, index }) => (
            <GridTile
              item={item}
              index={index}
              size={gridSize}
              gap={gridGap}
              colors={colors}
              photoFallbackLabel={t('shared.photoMemory', 'Photo memory')}
              onPress={() => openItem(item)}
            />
          )}
          numColumns={3}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: contentTopInset,
            paddingBottom: insets.bottom + 28,
            paddingHorizontal: Layout.screenPadding,
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyScreen: {
    paddingHorizontal: Layout.screenPadding,
  },
  tilePressable: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  tile: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
  tileMediaWrap: {
    flex: 1,
  },
  tileDoodleOverlay: {
    position: 'absolute',
    ...DOODLE_ARTBOARD_FRAME,
  },
  tileTextDoodleOverlay: {
    opacity: 0.48,
  },
  tileTextStickerOverlay: {
    opacity: 0.48,
    zIndex: 0,
  },
  photoPlaceholder: {
    flex: 1,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  photoPlaceholderBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderIcon: {
    fontSize: 20,
    lineHeight: 20,
    fontWeight: '700',
  },
  tileTextFill: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileText: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: 'System',
    zIndex: 1,
  },
  emptyState: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
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
    fontFamily: 'System',
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    fontFamily: 'System',
    marginTop: 8,
    maxWidth: 240,
  },
});
