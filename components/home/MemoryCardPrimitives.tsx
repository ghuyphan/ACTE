import { Ionicons } from '@expo/vector-icons';
import { TFunction } from 'i18next';
import { Image } from 'expo-image';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, useWindowDimensions, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
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

function MetadataContainer({
  accessibilityLabel,
  children,
  onPress,
}: {
  accessibilityLabel?: string;
  children: ReactNode;
  onPress?: () => void;
}) {
  const pill = <InfoPill style={styles.metadataPill}>{children}</InfoPill>;

  if (!onPress) {
    return pill;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.metadataPressable,
        pressed ? styles.metadataPressablePressed : null,
      ]}
    >
      {pill}
    </Pressable>
  );
}

function MetadataAction({
  color,
  label,
}: {
  color: string;
  label: string;
}) {
  return (
    <View style={styles.metadataPillAction}>
      <Text style={[styles.metadataActionText, { color }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={14} color={color} />
    </View>
  );
}

const BADGE_COLLAPSED_SIZE = 36;
const BADGE_GLYPH_BOX = 18;
const BADGE_HORIZONTAL_PADDING = 10;
const BADGE_LABEL_GAP = 6;
const BADGE_EXPAND_IN_DURATION_MS = 180;
const BADGE_EXPAND_OUT_DURATION_MS = 140;

function estimateBadgeLabelWidth(label: string) {
  return Math.max(32, Math.ceil(label.trim().length * 7.6));
}

function ExpandableStatusBadge({
  accessibilityHint,
  accessibilityLabel,
  backgroundColor,
  expanded,
  icon,
  label,
  labelColor,
  onPress,
  side,
  testID,
}: {
  accessibilityHint: string;
  accessibilityLabel: string;
  backgroundColor: string;
  expanded: boolean;
  icon: ReactNode;
  label: string;
  labelColor: string;
  onPress: () => void;
  side: 'left' | 'right';
  testID: string;
}) {
  const progress = useSharedValue(expanded ? 1 : 0);
  const labelWidth = useMemo(() => estimateBadgeLabelWidth(label), [label]);

  useEffect(() => {
    progress.value = withTiming(expanded ? 1 : 0, {
      duration: expanded ? BADGE_EXPAND_IN_DURATION_MS : BADGE_EXPAND_OUT_DURATION_MS,
      easing: expanded ? Easing.out(Easing.cubic) : Easing.inOut(Easing.quad),
    });
  }, [expanded, progress]);

  const targetExpandedWidth = Math.max(
    BADGE_COLLAPSED_SIZE,
    BADGE_HORIZONTAL_PADDING * 2 + BADGE_GLYPH_BOX + BADGE_LABEL_GAP + labelWidth
  );

  const animatedContainerStyle = useAnimatedStyle(() => ({
    width:
      BADGE_COLLAPSED_SIZE + (targetExpandedWidth - BADGE_COLLAPSED_SIZE) * progress.value,
    paddingHorizontal: BADGE_HORIZONTAL_PADDING * progress.value,
  }));

  const animatedLabelStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    width: labelWidth * progress.value,
    marginLeft: side === 'left' ? BADGE_LABEL_GAP * progress.value : 0,
    marginRight: side === 'right' ? BADGE_LABEL_GAP * progress.value : 0,
    transform: [
      {
        translateX: side === 'right' ? -6 * (1 - progress.value) : 6 * (1 - progress.value),
      },
    ],
  }));

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      hitSlop={8}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.badgePressable, pressed ? styles.badgePressablePressed : null]}
    >
      <Animated.View
        style={[
          styles.badge,
          styles.expandableBadge,
          expanded
            ? side === 'right'
              ? styles.rightExpandableBadgeExpanded
              : styles.leftExpandableBadgeExpanded
            : null,
          animatedContainerStyle,
          { backgroundColor },
        ]}
      >
        {side === 'right' ? (
          <>
            <Animated.View style={[styles.badgeLabelWrap, animatedLabelStyle]}>
              <Text numberOfLines={1} style={[styles.expandableBadgeText, { color: labelColor }]}>
                {label}
              </Text>
            </Animated.View>
            <View style={styles.badgeGlyph}>{icon}</View>
          </>
        ) : (
          <>
            <View style={styles.badgeGlyph}>{icon}</View>
            <Animated.View style={[styles.badgeLabelWrap, animatedLabelStyle]}>
              <Text numberOfLines={1} style={[styles.expandableBadgeText, { color: labelColor }]}>
                {label}
              </Text>
            </Animated.View>
          </>
        )}
      </Animated.View>
    </Pressable>
  );
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
  const [expandedBadgeKey, setExpandedBadgeKey] = useState<'shared' | 'live-photo' | 'favorite' | null>(null);
  const sharedStatusLabel = t('home.noteStatusShared', 'Shared');
  const sharedStatusA11yLabel = t('home.noteStatusSharedA11y', 'Shared with friends');
  const livePhotoPreviewHintLabel = t('home.noteStatusLivePhotoHint', 'Hold to preview');
  const livePhotoStatusA11yLabel = t('home.noteStatusLivePhotoA11y', 'Live Photo memory');
  const favoriteStatusLabel = t('home.noteStatusFavorite', 'Favorite');
  const favoriteStatusA11yLabel = t('home.noteStatusFavoriteA11y', 'Marked as favorite');
  const statusDisclosureHint = t('home.noteStatusShowHint', 'Shows what this badge means');
  const toggleExpandedBadge = (key: 'shared' | 'live-photo' | 'favorite') => {
    setExpandedBadgeKey((current) => (current === key ? null : key));
  };
  const noteMetadata = (
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
      {onPress ? (
        <MetadataAction
          color={colors.primary}
          label={t('home.openDetails', 'Details')}
        />
      ) : null}
    </View>
  );

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
              enablePlayback={isActive}
              autoPreviewOnceOnEnable={isActive}
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
            {note.isFavorite ? (
              <ExpandableStatusBadge
                accessibilityHint={statusDisclosureHint}
                accessibilityLabel={favoriteStatusA11yLabel}
                backgroundColor={colors.card}
                expanded={expandedBadgeKey === 'favorite'}
                icon={<Ionicons name="heart" size={16} color={colors.danger} />}
                label={favoriteStatusLabel}
                labelColor={colors.danger}
                onPress={() => toggleExpandedBadge('favorite')}
                side="right"
                testID="note-memory-favorite-badge"
              />
            ) : null}
            {note.isLivePhoto ? (
              <ExpandableStatusBadge
                accessibilityHint={statusDisclosureHint}
                accessibilityLabel={livePhotoStatusA11yLabel}
                backgroundColor={colors.card}
                expanded={expandedBadgeKey === 'live-photo'}
                icon={<LivePhotoIcon size={16} color={colors.primary} />}
                label={livePhotoPreviewHintLabel}
                labelColor={colors.primary}
                onPress={() => toggleExpandedBadge('live-photo')}
                side="right"
                testID="note-memory-live-badge"
              />
            ) : null}
          </View>
        ) : null}
        {isSharedByMe ? (
          <View style={styles.leftBadge}>
            <ExpandableStatusBadge
              accessibilityHint={statusDisclosureHint}
              accessibilityLabel={sharedStatusA11yLabel}
              backgroundColor={colors.card}
              expanded={expandedBadgeKey === 'shared'}
              icon={<Ionicons name="people-outline" size={16} color={colors.secondaryText} />}
              label={sharedStatusLabel}
              labelColor={colors.secondaryText}
              onPress={() => toggleExpandedBadge('shared')}
              side="left"
              testID="note-memory-shared-badge"
            />
          </View>
        ) : null}
      </View>

      <View style={[styles.metaContainer, { width: resolvedCardSize }]}>
        <MetadataContainer
          accessibilityLabel={
            onPress
              ? t('home.openNoteDetailsA11y', {
                  defaultValue: 'Open note details for {{location}}',
                  location: locationLabel,
                })
              : undefined
          }
          onPress={onPress}
        >
          {noteMetadata}
        </MetadataContainer>
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
  const authorAvatar = post.authorPhotoURLSnapshot ? (
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
  );
  const sharedMetadata = (
    <View style={styles.metadataPillContent}>
      <View style={styles.metadataPillMain}>
        {authorAvatar}
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
      {onPress ? (
        <MetadataAction
          color={colors.primary}
          label={t('home.openDetails', 'Details')}
        />
      ) : null}
    </View>
  );

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
          <MetadataContainer
            accessibilityLabel={
              onPress
                ? t('shared.openSharedDetailsA11y', {
                    defaultValue: 'Open shared post details for {{location}}',
                    location: placeLabel,
                  })
                : undefined
            }
            onPress={onPress}
          >
            {sharedMetadata}
          </MetadataContainer>
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
    height: 36,
    minWidth: 36,
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
  badgePressable: {
    borderRadius: 18,
  },
  badgePressablePressed: {
    opacity: 0.9,
    transform: [{ scale: 0.96 }],
  },
  badgeStack: {
    position: 'absolute',
    top: 18,
    right: 24,
    flexDirection: 'row-reverse',
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
  expandableBadge: {
    width: BADGE_COLLAPSED_SIZE,
    minWidth: BADGE_COLLAPSED_SIZE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  leftExpandableBadgeExpanded: {
    justifyContent: 'flex-start',
  },
  rightExpandableBadgeExpanded: {
    justifyContent: 'flex-end',
  },
  badgeGlyph: {
    width: BADGE_GLYPH_BOX,
    height: BADGE_GLYPH_BOX,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLabelWrap: {
    overflow: 'hidden',
    flexShrink: 1,
  },
  expandableBadgeText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
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
