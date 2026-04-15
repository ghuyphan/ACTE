import { Ionicons } from '@expo/vector-icons';
import { TFunction } from 'i18next';
import { memo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { HomeFeedBootstrapState } from '../../hooks/app/useHomeFeedViewModel';
import * as Haptics from '../../hooks/useHaptics';
import type { HomeFeedMode } from '../../hooks/app/useHomeFeedViewModel';
import CatBoxIcon from '../ui/CatBoxIcon';

interface HomeFeedEmptyStateProps {
  mode: Exclude<HomeFeedMode, 'content'>;
  bootstrapState?: HomeFeedBootstrapState;
  colors: {
    primary: string;
    text: string;
    secondaryText: string;
  };
  t: TFunction;
  onDisableFriendsFilter: () => void;
  onOpenFriends: () => void;
  onTakePhotoHere: () => void;
  onWriteOneSentence: () => void;
  onRetryBootstrap?: () => void;
}

function HomeFeedEmptyState({
  mode,
  bootstrapState = 'idle',
  colors,
  t,
  onDisableFriendsFilter,
  onOpenFriends,
  onTakePhotoHere,
  onWriteOneSentence,
  onRetryBootstrap,
}: HomeFeedEmptyStateProps) {
  const isSyncingEmpty = mode === 'syncing-empty';
  const isBootstrapBlocked = mode === 'bootstrap-blocked-empty';
  const isFriendsEmpty = mode === 'friends-empty';
  const syncingTitle =
    bootstrapState === 'switching-account'
      ? t('home.bootstrapSwitchingTitle', 'Opening your account')
      : bootstrapState === 'loading-shared'
          ? t('home.bootstrapLoadingSharedTitle', 'Loading shared memories')
          : t('home.syncingEmptyTitle', 'Importing your cloud notes');
  const syncingBody =
    bootstrapState === 'switching-account'
      ? t(
          'home.bootstrapSwitchingBody',
          'We are switching from local notes to your signed-in account now.'
        )
      : bootstrapState === 'loading-shared'
          ? t(
              'home.bootstrapLoadingSharedBody',
              'We are checking your shared feed and friend activity before showing Home.'
            )
          : t(
              'home.syncingEmptyBody',
              'We are pulling in your notes and shared memories from the cloud now. This usually takes just a moment.'
            );
  const blockedTitle =
    bootstrapState === 'disabled'
      ? t('home.bootstrapDisabledTitle', 'Cloud sync is turned off')
      : bootstrapState === 'offline'
        ? t('home.bootstrapOfflineTitle', 'You are offline right now')
        : t('home.bootstrapErrorTitle', 'Could not load your cloud notes');
  const blockedBody =
    bootstrapState === 'disabled'
      ? t(
          'home.bootstrapDisabledBody',
          'Turn cloud sync back on in Settings to load the notes saved to this account.'
        )
      : bootstrapState === 'offline'
        ? t(
            'home.bootstrapOfflineBody',
            'Reconnect to the internet, then pull down or tap retry to load the notes saved to this account.'
          )
        : t(
            'home.bootstrapErrorBody',
            'Something interrupted the first cloud load. Pull down or tap retry and we will try again.'
          );
  const shouldShowRetryAction =
    isBootstrapBlocked &&
    (bootstrapState === 'offline' || bootstrapState === 'error') &&
    typeof onRetryBootstrap === 'function';

  return (
    <View style={styles.emptyState} testID="home-feed-empty-state">
      <View style={styles.emptyIconWrap}>
        {isSyncingEmpty ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : isBootstrapBlocked ? (
          <Ionicons name="cloud-offline-outline" size={44} color={colors.secondaryText} />
        ) : isFriendsEmpty ? (
          <Ionicons name="people-outline" size={44} color={colors.secondaryText} />
        ) : (
          <CatBoxIcon size={50} color={colors.secondaryText} />
        )}
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        {isSyncingEmpty
          ? syncingTitle
          : isBootstrapBlocked
            ? blockedTitle
          : isFriendsEmpty
            ? t('shared.emptyFriendPostsTitle', 'No friend posts yet')
            : t('home.firstNoteEmptyTitle', 'Your journal is waiting')}
      </Text>
      <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>
        {isSyncingEmpty
          ? syncingBody
          : isBootstrapBlocked
            ? blockedBody
          : isFriendsEmpty
            ? t(
                'shared.emptyFriendPostsBody',
                'When friends share a memory, it will appear here. Switch back to All to see your notes.'
              )
            : t(
                'home.firstNoteEmptyBody',
                'Save your first note or photo to start filling this space.'
              )}
      </Text>
      {isFriendsEmpty ? (
        <View style={styles.emptyActions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onDisableFriendsFilter();
            }}
            style={({ pressed }) => [
              styles.emptyButton,
              {
                opacity: pressed ? 0.72 : 1,
              },
            ]}
          >
            <Text style={[styles.emptyButtonText, { color: colors.primary }]}>
              {t('home.feedFilterAll', 'All')}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onOpenFriends();
            }}
            style={({ pressed }) => [
              styles.emptyButton,
              {
                opacity: pressed ? 0.72 : 1,
              },
            ]}
          >
            <Text style={[styles.emptyButtonText, { color: colors.primary }]}>
              {t('shared.manageTitle', 'Friends')}
            </Text>
          </Pressable>
        </View>
      ) : shouldShowRetryAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onRetryBootstrap?.();
          }}
          style={({ pressed }) => [
            styles.emptyButton,
            {
              opacity: pressed ? 0.72 : 1,
            },
          ]}
        >
          <Text style={[styles.emptyButtonText, { color: colors.primary }]}>
            {t('home.bootstrapRetryButton', 'Retry')}
          </Text>
        </Pressable>
      ) : mode === 'first-note-empty' ? (
        <View style={styles.firstNoteActionList}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onWriteOneSentence();
            }}
            style={({ pressed }) => [
              styles.inlineActionButton,
              {
                opacity: pressed ? 0.72 : 1,
              },
            ]}
          >
            <Text style={[styles.inlineActionText, { color: colors.text }]}>
              {t('home.firstNoteActionTextTitle', 'Write')}
            </Text>
          </Pressable>
          <View style={[styles.inlineActionDivider, { backgroundColor: colors.secondaryText }]} />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onTakePhotoHere();
            }}
            style={({ pressed }) => [
              styles.inlineActionButton,
              {
                opacity: pressed ? 0.72 : 1,
              },
            ]}
          >
            <Text style={[styles.inlineActionText, { color: colors.secondaryText }]}>
              {t('home.firstNoteActionPhotoTitle', 'Photo')}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export default memo(HomeFeedEmptyState);

const styles = StyleSheet.create({
  emptyState: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    fontFamily: 'Noto Sans',
  },
  emptyBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    fontFamily: 'Noto Sans',
    maxWidth: 240,
  },
  emptyButton: {
    marginTop: 16,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    marginTop: 4,
  },
  emptyButtonText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
    fontFamily: 'Noto Sans',
  },
  firstNoteActionList: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 18,
  },
  inlineActionButton: {
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineActionText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
    textAlign: 'center',
  },
  inlineActionDivider: {
    width: 4,
    height: 4,
    borderRadius: 2,
    opacity: 0.35,
  },
});
