import { FlashList } from '@shopify/flash-list';
import { Stack, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SharedPostMemoryCard } from '../../home/MemoryCardPrimitives';
import { Layout } from '../../../constants/theme';
import { useAuth } from '../../../hooks/useAuth';
import { useSocialPushPermission } from '../../../hooks/useSocialPushPermission';
import { useSharedFeedStore } from '../../../hooks/useSharedFeed';
import { useTheme } from '../../../hooks/useTheme';
import { SharedPost } from '../../../services/sharedFeedService';
import { formatNoteTimestamp } from '../../../utils/dateUtils';

const { width } = Dimensions.get('window');
const DEFAULT_SHARED_CARD_SIZE = width - (Layout.screenPadding - 8) * 2;
const ESTIMATED_SHARED_CARD_HEIGHT = DEFAULT_SHARED_CARD_SIZE + 84;

export default function SharedIndexScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isReady: authReady, user } = useAuth();
  const { enableFromPrompt, isLoading: isSocialPushLoading, status: socialPushStatus } =
    useSocialPushPermission();
  const { dataSource, enabled, lastUpdatedAt, loading, sharedPosts } = useSharedFeedStore();

  const sortedPosts = useMemo(
    () => [...sharedPosts].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [sharedPosts]
  );
  const cacheBanner =
    dataSource === 'cache' ? (
      <View
        testID="shared-feed-cache-banner"
        style={[
          styles.cacheBanner,
          {
            backgroundColor: colors.primarySoft,
            borderColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.cacheBannerTitle, { color: colors.text }]}>
          {t('shared.cacheBannerTitle', 'Showing saved shared moments')}
        </Text>
        <Text style={[styles.cacheBannerBody, { color: colors.secondaryText }]}>
          {lastUpdatedAt
            ? t(
                'shared.cacheBannerBodyWithTime',
                'Last updated {{time}}. Live updates will resume when the connection returns.',
                { time: formatNoteTimestamp(lastUpdatedAt, 'card') }
              )
            : t(
                'shared.cacheBannerBody',
                'Live updates are unavailable right now, so Noto is showing your saved shared feed.'
              )}
        </Text>
      </View>
    ) : null;
  const showSocialPushBanner =
    enabled &&
    Boolean(user) &&
    !isSocialPushLoading &&
    (socialPushStatus === 'denied' || socialPushStatus === 'blocked');
  const socialPushBanner = showSocialPushBanner ? (
    <View
      testID="shared-feed-social-push-banner"
      style={[
        styles.socialPushBanner,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[styles.socialPushBannerTitle, { color: colors.text }]}>
        {t('shared.pushBlockedTitle', 'Turn on friend activity notifications')}
      </Text>
      <Text style={[styles.socialPushBannerBody, { color: colors.secondaryText }]}>
        {socialPushStatus === 'blocked'
          ? t(
              'shared.pushBlockedBody',
              'Notifications are off for Noto. Open Settings if you want alerts when friends accept invites or share memories.'
            )
          : t(
              'shared.pushDeferredBody',
              'Turn notifications on so Noto can tell you when friends accept invites or share moments with you.'
            )}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          void enableFromPrompt();
        }}
        style={({ pressed }) => [
          styles.socialPushBannerButton,
          { backgroundColor: colors.primary },
          pressed ? styles.socialPushBannerButtonPressed : null,
        ]}
      >
        <Text style={styles.socialPushBannerButtonLabel}>
          {socialPushStatus === 'blocked'
            ? t('common.openSettings', 'Open Settings')
            : t('onboarding.allowNotifications', 'Allow notifications')}
        </Text>
      </Pressable>
    </View>
  ) : null;

  const contentTopInset = insets.top + 72;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerShadowVisible: false,
          title: t('shared.viewAllTitle', 'Shared moments'),
          headerTintColor: colors.text,
          headerBackButtonDisplayMode: 'minimal',
          headerBackButtonMenuEnabled: false,
        }}
      />

      {!enabled ? (
        <View style={[styles.center, { paddingTop: contentTopInset }]}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {t('shared.unavailableTitle', 'Shared moments unavailable')}
          </Text>
          <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>
            {t('shared.unavailableBody', 'This build does not have shared social enabled right now.')}
          </Text>
        </View>
      ) : !authReady ? (
        <View style={styles.flexFill}>
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        </View>
      ) : !user ? (
        <View style={[styles.center, { paddingTop: contentTopInset }]}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {t('shared.signInTitle', 'Sign in to connect with friends')}
          </Text>
          <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>
            {t('shared.signInBody', 'Connect your account to invite and join friends on Home.')}
          </Text>
          <Pressable
            onPress={() => {
              router.push({
                pathname: '/auth',
                params: {
                  returnTo: '/shared',
                },
              } as any);
            }}
            style={[styles.signInButton, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.signInButtonLabel}>
              {t('shared.signInButton', 'Sign in')}
            </Text>
          </Pressable>
        </View>
      ) : loading && sortedPosts.length === 0 ? (
        <View style={styles.flexFill}>
          {cacheBanner || socialPushBanner ? (
            <View style={styles.bannerShell}>
              {cacheBanner}
              {socialPushBanner}
            </View>
          ) : null}
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        </View>
      ) : (
        <FlashList
          data={sortedPosts}
          keyExtractor={(item) => item.id}
          getItemType={(item) => item.type}
          drawDistance={ESTIMATED_SHARED_CARD_HEIGHT * 2}
          renderItem={({ item }: { item: SharedPost }) => (
            <SharedPostMemoryCard
              post={item}
              colors={colors}
              t={t}
              containerStyle={styles.cardRow}
              showSharedBadge={user?.uid === item.authorUid}
              onPress={() => {
                router.push(`/shared/${item.id}` as any);
              }}
            />
          )}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            cacheBanner || socialPushBanner ? (
              <View style={styles.bannerListHeader}>
                {cacheBanner}
                {socialPushBanner}
              </View>
            ) : null
          }
          contentContainerStyle={{
            paddingTop: contentTopInset,
            paddingBottom: insets.bottom + 32,
            paddingHorizontal: Layout.screenPadding,
          }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {t('shared.emptyPostsTitle', 'You\'re connected')}
              </Text>
              <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>
                {t('shared.emptyPostsBody', 'Shared notes will appear here as soon as either of you posts one.')}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flexFill: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Layout.screenPadding,
    gap: 10,
  },
  cardRow: {
    marginBottom: 28,
  },
  bannerShell: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: 12,
    gap: 12,
  },
  bannerListHeader: {
    paddingBottom: 18,
    gap: 12,
  },
  cacheBanner: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  cacheBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
  },
  cacheBannerBody: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Noto Sans',
  },
  socialPushBanner: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  socialPushBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
  },
  socialPushBannerBody: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Noto Sans',
  },
  socialPushBannerButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 14,
  },
  socialPushBannerButtonPressed: {
    opacity: 0.82,
  },
  socialPushBannerButtonLabel: {
    color: '#1C1C1E',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: 'Noto Sans',
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    fontFamily: 'Noto Sans',
  },
  signInButton: {
    marginTop: 8,
    borderRadius: 18,
    minHeight: 44,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  signInButtonLabel: {
    color: '#1C1C1E',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
  },
});
