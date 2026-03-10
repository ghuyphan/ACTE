import { Ionicons } from '@expo/vector-icons';
import { TFunction } from 'i18next';
import { ReactElement, RefObject, useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Reanimated, { LinearTransition } from 'react-native-reanimated';
import { Layout, Typography } from '../../constants/theme';
import { Note } from '../../services/database';
import { formatDate } from '../../utils/dateUtils';
import ImageMemoryCard from '../ImageMemoryCard';
import TextMemoryCard from '../TextMemoryCard';
import InfoPill from '../ui/InfoPill';

const { width, height } = Dimensions.get('window');
const HORIZONTAL_PADDING = Layout.screenPadding - 8;
const CARD_SIZE = width - HORIZONTAL_PADDING * 2;

function AnimatedNoteCard({
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
    text: string;
    secondaryText: string;
  };
  t: TFunction;
}) {
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const mountIndex = useRef(index).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        tension: 80,
        friction: 10,
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
    Animated.spring(pressScale, {
      toValue: 0.98,
      tension: 300,
      friction: 15,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      tension: 200,
      friction: 12,
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
          <ImageMemoryCard imageUrl={item.content} />
        ) : (
          <TextMemoryCard text={item.content} noteId={item.id} />
        )}

        {item.isFavorite ? (
          <View style={styles.favBadge}>
            <Ionicons name="heart" size={16} color="#FF3B30" />
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
}

interface NotesFeedProps {
  flatListRef: RefObject<FlatList<any> | null>;
  captureItem: ReactElement;
  notes: Note[];
  refreshing: boolean;
  onRefresh: () => void;
  topInset: number;
  snapHeight: number;
  onOpenNote: (noteId: string) => void;
  colors: {
    primary: string;
    text: string;
    secondaryText: string;
  };
  t: TFunction;
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
  colors,
  t,
}: NotesFeedProps) {
  const listData = [{ id: '__capture__', kind: 'capture' as const }, ...notes.map((note) => ({
    ...note,
    kind: 'note' as const,
  }))];

  return (
    <Reanimated.FlatList
      ref={flatListRef}
      data={listData}
      keyExtractor={(item) => item.id}
      renderItem={({ item, index }) => {
        if (item.kind === 'capture') {
          return captureItem;
        }

        const note = item as Note;
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
      }}
      itemLayoutAnimation={LinearTransition.springify().damping(20).stiffness(150)}
      snapToInterval={snapHeight}
      snapToAlignment="start"
      decelerationRate="fast"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: height - snapHeight }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
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
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
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
    alignItems: 'center',
    paddingTop: 16,
  },
  metadataPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
    maxWidth: '90%',
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
});
