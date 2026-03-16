import { BottomSheet, Group, Host, RNHostView } from '@expo/ui/swift-ui';
import { environment, presentationDragIndicator } from '@expo/ui/swift-ui/modifiers';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Layout, Shadows, Typography } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { FriendConnection, FriendInvite } from '../../services/sharedFeedService';
import { isOlderIOS } from '../../utils/platform';
import PrimaryButton from '../ui/PrimaryButton';

function SheetBody({
  visible,
  friends,
  activeInvite,
  loading,
  onClose,
  onShareInvite,
  onRevokeInvite,
  onRemoveFriend,
  inviteLabel,
  inviteBody,
  friendsTitle,
  primaryActionLabel,
  revokeInviteLabel,
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
  inviteLabel: string;
  inviteBody: string;
  friendsTitle: string;
  primaryActionLabel: string;
  revokeInviteLabel: string;
  emptyLoadingBody: string;
  emptyBody: string;
  friendFallback: string;
  connectedOnLabel: string;
  doneLabel: string;
}) {
  const { colors, isDark } = useTheme();
  const softFill = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';

  if (!visible) {
    return null;
  }

  return (
    <View style={[styles.sheetContent, isOlderIOS ? { backgroundColor: colors.card } : null]}>
      <View style={styles.header}>
        <View style={[styles.headerBadge, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="people-outline" size={18} color={colors.primary} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: colors.text }]}>{friendsTitle}</Text>
          <Text style={[styles.subtitle, { color: colors.secondaryText }]}>{inviteBody}</Text>
        </View>
      </View>

      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionLabel, { color: colors.secondaryText }]}>{inviteLabel}</Text>
          {activeInvite ? (
            <Pressable
              onPress={onRevokeInvite}
              style={({ pressed }) => [
                styles.inlineAction,
                {
                  backgroundColor: isDark ? 'rgba(255,69,58,0.14)' : 'rgba(255,59,48,0.1)',
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <Ionicons name="close-circle-outline" size={14} color={colors.danger} />
              <Text style={[styles.inlineActionText, { color: colors.danger }]}>{revokeInviteLabel}</Text>
            </Pressable>
          ) : null}
        </View>
        <Text
          style={[styles.sectionBody, { color: activeInvite ? colors.text : colors.secondaryText }]}
          numberOfLines={activeInvite ? 3 : 4}
        >
          {activeInvite?.url ?? inviteBody}
        </Text>

        <PrimaryButton
          label={primaryActionLabel}
          onPress={onShareInvite}
          leadingIcon={<Ionicons name="share-outline" size={18} color="#1C1C1E" />}
          style={styles.sectionPrimaryButton}
        />
      </View>

      <View
        style={[
          styles.sectionDivider,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          },
        ]}
      />

      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionLabel, { color: colors.secondaryText }]}>{friendsTitle}</Text>
        <View
          style={[
            styles.countPill,
            {
              backgroundColor: softFill,
            },
          ]}
        >
          <Text style={[styles.countPillText, { color: colors.text }]}>{friends.length}</Text>
        </View>
      </View>
      <ScrollView style={styles.friendList} contentContainerStyle={styles.friendListContent}>
        {friends.length === 0 ? (
          <Text style={[styles.emptyText, styles.emptyStateText, { color: colors.secondaryText }]}>
            {loading ? emptyLoadingBody : emptyBody}
          </Text>
        ) : (
          friends.map((friend) => (
            <View
              key={friend.userId}
              style={[
                styles.friendRow,
                {
                  backgroundColor: softFill,
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
                    backgroundColor: isDark ? 'rgba(255,69,58,0.16)' : 'rgba(255,59,48,0.1)',
                    opacity: pressed ? 0.92 : 1,
                  },
                ]}
              >
                <Ionicons name="person-remove-outline" size={16} color={colors.danger} />
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
  const primaryActionLabel = props.activeInvite
    ? t('shared.shareInviteButton', 'Share invite')
    : t('shared.createInviteButton', 'Create invite');

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
                    isOlderIOS
                      ? {
                          backgroundColor: colors.card,
                          borderTopLeftRadius: 12,
                          borderTopRightRadius: 12,
                        }
                      : null,
                  ]}
                >
                  <SheetBody
                    {...props}
                    inviteLabel={t('shared.inviteSectionTitle', 'Invite link')}
                    inviteBody={t(
                      'shared.manageBody',
                      'Create one link, keep your circle small, and manage it here.'
                    )}
                    friendsTitle={t('shared.manageTitle', 'Friends')}
                    primaryActionLabel={primaryActionLabel}
                    revokeInviteLabel={t('shared.revokeInviteButton', 'Revoke invite')}
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
            inviteLabel={t('shared.inviteSectionTitle', 'Invite link')}
            inviteBody={t(
              'shared.manageBody',
              'Create one link, keep your circle small, and manage it here.'
            )}
            friendsTitle={t('shared.manageTitle', 'Friends')}
            primaryActionLabel={primaryActionLabel}
            revokeInviteLabel={t('shared.revokeInviteButton', 'Revoke invite')}
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
    backgroundColor: 'transparent',
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
    paddingTop: 18,
    paddingBottom: 20,
    maxHeight: 540,
  },
  header: {
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerBadge: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    ...Typography.body,
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
  },
  sectionBlock: {
    marginBottom: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionBody: {
    ...Typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
    marginBottom: 18,
  },
  inlineAction: {
    minHeight: 30,
    borderRadius: 999,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  inlineActionText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
  },
  sectionPrimaryButton: {
    width: '100%',
    marginTop: 2,
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
  friendList: {
    maxHeight: 250,
  },
  friendListContent: {
    gap: 10,
    paddingBottom: 4,
  },
  emptyText: {
    ...Typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyStateText: {
    paddingTop: 2,
    paddingBottom: 6,
  },
  friendRow: {
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarImage: {
    width: 42,
    height: 42,
    borderRadius: 16,
  },
  avatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '800',
  },
  friendCopy: {
    flex: 1,
  },
  friendName: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
  },
  friendMeta: {
    ...Typography.pill,
    marginTop: 4,
  },
  removeButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
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
