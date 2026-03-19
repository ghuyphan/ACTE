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
import { Image } from 'expo-image';
import Reanimated, { Easing, LinearTransition } from 'react-native-reanimated';
import { Layout, Typography } from '../../constants/theme';
import { Note } from '../../services/database';
import { getNotePhotoUri } from '../../services/photoStorage';
import { SharedPost } from '../../services/sharedFeedService';
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
  colors,
  t,
}: {
  item: Note;
  index: number;
  onPress: () => void;
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
      </Animated.View>
    </Pressable>
  );
});

const AnimatedSharedPostCard = memo(function AnimatedSharedPostCard({
  item,
  index,
  colors,
  t,
}: {
  item: SharedPost;
  index: number;
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

  const authorLabel = item.authorDisplayName ?? t('shared.someone', 'Someone');
  const dateStr = formatDate(item.createdAt, 'short');

  return (
    <Animated.View style={[styles.sharedCardWrap, { opacity, transform: [{ scale }] }]}>
      <View style={styles.noteCardWrapper}>
        {item.type === 'photo' && item.photoLocalUri ? (
          <ImageMemoryCard imageUrl={item.photoLocalUri} />
        ) : (
          <TextMemoryCard text={item.text || t('shared.photoMemory', 'Photo memory')} noteId={item.id} />
        )}
      </View>

      <View style={styles.sharedMetaContainer}>
        <View style={styles.sharedMetaRow}>
          <InfoPill style={styles.sharedAuthorPill}>
            {item.authorPhotoURLSnapshot ? (
              <Image source={{ uri: item.authorPhotoURLSnapshot }} style={styles.sharedAvatarImage} contentFit="cover" />
            ) : (
              <View style={[styles.sharedAvatarFallback, { backgroundColor: colors.card }]}>
                <Text style={[styles.sharedAvatarLabel, { color: colors.primary }]}>
                  {authorLabel.trim().charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </InfoPill>

          <InfoPill icon="location" iconColor={colors.secondaryText} style={[styles.metadataPill, styles.sharedMetadataPill]}>
            <Text style={[styles.metadataPillText, { color: colors.text }]} numberOfLines={1}>
              {item.placeName ?? t('shared.sharedNow', 'Shared now')}
            </Text>
            <View style={[styles.metadataPillDot, { backgroundColor: colors.secondaryText }]} />
            <Text style={[styles.metadataPillDate, { color: colors.secondaryText }]}>{dateStr}</Text>
          </InfoPill>
        </View>
      </View>
    </Animated.View>
  );
});

type NotesFeedListItem =
  | { id: string; kind: 'note'; note: Note; createdAt: string }
  | { id: string; kind: 'shared-post'; post: SharedPost; createdAt: string };

interface NotesFeedProps {
  flatListRef: RefObject<FlatList<any> | null>;
  captureHeader: ReactElement;
  captureMode: 'text' | 'camera';
  notes: Note[];
  sharedPosts?: SharedPost[];
  refreshing: boolean;
  onRefresh: () => void;
  topInset: number;
  snapHeight: number;
  onOpenNote: (noteId: string) => void;
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
  captureHeader,
  captureMode,
  notes,
  sharedPosts = [],
  refreshing,
  onRefresh,
  topInset,
  snapHeight,
  onOpenNote,
  colors,
  t,
  onCaptureVisibilityChange,
}: NotesFeedProps) {
  const listData = useMemo<NotesFeedListItem[]>(
    () =>
      [
        ...notes.map((note) => ({
          id: note.id,
          kind: 'note' as const,
          note,
          createdAt: note.createdAt,
        })),
        ...sharedPosts.map((post) => ({
          id: post.id,
          kind: 'shared-post' as const,
          post,
          createdAt: post.createdAt,
        })),
      ].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [notes, sharedPosts]
  );
  const refreshSpinnerOffset = topInset + Layout.headerHeight + Layout.floatingGap;
  useEffect(() => {
    onCaptureVisibilityChange?.(true);
  }, [onCaptureVisibilityChange]);

  const settleCaptureVisibility = useCallback(
    (offsetY: number) => {
      onCaptureVisibilityChange?.(offsetY < snapHeight * 0.5);
    },
    [onCaptureVisibilityChange, snapHeight]
  );

  const getItemLayout = useCallback(
    (_data: ArrayLike<NotesFeedListItem> | null | undefined, index: number) => ({
      length: snapHeight,
      offset: snapHeight * (index + 1),
      index,
    }),
    [snapHeight]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: NotesFeedListItem; index: number }) => {
      if (item.kind === 'shared-post') {
        return (
          <View style={[styles.snapItem, { height: snapHeight, paddingTop: topInset + 60 }]}>
            <AnimatedSharedPostCard item={item.post} index={index} colors={colors} t={t} />
          </View>
        );
      }

      const note = item.note;
      return (
        <View style={[styles.snapItem, { height: snapHeight, paddingTop: topInset + 60 }]}>
          <AnimatedNoteCard
            item={note}
            index={index}
            onPress={() => onOpenNote(note.id)}
            colors={colors}
            t={t}
          />
        </View>
      );
    },
    [colors, onOpenNote, snapHeight, t, topInset]
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
      removeClippedSubviews={captureMode !== 'camera'}
      snapToInterval={snapHeight}
      snapToAlignment="start"
      decelerationRate="fast"
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={captureHeader}
      onScrollEndDrag={(event) => {
        const velocityY = event.nativeEvent.velocity?.y ?? 0;
        if (Math.abs(velocityY) < 0.05) {
          settleCaptureVisibility(event.nativeEvent.contentOffset.y);
        }
      }}
      onMomentumScrollEnd={(event) => {
        settleCaptureVisibility(event.nativeEvent.contentOffset.y);
      }}
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
  sharedCardWrap: {
    width: CARD_SIZE,
    alignSelf: 'center',
  },
  sharedMetaContainer: {
    width: CARD_SIZE,
    alignSelf: 'center',
    minHeight: 56,
    paddingTop: 16,
  },
  sharedMetaRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sharedAuthorPill: {
    width: 44,
    minWidth: 44,
    paddingHorizontal: 0,
    justifyContent: 'center',
  },
  sharedAvatarImage: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  sharedAvatarFallback: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sharedAvatarLabel: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '800',
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
  sharedMetadataPill: {
    flex: 1,
    minWidth: 0,
    maxWidth: CARD_SIZE - 52,
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
