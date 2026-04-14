import { Ionicons } from '@expo/vector-icons';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Dimensions, FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Sheet, Typography } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { FriendConnection, FriendInvite } from '../../services/sharedFeedService';
import AppSheet from '../sheets/AppSheet';
import AppSheetScaffold from '../sheets/AppSheetScaffold';
import SheetFooterButton from '../sheets/SheetFooterButton';

const ESTIMATED_FRIEND_ROW_HEIGHT = 86;
const FIXED_SHEET_HEIGHT = Math.min(Sheet.maxHeight, Math.round(Dimensions.get('window').height * 0.82));
const FriendsList = Platform.OS === 'android' ? BottomSheetFlatList : FlatList;

function formatConnectedCopy(connectedOnLabel: string, friendedAt: string) {
  return `${connectedOnLabel} ${new Date(friendedAt).toLocaleDateString()}`;
}

function resolveFriendLabels(friend: FriendConnection, friendFallback: string, connectedOnLabel: string) {
  const normalizedDisplayName = friend.displayNameSnapshot?.trim() || null;
  const normalizedUsername = friend.username?.trim().toLowerCase() || null;
  const connectedCopy = formatConnectedCopy(connectedOnLabel, friend.friendedAt);
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
  onOpenFriendSearch,
}: {
  activeInvite: FriendInvite | null;
  creatingInvite: boolean;
  onCreateInvite: () => void;
  onShareInvite: () => void;
  onRevokeInvite: () => void;
  onOpenFriendSearch: () => void;
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
      <Pressable
        onPress={onOpenFriendSearch}
        style={({ pressed }) => [
          styles.searchFriendAction,
          {
            backgroundColor: softFill,
            borderColor: outlineColor,
            opacity: pressed ? 0.92 : 1,
          },
        ]}
      >
        <Ionicons name="search-outline" size={16} color={colors.text} />
        <Text style={[styles.searchFriendActionText, { color: colors.text }]}>
          {t('shared.searchByUsernameButton', 'Find by Noto ID')}
        </Text>
      </Pressable>
    </View>
  );
}

function FriendsSectionHeader({ count }: { count: number }) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const softFill = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';

  return (
    <View style={styles.sectionHeaderRow}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        {t('shared.friendsListTitle', 'Your friends')}
      </Text>
      <View style={[styles.countPill, { backgroundColor: softFill }]}>
        <Text style={[styles.countPillText, { color: colors.text }]}>{count}</Text>
      </View>
    </View>
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
  connectedOnLabel,
  onRemoveFriend,
}: {
  friend: FriendConnection;
  friendFallback: string;
  connectedOnLabel: string;
  onRemoveFriend: (friendUid: string) => void;
}) {
  const { colors, isDark } = useTheme();
  const softFill = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const outlineColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const labels = resolveFriendLabels(friend, friendFallback, connectedOnLabel);
  const avatarSeed = (friend.username || friend.displayNameSnapshot || friendFallback).trim();
  const avatarLabel = avatarSeed.charAt(0).toUpperCase();

  return (
    <View
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
  onOpenFriendSearch: () => void;
  onRemoveFriend: (friendUid: string) => void;
}) {
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
    onOpenFriendSearch,
    onRemoveFriend,
  } = props;

  const emptyLoadingBody = t('shared.refreshingFriends', 'Refreshing your shared circle...');
  const emptyBody = t(
    'shared.emptyManageBody',
    'Invite someone to start a simple shared feed on Home.'
  );
  const friendFallback = t('shared.friendFallback', 'Friend');
  const connectedOnLabel = t('shared.connectedOn', 'Connected');
  const horizontalPadding =
    Platform.OS === 'ios' ? Sheet.ios.horizontalPadding : Sheet.android.horizontalPadding;

  return (
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
        headerVariant="standard"
        title={t('shared.manageTitle', 'Friends')}
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
            onOpenFriendSearch={onOpenFriendSearch}
          />
          <FriendsSectionHeader count={friends.length} />
        </View>
        <View style={styles.listShell}>
          <FriendsList<FriendConnection>
            data={friends}
            keyExtractor={(item) => item.userId}
            renderItem={({ item }) => (
              <FriendRow
                friend={item}
                friendFallback={friendFallback}
                connectedOnLabel={connectedOnLabel}
                onRemoveFriend={onRemoveFriend}
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
  searchFriendAction: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  searchFriendActionText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: ESTIMATED_FRIEND_ROW_HEIGHT,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    ...Typography.body,
    fontSize: 18,
    fontWeight: '700',
  },
  friendCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  friendName: {
    ...Typography.body,
    fontSize: 16,
    fontWeight: '700',
  },
  friendMeta: {
    ...Typography.body,
    fontSize: 13,
    lineHeight: 18,
  },
  removeButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
