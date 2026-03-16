import { Ionicons } from '@expo/vector-icons';
import { GlassView } from 'expo-glass-effect';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
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
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Radii, Shadows, Typography } from '../../constants/theme';
import { CardGradients, useTheme } from '../../hooks/useTheme';
import { FriendConnection, SharedPost } from '../../services/sharedFeedService';
import { isOlderIOS } from '../../utils/platform';

function hashToIndex(str: string, max: number): number {
  let hash = 0;
  for (let index = 0; index < str.length; index += 1) {
    hash = (hash * 31 + str.charCodeAt(index)) % max;
  }
  return Math.abs(hash) % max;
}

function PostCard({ post, index }: { post: SharedPost; index: number }) {
  const { t } = useTranslation();
  const gradient = CardGradients[hashToIndex(post.id, CardGradients.length)];
  const authorLabel = post.authorDisplayName ?? t('shared.someone', 'Someone');

  return (
    <Animated.View entering={FadeInUp.delay(index * 70).springify().damping(18).mass(0.8)}>
      <View style={styles.postCard}>
        {post.type === 'photo' && post.photoLocalUri ? (
          <View style={styles.photoCard}>
            <Image source={{ uri: post.photoLocalUri }} style={styles.postImage} contentFit="cover" />
            <LinearGradient
              colors={['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.48)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.postOverlayFooter}>
              <Text style={styles.postOverlayAuthor} numberOfLines={1}>
                {authorLabel}
              </Text>
              <Text style={styles.postOverlayCaption} numberOfLines={1}>
                {post.placeName ?? t('shared.sharedNow', 'Shared now')}
              </Text>
            </View>
          </View>
        ) : (
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.textPostCard}
          >
            <Text style={styles.textPostAuthor} numberOfLines={1}>
              {authorLabel}
            </Text>
            <Text style={styles.textPostBody} numberOfLines={4}>
              {post.text || t('shared.photoMemory', 'Photo memory')}
            </Text>
            {post.placeName ? (
              <Text style={styles.textPostPlace} numberOfLines={1}>
                {post.placeName}
              </Text>
            ) : null}
          </LinearGradient>
        )}
      </View>
    </Animated.View>
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
                <PostCard key={post.id} post={post} index={index} />
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
    width: 170,
  },
  photoCard: {
    height: 176,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#1C1C1E',
  },
  postImage: {
    ...StyleSheet.absoluteFillObject,
  },
  postOverlayFooter: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
  },
  postOverlayAuthor: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  postOverlayCaption: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '500',
  },
  textPostCard: {
    height: 176,
    borderRadius: 24,
    padding: 16,
    justifyContent: 'space-between',
  },
  textPostAuthor: {
    color: '#FFF8F0',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  textPostBody: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
  },
  textPostPlace: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '500',
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
