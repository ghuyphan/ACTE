import { Ionicons } from '@expo/vector-icons';
import { TFunction } from 'i18next';
import { Image } from 'expo-image';
import { Pressable, StyleProp, StyleSheet, Text, useWindowDimensions, View, ViewStyle } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { Layout, Radii, Typography } from '../../constants/theme';
import { useRelativeTimeNow } from '../../hooks/useRelativeTimeNow';
import { Note } from '../../services/database';
import { getNotePairedVideoUri } from '../../services/livePhotoStorage';
import { getNotePhotoUri } from '../../services/photoStorage';
import { SharedPost } from '../../services/sharedFeedService';
import { formatNoteTimestamp } from '../../utils/dateUtils';
import ImageMemoryCard from '../notes/ImageMemoryCard';
import {
  DEFAULT_DEBUG_TILT_STATE,
  type DebugTiltState,
} from '../notes/StickerPhysicsDebugControls';
import TextMemoryCard from '../notes/TextMemoryCard';
import InfoPill from '../ui/InfoPill';
import LivePhotoIcon from '../ui/LivePhotoIcon';
import SharedPostCardVisual from './SharedPostCardVisual';

type MemoryColors = {
  primary: string;
  text: string;
  secondaryText: string;
  danger: string;
  card: string;
  border?: string;
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
  isSharedByMe?: boolean;
}

interface SharedPostMemoryCardProps {
  post: SharedPost;
  colors: MemoryColors;
  t: TFunction;
  onPress?: () => void;
  cardSize?: number;
  containerStyle?: StyleProp<ViewStyle>;
  isActive?: boolean;
  showSharedBadge?: boolean;
}

export function NoteMemoryCard({
  note,
  colors,
  t,
  onPress,
  cardSize,
  containerStyle,
  isActive = false,
  isSharedByMe = false,
}: NoteMemoryCardProps) {
  const { width } = useWindowDimensions();
  const now = useRelativeTimeNow();
  const resolvedCardSize = cardSize ?? width - (Layout.screenPadding - 8) * 2;
  const dateStr = formatNoteTimestamp(note.createdAt, 'card', now);
  const debugTiltOverride = useSharedValue<DebugTiltState>(DEFAULT_DEBUG_TILT_STATE);
  const locationLabel = note.locationName ?? t('home.unknownLocation', 'Unknown location');

  const content = (
    <View style={[styles.cardRoot, containerStyle, { width: resolvedCardSize }]}>
      <View style={[styles.noteCardWrapper, { width: resolvedCardSize, height: resolvedCardSize }]}>
        <View style={styles.cardFill}>
          {note.type === 'photo' ? (
            <ImageMemoryCard
              imageUrl={getNotePhotoUri(note)}
              caption={note.caption}
              isLivePhoto={note.isLivePhoto}
              pairedVideoUri={getNotePairedVideoUri(note)}
              showLiveBadge={false}
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

        {note.isFavorite || note.isLivePhoto ? (
          <View style={styles.badgeStack}>
            {note.isLivePhoto ? (
              <View testID="note-memory-live-badge" style={[styles.badge, { backgroundColor: colors.card }]}>
                <LivePhotoIcon size={18} color={colors.primary} />
              </View>
            ) : null}
            {note.isFavorite ? (
              <View testID="note-memory-favorite-badge" style={[styles.badge, { backgroundColor: colors.card }]}>
                <Ionicons name="heart" size={16} color={colors.danger} />
              </View>
            ) : null}
          </View>
        ) : null}
        {isSharedByMe ? (
          <View
            testID="note-memory-shared-badge"
            pointerEvents="none"
            style={[styles.badge, styles.leftBadge, { backgroundColor: colors.card }]}
          >
            <Ionicons name="people-outline" size={16} color={colors.secondaryText} />
          </View>
        ) : null}
      </View>

      <View style={[styles.metaContainer, { width: resolvedCardSize }]}>
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
                  <View style={styles.metadataLocationGroup}>
                    <Ionicons name="location" size={14} color={colors.secondaryText} />
                    <Text style={[styles.metadataPillText, { color: colors.text }]} numberOfLines={1}>
                      {locationLabel}
                    </Text>
                  </View>
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
                <View style={styles.metadataLocationGroup}>
                  <Ionicons name="location" size={14} color={colors.secondaryText} />
                  <Text style={[styles.metadataPillText, { color: colors.text }]} numberOfLines={1}>
                    {locationLabel}
                  </Text>
                </View>
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
  cardSize,
  containerStyle,
  isActive = false,
  showSharedBadge = false,
}: SharedPostMemoryCardProps) {
  const { width } = useWindowDimensions();
  const now = useRelativeTimeNow();
  const resolvedCardSize = cardSize ?? width - (Layout.screenPadding - 8) * 2;
  const authorLabel = post.authorDisplayName ?? t('shared.someone', 'Someone');
  const dateStr = formatNoteTimestamp(post.createdAt, 'card', now);
  const debugTiltOverride = useSharedValue<DebugTiltState>(DEFAULT_DEBUG_TILT_STATE);
  const placeLabel = post.placeName ?? t('shared.sharedNow', 'Shared now');

  const content = (
    <View style={[styles.cardRoot, containerStyle, { width: resolvedCardSize }]}>
      <View style={[styles.sharedCardWrap, { width: resolvedCardSize }]}>
        <View style={[styles.noteCardWrapper, { width: resolvedCardSize, height: resolvedCardSize }]}>
          <View style={styles.cardFill}>
            <SharedPostCardVisual
              post={post}
              fallbackText={t('shared.noteFallback', 'Shared note')}
              isActive={isActive}
              debugTiltOverride={debugTiltOverride}
            />
          </View>
          {showSharedBadge ? (
            <View
              pointerEvents="none"
              style={[
                styles.sharedBadge,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.primarySoft ?? colors.border ?? colors.card,
                },
              ]}
            >
              <Ionicons name="paper-plane-outline" size={14} color={colors.primary} />
              <Text style={[styles.sharedBadgeText, { color: colors.primary }]}>
                {t('shared.cardBadge', 'Shared')}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.metaContainer, { width: resolvedCardSize }]}>
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
              <InfoPill style={styles.metadataPill}>
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
                    <View style={styles.metadataLocationGroup}>
                      <Ionicons name="location" size={14} color={colors.secondaryText} />
                      <Text style={[styles.metadataPillText, { color: colors.text }]} numberOfLines={1}>
                        {placeLabel}
                      </Text>
                    </View>
                    <View style={[styles.metadataPillDot, { backgroundColor: colors.secondaryText }]} />
                    <Text style={[styles.metadataPillDate, { color: colors.secondaryText }]}>{dateStr}</Text>
                  </View>
                  <View style={styles.metadataPillAction}>
                    <Text
                      numberOfLines={1}
                      style={[styles.metadataActionText, { color: colors.primary }]}
                    >
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
                  <View style={styles.metadataLocationGroup}>
                    <Ionicons name="location" size={14} color={colors.secondaryText} />
                    <Text style={[styles.metadataPillText, { color: colors.text }]} numberOfLines={1}>
                      {placeLabel}
                    </Text>
                  </View>
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
  badge: {
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
  badgeStack: {
    position: 'absolute',
    top: 18,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  leftBadge: {
    position: 'absolute',
    top: 18,
    left: 24,
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
  sharedBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  sharedBadgeText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
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
    minHeight: 42,
    maxWidth: '85%',
    paddingHorizontal: 10,
    paddingVertical: 0,
    borderRadius: Radii.pill,
  },
  metadataPressable: {
    alignSelf: 'center',
    maxWidth: '85%',
  },
  metadataPressablePressed: {
    opacity: 0.84,
  },
  metadataPillText: {
    ...Typography.pill,
    flexShrink: 1,
    minWidth: 0,
  },
  metadataLocationGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    minWidth: 0,
  },
  metadataPillDate: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'Noto Sans',
    flexShrink: 0,
  },
  metadataPillDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 2,
  },
  metadataPillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    minWidth: 0,
  },
  metadataPillMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
    flexShrink: 1,
  },
  metadataPillAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
    marginLeft: 8,
  },
  metadataActionText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Noto Sans',
  },
});
