import { Ionicons } from '@expo/vector-icons';
import { TFunction } from 'i18next';
import { ReactElement, RefObject, memo, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing as RNEasing,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Reanimated, { Easing, LinearTransition } from 'react-native-reanimated';
import { Layout, Typography } from '../../constants/theme';
import { Note } from '../../services/database';
import { getNotePhotoUri } from '../../services/photoStorage';
import { formatDate } from '../../utils/dateUtils';
import ImageMemoryCard from '../ImageMemoryCard';
import TextMemoryCard from '../TextMemoryCard';
import InfoPill from '../ui/InfoPill';

const { width, height } = Dimensions.get('window');
const HORIZONTAL_PADDING = Layout.screenPadding - 8;
const CARD_SIZE = width - HORIZONTAL_PADDING * 2;

const AnimatedNoteCard = memo(function AnimatedNoteCard({
  item,
  index,
  onPress,
  onShare,
  colors,
  t,
}: {
  item: Note;
  index: number;
  onPress: () => void;
  onShare?: (() => void) | null;
  colors: {
    primary: string;
    text: string;
    secondaryText: string;
    danger: string;
    card: string;
  };
  t: TFunction;
}) {
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const mountIndex = useRef(index).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 1,
        duration: 260,
        easing: RNEasing.out(RNEasing.cubic),
        delay: mountIndex * 50,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        delay: mountIndex * 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, [mountIndex, opacity, scale]);

  const handlePressIn = () => {
    Animated.timing(pressScale, {
      toValue: 0.98,
      duration: 120,
      easing: RNEasing.out(RNEasing.quad),
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(pressScale, {
      toValue: 1,
      duration: 180,
      easing: RNEasing.out(RNEasing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const dateStr = formatDate(item.createdAt, 'short');

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View
        style={[styles.noteCardWrapper, { opacity, transform: [{ scale: Animated.multiply(scale, pressScale) }] }]}
      >
        {item.type === 'photo' ? (
          <ImageMemoryCard imageUrl={getNotePhotoUri(item)} />
        ) : (
          <TextMemoryCard text={item.content} noteId={item.id} />
        )}

        {item.isFavorite ? (
          <View style={[styles.favBadge, { backgroundColor: colors.card }]}>
            <Ionicons name="heart" size={16} color={colors.danger} />
          </View>
        ) : null}
      </Animated.View>

      <Animated.View style={[styles.belowCardMetaContainer, { opacity }]}>
        <InfoPill icon="location" iconColor={colors.secondaryText} style={styles.metadataPill}>
          <Text style={[styles.metadataPillText, { color: colors.text }]} numberOfLines={1}>
            {item.locationName ?? t('home.unknownLocation', 'Unknown location')}
          </Text>
          <View style={[styles.metadataPillDot, { backgroundColor: colors.secondaryText }]} />
          <Text style={[styles.metadataPillDate, { color: colors.secondaryText }]}>{dateStr}</Text>
        </InfoPill>
        {onShare ? (
          <Pressable
            testID={`note-share-room-${item.id}`}
            onPress={onShare}
            style={styles.shareButtonPressable}
          >
            <InfoPill style={styles.shareButton}>
              <Ionicons name="paper-plane-outline" size={17} color={colors.primary} />
            </InfoPill>
          </Pressable>
        ) : null}
      </Animated.View>
    </Pressable>
  );
});

type NotesFeedListItem =
  | { id: '__capture__'; kind: 'capture' }
  | { id: string; kind: 'note'; note: Note };

interface NotesFeedProps {
  flatListRef: RefObject<FlatList<any> | null>;
  captureItem: ReactElement;
  notes: Note[];
  refreshing: boolean;
  onRefresh: () => void;
  topInset: number;
  snapHeight: number;
  onOpenNote: (noteId: string) => void;
  onShareNote?: (noteId: string) => void;
  colors: {
    primary: string;
    text: string;
    secondaryText: string;
    danger: string;
    card: string;
  };
  t: TFunction;
  onCaptureVisibilityChange?: (isVisible: boolean) => void;
}

export default function NotesFeed({
  flatListRef,
  captureItem,
  notes,
  refreshing,
  onRefresh,
  topInset,
  snapHeight,
  onOpenNote,
  onShareNote,
  colors,
  t,
  onCaptureVisibilityChange,
}: NotesFeedProps) {
  const listData = useMemo<NotesFeedListItem[]>(
    () => [
      { id: '__capture__', kind: 'capture' },
      ...notes.map((note) => ({
        id: note.id,
        kind: 'note' as const,
        note,
      })),
    ],
    [notes]
  );
  const refreshSpinnerOffset = topInset + Layout.headerHeight + Layout.floatingGap;

  const captureVisibilityRef = useRef(onCaptureVisibilityChange);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 30 });

  useEffect(() => {
    captureVisibilityRef.current = onCaptureVisibilityChange;
  }, [onCaptureVisibilityChange]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: { item?: { id?: string } }[] }) => {
      const isCaptureVisible = viewableItems.some((entry) => entry.item?.id === '__capture__');
      captureVisibilityRef.current?.(isCaptureVisible);
    }
  ).current;

  const getItemLayout = useCallback(
    (_data: ArrayLike<NotesFeedListItem> | null | undefined, index: number) => ({
      length: snapHeight,
      offset: snapHeight * index,
      index,
    }),
    [snapHeight]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: NotesFeedListItem; index: number }) => {
      if (item.kind === 'capture') {
        return captureItem;
      }

      const note = item.note;
      return (
        <View style={[styles.snapItem, { height: snapHeight, paddingTop: topInset + 60 }]}>
          <AnimatedNoteCard
            item={note}
            index={index}
            onPress={() => onOpenNote(note.id)}
            onShare={onShareNote ? () => onShareNote(note.id) : null}
            colors={colors}
            t={t}
          />
        </View>
      );
    },
    [captureItem, colors, onOpenNote, onShareNote, snapHeight, t, topInset]
  );

  return (
    <Reanimated.FlatList
      ref={flatListRef}
      data={listData}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      itemLayoutAnimation={LinearTransition.duration(180).easing(Easing.out(Easing.cubic))}
      getItemLayout={getItemLayout}
      initialNumToRender={3}
      maxToRenderPerBatch={4}
      windowSize={5}
      removeClippedSubviews
      snapToInterval={snapHeight}
      snapToAlignment="start"
      decelerationRate="fast"
      showsVerticalScrollIndicator={false}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig.current}
      contentContainerStyle={{ paddingBottom: height - snapHeight }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          progressViewOffset={refreshSpinnerOffset}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  snapItem: {
    width,
    justifyContent: 'center',
  },
  noteCardWrapper: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    alignSelf: 'center',
    justifyContent: 'center',
  },
  favBadge: {
    position: 'absolute',
    top: 18,
    right: 24,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    backgroundColor: '#fff',
  },
  belowCardMetaContainer: {
    width: CARD_SIZE,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    minHeight: 56,
    paddingTop: 16,
  },
  metadataPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
    maxWidth: CARD_SIZE - 64,
  },
  metadataPillText: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
    fontFamily: 'System',
  },
  metadataPillDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 2,
    opacity: 0.5,
  },
  metadataPillDate: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '500',
  },
  shareButtonPressable: {
    position: 'absolute',
    right: 0,
    top: 16,
  },
  shareButton: {
    minHeight: 40,
    paddingHorizontal: 13,
    paddingVertical: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
