import { Ionicons } from '@expo/vector-icons';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Image } from 'expo-image';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  LinearTransition,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import AppSheet from '../sheets/AppSheet';
import AppSheetScaffold from '../sheets/AppSheetScaffold';
import FriendInviteJoinBody from '../FriendInviteJoinBody';
import SheetFooterButton from '../sheets/SheetFooterButton';
import AppBackButton from '../ui/AppBackButton';
import AppIconButton from '../ui/AppIconButton';
import { Sheet, Typography } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { FriendConnection, FriendInvite } from '../../services/sharedFeedService';
import { useSharedManageSheetModel } from './useSharedManageSheetModel';

const ANDROID_FRIENDS_JOIN_SNAP_POINTS: string[] = ['46%', '82%'];

function ManageBody({
  friends,
  activeInvite,
  loading,
  onOpenJoin,
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
  loading: boolean;
  onOpenJoin: () => void;
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
  const quickActions = [
    {
      key: 'share',
      icon: 'paper-plane-outline' as const,
      label: t('shared.quickShareLabel', 'Share'),
      onPress: onShareInvite,
      accent: true,
    },
    {
      key: 'join',
      icon: 'enter-outline' as const,
      label: t('shared.quickJoinLabel', 'Join'),
      onPress: onOpenJoin,
      accent: false,
    },
    {
      key: 'link',
      icon: activeInvite ? ('link-outline' as const) : ('person-add-outline' as const),
      label: activeInvite
        ? t('shared.quickInviteReadyLabel', 'Invite ready')
        : t('shared.quickInviteLabel', 'Create link'),
      onPress: onCreateInvite,
      accent: false,
    },
  ];
  return (
    <>
      <Pressable
        onPress={onOpenJoin}
        style={({ pressed }) => [
          styles.addFriendRow,
          {
            backgroundColor: softFill,
            borderColor: outlineColor,
            opacity: pressed ? 0.92 : 1,
          },
        ]}
      >
        <Ionicons name="search-outline" size={24} color={colors.secondaryText} />
        <Text style={[styles.addFriendText, { color: colors.secondaryText }]}>
          {t('shared.addFriendCta', 'Add a new friend')}
        </Text>
      </Pressable>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t('shared.quickActionsTitle', 'Invite options')}
        </Text>
        <View style={styles.quickActionsRow}>
          {quickActions.map((action) => (
            <Pressable
              key={action.key}
              onPress={action.onPress}
              style={({ pressed }) => [
                styles.quickAction,
                {
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.quickActionIcon,
                  {
                    backgroundColor: action.accent ? colors.primary : softFill,
                    borderColor: action.accent ? colors.primary : outlineColor,
                  },
                ]}
              >
                <Ionicons
                  name={action.icon}
                  size={22}
                  color={action.accent ? '#1C1C1E' : colors.text}
                />
              </View>
              <Text style={[styles.quickActionLabel, { color: colors.text }]}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {activeInvite ? (
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
            <View style={styles.inviteCardCopy}>
              <Text style={[styles.inviteCardTitle, { color: colors.text }]}>
                {t('shared.inviteReadyTitle', 'Invite link ready')}
              </Text>
              <Text style={[styles.inviteCardBody, { color: colors.secondaryText }]}>
                {t('shared.inviteReadyBody', 'Share this link to connect.')}
              </Text>
            </View>
          </View>
          <View style={styles.inviteActionsRow}>
            <Pressable
              onPress={onShareInvite}
              style={({ pressed }) => [
                styles.primaryInviteAction,
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.92 : 1,
                },
              ]}
            >
              <Ionicons name="paper-plane-outline" size={16} color="#1C1C1E" />
              <Text numberOfLines={1} style={styles.primaryInviteActionText}>
                {t('shared.shareInviteButton', 'Share invite link')}
              </Text>
            </Pressable>
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
              <Text numberOfLines={1} style={[styles.secondaryInviteActionText, { color: colors.secondaryText }]}>
                {t('shared.revokeInviteButton', 'Revoke invite')}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t('shared.friendsListTitle', 'Your friends')}
        </Text>
        <View style={[styles.countPill, { backgroundColor: softFill }]}>
          <Text style={[styles.countPillText, { color: colors.text }]}>{friends.length}</Text>
        </View>
      </View>
      {friends.length === 0 ? (
        <View style={[styles.emptyStateCard, { backgroundColor: softFill, borderColor: outlineColor }]}>
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
              <Image source={{ uri: friend.photoURLSnapshot }} style={styles.avatarImage} contentFit="cover" />
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
  loading: boolean;
  onClose: () => void;
  onCreateInvite: () => void;
  onShareInvite: () => void;
  onRevokeInvite: () => void;
  onRemoveFriend: (friendUid: string) => void;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { visible, friends, activeInvite, loading, onClose, onCreateInvite, onShareInvite, onRevokeInvite, onRemoveFriend } = props;
  const {
    handleBackToManage,
    handleGoToAuth,
    handleOpenJoin,
    inviteValue,
    isAuthAvailable,
    joinInvite,
    joining,
    mode,
    setInviteValue,
    user,
  } = useSharedManageSheetModel({ visible, onClose });
  const hasInviteValue = inviteValue.trim().length > 0;
  const contentOpacity = useSharedValue(1);
  const contentTranslateY = useSharedValue(0);
  const keyboardVisibleRef = useRef(false);
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
  }, [activeInvite?.id, animateContentChange, friends.length, hasInviteValue, mode, visible]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, () => {
      keyboardVisibleRef.current = true;
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      keyboardVisibleRef.current = false;
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
      keyboardVisibleRef.current = false;
    };
  }, []);

  const runAfterKeyboardDismiss = useCallback((action: () => void) => {
    if (!keyboardVisibleRef.current) {
      action();
      return;
    }

    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    let settled = false;
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      if (settled) {
        return;
      }

      settled = true;
      hideSubscription.remove();
      requestAnimationFrame(action);
    });

    Keyboard.dismiss();

    setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      hideSubscription.remove();
      action();
    }, Platform.OS === 'ios' ? 260 : 180);
  }, []);

  const handleJoinBackPress = useCallback(() => {
    runAfterKeyboardDismiss(handleBackToManage);
  }, [handleBackToManage, runAfterKeyboardDismiss]);

  const handleJoinClosePress = useCallback(() => {
    runAfterKeyboardDismiss(onClose);
  }, [onClose, runAfterKeyboardDismiss]);

  const manageBody = (
    <ManageBody
      friends={friends}
      activeInvite={activeInvite}
      loading={loading}
      onOpenJoin={handleOpenJoin}
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

  const joinContent = (
    <Animated.View
      layout={contentLayoutTransition}
      style={contentAnimatedStyle}
    >
      <AppSheetScaffold
        headerVariant="standard"
        title={t('shared.joinTitle', 'Join a friend')}
        subtitle={
          user
            ? t('shared.joinBody', 'Paste an invite link to connect.')
            : isAuthAvailable
              ? t('shared.joinSignInBody', 'Sign in to connect with this friend.')
              : t('shared.unavailableBody', 'This build does not have shared social enabled right now.')
        }
        headerTop={(
          <View>
            <View style={styles.joinTopRow}>
              <AppBackButton
                onPress={handleJoinBackPress}
                style={styles.joinIconButton}
              />
              <AppIconButton
                icon="close"
                accessibilityLabel={t('common.close', 'Close')}
                onPress={handleJoinClosePress}
                style={styles.joinIconButton}
              />
            </View>
            <View style={[styles.joinBadge, { backgroundColor: colors.primarySoft }]}>
              <Ionicons
                name={user ? 'link-outline' : 'person-circle-outline'}
                size={20}
                color={colors.primary}
              />
            </View>
          </View>
        )}
      >
        <FriendInviteJoinBody
          user={user}
          isAuthAvailable={isAuthAvailable}
          inviteValue={inviteValue}
          joining={joining}
          contentStyle={styles.sheetContent}
          onChangeInvite={setInviteValue}
          onSubmit={() => {
            void joinInvite();
          }}
          onGoToAuth={handleGoToAuth}
        />
      </AppSheetScaffold>
    </Animated.View>
  );

  const manageContent = Platform.OS === 'android' ? (
    <BottomSheetScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.manageScrollContent}
    >
      <Animated.View
        layout={contentLayoutTransition}
        style={contentAnimatedStyle}
      >
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
          <SheetFooterButton
            label={t('common.done', 'Done')}
            onPress={onClose}
          />
        </View>
      </Animated.View>
    </BottomSheetScrollView>
  ) : (
    <Animated.View
      layout={contentLayoutTransition}
      style={contentAnimatedStyle}
    >
      <AppSheetScaffold
        headerVariant="standard"
        title={t('shared.manageTitle', 'Friends')}
        subtitle={t('shared.friendsCount', '{{count}} friends', { count: friends.length })}
        footer={
          <SheetFooterButton
            label={t('common.done', 'Done')}
            onPress={onClose}
          />
        }
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
      androidDynamicSizing={mode === 'manage'}
      androidDisablePanningWhenKeyboardHidden={mode === 'join'}
      androidMaxDynamicContentSize={Sheet.maxHeight}
      androidKeyboardBehavior={mode === 'join' ? 'extend' : 'interactive'}
      androidRestoreInitialSnapOnKeyboardHide={mode === 'join'}
      androidInitialIndex={0}
      androidSnapPoints={mode === 'join' ? ANDROID_FRIENDS_JOIN_SNAP_POINTS : undefined}
    >
      {mode === 'join' ? joinContent : manageContent}
    </AppSheet>
  );
}

const styles = StyleSheet.create({
  sheetContent: {
    maxHeight: 680,
  },
  manageScrollContent: {
    paddingHorizontal: Sheet.android.horizontalPadding,
    paddingBottom: Sheet.android.bottomPadding + Sheet.android.comfortBottomPadding,
    minHeight: 600,
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
  addFriendRow: {
    minHeight: 72,
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  addFriendText: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '600',
  },
  section: {
    marginTop: 28,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 30,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
  },
  quickActionsRow: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    gap: 10,
  },
  quickActionIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  inviteCard: {
    marginTop: 22,
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
  },
  inviteCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
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
  joinTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Platform.OS === 'ios' ? 6 : 0,
  },
  joinIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinBadge: {
    width: 46,
    height: 46,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  joinTitle: {
    marginTop: 18,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  joinSubtitle: {
    ...Typography.body,
    marginTop: 10,
  },
});
