import { Ionicons } from '@expo/vector-icons';
import { GlassView } from '../ui/GlassView';
import { Image } from 'expo-image';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Radii, Shadows, Typography } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { FriendConnection, SharedPost } from '../../services/sharedFeedService';
import { isOlderIOS } from '../../utils/platform';
import ImageMemoryCard from '../ImageMemoryCard';
import TextMemoryCard from '../TextMemoryCard';
import InfoPill from '../ui/InfoPill';

function PostCard({ post }: { post: SharedPost }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const authorLabel = post.authorDisplayName ?? t('shared.someone', 'Someone');
  const locationLabel = post.placeName ?? t('shared.sharedNow', 'Shared now');

  return (
    <View>
      <View style={styles.postCard}>
        <View style={styles.postVisual}>
          {post.type === 'photo' && post.photoLocalUri ? (
            <ImageMemoryCard imageUrl={post.photoLocalUri} doodleStrokesJson={post.doodleStrokesJson} />
          ) : (
            <TextMemoryCard text={post.text || t('shared.photoMemory', 'Photo memory')} noteId={post.id} />
          )}
        </View>

        <View style={styles.metaRow}>
          <InfoPill style={styles.authorPill}>
            {post.authorPhotoURLSnapshot ? (
              <Image source={{ uri: post.authorPhotoURLSnapshot }} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: colors.primarySoft }]}>
                <Text style={[styles.avatarFallbackLabel, { color: colors.primary }]}>
                  {authorLabel.trim().charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={[styles.authorText, { color: colors.text }]} numberOfLines={1}>
              {authorLabel}
            </Text>
          </InfoPill>

          <InfoPill icon="location" iconColor={colors.secondaryText} style={styles.locationPill}>
            <Text style={[styles.locationText, { color: colors.text }]} numberOfLines={1}>
              {locationLabel}
            </Text>
          </InfoPill>
        </View>
      </View>
    </View>
  );
}

export default function SharedMomentsStrip({
  enabled,
  signedIn,
  loading,
  friends,
  sharedPosts,
  onOpenManage,
  onOpenAuth,
}: {
  enabled: boolean;
  signedIn: boolean;
  loading: boolean;
  friends: FriendConnection[];
  sharedPosts: SharedPost[];
  onOpenManage: () => void;
  onOpenAuth: () => void;
}) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();

  const glassOverlay = isDark ? 'rgba(18,18,24,0.56)' : 'rgba(255,255,255,0.72)';
  const emptyTitle = useMemo(() => {
    if (!enabled) {
      return t('shared.unavailableTitle', 'Shared moments unavailable');
    }
    if (!signedIn) {
      return t('shared.signInTitle', 'Sign in to share with friends');
    }
    if (friends.length === 0) {
      return t('shared.emptyFriendsTitle', 'No friends connected yet');
    }
    return t('shared.emptyPostsTitle', 'Your shared feed is ready');
  }, [enabled, friends.length, signedIn, t]);

  const emptyBody = useMemo(() => {
    if (!enabled) {
      return t('shared.unavailableBody', 'This build does not have shared social enabled right now.');
    }
    if (!signedIn) {
      return t('shared.signInBody', 'Connect your account to start a private shared feed with friends.');
    }
    if (friends.length === 0) {
      return t('shared.emptyFriendsBody', 'Invite someone and the moments you share together will appear here.');
    }
    return t('shared.emptyPostsBody', 'Your shared posts and theirs will start appearing here as soon as someone sends one.');
  }, [enabled, friends.length, signedIn, t]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>
            {t('shared.sectionEyebrow', 'Shared moments')}
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('shared.sectionTitle', 'Friends on Home')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
            {t('shared.sectionSubtitle', 'A quiet shared strip that lives right beside your private journal.')}
          </Text>
        </View>

        <Pressable
          onPress={signedIn ? onOpenManage : onOpenAuth}
          style={({ pressed }) => [
            styles.manageButton,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.68)',
              opacity: pressed ? 0.92 : 1,
              transform: [{ scale: pressed ? 0.985 : 1 }],
            },
          ]}
        >
          <Ionicons name={signedIn ? 'people-outline' : 'person-circle-outline'} size={18} color={colors.primary} />
        </Pressable>
      </View>

      <View
        style={[
          styles.shell,
          {
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.92)',
          },
        ]}
      >
        <GlassView
          style={StyleSheet.absoluteFillObject}
          glassEffectStyle="regular"
          colorScheme={isDark ? 'dark' : 'light'}
        />
        <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: glassOverlay }]} />
        {isOlderIOS ? (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              {
                borderRadius: 30,
                backgroundColor: isDark ? 'rgba(18,18,24,0.9)' : 'rgba(255,255,255,0.92)',
              },
            ]}
          />
        ) : null}

        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : sharedPosts.length > 0 ? (
          <View style={styles.content}>
            <View style={styles.statsRow}>
              <View
                style={[
                  styles.statPill,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                  },
                ]}
              >
                <Ionicons name="people-outline" size={14} color={colors.primary} />
                <Text style={[styles.statText, { color: colors.text }]}>
                  {t('shared.friendsCount', '{{count}} friends', { count: friends.length })}
                </Text>
              </View>
              <View
                style={[
                  styles.statPill,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                  },
                ]}
              >
                <Ionicons name="sparkles-outline" size={14} color={colors.primary} />
                <Text style={[styles.statText, { color: colors.text }]}>
                  {t('shared.postsCount', '{{count}} shared', { count: sharedPosts.length })}
                </Text>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.postsRow}
            >
              {sharedPosts.map((post, index) => (
                <PostCard key={post.id} post={post} />
              ))}
            </ScrollView>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <View
              style={[
                styles.emptyBadge,
                {
                  backgroundColor: colors.primarySoft,
                },
              ]}
            >
              <Ionicons name="sparkles-outline" size={20} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{emptyTitle}</Text>
            <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>{emptyBody}</Text>
            <Pressable
              onPress={signedIn ? onOpenManage : onOpenAuth}
              style={({ pressed }) => [
                styles.emptyAction,
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.92 : 1,
                  transform: [{ scale: pressed ? 0.985 : 1 }],
                },
              ]}
            >
              <Ionicons
                name={signedIn ? 'share-social-outline' : 'person-circle-outline'}
                size={18}
                color="#1C1C1E"
              />
              <Text style={styles.emptyActionText}>
                {signedIn ? t('shared.manageButton', 'Manage') : t('shared.signInButton', 'Sign in')}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  title: {
    marginTop: 6,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    ...Typography.body,
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
  },
  manageButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.button,
  },
  shell: {
    overflow: 'hidden',
    borderRadius: 30,
    borderWidth: 1,
    minHeight: 182,
    ...Shadows.floating,
  },
  loadingState: {
    minHeight: 182,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingVertical: 14,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  statText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
  },
  postsRow: {
    paddingHorizontal: 14,
    gap: 12,
  },
  postCard: {
    width: 188,
  },
  postVisual: {
    width: '100%',
    height: 188,
  },
  metaRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  authorPill: {
    maxWidth: 118,
    paddingLeft: 8,
    paddingRight: 12,
  },
  authorText: {
    ...Typography.pill,
    flexShrink: 1,
  },
  locationPill: {
    flex: 1,
  },
  locationText: {
    ...Typography.pill,
    flexShrink: 1,
  },
  avatarImage: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  avatarFallback: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackLabel: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '800',
  },
  emptyState: {
    minHeight: 182,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  emptyBadge: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    marginTop: 14,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyBody: {
    ...Typography.body,
    marginTop: 8,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  emptyAction: {
    minHeight: 48,
    marginTop: 16,
    borderRadius: 18,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyActionText: {
    color: '#1C1C1E',
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '800',
  },
});
