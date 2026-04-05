import { Ionicons } from '@expo/vector-icons';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Image } from 'expo-image';
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  LinearTransition,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Sheet, Typography } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { FriendConnection, FriendInvite } from '../../services/sharedFeedService';
import AppSheet from '../sheets/AppSheet';
import AppSheetScaffold from '../sheets/AppSheetScaffold';
import SheetFooterButton from '../sheets/SheetFooterButton';

function ManageBody({
  friends,
  activeInvite,
  creatingInvite,
  loading,
  onCreateInvite,
  onShareInvite,
  onRevokeInvite,
  onRemoveFriend,
  emptyLoadingBody,
  emptyBody,
  friendFallback,
  connectedOnLabel,
}: {
  friends: FriendConnection[];
  activeInvite: FriendInvite | null;
  creatingInvite: boolean;
  loading: boolean;
  onCreateInvite: () => void;
  onShareInvite: () => void;
  onRevokeInvite: () => void;
  onRemoveFriend: (friendUid: string) => void;
  emptyLoadingBody: string;
  emptyBody: string;
  friendFallback: string;
  connectedOnLabel: string;
}) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const softFill = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const outlineColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const inviteState = activeInvite ? 'ready' : creatingInvite ? 'creating' : 'empty';
  const invitePrimaryAction = inviteState === 'ready' ? onShareInvite : onCreateInvite;
  const invitePrimaryIcon =
    inviteState === 'empty' ? 'person-add-outline' : 'paper-plane-outline';
  const invitePrimaryLabel =
    inviteState === 'ready'
      ? t('shared.shareInviteButton', 'Share invite link')
      : inviteState === 'creating'
        ? t('shared.creatingInviteButton', 'Preparing invite...')
        : t('shared.createInviteButton', 'Create invite');
  const inviteTitle =
    inviteState === 'ready'
      ? t('shared.inviteReadyTitle', 'Invite link ready')
      : inviteState === 'creating'
        ? t('shared.creatingInviteTitle', 'Preparing invite link')
        : t('shared.inviteFirstTitle', 'Invite your first friend');
  const inviteBody =
    inviteState === 'ready'
      ? t('shared.inviteReadyBody', 'Share this link to connect.')
      : inviteState === 'creating'
        ? t('shared.creatingInviteBody', 'Getting your invite link ready...')
        : t(
            'shared.inviteFirstBody',
            'One invite link is all you need to start sharing notes from Home.'
          );

  return (
    <>
      <View
        style={[
          styles.inviteCard,
          {
            backgroundColor: softFill,
            borderColor: outlineColor,
          },
        ]}
      >
        <View style={styles.inviteCardHeader}>
          <View style={[styles.inviteCardIcon, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name={invitePrimaryIcon} size={18} color={colors.primary} />
          </View>
          <View style={styles.inviteCardCopy}>
            <Text style={[styles.inviteCardTitle, { color: colors.text }]}>
              {inviteTitle}
            </Text>
            <Text style={[styles.inviteCardBody, { color: colors.secondaryText }]}>
              {inviteBody}
            </Text>
          </View>
        </View>
        <View style={styles.inviteActionsRow}>
          <Pressable
            onPress={invitePrimaryAction}
            disabled={inviteState === 'creating'}
            style={({ pressed }) => [
              styles.primaryInviteAction,
              {
                backgroundColor: colors.primary,
                opacity: inviteState === 'creating' ? 0.72 : pressed ? 0.92 : 1,
              },
            ]}
          >
            <Ionicons name={invitePrimaryIcon} size={16} color="#1C1C1E" />
            <Text numberOfLines={1} style={styles.primaryInviteActionText}>
              {invitePrimaryLabel}
            </Text>
          </Pressable>
          {inviteState === 'ready' ? (
            <Pressable
              onPress={onRevokeInvite}
              style={({ pressed }) => [
                styles.secondaryInviteAction,
                {
                  backgroundColor: softFill,
                  borderColor: outlineColor,
                  opacity: pressed ? 0.92 : 1,
                },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[styles.secondaryInviteActionText, { color: colors.secondaryText }]}
              >
                {t('shared.revokeInviteButton', 'Revoke invite')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t('shared.friendsListTitle', 'Your friends')}
        </Text>
        <View style={[styles.countPill, { backgroundColor: softFill }]}>
          <Text style={[styles.countPillText, { color: colors.text }]}>{friends.length}</Text>
        </View>
      </View>
      {friends.length === 0 ? (
        <View
          style={[
            styles.emptyStateCard,
            {
              backgroundColor: softFill,
              borderColor: outlineColor,
            },
          ]}
        >
          <View style={[styles.emptyStateIcon, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="people-outline" size={18} color={colors.primary} />
          </View>
          <Text style={[styles.emptyText, styles.emptyStateText, { color: colors.secondaryText }]}>
            {loading ? emptyLoadingBody : emptyBody}
          </Text>
        </View>
      ) : (
        friends.map((friend) => (
          <View
            key={friend.userId}
            style={[
              styles.friendRow,
              {
                borderBottomColor: outlineColor,
              },
            ]}
          >
            {friend.photoURLSnapshot ? (
              <Image
                source={{ uri: friend.photoURLSnapshot }}
                style={styles.avatarImage}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: colors.primarySoft }]}>
                <Text style={[styles.avatarLabel, { color: colors.primary }]}>
                  {(friend.displayNameSnapshot ?? 'F').trim().charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.friendCopy}>
              <Text style={[styles.friendName, { color: colors.text }]}>
                {friend.displayNameSnapshot ?? friendFallback}
              </Text>
              <Text style={[styles.friendMeta, { color: colors.secondaryText }]}>
                {`${connectedOnLabel} ${new Date(friend.friendedAt).toLocaleDateString()}`}
              </Text>
            </View>
            <Pressable
              onPress={() => onRemoveFriend(friend.userId)}
              style={({ pressed }) => [
                styles.removeButton,
                {
                  backgroundColor: softFill,
                  opacity: pressed ? 0.92 : 1,
                },
              ]}
            >
              <Ionicons name="close-outline" size={24} color={colors.secondaryText} />
            </Pressable>
          </View>
        ))
      )}
    </>
  );
}

export default function SharedManageSheet(props: {
  visible: boolean;
  friends: FriendConnection[];
  activeInvite: FriendInvite | null;
  creatingInvite?: boolean;
  loading: boolean;
  onClose: () => void;
  onCreateInvite: () => void;
  onShareInvite: () => void;
  onRevokeInvite: () => void;
  onRemoveFriend: (friendUid: string) => void;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const {
    visible,
    friends,
    activeInvite,
    creatingInvite = false,
    loading,
    onClose,
    onCreateInvite,
    onShareInvite,
    onRevokeInvite,
    onRemoveFriend,
  } = props;
  const contentOpacity = useSharedValue(1);
  const contentTranslateY = useSharedValue(0);
  const contentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentTranslateY.value }],
  }));
  const contentLayoutTransition = LinearTransition.duration(220).easing(Easing.out(Easing.cubic));

  const animateContentChange = useCallback(() => {
    cancelAnimation(contentOpacity);
    cancelAnimation(contentTranslateY);
    contentOpacity.value = 0.92;
    contentTranslateY.value = 10;
    contentOpacity.value = withTiming(1, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
    });
    contentTranslateY.value = withTiming(0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [contentOpacity, contentTranslateY]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    animateContentChange();
  }, [activeInvite?.id, animateContentChange, friends.length, visible]);

  const manageBody = (
    <ManageBody
      friends={friends}
      activeInvite={activeInvite}
      creatingInvite={creatingInvite}
      loading={loading}
      onCreateInvite={onCreateInvite}
      onShareInvite={onShareInvite}
      onRevokeInvite={onRevokeInvite}
      onRemoveFriend={onRemoveFriend}
      emptyLoadingBody={t('shared.refreshingFriends', 'Refreshing your shared circle...')}
      emptyBody={t(
        'shared.emptyManageBody',
        'Invite someone to start a simple shared feed on Home.'
      )}
      friendFallback={t('shared.friendFallback', 'Friend')}
      connectedOnLabel={t('shared.connectedOn', 'Connected')}
    />
  );

  const androidContent = (
    <BottomSheetScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.manageScrollContent}
    >
      <Animated.View layout={contentLayoutTransition} style={contentAnimatedStyle}>
        <View style={styles.manageHeader}>
          <Text style={[styles.manageTitle, { color: colors.text }]}>
            {t('shared.manageTitle', 'Friends')}
          </Text>
          <Text style={[styles.manageSubtitle, { color: colors.secondaryText }]}>
            {t('shared.friendsCount', '{{count}} friends', { count: friends.length })}
          </Text>
        </View>
        {manageBody}
        <View style={styles.manageFooter}>
          <SheetFooterButton label={t('common.done', 'Done')} onPress={onClose} />
        </View>
      </Animated.View>
    </BottomSheetScrollView>
  );

  const iosContent = (
    <Animated.View layout={contentLayoutTransition} style={contentAnimatedStyle}>
      <AppSheetScaffold
        headerVariant="standard"
        title={t('shared.manageTitle', 'Friends')}
        subtitle={t('shared.friendsCount', '{{count}} friends', { count: friends.length })}
        footer={<SheetFooterButton label={t('common.done', 'Done')} onPress={onClose} />}
      >
        {manageBody}
      </AppSheetScaffold>
    </Animated.View>
  );

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      androidScrollable
      androidDynamicSizing
      androidMaxDynamicContentSize={Sheet.maxHeight}
      androidInitialIndex={0}
    >
      {Platform.OS === 'android' ? androidContent : iosContent}
    </AppSheet>
  );
}

const styles = StyleSheet.create({
  manageScrollContent: {
    paddingHorizontal: Sheet.android.horizontalPadding,
    paddingBottom: Sheet.android.bottomPadding + Sheet.android.comfortBottomPadding,
  },
  manageHeader: {
    paddingTop: Sheet.android.headerTopPadding,
    paddingBottom: Sheet.android.headerBottomSpacing,
  },
  manageTitle: {
    ...Typography.screenTitle,
    textAlign: 'left',
    fontWeight: '600',
  },
  manageSubtitle: {
    ...Typography.body,
    marginTop: 8,
    fontSize: 15,
    lineHeight: 21,
  },
  manageFooter: {
    paddingTop: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 28,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
  },
  inviteCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
  },
  inviteCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  inviteCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  inviteCardCopy: {
    flex: 1,
  },
  inviteCardTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  inviteCardBody: {
    ...Typography.body,
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
  },
  inviteActionsRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
  },
  primaryInviteAction: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    borderRadius: 999,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryInviteActionText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    flexShrink: 1,
  },
  secondaryInviteAction: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryInviteActionText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    flexShrink: 1,
  },
  countPill: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countPillText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
  },
  emptyText: {
    ...Typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyStateText: {
    textAlign: 'center',
  },
  emptyStateCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyStateIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendRow: {
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '800',
  },
  friendCopy: {
    flex: 1,
  },
  friendName: {
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '800',
  },
  friendMeta: {
    ...Typography.pill,
    marginTop: 4,
  },
  removeButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
