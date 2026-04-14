import { Ionicons } from '@expo/vector-icons';
import { TFunction } from 'i18next';
import { memo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from '../../hooks/useHaptics';
import type { HomeFeedMode } from '../../hooks/app/useHomeFeedViewModel';
import CatBoxIcon from '../ui/CatBoxIcon';

interface HomeFeedEmptyStateProps {
  mode: Exclude<HomeFeedMode, 'content'>;
  colors: {
    primary: string;
    text: string;
    secondaryText: string;
  };
  t: TFunction;
  onDisableFriendsFilter: () => void;
  onOpenFriends: () => void;
  onCreateFirstMemory: () => void;
}

function HomeFeedEmptyState({
  mode,
  colors,
  t,
  onDisableFriendsFilter,
  onOpenFriends,
  onCreateFirstMemory,
}: HomeFeedEmptyStateProps) {
  const isSyncingEmpty = mode === 'syncing-empty';
  const isFriendsEmpty = mode === 'friends-empty';

  return (
    <View style={styles.emptyState} testID="home-feed-empty-state">
      <View style={styles.emptyIconWrap}>
        {isSyncingEmpty ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : isFriendsEmpty ? (
          <Ionicons name="people-outline" size={44} color={colors.secondaryText} />
        ) : (
          <CatBoxIcon size={50} color={colors.secondaryText} />
        )}
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        {isSyncingEmpty
          ? t('home.syncingEmptyTitle', 'Syncing your memories')
          : isFriendsEmpty
            ? t('shared.emptyFriendPostsTitle', 'No friend posts yet')
            : t('home.firstNoteEmptyTitle', 'Your journal is waiting')}
      </Text>
      <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>
        {isSyncingEmpty
          ? t(
              'home.syncingEmptyBody',
              'We are pulling in your notes and shared memories now. This usually takes just a moment.'
            )
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
      ) : mode === 'first-note-empty' ? (
        <View style={styles.emptyActions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onCreateFirstMemory();
            }}
            style={({ pressed }) => [
              styles.emptyButton,
              {
                opacity: pressed ? 0.72 : 1,
              },
            ]}
          >
            <Text style={[styles.emptyButtonText, { color: colors.primary }]}>
              {t('home.createFirst', 'Save your first memory')}
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
});
