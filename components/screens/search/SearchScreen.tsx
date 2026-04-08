import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useDeferredValue, useEffect, useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Layout, Shadows } from '../../../constants/theme';
import { useAndroidBottomTabOverlayInset } from '../../../hooks/useAndroidBottomTabOverlayInset';
import { useAndroidTabSearchQuery } from '../../../hooks/useAndroidTabSearchState';
import { CardGradients, useTheme } from '../../../hooks/useTheme';
import { useNotesStore } from '../../../hooks/useNotes';
import { Note } from '../../../services/database';
import { getNotePhotoUri } from '../../../services/photoStorage';
import { formatNoteTextWithEmoji } from '../../../services/noteTextPresentation';
import { formatDate } from '../../../utils/dateUtils';

function hashToIndex(str: string, max: number): number {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) % max;
  }
  return Math.abs(hash) % max;
}

function getPreviewText(note: Note, photoLabel: string, emptyLabel: string) {
  if (note.type === 'photo') {
    const caption = note.caption?.trim();
    return caption?.length ? caption : photoLabel;
  }

  const normalized = note.content.trim();
  if (!normalized) {
    return emptyLabel;
  }
  return formatNoteTextWithEmoji(normalized, note.moodEmoji);
}

export default function SearchScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomTabOverlayInset = useAndroidBottomTabOverlayInset();
  const androidTabSearchQuery = useAndroidTabSearchQuery();
  const { notes, loading, searchNotes } = useNotesStore();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [filteredNotes, setFilteredNotes] = useState<Note[]>([]);
  const [, startSearchTransition] = useTransition();
  const activeQuery = Platform.OS === 'android' ? androidTabSearchQuery : query;
  const deferredQuery = useDeferredValue(activeQuery);
  const hasQuery = activeQuery.trim().length > 0;
  const hasDeferredQuery = deferredQuery.trim().length > 0;

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    setQuery(androidTabSearchQuery);
  }, [androidTabSearchQuery]);

  useEffect(() => {
    if (!hasDeferredQuery) {
      setFilteredNotes([]);
      return;
    }

    let cancelled = false;

    void searchNotes(deferredQuery)
      .then((results) => {
        if (!cancelled) {
          setFilteredNotes(results);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn('Search query failed:', error);
          setFilteredNotes([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [deferredQuery, hasDeferredQuery, notes, searchNotes]);

  const shouldShowEmptyState = filteredNotes.length === 0;

  const openNote = useCallback(
    (noteId: string) => {
      Keyboard.dismiss();
      router.push(`/note/${noteId}` as any);
    },
    [router]
  );

  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  const handleSearchChange = useCallback((nextQuery: string) => {
    startSearchTransition(() => {
      setQuery(nextQuery);
    });
  }, [startSearchTransition]);

  const renderNote = useCallback(
    ({ item }: { item: Note }) => {
      const previewText = getPreviewText(
        item,
        t('map.photoNote', 'Photo Note'),
        t('map.noContent', 'No note content')
      );
      const previewGradient = CardGradients[hashToIndex(item.id, CardGradients.length)];
      const createdAt = formatDate(item.createdAt, 'short');

      return (
        <Pressable
          style={styles.resultPress}
          onPress={() => openNote(item.id)}
        >
          <View
            style={[
              styles.resultCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.resultTopRow}>
              <View style={styles.previewFrame}>
                {item.type === 'photo' ? (
                  <Image
                    source={{ uri: getNotePhotoUri(item) }}
                    style={[
                      styles.previewFrame,
                      {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                      },
                    ]}
                    contentFit="cover"
                    transition={140}
                  />
                ) : (
                  <LinearGradient
                    colors={previewGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.previewFrame}
                  >
                    <Text style={styles.previewText} numberOfLines={3}>
                      {previewText}
                    </Text>
                  </LinearGradient>
                )}

                {item.isFavorite ? (
                  <View style={styles.favoriteBadge}>
                    <Ionicons name="heart" size={13} color={colors.danger} />
                  </View>
                ) : null}
              </View>

              <View style={styles.resultCopy}>
                <Text style={[styles.locationText, { color: colors.text }]} numberOfLines={1}>
                  {item.locationName ?? t('home.unknownLocation', 'Unknown location')}
                </Text>
                <Text style={[styles.contentText, { color: colors.secondaryText }]} numberOfLines={3}>
                  {previewText}
                </Text>
              </View>
            </View>

            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={13} color={colors.secondaryText} />
              <Text style={[styles.metaText, { color: colors.secondaryText }]}>{createdAt}</Text>
              <View style={[styles.metaDot, { backgroundColor: colors.secondaryText }]} />
              <Ionicons
                name={item.type === 'photo' ? 'image-outline' : 'document-text-outline'}
                size={13}
                color={colors.secondaryText}
              />
              <Text style={[styles.metaText, { color: colors.secondaryText }]}>
                {item.type === 'photo' ? t('map.photoNote', 'Photo Note') : t('map.filterText', 'Text')}
              </Text>
            </View>
          </View>
        </Pressable>
      );
    },
    [colors.border, colors.danger, colors.secondaryText, colors.surface, colors.text, isDark, openNote, t]
  );

  const renderSeparator = useCallback(() => <View style={styles.resultSeparator} />, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: Platform.OS !== 'android',
          title: '',
          headerShadowVisible: false,
          headerTransparent: true,
        }}
      />
      {Platform.OS === 'ios' ? (
        <Stack.SearchBar
          hideWhenScrolling={false}
          placeholder={t('home.searchPlaceholder', 'Search notes...')}
          onChangeText={(event) => handleSearchChange(event.nativeEvent.text)}
        />
      ) : null}

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : shouldShowEmptyState ? (
        <Pressable
          onPress={dismissKeyboard}
          style={[
            styles.centerWrap,
            styles.emptyScreen,
            {
              paddingTop: Platform.OS === 'android' ? insets.top + Layout.screenPadding : insets.top + 10,
              paddingBottom: insets.bottom + 20 + bottomTabOverlayInset,
            },
          ]}
        >
          <View pointerEvents="none" style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons
                name="search-outline"
                size={Platform.OS === 'ios' ? 54 : 30}
                color={colors.secondaryText}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {hasQuery
                ? t('home.noResults', 'No notes found')
                : t('home.searchPlaceholder', 'Search notes...')}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.secondaryText }]}>
              {hasQuery
                ? t('home.noResultsMsg', 'Try a different keyword')
                : t('home.count', '{{count}} notes saved', { count: notes.length })}
            </Text>
          </View>
        </Pressable>
      ) : (
        <FlashList
          data={filteredNotes}
          keyExtractor={(item) => item.id}
          getItemType={(item) => item.type}
          drawDistance={440}
          renderItem={renderNote}
          ItemSeparatorComponent={renderSeparator}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          automaticallyAdjustsScrollIndicatorInsets={false}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          contentContainerStyle={[
            styles.listContent,
            {
              paddingTop: Platform.OS === 'android' ? insets.top + Layout.screenPadding : insets.top + 10,
              paddingBottom: insets.bottom + 20 + bottomTabOverlayInset,
            },
          ]}
          onScrollBeginDrag={dismissKeyboard}
          onTouchStart={dismissKeyboard}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingTop: 16,
    paddingHorizontal: Layout.screenPadding,
  },
  resultPress: {
    width: '100%',
  },
  resultCard: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    ...Shadows.floating,
  },
  resultSeparator: {
    height: 14,
  },
  resultTopRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  previewFrame: {
    width: 84,
    height: 84,
    borderRadius: 18,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    paddingHorizontal: 8,
    textAlign: 'center',
    fontFamily: 'Noto Sans',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  resultCopy: {
    flex: 1,
    gap: 4,
  },
  locationText: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
  },
  contentText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Noto Sans',
  },
  metaRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 2,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'Noto Sans',
  },
  metaDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    opacity: 0.5,
  },
  favoriteBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emptyScreen: {
    paddingHorizontal: Layout.screenPadding,
  },
  emptyState: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    marginTop: -48,
  },
  emptyIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '600',
    fontFamily: 'Noto Sans',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'Noto Sans',
    marginTop: 8,
    maxWidth: 240,
  },
});
