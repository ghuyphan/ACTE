import { Ionicons } from '@expo/vector-icons';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Sheet, Typography } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { FriendConnection, FriendGroup, FriendInvite } from '../../services/sharedFeedService';
import AppSheet from '../sheets/AppSheet';
import AppSheetScaffold from '../sheets/AppSheetScaffold';
import SheetFooterButton from '../sheets/SheetFooterButton';
import TextFieldEditSheet from '../sheets/TextFieldEditSheet';
import PrimaryButton from '../ui/PrimaryButton';

const ESTIMATED_FRIEND_ROW_HEIGHT = 68;
const FIXED_SHEET_HEIGHT = Math.min(Sheet.maxHeight, Math.round(Dimensions.get('window').height * 0.82));
const FriendsList = Platform.OS === 'android' ? BottomSheetFlatList : FlatList;

function formatConnectedCopy(template: string, friendedAt: string, locale?: string) {
  const date = new Date(friendedAt);
  const dateLabel = Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat(locale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(date);

  return template.replace('{{date}}', dateLabel).trim();
}

function resolveFriendLabels(
  friend: FriendConnection,
  friendFallback: string,
  connectedCopyTemplate: string,
  locale?: string
) {
  const normalizedNickname = friend.nickname?.trim() || null;
  const normalizedDisplayName = friend.displayNameSnapshot?.trim() || null;
  const normalizedUsername = friend.username?.trim().toLowerCase() || null;
  const connectedCopy = formatConnectedCopy(connectedCopyTemplate, friend.friendedAt, locale);
  const publicLabel = normalizedDisplayName
    ? normalizedDisplayName
    : normalizedUsername
      ? `@${normalizedUsername}`
      : friendFallback;

  if (normalizedNickname) {
    return {
      title: normalizedNickname,
      meta: `${publicLabel} • ${connectedCopy}`,
    };
  }

  const hasDistinctDisplayName =
    Boolean(normalizedDisplayName) &&
    Boolean(normalizedUsername) &&
    normalizedDisplayName!.toLowerCase() !== normalizedUsername;

  if (hasDistinctDisplayName) {
    return {
      title: normalizedDisplayName!,
      meta: `@${normalizedUsername} • ${connectedCopy}`,
    };
  }

  if (normalizedUsername) {
    return {
      title: `@${normalizedUsername}`,
      meta: connectedCopy,
    };
  }

  return {
    title: normalizedDisplayName ?? friendFallback,
    meta: connectedCopy,
  };
}

function InviteActionsCard({
  activeInvite,
  creatingInvite,
  onCreateInvite,
  onShareInvite,
  onRevokeInvite,
}: {
  activeInvite: FriendInvite | null;
  creatingInvite: boolean;
  onCreateInvite: () => void;
  onShareInvite: () => void;
  onRevokeInvite: () => void;
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
  );
}

function FriendsSectionHeader({ count, compactTop = false }: { count: number; compactTop?: boolean }) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const softFill = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';

  return (
    <View
      style={[
        styles.sectionHeaderRow,
        compactTop ? styles.sectionHeaderCompactTop : styles.sectionHeaderTop,
      ]}
    >
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        {t('shared.friendsListTitle', 'Your friends')}
      </Text>
      <View style={[styles.countPill, { backgroundColor: softFill }]}>
        <Text style={[styles.countPillText, { color: colors.text }]}>{count}</Text>
      </View>
    </View>
  );
}

function GroupsSectionHeader({ onCreateGroup }: { onCreateGroup: () => void }) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const softFill = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';

  return (
    <View style={[styles.sectionHeaderRow, styles.groupsHeaderTop]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        {t('shared.friendGroupsTitle', 'Groups')}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onCreateGroup}
        style={({ pressed }) => [
          styles.addGroupButton,
          { backgroundColor: softFill, opacity: pressed ? 0.86 : 1 },
        ]}
      >
        <Ionicons name="add" size={18} color={colors.text} />
      </Pressable>
    </View>
  );
}

function GroupRow({
  group,
  memberCount,
  onPress,
}: {
  group: FriendGroup;
  memberCount: number;
  onPress: (group: FriendGroup) => void;
}) {
  const { colors, isDark } = useTheme();
  const softFill = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const { t } = useTranslation();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(group)}
      style={({ pressed }) => [
        styles.groupRow,
        { backgroundColor: softFill, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <View style={[styles.groupIcon, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name="people-outline" size={18} color={colors.primary} />
      </View>
      <View style={styles.friendCopy}>
        <Text numberOfLines={1} style={[styles.friendName, { color: colors.text }]}>
          {group.name}
        </Text>
        <Text numberOfLines={1} style={[styles.friendMeta, { color: colors.secondaryText }]}>
          {t('shared.friendGroupMembersCount', '{{count}} friends', { count: memberCount })}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.secondaryText} />
    </Pressable>
  );
}

function EmptyFriendsState({
  loading,
  emptyLoadingBody,
  emptyBody,
}: {
  loading: boolean;
  emptyLoadingBody: string;
  emptyBody: string;
}) {
  const { colors, isDark } = useTheme();
  const softFill = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const outlineColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  return (
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
  );
}

function FriendRow({
  friend,
  friendFallback,
  connectedCopyTemplate,
  locale,
  onRemoveFriend,
  onEditNickname,
}: {
  friend: FriendConnection;
  friendFallback: string;
  connectedCopyTemplate: string;
  locale?: string;
  onRemoveFriend: (friendUid: string) => void;
  onEditNickname: (friend: FriendConnection) => void;
}) {
  const { colors, isDark } = useTheme();
  const softFill = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const labels = resolveFriendLabels(friend, friendFallback, connectedCopyTemplate, locale);
  const avatarSeed = (friend.nickname || friend.username || friend.displayNameSnapshot || friendFallback).trim();
  const avatarLabel = avatarSeed.charAt(0).toUpperCase();

  return (
    <View style={styles.friendRow}>
      {friend.photoURLSnapshot ? (
        <Image
          source={{ uri: friend.photoURLSnapshot }}
          style={styles.avatarImage}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.avatarFallback, { backgroundColor: colors.primarySoft }]}>
          <Text style={[styles.avatarLabel, { color: colors.primary }]}>{avatarLabel}</Text>
        </View>
      )}
      <View style={styles.friendCopy}>
        <Text numberOfLines={1} style={[styles.friendName, { color: colors.text }]}>
          {labels.title}
        </Text>
        <Text numberOfLines={1} style={[styles.friendMeta, { color: colors.secondaryText }]}>
          {labels.meta}
        </Text>
      </View>
      <Pressable
        accessibilityLabel={labels.title}
        accessibilityRole="button"
        onPress={() => onEditNickname(friend)}
        style={({ pressed }) => [
          styles.iconButton,
          {
            backgroundColor: softFill,
            opacity: pressed ? 0.92 : 1,
          },
        ]}
      >
        <Ionicons name="pencil-outline" size={18} color={colors.secondaryText} />
      </Pressable>
      <Pressable
        onPress={() => onRemoveFriend(friend.userId)}
        style={({ pressed }) => [
          styles.iconButton,
          {
            backgroundColor: softFill,
            opacity: pressed ? 0.92 : 1,
          },
        ]}
      >
        <Ionicons name="close-outline" size={21} color={colors.secondaryText} />
      </Pressable>
    </View>
  );
}

export default function SharedManageSheet(props: {
  visible: boolean;
  friends: FriendConnection[];
  friendGroups: FriendGroup[];
  activeInvite: FriendInvite | null;
  creatingInvite?: boolean;
  loading: boolean;
  onClose: () => void;
  onCreateInvite: () => void;
  onShareInvite: () => void;
  onRevokeInvite: () => void;
  onOpenFriendSearch: () => void;
  onOpenChats?: () => void;
  unreadChatsCount?: number;
  onRemoveFriend: (friendUid: string) => void;
  onUpdateFriendNickname: (friendUid: string, nickname: string | null) => Promise<void>;
  onCreateFriendGroup: (input: { name: string; memberUserIds: string[] }) => Promise<void>;
  onUpdateFriendGroup: (groupId: string, input: { name: string; memberUserIds: string[] }) => Promise<void>;
  onDeleteFriendGroup: (groupId: string) => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const {
    visible,
    friends,
    friendGroups,
    activeInvite,
    creatingInvite = false,
    loading,
    onClose,
    onCreateInvite,
    onShareInvite,
    onRevokeInvite,
    onOpenFriendSearch,
    onOpenChats,
    unreadChatsCount = 0,
    onRemoveFriend,
    onUpdateFriendNickname,
    onCreateFriendGroup,
    onUpdateFriendGroup,
    onDeleteFriendGroup,
  } = props;
  const [nicknameFriend, setNicknameFriend] = useState<FriendConnection | null>(null);
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [nicknameErrorMessage, setNicknameErrorMessage] = useState<string | null>(null);
  const [isSavingNickname, setIsSavingNickname] = useState(false);
  const [editingGroup, setEditingGroup] = useState<FriendGroup | null>(null);
  const [isGroupEditorVisible, setIsGroupEditorVisible] = useState(false);
  const [groupNameDraft, setGroupNameDraft] = useState('');
  const [groupMemberDraft, setGroupMemberDraft] = useState<string[]>([]);
  const [groupErrorMessage, setGroupErrorMessage] = useState<string | null>(null);
  const [isSavingGroup, setIsSavingGroup] = useState(false);

  const emptyLoadingBody = t('shared.refreshingFriends', 'Refreshing your shared circle...');
  const emptyBody = t(
    'shared.emptyManageBody',
    'Invite someone to start a simple shared feed on Home.'
  );
  const friendFallback = t('shared.friendFallback', 'Friend');
  const connectedCopyTemplate = t('shared.friendsSince', 'Friends since {{date}}');
  const horizontalPadding =
    Platform.OS === 'ios' ? Sheet.ios.horizontalPadding : Sheet.android.horizontalPadding;
  const friendLabelById = useMemo(() => {
    const labels = new Map<string, string>();
    for (const friend of friends) {
      labels.set(
        friend.userId,
        resolveFriendLabels(friend, friendFallback, connectedCopyTemplate, i18n.language).title
      );
    }
    return labels;
  }, [connectedCopyTemplate, friendFallback, friends, i18n.language]);
  const normalizedNicknameDraft = nicknameDraft.trim();
  const currentNickname = nicknameFriend?.nickname?.trim() ?? '';
  const canSaveNickname =
    Boolean(nicknameFriend) &&
    !isSavingNickname &&
    normalizedNicknameDraft.length <= 40 &&
    normalizedNicknameDraft !== currentNickname;
  const friendBadgeLabel = friends.length > 0 ? (friends.length > 9 ? '9+' : String(friends.length)) : undefined;
  const unreadChatsBadgeLabel =
    unreadChatsCount > 0 ? (unreadChatsCount > 9 ? '9+' : String(unreadChatsCount)) : undefined;

  useEffect(() => {
    if (!visible) {
      setNicknameFriend(null);
      setNicknameDraft('');
      setNicknameErrorMessage(null);
      setIsGroupEditorVisible(false);
      setEditingGroup(null);
      setGroupNameDraft('');
      setGroupMemberDraft([]);
      setGroupErrorMessage(null);
    }
  }, [visible]);

  const openNicknameEditor = (friend: FriendConnection) => {
    setNicknameFriend(friend);
    setNicknameDraft(friend.nickname ?? '');
    setNicknameErrorMessage(null);
  };

  const closeNicknameEditor = () => {
    if (isSavingNickname) {
      return;
    }

    setNicknameFriend(null);
    setNicknameDraft('');
    setNicknameErrorMessage(null);
  };

  const saveNickname = async () => {
    if (!nicknameFriend || !canSaveNickname) {
      if (normalizedNicknameDraft.length > 40) {
        setNicknameErrorMessage(t('shared.friendNicknameTooLong', 'Use 40 characters or fewer.'));
      }
      return;
    }

    setIsSavingNickname(true);
    setNicknameErrorMessage(null);
    try {
      await onUpdateFriendNickname(nicknameFriend.userId, normalizedNicknameDraft || null);
      setNicknameFriend(null);
      setNicknameDraft('');
    } catch (error) {
      setNicknameErrorMessage(
        error instanceof Error
          ? error.message
          : t('shared.friendNicknameSaveFailed', 'Could not update nickname.')
      );
    } finally {
      setIsSavingNickname(false);
    }
  };

  const openGroupEditor = (group: FriendGroup | null = null) => {
    setEditingGroup(group);
    setGroupNameDraft(group?.name ?? '');
    setGroupMemberDraft(group?.memberUserIds ?? []);
    setGroupErrorMessage(null);
    setIsGroupEditorVisible(true);
  };

  const closeGroupEditor = () => {
    if (isSavingGroup) {
      return;
    }

    setIsGroupEditorVisible(false);
    setEditingGroup(null);
    setGroupNameDraft('');
    setGroupMemberDraft([]);
    setGroupErrorMessage(null);
  };

  const toggleGroupMember = (friendUid: string) => {
    setGroupMemberDraft((current) =>
      current.includes(friendUid)
        ? current.filter((memberUid) => memberUid !== friendUid)
        : [...current, friendUid]
    );
  };

  const saveGroup = async () => {
    const name = groupNameDraft.trim();
    if (!name) {
      setGroupErrorMessage(t('shared.friendGroupNameRequired', 'Add a group name.'));
      return;
    }
    if (name.length > 40) {
      setGroupErrorMessage(t('shared.friendGroupNameTooLong', 'Use 40 characters or fewer.'));
      return;
    }
    if (groupMemberDraft.length === 0) {
      setGroupErrorMessage(t('shared.friendGroupMembersRequired', 'Choose at least one friend.'));
      return;
    }

    setIsSavingGroup(true);
    setGroupErrorMessage(null);
    try {
      const input = { name, memberUserIds: groupMemberDraft };
      if (editingGroup) {
        await onUpdateFriendGroup(editingGroup.id, input);
      } else {
        await onCreateFriendGroup(input);
      }
      setIsGroupEditorVisible(false);
      setEditingGroup(null);
      setGroupNameDraft('');
      setGroupMemberDraft([]);
    } catch (error) {
      setGroupErrorMessage(
        error instanceof Error
          ? error.message
          : t('shared.friendGroupSaveFailed', 'Could not save group.')
      );
    } finally {
      setIsSavingGroup(false);
    }
  };

  const deleteGroup = async () => {
    if (!editingGroup || isSavingGroup) {
      return;
    }

    setIsSavingGroup(true);
    setGroupErrorMessage(null);
    try {
      await onDeleteFriendGroup(editingGroup.id);
      setIsGroupEditorVisible(false);
      setEditingGroup(null);
      setGroupNameDraft('');
      setGroupMemberDraft([]);
    } catch (error) {
      setGroupErrorMessage(
        error instanceof Error
          ? error.message
          : t('shared.friendGroupDeleteFailed', 'Could not delete group.')
      );
    } finally {
      setIsSavingGroup(false);
    }
  };

  return (
    <>
      <AppSheet
        visible={visible}
        onClose={onClose}
        androidDynamicSizing={false}
        androidInitialIndex={0}
        androidSnapPoints={[FIXED_SHEET_HEIGHT]}
        androidContentContainerStyle={styles.androidSheetContainer}
        fitToContents={false}
      >
        <AppSheetScaffold
          headerVariant="action"
          title={t('shared.manageTitle', 'Friends')}
          overlayHeaderActions
          trailingActions={[
            ...(onOpenChats
              ? [
                  {
                    icon: 'chatbubble-ellipses-outline',
                    accessibilityLabel: t('shared.chatsTitle', 'Chats'),
                    onPress: onOpenChats,
                    testID: 'shared-manage-chats-button',
                    badgeLabel: unreadChatsBadgeLabel,
                  } as const,
                ]
              : []),
            {
              icon: 'search',
              accessibilityLabel: t('shared.searchByUsernameButton', 'Find by Noto ID'),
              onPress: onOpenFriendSearch,
              testID: 'shared-manage-find-friend-button',
              badgeLabel: friendBadgeLabel,
            },
          ]}
          footer={<SheetFooterButton label={t('common.done', 'Done')} onPress={onClose} />}
          useHorizontalPadding={false}
          contentBottomPaddingWhenFooter={0}
          footerTopSpacing={12}
          style={styles.sheetScaffold}
          contentContainerStyle={styles.sheetBody}
        >
          <View style={[styles.fixedContent, { paddingHorizontal: horizontalPadding }]}>
            <InviteActionsCard
              activeInvite={activeInvite}
              creatingInvite={creatingInvite}
              onCreateInvite={onCreateInvite}
              onShareInvite={onShareInvite}
              onRevokeInvite={onRevokeInvite}
            />
            <GroupsSectionHeader onCreateGroup={() => openGroupEditor(null)} />
            {friendGroups.length > 0 ? (
              <View style={styles.groupList}>
                {friendGroups.map((group) => (
                  <GroupRow
                    key={group.id}
                    group={group}
                    memberCount={group.memberUserIds.length}
                    onPress={openGroupEditor}
                  />
                ))}
              </View>
            ) : null}
            <FriendsSectionHeader count={friends.length} compactTop={friendGroups.length === 0} />
          </View>
          <View style={styles.listShell}>
            <FriendsList<FriendConnection>
              data={friends}
              keyExtractor={(item) => item.userId}
              renderItem={({ item }) => (
                <FriendRow
                  friend={item}
                  friendFallback={friendFallback}
                  connectedCopyTemplate={connectedCopyTemplate}
                  locale={i18n.language}
                  onRemoveFriend={onRemoveFriend}
                  onEditNickname={openNicknameEditor}
                />
              )}
              ListEmptyComponent={(
                <EmptyFriendsState
                  loading={loading}
                  emptyLoadingBody={emptyLoadingBody}
                  emptyBody={emptyBody}
                />
              )}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              initialNumToRender={12}
              maxToRenderPerBatch={10}
              windowSize={5}
              contentContainerStyle={[
                styles.listContent,
                { paddingHorizontal: horizontalPadding },
              ]}
            />
          </View>
        </AppSheetScaffold>
      </AppSheet>
      <TextFieldEditSheet
        visible={Boolean(nicknameFriend)}
        value={nicknameDraft}
        errorMessage={nicknameErrorMessage}
        helperText={t('shared.friendNicknameHint', 'Only you will see this nickname.')}
        isSaving={isSavingNickname}
        onChangeValue={setNicknameDraft}
        onClose={closeNicknameEditor}
        onSave={saveNickname}
        title={t('shared.friendNicknameSheetTitle', 'Friend nickname')}
        subtitle={
          nicknameFriend
            ? resolveFriendLabels(
                nicknameFriend,
                friendFallback,
                connectedCopyTemplate,
                i18n.language
              ).meta
            : undefined
        }
        saveLabel={t('shared.friendNicknameSave', 'Save nickname')}
        placeholder={t('shared.friendNicknamePlaceholder', 'Add nickname')}
        autoComplete="name"
        testIDPrefix="friend-nickname"
      />
      <AppSheet
        visible={isGroupEditorVisible}
        onClose={closeGroupEditor}
        androidKeyboardInputMode="adjustPan"
      >
        <AppSheetScaffold
          headerVariant="standard"
          title={
            editingGroup
              ? t('shared.friendGroupEditTitle', 'Edit group')
              : t('shared.friendGroupCreateTitle', 'New group')
          }
          subtitle={t('shared.friendGroupSheetSubtitle', 'Pick friends once, then share to them from Home.')}
          footer={
            <View style={styles.groupFooter}>
              <PrimaryButton
                label={t('shared.friendGroupSave', 'Save group')}
                onPress={saveGroup}
                loading={isSavingGroup}
                testID="friend-group-save-button"
              />
              {editingGroup ? (
                <Pressable
                  onPress={deleteGroup}
                  disabled={isSavingGroup}
                  style={({ pressed }) => [
                    styles.deleteGroupButton,
                    { opacity: isSavingGroup ? 0.5 : pressed ? 0.78 : 1 },
                  ]}
                >
                  <Text style={[styles.deleteGroupText, { color: colors.danger }]}>
                    {t('shared.friendGroupDelete', 'Delete group')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          }
        >
          <TextInput
            value={groupNameDraft}
            onChangeText={setGroupNameDraft}
            placeholder={t('shared.friendGroupNamePlaceholder', 'Group name')}
            placeholderTextColor={colors.secondaryText}
            autoCapitalize="words"
            style={[
              styles.groupNameInput,
              {
                backgroundColor: colors.surface,
                borderColor: groupErrorMessage ? colors.danger : colors.border,
                color: colors.text,
              },
            ]}
            testID="friend-group-name-input"
          />
          <Text
            style={[
              styles.groupHelperText,
              { color: groupErrorMessage ? colors.danger : colors.secondaryText },
            ]}
          >
            {groupErrorMessage ?? t('shared.friendGroupMembersHint', 'Choose the friends in this group.')}
          </Text>
          <View style={styles.groupMembers}>
            {friends.map((friend) => {
              const selected = groupMemberDraft.includes(friend.userId);
              const label = friendLabelById.get(friend.userId) ?? friendFallback;
              return (
                <Pressable
                  key={friend.userId}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  onPress={() => toggleGroupMember(friend.userId)}
                  style={({ pressed }) => [
                    styles.memberChoice,
                    {
                      backgroundColor: selected ? colors.primarySoft : colors.surface,
                      borderColor: selected ? `${colors.primary}66` : colors.border,
                      opacity: pressed ? 0.86 : 1,
                    },
                  ]}
                >
                  <Text numberOfLines={1} style={[styles.memberChoiceText, { color: colors.text }]}>
                    {label}
                  </Text>
                  <Ionicons
                    name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={selected ? colors.primary : colors.secondaryText}
                  />
                </Pressable>
              );
            })}
          </View>
        </AppSheetScaffold>
      </AppSheet>
    </>
  );
}

const styles = StyleSheet.create({
  androidSheetContainer: {
    height: FIXED_SHEET_HEIGHT,
  },
  sheetScaffold: {
    height: FIXED_SHEET_HEIGHT,
  },
  sheetBody: {
    flex: 1,
  },
  fixedContent: {
    width: '100%',
  },
  listShell: {
    flex: 1,
    width: '100%',
  },
  listContent: {
    paddingBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  sectionHeaderTop: {
    marginTop: 20,
  },
  sectionHeaderCompactTop: {
    marginTop: 10,
  },
  groupsHeaderTop: {
    marginTop: 18,
  },
  sectionTitle: {
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '800',
  },
  inviteCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 12,
  },
  inviteCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  inviteCardIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  inviteCardCopy: {
    flex: 1,
  },
  inviteCardTitle: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
  },
  inviteCardBody: {
    ...Typography.body,
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
  },
  inviteActionsRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  primaryInviteAction: {
    flex: 1,
    minWidth: 0,
    minHeight: 42,
    borderRadius: 999,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryInviteActionText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
    color: '#1C1C1E',
    flexShrink: 1,
  },
  secondaryInviteAction: {
    flex: 1,
    minWidth: 0,
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryInviteActionText: {
    fontSize: 13,
    lineHeight: 17,
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
  addGroupButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupList: {
    gap: 8,
    marginBottom: 2,
  },
  groupRow: {
    minHeight: 58,
    borderRadius: 18,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  groupIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: ESTIMATED_FRIEND_ROW_HEIGHT,
    paddingVertical: 7,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    ...Typography.body,
    fontSize: 16,
    fontWeight: '700',
  },
  friendCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  friendName: {
    ...Typography.body,
    fontSize: 15,
    fontWeight: '700',
  },
  friendMeta: {
    ...Typography.body,
    fontSize: 12,
    lineHeight: 16,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  groupFooter: {
    width: '100%',
    gap: 8,
  },
  deleteGroupButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteGroupText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  groupNameInput: {
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    ...Typography.body,
  },
  groupHelperText: {
    ...Typography.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  groupMembers: {
    marginTop: 14,
    gap: 8,
  },
  memberChoice: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  memberChoiceText: {
    flex: 1,
    minWidth: 0,
    ...Typography.body,
    fontSize: 15,
    fontWeight: '700',
  },
});
