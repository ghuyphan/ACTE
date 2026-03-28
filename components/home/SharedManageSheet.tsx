import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import AppSheet from '../AppSheet';
import AppSheetScaffold from '../AppSheetScaffold';
import PrimaryButton from '../ui/PrimaryButton';
import { Typography } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { useSharedFeedStore } from '../../hooks/useSharedFeed';
import { useTheme } from '../../hooks/useTheme';
import { FriendConnection, FriendInvite, getSharedFeedErrorMessage } from '../../services/sharedFeedService';

function ManageBody({
  friends,
  activeInvite,
  loading,
  onOpenJoin,
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
      onPress: onShareInvite,
      accent: false,
    },
  ];

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
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
                  {t('shared.inviteReadyBody', 'Share this link with a friend to connect.')}
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
                <Text style={styles.primaryInviteActionText}>
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
                <Text style={[styles.secondaryInviteActionText, { color: colors.secondaryText }]}>
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
    </ScrollView>
  );
}

function JoinBody({
  user,
  isAuthAvailable,
  inviteValue,
  joining,
  onChangeInvite,
  onSubmit,
  onGoToAuth,
}: {
  user: ReturnType<typeof useAuth>['user'];
  isAuthAvailable: boolean;
  inviteValue: string;
  joining: boolean;
  onChangeInvite: (value: string) => void;
  onSubmit: () => void;
  onGoToAuth: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <View style={styles.sheetContent}>
      {user ? (
        <View style={styles.joinFormBlock}>
          <Text style={[styles.joinFieldLabel, { color: colors.secondaryText }]}>
            {t('shared.joinCardTitle', 'Invite link')}
          </Text>
          <TextInput
            value={inviteValue}
            onChangeText={onChangeInvite}
            placeholder={t('shared.joinPlaceholder', 'Paste the full invite link')}
            placeholderTextColor={colors.secondaryText}
            style={[
              styles.joinInput,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </View>
      ) : null}

      <PrimaryButton
        label={user ? t('shared.joinButton', 'Continue') : t('shared.signInButton', 'Sign in')}
        onPress={() => {
          if (user) {
            onSubmit();
            return;
          }

          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onGoToAuth();
        }}
        loading={user ? joining : false}
        disabled={user ? !inviteValue.trim() : !isAuthAvailable}
        leadingIcon={
          <Ionicons
            name={user ? 'enter-outline' : 'person-circle-outline'}
            size={18}
            color="#1C1C1E"
          />
        }
        style={styles.joinPrimaryAction}
      />

      {user && inviteValue.trim() ? (
        <View
          style={[
            styles.joinHelperCard,
            {
              backgroundColor: colors.primarySoft,
              borderColor: colors.primary + '22',
            },
          ]}
        >
          <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
          <Text style={[styles.joinHelperText, { color: colors.text }]}>
            {t('shared.joinFooterBody', 'We’ll connect you as soon as this invite checks out.')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default function SharedManageSheet(props: {
  visible: boolean;
  friends: FriendConnection[];
  activeInvite: FriendInvite | null;
  loading: boolean;
  onClose: () => void;
  onShareInvite: () => void;
  onRevokeInvite: () => void;
  onRemoveFriend: (friendUid: string) => void;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { user, isAuthAvailable } = useAuth();
  const { acceptFriendInvite } = useSharedFeedStore();
  const { visible, friends, activeInvite, loading, onClose, onShareInvite, onRevokeInvite, onRemoveFriend } = props;
  const [mode, setMode] = useState<'manage' | 'join'>('manage');
  const [inviteValue, setInviteValue] = useState('');
  const [joining, setJoining] = useState(false);
  const hasInviteValue = inviteValue.trim().length > 0;
  const contentOpacity = useState(() => new Animated.Value(1))[0];
  const contentTranslateY = useState(() => new Animated.Value(0))[0];

  const animateSheetLayout = useCallback(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }

    LayoutAnimation.configureNext({
      duration: 220,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
        duration: 160,
      },
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
        duration: 180,
      },
    });
  }, []);

  const animateContentChange = useCallback(() => {
    contentOpacity.stopAnimation();
    contentTranslateY.stopAnimation();
    contentOpacity.setValue(0.92);
    contentTranslateY.setValue(10);

    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(contentTranslateY, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [contentOpacity, contentTranslateY]);

  useEffect(() => {
    if (!visible) {
      setMode('manage');
      setInviteValue('');
      setJoining(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    animateSheetLayout();
    animateContentChange();
  }, [activeInvite?.id, animateContentChange, animateSheetLayout, friends.length, hasInviteValue, mode, visible]);

  const handleOpenJoin = useCallback(() => {
    setMode('join');
  }, []);

  const handleBackToManage = useCallback(() => {
    if (joining) {
      return;
    }

    setInviteValue('');
    setMode('manage');
  }, [joining]);

  const handleGoToAuth = useCallback(() => {
    if (joining) {
      return;
    }

    onClose();
    setMode('manage');
    setInviteValue('');
    setTimeout(() => {
      router.push('/auth');
    }, 180);
  }, [joining, onClose, router]);

  const handleJoinInvite = useCallback(async () => {
    if (!inviteValue.trim()) {
      Alert.alert(
        t('shared.joinErrorTitle', 'Invite needed'),
        t('shared.joinErrorBody', 'Paste a valid invite link to connect.')
      );
      return;
    }

    if (!user) {
      handleGoToAuth();
      return;
    }

    setJoining(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await acceptFriendInvite(inviteValue.trim());
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setInviteValue('');
      setMode('manage');
      Alert.alert(
        t('shared.joinSuccessTitle', "You're connected"),
        t('shared.joinSuccessBody', 'You can now share notes with this friend from Home.')
      );
    } catch (error) {
      Alert.alert(t('shared.joinFailedTitle', 'Could not join'), getSharedFeedErrorMessage(error));
    } finally {
      setJoining(false);
    }
  }, [acceptFriendInvite, handleGoToAuth, inviteValue, t, user]);

  const content = (
    <Animated.View
      key={`shared-manage-${mode}`}
      style={{
        opacity: contentOpacity,
        transform: [{ translateY: contentTranslateY }],
      }}
    >
      {mode === 'join' ? (
        <AppSheetScaffold
          headerVariant="action"
          title={t('shared.joinTitle', 'Join a friend')}
          subtitle={
            user
              ? t('shared.joinBody', 'Paste the invite link to connect and start sharing on Home.')
              : isAuthAvailable
                ? t('shared.joinSignInBody', 'Sign in first so we can connect you to this friend.')
                : t('shared.unavailableBody', 'This build does not have shared social enabled right now.')
          }
          headerTop={(
            <View style={[styles.joinBadge, { backgroundColor: colors.primarySoft }]}>
              <Ionicons
                name={user ? 'link-outline' : 'person-circle-outline'}
                size={20}
                color={colors.primary}
              />
            </View>
          )}
          leadingAction={{
            icon: 'chevron-back',
            accessibilityLabel: t('common.back', 'Back'),
            onPress: handleBackToManage,
          }}
          trailingAction={{
            icon: 'close',
            accessibilityLabel: t('common.close', 'Close'),
            onPress: onClose,
          }}
        >
          <JoinBody
            user={user}
            isAuthAvailable={isAuthAvailable}
            inviteValue={inviteValue}
            joining={joining}
            onChangeInvite={setInviteValue}
            onSubmit={() => {
              void handleJoinInvite();
            }}
            onGoToAuth={handleGoToAuth}
          />
        </AppSheetScaffold>
      ) : (
        <AppSheetScaffold
          headerVariant="standard"
          title={t('shared.manageTitle', 'Friends')}
          subtitle={t('shared.friendsCount', '{{count}} friends', { count: friends.length })}
          footer={
            Platform.OS === 'android' ? (
              <Pressable onPress={onClose} style={styles.closeAction}>
                <Text style={[styles.closeText, { color: colors.secondaryText }]}>
                  {t('common.done', 'Done')}
                </Text>
              </Pressable>
            ) : null
          }
        >
          <ManageBody
            friends={friends}
            activeInvite={activeInvite}
            loading={loading}
            onOpenJoin={handleOpenJoin}
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
        </AppSheetScaffold>
      )}
    </Animated.View>
  );

  return (
    <AppSheet visible={visible} onClose={onClose}>
      {content}
    </AppSheet>
  );
}

const styles = StyleSheet.create({
  sheetContent: {
    maxHeight: 680,
  },
  scrollContent: {
    paddingBottom: Platform.OS === 'ios' ? 28 : 8,
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
    minHeight: 44,
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
  },
  secondaryInviteAction: {
    minHeight: 44,
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
  closeAction: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  closeText: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '700',
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
  joinFormBlock: {
    marginTop: 22,
    gap: 8,
  },
  joinFieldLabel: {
    ...Typography.pill,
    fontSize: 13,
  },
  joinInput: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...Typography.body,
  },
  joinPrimaryAction: {
    width: '100%',
    marginTop: 22,
  },
  joinHelperCard: {
    marginTop: 16,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  joinHelperText: {
    ...Typography.body,
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
