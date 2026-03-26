import { Ionicons } from '@expo/vector-icons';
import { TFunction } from 'i18next';
import { Image } from 'expo-image';
import { Dimensions, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Layout, Typography } from '../../constants/theme';
import { Note } from '../../services/database';
import { getNotePhotoUri } from '../../services/photoStorage';
import { SharedPost } from '../../services/sharedFeedService';
import { formatDate } from '../../utils/dateUtils';
import ImageMemoryCard from '../ImageMemoryCard';
import TextMemoryCard from '../TextMemoryCard';
import InfoPill from '../ui/InfoPill';
import SharedPostCardVisual from './SharedPostCardVisual';

const { width } = Dimensions.get('window');
const DEFAULT_CARD_SIZE = width - (Layout.screenPadding - 8) * 2;

type MemoryColors = {
  primary: string;
  text: string;
  secondaryText: string;
  danger: string;
  card: string;
  primarySoft?: string;
};

interface NoteMemoryCardProps {
  note: Note;
  colors: MemoryColors;
  t: TFunction;
  onPress?: () => void;
  cardSize?: number;
  containerStyle?: StyleProp<ViewStyle>;
}

interface SharedPostMemoryCardProps {
  post: SharedPost;
  colors: MemoryColors;
  t: TFunction;
  onPress?: () => void;
  cardSize?: number;
  containerStyle?: StyleProp<ViewStyle>;
}

export function NoteMemoryCard({
  note,
  colors,
  t,
  onPress,
  cardSize = DEFAULT_CARD_SIZE,
  containerStyle,
}: NoteMemoryCardProps) {
  const dateStr = formatDate(note.createdAt, 'short');
  const content = (
    <View style={[styles.cardRoot, containerStyle, { width: cardSize }]}>
      <View style={[styles.noteCardWrapper, { width: cardSize, height: cardSize }]}>
        <View style={styles.cardFill}>
          {note.type === 'photo' ? (
            <ImageMemoryCard
              imageUrl={getNotePhotoUri(note)}
              doodleStrokesJson={note.doodleStrokesJson}
              stickerPlacementsJson={note.stickerPlacementsJson}
            />
          ) : (
            <TextMemoryCard
              text={note.content}
              noteId={note.id}
              emoji={note.moodEmoji}
              doodleStrokesJson={note.doodleStrokesJson}
              stickerPlacementsJson={note.stickerPlacementsJson}
            />
          )}
        </View>

        {note.isFavorite ? (
          <View style={[styles.favBadge, { backgroundColor: colors.card }]}>
            <Ionicons name="heart" size={16} color={colors.danger} />
          </View>
        ) : null}
      </View>

      <View style={[styles.metaContainer, { width: cardSize }]}>
        <InfoPill icon="location" iconColor={colors.secondaryText} style={styles.metadataPill}>
          <Text style={[styles.metadataPillText, { color: colors.text }]} numberOfLines={1}>
            {note.locationName ?? t('home.unknownLocation', 'Unknown location')}
          </Text>
          <View style={[styles.metadataPillDot, { backgroundColor: colors.secondaryText }]} />
          <Text style={[styles.metadataPillDate, { color: colors.secondaryText }]}>{dateStr}</Text>
          {note.hasDoodle ? (
            <>
              <View style={[styles.metadataPillDot, { backgroundColor: colors.secondaryText }]} />
              <Ionicons name="brush-outline" size={14} color={colors.secondaryText} />
            </>
          ) : null}
        </InfoPill>
      </View>
    </View>
  );

  if (!onPress) {
    return content;
  }

  return <Pressable onPress={onPress}>{content}</Pressable>;
}

export function SharedPostMemoryCard({
  post,
  colors,
  t,
  onPress,
  cardSize = DEFAULT_CARD_SIZE,
  containerStyle,
}: SharedPostMemoryCardProps) {
  const authorLabel = post.authorDisplayName ?? t('shared.someone', 'Someone');
  const dateStr = formatDate(post.createdAt, 'short');
  const content = (
    <View style={[styles.cardRoot, containerStyle, { width: cardSize }]}>
      <View style={[styles.sharedCardWrap, { width: cardSize }]}>
        <View style={[styles.noteCardWrapper, { width: cardSize, height: cardSize }]}>
          <View style={styles.cardFill}>
            <SharedPostCardVisual
              post={post}
              fallbackText={t('shared.noteFallback', 'Shared note')}
            />
          </View>
        </View>

        <View style={[styles.metaContainer, { width: cardSize }]}>
          <InfoPill style={[styles.metadataPill, styles.sharedUnifiedPill]}>
            {post.authorPhotoURLSnapshot ? (
              <Image
                source={{ uri: post.authorPhotoURLSnapshot }}
                style={styles.sharedAvatarImage}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.sharedAvatarFallback, { backgroundColor: colors.card }]}>
                <Text style={[styles.sharedAvatarLabel, { color: colors.primary }]}>
                  {authorLabel.trim().charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={[styles.metadataPillDot, { backgroundColor: colors.secondaryText }]} />
            <Ionicons name="location" size={14} color={colors.secondaryText} />
            <Text style={[styles.metadataPillText, { color: colors.text }]} numberOfLines={1}>
              {post.placeName ?? t('shared.sharedNow', 'Shared now')}
            </Text>
            <View style={[styles.metadataPillDot, { backgroundColor: colors.secondaryText }]} />
            <Text style={[styles.metadataPillDate, { color: colors.secondaryText }]}>{dateStr}</Text>
          </InfoPill>
        </View>
      </View>
    </View>
  );

  if (!onPress) {
    return content;
  }

  return <Pressable onPress={onPress}>{content}</Pressable>;
}

const styles = StyleSheet.create({
  cardRoot: {
    alignSelf: 'center',
  },
  cardFill: {
    flex: 1,
  },
  noteCardWrapper: {
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
  metaContainer: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    paddingTop: 16,
  },
  sharedCardWrap: {
    alignSelf: 'center',
  },
  sharedUnifiedPill: {
    alignSelf: 'center',
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
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'System',
  },
  metadataPill: {
    minHeight: 36,
  },
  metadataPillText: {
    ...Typography.pill,
    flexShrink: 1,
  },
  metadataPillDate: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'System',
  },
  metadataPillDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 2,
  },
});
