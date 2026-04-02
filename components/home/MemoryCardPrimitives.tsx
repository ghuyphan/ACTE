import { Ionicons } from '@expo/vector-icons';
import { TFunction } from 'i18next';
import { Image } from 'expo-image';
import { Dimensions, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { Layout, Typography } from '../../constants/theme';
import { Note } from '../../services/database';
import { getNotePhotoUri } from '../../services/photoStorage';
import { SharedPost } from '../../services/sharedFeedService';
import { formatDate } from '../../utils/dateUtils';
import ImageMemoryCard from '../notes/ImageMemoryCard';
import {
  DEFAULT_DEBUG_TILT_STATE,
  type DebugTiltState,
} from '../notes/StickerPhysicsDebugControls';
import TextMemoryCard from '../notes/TextMemoryCard';
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
  isActive?: boolean;
}

interface SharedPostMemoryCardProps {
  post: SharedPost;
  colors: MemoryColors;
  t: TFunction;
  onPress?: () => void;
  cardSize?: number;
  containerStyle?: StyleProp<ViewStyle>;
  isActive?: boolean;
}

export function NoteMemoryCard({
  note,
  colors,
  t,
  onPress,
  cardSize = DEFAULT_CARD_SIZE,
  containerStyle,
  isActive = false,
}: NoteMemoryCardProps) {
  const dateStr = formatDate(note.createdAt, 'short');
  const debugTiltOverride = useSharedValue<DebugTiltState>(DEFAULT_DEBUG_TILT_STATE);
  const locationLabel = note.locationName ?? t('home.unknownLocation', 'Unknown location');

  const content = (
    <View style={[styles.cardRoot, containerStyle, { width: cardSize }]}>
      <View style={[styles.noteCardWrapper, { width: cardSize, height: cardSize }]}>
        <View style={styles.cardFill}>
          {note.type === 'photo' ? (
            <ImageMemoryCard
              imageUrl={getNotePhotoUri(note)}
              doodleStrokesJson={note.doodleStrokesJson}
              stickerPlacementsJson={note.stickerPlacementsJson}
              isActive={isActive}
              debugTiltOverride={debugTiltOverride}
            />
          ) : (
            <TextMemoryCard
              text={note.content}
              noteId={note.id}
              emoji={note.moodEmoji}
              noteColor={note.noteColor}
              doodleStrokesJson={note.doodleStrokesJson}
              stickerPlacementsJson={note.stickerPlacementsJson}
              isActive={isActive}
              debugTiltOverride={debugTiltOverride}
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
        {onPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('home.openNoteDetailsA11y', {
              defaultValue: 'Open note details for {{location}}',
              location: locationLabel,
            })}
            hitSlop={8}
            onPress={onPress}
            style={({ pressed }) => [
              styles.metadataPressable,
              pressed ? styles.metadataPressablePressed : null,
            ]}
          >
            <InfoPill style={styles.metadataPill}>
              <View style={styles.metadataPillContent}>
                <View style={styles.metadataPillMain}>
                  <Ionicons name="location" size={14} color={colors.secondaryText} />
                  <Text style={[styles.metadataPillText, { color: colors.text }]} numberOfLines={1}>
                    {locationLabel}
                  </Text>
                  <View style={[styles.metadataPillDot, { backgroundColor: colors.secondaryText }]} />
                  <Text style={[styles.metadataPillDate, { color: colors.secondaryText }]}>{dateStr}</Text>
                  {note.hasDoodle ? (
                    <>
                      <View style={[styles.metadataPillDot, { backgroundColor: colors.secondaryText }]} />
                      <Ionicons name="brush-outline" size={14} color={colors.secondaryText} />
                    </>
                  ) : null}
                </View>
                <View style={styles.metadataPillAction}>
                  <Text style={[styles.metadataActionText, { color: colors.primary }]}>
                    {t('home.openDetails', 'Details')}
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                </View>
              </View>
            </InfoPill>
          </Pressable>
        ) : (
          <InfoPill style={styles.metadataPill}>
            <View style={styles.metadataPillContent}>
              <View style={styles.metadataPillMain}>
                <Ionicons name="location" size={14} color={colors.secondaryText} />
                <Text style={[styles.metadataPillText, { color: colors.text }]} numberOfLines={1}>
                  {locationLabel}
                </Text>
                <View style={[styles.metadataPillDot, { backgroundColor: colors.secondaryText }]} />
                <Text style={[styles.metadataPillDate, { color: colors.secondaryText }]}>{dateStr}</Text>
                {note.hasDoodle ? (
                  <>
                    <View style={[styles.metadataPillDot, { backgroundColor: colors.secondaryText }]} />
                    <Ionicons name="brush-outline" size={14} color={colors.secondaryText} />
                  </>
                ) : null}
              </View>
            </View>
          </InfoPill>
        )}
      </View>
    </View>
  );
  return content;
}

export function SharedPostMemoryCard({
  post,
  colors,
  t,
  onPress,
  cardSize = DEFAULT_CARD_SIZE,
  containerStyle,
  isActive = false,
}: SharedPostMemoryCardProps) {
  const authorLabel = post.authorDisplayName ?? t('shared.someone', 'Someone');
  const dateStr = formatDate(post.createdAt, 'short');
  const debugTiltOverride = useSharedValue<DebugTiltState>(DEFAULT_DEBUG_TILT_STATE);
  const placeLabel = post.placeName ?? t('shared.sharedNow', 'Shared now');

  const content = (
    <View style={[styles.cardRoot, containerStyle, { width: cardSize }]}>
      <View style={[styles.sharedCardWrap, { width: cardSize }]}>
        <View style={[styles.noteCardWrapper, { width: cardSize, height: cardSize }]}>
          <View style={styles.cardFill}>
            <SharedPostCardVisual
              post={post}
              fallbackText={t('shared.noteFallback', 'Shared note')}
              isActive={isActive}
              debugTiltOverride={debugTiltOverride}
            />
          </View>
        </View>

        <View style={[styles.metaContainer, { width: cardSize }]}>
          {onPress ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('shared.openSharedDetailsA11y', {
                defaultValue: 'Open shared post details for {{location}}',
                location: placeLabel,
              })}
              hitSlop={8}
              onPress={onPress}
              style={({ pressed }) => [
                styles.metadataPressable,
                pressed ? styles.metadataPressablePressed : null,
              ]}
            >
              <InfoPill style={[styles.metadataPill, styles.sharedUnifiedPill]}>
                <View style={styles.metadataPillContent}>
                  <View style={styles.metadataPillMain}>
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
                      {placeLabel}
                    </Text>
                    <View style={[styles.metadataPillDot, { backgroundColor: colors.secondaryText }]} />
                    <Text style={[styles.metadataPillDate, { color: colors.secondaryText }]}>{dateStr}</Text>
                  </View>
                  <View style={styles.metadataPillAction}>
                    <Text style={[styles.metadataActionText, { color: colors.primary }]}>
                      {t('home.openDetails', 'Details')}
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                  </View>
                </View>
              </InfoPill>
            </Pressable>
          ) : (
            <InfoPill style={[styles.metadataPill, styles.sharedUnifiedPill]}>
              <View style={styles.metadataPillContent}>
                <View style={styles.metadataPillMain}>
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
                    {placeLabel}
                  </Text>
                  <View style={[styles.metadataPillDot, { backgroundColor: colors.secondaryText }]} />
                  <Text style={[styles.metadataPillDate, { color: colors.secondaryText }]}>{dateStr}</Text>
                </View>
              </View>
            </InfoPill>
          )}
        </View>
      </View>
    </View>
  );
  return content;
}

const styles = StyleSheet.create({
  cardRoot: {
    alignSelf: 'center',
    position: 'relative',
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
    fontFamily: 'Noto Sans',
  },
  metadataPill: {
    minHeight: 36,
    minWidth: '100%',
  },
  metadataPressable: {
    alignSelf: 'stretch',
  },
  metadataPressablePressed: {
    opacity: 0.84,
  },
  metadataPillText: {
    ...Typography.pill,
    flexShrink: 1,
  },
  metadataPillDate: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'Noto Sans',
  },
  metadataPillDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 2,
  },
  metadataPillContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  metadataPillMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  metadataPillAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  metadataActionText: {
    ...Typography.pill,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
  },
});
