import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Href, Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useDeferredValue, useEffect, useMemo, useReducer, useState, useTransition, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Layout, Shadows } from '../../../constants/theme';
import { useAndroidBottomTabOverlayInset } from '../../../hooks/useAndroidBottomTabOverlayInset';
import {
  clearAndroidTabSearch,
  useAndroidTabSearchQuery,
} from '../../../hooks/useAndroidTabSearchState';
import { useFeedFocus } from '../../../hooks/useFeedFocus';
import { useTheme } from '../../../hooks/useTheme';
import { useNotesStore } from '../../../hooks/useNotes';
import { Note } from '../../../services/database';
import { getTextNoteCardGradient } from '../../../services/noteAppearance';
import { getNotePhotoUri } from '../../../services/photoStorage';
import {
  filterNotesBySearchFilters,
  NOTE_SEARCH_FILTER_OPTIONS,
  type NoteSearchFilter,
} from '../../../services/noteSearchFilters';
import { getNotePreviewText } from '../../../services/noteTextPresentation';
import { formatDate } from '../../../utils/dateUtils';
import NotoLoader from '../../ui/NotoLoader';

function getPreviewText(note: Note, photoLabel: string, emptyLabel: string) {
  return getNotePreviewText(note, {
    photoLabel,
    emptyLabel,
  });
}

type SearchStatus = 'idle' | 'searching' | 'success' | 'failed';

type SearchState = {
  query: string;
  results: Note[];
  status: SearchStatus;
};

type SearchAction =
  | { type: 'queryChanged'; query: string }
  | { type: 'searchStarted'; query: string }
  | { type: 'searchSucceeded'; query: string; results: Note[] }
  | { type: 'searchFailed'; query: string };

const SEARCH_LOADING_DELAY_MS = 180;

const initialSearchState: SearchState = {
  query: '',
  results: [],
  status: 'idle',
};

function SearchEmptyMessage({
  accessible,
  accessibilityLabel,
  busy,
  icon,
  pointerEvents,
  subtitle,
  title,
  titleColor,
  subtitleColor,
}: {
  accessible?: boolean;
  accessibilityLabel?: string;
  busy?: boolean;
  icon: ReactNode;
  pointerEvents?: 'none';
  subtitle: string;
  title: string;
  titleColor: string;
  subtitleColor: string;
}) {
  return (
    <View
      accessible={accessible}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={busy ? { busy: true } : undefined}
      pointerEvents={pointerEvents}
      style={styles.emptyState}
    >
      <View style={styles.emptyIconWrap}>{icon}</View>
      <Text style={[styles.emptyTitle, { color: titleColor }]}>{title}</Text>
      <Text style={[styles.emptySubtitle, { color: subtitleColor }]}>{subtitle}</Text>
    </View>
  );
}

function searchReducer(state: SearchState, action: SearchAction): SearchState {
  switch (action.type) {
    case 'queryChanged':
      return action.query
        ? { query: action.query, results: [], status: 'searching' }
        : initialSearchState;
    case 'searchStarted':
      return action.query === state.query
        ? { ...state, results: [], status: 'searching' }
        : state;
    case 'searchSucceeded':
      return action.query === state.query
        ? { query: action.query, results: action.results, status: 'success' }
        : state;
    case 'searchFailed':
      return action.query === state.query
        ? { query: action.query, results: [], status: 'failed' }
        : state;
  }
}

export default function SearchScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomTabOverlayInset = useAndroidBottomTabOverlayInset();
  const androidTabSearchQuery = useAndroidTabSearchQuery();
  const { requestFeedFocus } = useFeedFocus();
  const { notes, loading, searchNotes } = useNotesStore();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<NoteSearchFilter[]>([]);
  const [searchState, dispatchSearch] = useReducer(searchReducer, initialSearchState);
  const [showDelayedSearchLoading, setShowDelayedSearchLoading] = useState(false);
  const [, startSearchTransition] = useTransition();
  const activeQuery = Platform.OS === 'android' ? androidTabSearchQuery : query;
  const deferredQuery = useDeferredValue(activeQuery);
  const trimmedActiveQuery = activeQuery.trim();
  const trimmedDeferredQuery = deferredQuery.trim();
  const hasQuery = trimmedActiveQuery.length > 0;
  const hasActiveFilters = activeFilters.length > 0;
  const hasDeferredQuery = trimmedDeferredQuery.length > 0;

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') {
        return undefined;
      }

      return () => {
        clearAndroidTabSearch();
      };
    }, [])
  );

  useEffect(() => {
    dispatchSearch({ type: 'queryChanged', query: trimmedActiveQuery });
  }, [trimmedActiveQuery]);

  useEffect(() => {
    if (!hasDeferredQuery) {
      return;
    }

    let cancelled = false;
    const searchQuery = trimmedDeferredQuery;
    dispatchSearch({ type: 'searchStarted', query: searchQuery });

    void searchNotes(searchQuery)
      .then((results) => {
        if (!cancelled) {
          dispatchSearch({ type: 'searchSucceeded', query: searchQuery, results });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn('Search query failed:', error);
          dispatchSearch({ type: 'searchFailed', query: searchQuery });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hasDeferredQuery, searchNotes, trimmedDeferredQuery]);

  const candidateNotes = useMemo(
    () =>
      hasQuery && searchState.status === 'success' && searchState.query === trimmedActiveQuery
        ? searchState.results
        : !hasQuery && hasActiveFilters
          ? notes
          : [],
    [
      hasActiveFilters,
      hasQuery,
      notes,
      searchState.query,
      searchState.results,
      searchState.status,
      trimmedActiveQuery,
    ]
  );
  const visibleNotes = useMemo(
    () => filterNotesBySearchFilters(candidateNotes, activeFilters),
    [activeFilters, candidateNotes]
  );
  const isSearching = searchState.status === 'searching';
  const searchFailed = hasQuery && searchState.status === 'failed';
  const hasPendingSearch =
    hasQuery &&
    !searchFailed &&
    (isSearching || searchState.query !== trimmedActiveQuery) &&
    visibleNotes.length === 0;
  const shouldShowSearchingState = hasPendingSearch && showDelayedSearchLoading;
  const shouldHoldSearchingState = hasPendingSearch && !showDelayedSearchLoading;
  const shouldShowEmptyState =
    !searchFailed && !hasPendingSearch && visibleNotes.length === 0;
  const emptyScreenInsetStyle = {
    paddingTop: 10,
    paddingBottom: insets.bottom + 20 + bottomTabOverlayInset,
  };

  useEffect(() => {
    if (!hasPendingSearch) {
      setShowDelayedSearchLoading(false);
      return;
    }

    const timeout = setTimeout(() => {
      setShowDelayedSearchLoading(true);
    }, SEARCH_LOADING_DELAY_MS);

    return () => {
      clearTimeout(timeout);
    };
  }, [hasPendingSearch, trimmedActiveQuery]);

  const openNote = useCallback(
    (noteId: string) => {
      Keyboard.dismiss();
      requestFeedFocus({ kind: 'note', id: noteId });
      router.replace('/' as Href);
    },
    [requestFeedFocus, router]
  );

  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  const handleSearchChange = useCallback((nextQuery: string) => {
    startSearchTransition(() => {
      setQuery(nextQuery);
    });
  }, [startSearchTransition]);
  const toggleFilter = useCallback((filter: NoteSearchFilter) => {
    setActiveFilters((current) => (
      current.includes(filter)
        ? current.filter((item) => item !== filter)
        : [...current, filter]
    ));
  }, []);

  const renderNote = useCallback(
    ({ item }: { item: Note }) => {
      const previewText = getPreviewText(
        item,
        t('map.photoNote', 'Photo Note'),
        t('map.noContent', 'No note content')
      );
      const previewGradient = getTextNoteCardGradient({
        text: item.content,
        noteId: item.id,
        emoji: item.moodEmoji,
        noteColor: item.noteColor,
        fallbackGradient: colors.captureGradient,
      });
      const createdAt = formatDate(item.createdAt, 'short');
      const locationLabel = item.locationName ?? t('home.unknownLocation', 'Unknown location');
      const noteTypeLabel = item.type === 'photo'
        ? t('map.photoNote', 'Photo Note')
        : t('map.filterText', 'Text');

      return (
        <Pressable
          accessibilityLabel={t('home.openNoteDetailsA11y', {
            defaultValue: 'Open note details for {{location}}',
            location: locationLabel,
          })}
          accessibilityRole="button"
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
                  {locationLabel}
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
                {noteTypeLabel}
              </Text>
            </View>
          </View>
        </Pressable>
      );
    },
    [
      colors.border,
      colors.captureGradient,
      colors.danger,
      colors.secondaryText,
      colors.surface,
      colors.text,
      isDark,
      openNote,
      t,
    ]
  );

  const renderSeparator = useCallback(() => <View style={styles.resultSeparator} />, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: Platform.OS !== 'android',
          title: t('tabs.search', 'Search'),
          headerShadowVisible: false,
          headerTransparent: false,
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
        }}
      />
      {Platform.OS === 'ios' ? (
        <Stack.SearchBar
          hideWhenScrolling={false}
          placeholder={t('home.searchPlaceholder', 'Search notes...')}
          onChangeText={(event) => handleSearchChange(event.nativeEvent.text)}
        />
      ) : null}

      <View style={[
        styles.filterWrap,
        {
          paddingTop: Platform.OS === 'android' ? insets.top + Layout.screenPadding : 10,
          backgroundColor: colors.background,
        },
      ]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
          keyboardShouldPersistTaps="handled"
        >
          {NOTE_SEARCH_FILTER_OPTIONS.map((option) => {
            const selected = activeFilters.includes(option.id);
            return (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => toggleFilter(option.id)}
                style={({ pressed }) => [
                  styles.filterChip,
                  {
                    backgroundColor: selected ? colors.primary : colors.surface,
                    borderColor: selected ? colors.primary : colors.border,
                    opacity: pressed ? 0.82 : 1,
                  },
                ]}
              >
                <Ionicons
                  name={option.icon as keyof typeof Ionicons.glyphMap}
                  size={14}
                  color={selected ? '#FFFFFF' : colors.secondaryText}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.filterChipText,
                    { color: selected ? '#FFFFFF' : colors.text },
                  ]}
                >
                  {t(option.labelKey, option.fallbackLabel)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centerWrap}>
          <NotoLoader variant="skeleton" size="large" color={colors.primary} />
        </View>
      ) : searchFailed ? (
        <Pressable
          onPress={dismissKeyboard}
          style={[
            styles.centerWrap,
            styles.emptyScreen,
            emptyScreenInsetStyle,
          ]}
          testID="search-error-state"
        >
          <SearchEmptyMessage
            pointerEvents="none"
            title={t('search.errorTitle', 'Search is unavailable')}
            subtitle={t('search.errorBody', 'We could not search your notes right now. Please try again in a moment.')}
            titleColor={colors.text}
            subtitleColor={colors.secondaryText}
            icon={
              <Ionicons
                name="alert-circle-outline"
                size={Platform.OS === 'ios' ? 54 : 30}
                color={colors.secondaryText}
              />
            }
          />
        </Pressable>
      ) : shouldShowSearchingState ? (
        <View
          style={[
            styles.centerWrap,
            styles.emptyScreen,
            emptyScreenInsetStyle,
          ]}
        >
          <SearchEmptyMessage
            accessible
            accessibilityLabel={t('common.loading', 'Loading')}
            busy
            title={t('common.loading', 'Loading')}
            subtitle={t('home.searchPlaceholder', 'Search notes...')}
            titleColor={colors.text}
            subtitleColor={colors.secondaryText}
            icon={
              <NotoLoader
                variant={Platform.OS === 'ios' ? 'inline' : 'note'}
                size={Platform.OS === 'ios' ? 34 : 'large'}
                color={colors.primary}
              />
            }
          />
        </View>
      ) : shouldHoldSearchingState ? (
        <Pressable
          onPress={dismissKeyboard}
          style={[
            styles.centerWrap,
            styles.emptyScreen,
            emptyScreenInsetStyle,
          ]}
        />
      ) : shouldShowEmptyState ? (
        <Pressable
          onPress={dismissKeyboard}
          style={[
            styles.centerWrap,
            styles.emptyScreen,
            emptyScreenInsetStyle,
          ]}
        >
          <SearchEmptyMessage
            pointerEvents="none"
            title={hasQuery || hasActiveFilters
              ? t('home.noResults', 'No notes found')
              : t('home.searchPlaceholder', 'Search notes...')}
            subtitle={hasQuery || hasActiveFilters
              ? t('home.noResultsMsg', 'Try a different keyword')
              : t('home.count', '{{count}} notes saved', { count: notes.length })}
            titleColor={colors.text}
            subtitleColor={colors.secondaryText}
            icon={
              <Ionicons
                name="search-outline"
                size={Platform.OS === 'ios' ? 54 : 30}
                color={colors.secondaryText}
              />
            }
          />
        </Pressable>
      ) : (
        <FlashList
          data={visibleNotes}
          keyExtractor={(item) => item.id}
          getItemType={(item) => item.type}
          drawDistance={440}
          renderItem={renderNote}
          ListHeaderComponent={
            hasQuery && isSearching ? (
              <View
                accessible
                accessibilityLabel={t('common.loading', 'Loading')}
                accessibilityState={{ busy: true }}
                style={[
                  styles.searchingBanner,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <NotoLoader variant="inline" size="small" color={colors.primary} />
                <Text style={[styles.searchingBannerText, { color: colors.secondaryText }]}>
                  {t('common.loading', 'Loading')}
                </Text>
              </View>
            ) : null
          }
          ItemSeparatorComponent={renderSeparator}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          automaticallyAdjustsScrollIndicatorInsets={false}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          contentContainerStyle={[
            styles.listContent,
            {
              paddingTop: 10,
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
    paddingTop: 10,
    paddingHorizontal: Layout.screenPadding,
  },
  filterWrap: {
    paddingBottom: 8,
  },
  filterContent: {
    gap: 8,
    paddingHorizontal: Layout.screenPadding,
  },
  filterChip: {
    minHeight: 34,
    maxWidth: 150,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
  },
  filterChipText: {
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 17,
    fontFamily: 'Noto Sans',
    fontWeight: '700',
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
  searchingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  searchingBannerText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Noto Sans',
    fontWeight: '600',
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
