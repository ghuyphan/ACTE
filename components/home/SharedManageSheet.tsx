import { BottomSheet, Group, Host, RNHostView } from '@expo/ui/swift-ui';
import { environment, presentationDragIndicator } from '@expo/ui/swift-ui/modifiers';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Layout, Shadows, Typography } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { FriendConnection, FriendInvite } from '../../services/sharedFeedService';
import { isOlderIOS } from '../../utils/platform';

function SheetBody({
  visible,
  friends,
  activeInvite,
  loading,
  onClose,
  onShareInvite,
  onRevokeInvite,
  onRemoveFriend,
  friendsTitle,
  emptyLoadingBody,
  emptyBody,
  friendFallback,
  connectedOnLabel,
  doneLabel,
}: {
  visible: boolean;
  friends: FriendConnection[];
  activeInvite: FriendInvite | null;
  loading: boolean;
  onClose: () => void;
  onShareInvite: () => void;
  onRevokeInvite: () => void;
  onRemoveFriend: (friendUid: string) => void;
  friendsTitle: string;
  emptyLoadingBody: string;
  emptyBody: string;
  friendFallback: string;
  connectedOnLabel: string;
  doneLabel: string;
}) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const softFill = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const outlineColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const navigateToJoin = () => {
    onClose();
    setTimeout(() => {
      router.push('/friends/join');
    }, 180);
  };
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
      onPress: navigateToJoin,
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

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.sheetContent}>
      {Platform.OS !== 'ios' ? (
        <View style={styles.grabberWrap}>
          <View style={[styles.grabber, { backgroundColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.16)' }]} />
        </View>
      ) : null}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.header, Platform.OS === 'ios' ? styles.headerWithNativeHandle : null]}>
          <Text style={[styles.title, { color: colors.text }]}>{friendsTitle}</Text>
          <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
            {t('shared.friendsCount', '{{count}} friends', { count: friends.length })}
          </Text>
        </View>

        <Pressable
          onPress={navigateToJoin}
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

      {Platform.OS !== 'ios' ? (
        <Pressable onPress={onClose} style={styles.closeAction}>
          <Text style={[styles.closeText, { color: colors.secondaryText }]}>{doneLabel}</Text>
        </Pressable>
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
  const { isDark, colors } = useTheme();
  const { t } = useTranslation();

  if (Platform.OS === 'ios') {
    return (
      <View pointerEvents={props.visible ? 'auto' : 'none'} style={StyleSheet.absoluteFill}>
        <Host style={StyleSheet.absoluteFill} colorScheme={isDark ? 'dark' : 'light'}>
          <BottomSheet isPresented={props.visible} onIsPresentedChange={(next) => (!next ? props.onClose() : null)} fitToContents>
            <Group modifiers={[presentationDragIndicator('visible'), environment('colorScheme', isDark ? 'dark' : 'light')]}>
              <RNHostView matchContents>
                <View
                  style={[
                    styles.iosContainer,
                    {
                      borderTopLeftRadius: isOlderIOS ? 12 : 24,
                      borderTopRightRadius: isOlderIOS ? 12 : 24,
                    },
                  ]}
                >
                  <SheetBody
                    {...props}
                    friendsTitle={t('shared.manageTitle', 'Friends')}
                    emptyLoadingBody={t('shared.refreshingFriends', 'Refreshing your shared circle...')}
                    emptyBody={t(
                      'shared.emptyManageBody',
                      'Invite someone to start a simple shared feed on Home.'
                    )}
                    friendFallback={t('shared.friendFallback', 'Friend')}
                    connectedOnLabel={t('shared.connectedOn', 'Connected')}
                    doneLabel={t('common.done', 'Done')}
                  />
                </View>
              </RNHostView>
            </Group>
          </BottomSheet>
        </Host>
      </View>
    );
  }

  return (
    <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={props.onClose} />
        <View style={[styles.androidSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SheetBody
            {...props}
            friendsTitle={t('shared.manageTitle', 'Friends')}
            emptyLoadingBody={t('shared.refreshingFriends', 'Refreshing your shared circle...')}
            emptyBody={t(
              'shared.emptyManageBody',
              'Invite someone to start a simple shared feed on Home.'
            )}
            friendFallback={t('shared.friendFallback', 'Friend')}
            connectedOnLabel={t('shared.connectedOn', 'Connected')}
            doneLabel={t('common.done', 'Done')}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  iosContainer: {
    overflow: 'hidden',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
    padding: Layout.screenPadding,
  },
  androidSheet: {
    borderRadius: 24,
    borderWidth: 1,
    ...Shadows.floating,
  },
  sheetContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
    // paddingBottom: Platform.OS === 'ios' ? 28 : 20,
    maxHeight: 680,
  },
  scrollContent: {
    // paddingBottom: Platform.OS === 'ios' ? 28 : 8,
  },
  grabberWrap: {
    alignItems: 'center',
    marginBottom: 18,
  },
  grabber: {
    width: 88,
    height: 6,
    borderRadius: 999,
  },
  header: {
    marginBottom: 22,
    alignItems: 'center',
  },
  headerWithNativeHandle: {
    marginTop: 8,
  },
  title: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.body,
    marginTop: 8,
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
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
});
