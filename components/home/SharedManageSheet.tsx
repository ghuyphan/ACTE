import { Ionicons } from '@expo/vector-icons';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { environment, presentationDetents, presentationDragIndicator } from '@expo/ui/swift-ui/modifiers';
import { Image } from 'expo-image';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import {
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Sheet, Typography } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { FriendConnection, FriendGroup, FriendInvite } from '../../services/sharedFeedService';
import { getPersistentItem, getPersistentItemSync, setPersistentItem } from '../../utils/appStorage';
import AppSheet from '../sheets/AppSheet';
import AppSheetScaffold from '../sheets/AppSheetScaffold';
import SheetFooterButton from '../sheets/SheetFooterButton';
import TextFieldEditSheet from '../sheets/TextFieldEditSheet';
import PrimaryButton from '../ui/PrimaryButton';

const FIXED_SHEET_HEIGHT = Math.min(Sheet.maxHeight, Math.round(Dimensions.get('window').height * 0.82));
const FriendsList = Platform.OS === 'android' ? BottomSheetFlatList : FlatList;
const MIN_EXISTING_FRIENDS_SHEET_HEIGHT = Math.min(FIXED_SHEET_HEIGHT, 560);
const MIN_EMPTY_FRIENDS_SHEET_HEIGHT = Math.min(FIXED_SHEET_HEIGHT, 540);
const COLLAPSIBLE_LAYOUT_TRANSITION = LinearTransition.duration(180).easing(Easing.out(Easing.cubic));
const COLLAPSIBLE_ENTERING = FadeIn.duration(140).easing(Easing.out(Easing.cubic));
const COLLAPSIBLE_EXITING = FadeOut.duration(110).easing(Easing.in(Easing.cubic));
const COLLAPSE_STATE_STORAGE_KEY = 'sharedManageSheet.collapseState.v1';
const DEFAULT_COLLAPSE_STATE = {
  groupsExpanded: true,
  friendsExpanded: true,
};

type CollapseState = typeof DEFAULT_COLLAPSE_STATE;

function parseCollapseState(rawValue: string | null | undefined): CollapseState | null {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<CollapseState>;
    return {
      groupsExpanded:
        typeof parsed.groupsExpanded === 'boolean'
          ? parsed.groupsExpanded
          : DEFAULT_COLLAPSE_STATE.groupsExpanded,
      friendsExpanded:
        typeof parsed.friendsExpanded === 'boolean'
          ? parsed.friendsExpanded
          : DEFAULT_COLLAPSE_STATE.friendsExpanded,
    };
  } catch {
    return null;
  }
}

function getInitialCollapseState(): CollapseState {
  return parseCollapseState(getPersistentItemSync(COLLAPSE_STATE_STORAGE_KEY)) ?? DEFAULT_COLLAPSE_STATE;
}

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
  hasFriends,
  onCreateInvite,
  onShareInvite,
  onRevokeInvite,
}: {
  activeInvite: FriendInvite | null;
  creatingInvite: boolean;
  hasFriends: boolean;
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
        : hasFriends
          ? t('shared.inviteAnotherTitle', 'Invite another friend')
          : t('shared.inviteFirstTitle', 'Invite your first friend');
  const inviteBody =
    inviteState === 'ready'
      ? t('shared.inviteReadyBody', 'Share this link to connect.')
      : inviteState === 'creating'
        ? t('shared.creatingInviteBody', 'Getting your invite link ready...')
        : hasFriends
          ? t('shared.inviteAnotherBody', 'Share a link when you want to add someone new.')
          : t(
              'shared.inviteFirstBody',
              'One invite link is all you need to start sharing notes from Home.'
            );

  if (hasFriends) {
    return (
      <View
        style={[
          styles.inviteCompactCard,
          {
            backgroundColor: softFill,
            borderColor: outlineColor,
          },
        ]}
      >
        <View style={[styles.inviteCompactIcon, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name={invitePrimaryIcon} size={17} color={colors.primary} />
        </View>
        <View style={styles.inviteCardCopy}>
          <Text numberOfLines={1} style={[styles.inviteCompactTitle, { color: colors.text }]}>
            {inviteTitle}
          </Text>
          <Text numberOfLines={1} style={[styles.inviteCompactBody, { color: colors.secondaryText }]}>
            {inviteBody}
          </Text>
        </View>
        <Pressable
          onPress={invitePrimaryAction}
          disabled={inviteState === 'creating'}
          style={({ pressed }) => [
            styles.compactInviteAction,
            {
              backgroundColor: colors.primary,
              opacity: inviteState === 'creating' ? 0.72 : pressed ? 0.9 : 1,
            },
          ]}
        >
          <Text numberOfLines={1} style={styles.compactInviteActionText}>
            {inviteState === 'ready'
              ? t('shared.shareInviteButtonShort', 'Share')
              : inviteState === 'creating'
                ? t('shared.creatingInviteButtonShort', 'Preparing')
                : t('shared.inviteButtonShort', 'Invite')}
          </Text>
        </Pressable>
        {inviteState === 'ready' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('shared.revokeInviteButton', 'Revoke invite')}
            onPress={onRevokeInvite}
            style={({ pressed }) => [
              styles.compactRevokeAction,
              { backgroundColor: softFill, opacity: pressed ? 0.84 : 1 },
            ]}
          >
            <Ionicons name="trash-outline" size={15} color={colors.secondaryText} />
          </Pressable>
        ) : null}
      </View>
    );
  }

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

function CollapsibleSectionHeader({
  title,
  count,
  expanded,
  onToggle,
  compactTop = false,
  topStyle,
  trailing,
}: {
  title: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  compactTop?: boolean;
  topStyle?: StyleProp<ViewStyle>;
  trailing?: ReactNode;
}) {
  const { colors, isDark } = useTheme();
  const softFill = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const chevronAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        rotate: withTiming(expanded ? '90deg' : '0deg', {
          duration: 160,
          easing: Easing.out(Easing.cubic),
        }),
      },
    ],
  }));

  return (
    <Animated.View
      layout={COLLAPSIBLE_LAYOUT_TRANSITION}
      style={[
        styles.sectionHeaderRow,
        compactTop ? styles.sectionHeaderCompactTop : styles.sectionHeaderTop,
        topStyle,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={({ pressed }) => [
          styles.sectionToggle,
          {
            opacity: pressed ? 0.72 : 1,
          },
        ]}
      >
        <Animated.View style={chevronAnimatedStyle}>
          <Ionicons name="chevron-forward" size={17} color={colors.secondaryText} />
        </Animated.View>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
        <View style={[styles.countPill, { backgroundColor: softFill }]}>
          <Text style={[styles.countPillText, { color: colors.text }]}>{count}</Text>
        </View>
      </Pressable>
      {trailing}
    </Animated.View>
  );
}

function GroupsSectionHeader({
  count,
  expanded,
  onToggle,
  onCreateGroup,
}: {
  count: number;
  expanded: boolean;
  onToggle: () => void;
  onCreateGroup: () => void;
}) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const softFill = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';

  return (
    <CollapsibleSectionHeader
      title={t('shared.friendGroupsTitle', 'Groups')}
      count={count}
      expanded={expanded}
      onToggle={onToggle}
      topStyle={styles.groupsHeaderTop}
      trailing={
        <Pressable
          accessibilityRole="button"
          onPress={onCreateGroup}
          style={({ pressed }) => [
            styles.addGroupButton,
            { backgroundColor: softFill, opacity: pressed ? 0.86 : 1 },
          ]}
        >
          <Ionicons name="add" size={17} color={colors.text} />
        </Pressable>
      }
    />
  );
}

function FriendsSectionHeader({
  count,
  expanded,
  onToggle,
  onCreateGroup,
  compactTop = false,
}: {
  count: number;
  expanded: boolean;
  onToggle: () => void;
  onCreateGroup?: () => void;
  compactTop?: boolean;
}) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const softFill = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';

  return (
    <CollapsibleSectionHeader
      title={t('shared.friendsListTitle', 'Connected friends')}
      count={count}
      expanded={expanded}
      onToggle={onToggle}
      compactTop={compactTop}
      trailing={onCreateGroup ? (
        <Pressable
          accessibilityRole="button"
          onPress={onCreateGroup}
          style={({ pressed }) => [
            styles.inlineGroupAction,
            { backgroundColor: softFill, opacity: pressed ? 0.84 : 1 },
          ]}
        >
          <Ionicons name="add" size={14} color={colors.secondaryText} />
          <Text numberOfLines={1} style={[styles.inlineGroupActionText, { color: colors.secondaryText }]}>
            {t('shared.friendGroupCreateShort', 'New group')}
          </Text>
        </Pressable>
      ) : undefined}
    />
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
      <Ionicons name="chevron-forward" size={17} color={colors.secondaryText} />
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
  onManageFriend,
}: {
  friend: FriendConnection;
  friendFallback: string;
  connectedCopyTemplate: string;
  locale?: string;
  onManageFriend: (friend: FriendConnection) => void;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const labels = resolveFriendLabels(friend, friendFallback, connectedCopyTemplate, locale);
  const compactMeta = friend.nickname?.trim()
    ? (friend.username?.trim() ? `@${friend.username.trim().toLowerCase()}` : labels.meta.split(' • ')[0])
    : labels.meta.includes(' • ')
      ? labels.meta.split(' • ')[0]
      : '';
  const avatarSeed = (friend.nickname || friend.username || friend.displayNameSnapshot || friendFallback).trim();
  const avatarLabel = avatarSeed.charAt(0).toUpperCase();

  return (
    <Pressable
      accessibilityLabel={`${labels.title}, ${t('shared.friendManageAction', 'Manage friend')}`}
      accessibilityRole="button"
      onPress={() => onManageFriend(friend)}
      style={({ pressed }) => [
        styles.friendRow,
        pressed ? styles.friendRowPressed : null,
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
        {compactMeta ? (
          <Text numberOfLines={1} style={[styles.friendMeta, { color: colors.secondaryText }]}>
            {compactMeta}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function FriendActionsSheet({
  friend,
  friendFallback,
  connectedCopyTemplate,
  locale,
  onClose,
  onEditNickname,
  onRemoveFriend,
}: {
  friend: FriendConnection | null;
  friendFallback: string;
  connectedCopyTemplate: string;
  locale?: string;
  onClose: () => void;
  onEditNickname: (friend: FriendConnection) => void;
  onRemoveFriend: (friendUid: string) => void;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const horizontalPadding =
    Platform.OS === 'ios' ? Sheet.ios.horizontalPadding : Sheet.android.horizontalPadding;
  const labels = friend
    ? resolveFriendLabels(friend, friendFallback, connectedCopyTemplate, locale)
    : null;
  const actionRows = [
    {
      key: 'nickname',
      icon: 'pencil-outline' as const,
      label: t('shared.friendNicknameEdit', 'Edit nickname'),
      color: colors.primary,
      onPress: () => {
        if (!friend) {
          return;
        }
        onEditNickname(friend);
      },
    },
    {
      key: 'remove',
      icon: 'person-remove-outline' as const,
      label: t('shared.removeFriendConfirm', 'Remove'),
      color: colors.danger,
      onPress: () => {
        if (!friend) {
          return;
        }
        onRemoveFriend(friend.userId);
      },
    },
  ];

  return (
    <AppSheet visible={Boolean(friend)} onClose={onClose}>
      <AppSheetScaffold
        headerVariant="standard"
        title={labels?.title ?? t('shared.friendFallback', 'Friend')}
        subtitle={labels?.meta}
        useHorizontalPadding={false}
        footer={(
          <View style={styles.friendActionsFooter}>
            <SheetFooterButton
              label={t('common.done', 'Done')}
              onPress={onClose}
              style={styles.compactDoneButton}
            />
          </View>
        )}
      >
        <View style={styles.friendActionsList}>
          {actionRows.map((action, index) => (
            <View key={action.key}>
              <Pressable
                accessibilityRole="button"
                disabled={!friend}
                onPress={action.onPress}
                style={({ pressed }) => [
                  styles.friendActionOption,
                  { paddingHorizontal: horizontalPadding },
                  pressed ? styles.friendActionOptionPressed : null,
                  !friend ? styles.friendActionOptionDisabled : null,
                ]}
              >
                <View style={[styles.friendActionIconBadge, { backgroundColor: `${action.color}18` }]}>
                  <Ionicons name={action.icon} size={18} color={action.color} />
                </View>
                <Text style={[styles.friendActionOptionLabel, { color: action.color === colors.danger ? colors.danger : colors.text }]}>
                  {action.label}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={action.color === colors.danger ? colors.danger : colors.secondaryText}
                />
              </Pressable>
              {index < actionRows.length - 1 ? (
                <View
                  style={[
                    styles.friendActionDivider,
                    {
                      backgroundColor: colors.border,
                      marginLeft: horizontalPadding + 54,
                    },
                  ]}
                />
              ) : null}
            </View>
          ))}
        </View>
      </AppSheetScaffold>
    </AppSheet>
  );
}

function FriendCreateActionsSheet({
  visible,
  activeInvite,
  creatingInvite,
  canCreateGroup,
  onClose,
  onCreateInvite,
  onShareInvite,
  onRevokeInvite,
  onCreateGroup,
}: {
  visible: boolean;
  activeInvite: FriendInvite | null;
  creatingInvite: boolean;
  canCreateGroup: boolean;
  onClose: () => void;
  onCreateInvite: () => void;
  onShareInvite: () => void;
  onRevokeInvite: () => void;
  onCreateGroup: () => void;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const horizontalPadding =
    Platform.OS === 'ios' ? Sheet.ios.horizontalPadding : Sheet.android.horizontalPadding;
  const inviteAction = activeInvite
    ? {
        key: 'share-invite',
        icon: 'paper-plane-outline' as const,
        label: t('shared.shareInviteButton', 'Share invite link'),
        color: colors.primary,
        onPress: onShareInvite,
        disabled: false,
        closeOnPress: false,
      }
    : {
        key: 'create-invite',
        icon: 'person-add-outline' as const,
        label: creatingInvite
          ? t('shared.creatingInviteButton', 'Preparing invite...')
          : t('shared.createInviteButton', 'Create invite'),
        color: colors.primary,
        onPress: onCreateInvite,
        disabled: creatingInvite,
        closeOnPress: false,
      };
  const actionRows = [
    inviteAction,
    ...(canCreateGroup
      ? [
          {
            key: 'new-group',
            icon: 'people-outline' as const,
            label: t('shared.friendGroupCreateTitle', 'New group'),
            color: colors.text,
            onPress: onCreateGroup,
            disabled: false,
            closeOnPress: true,
          },
        ]
      : []),
    ...(activeInvite
      ? [
          {
            key: 'revoke-invite',
            icon: 'trash-outline' as const,
            label: t('shared.revokeInviteButton', 'Revoke invite'),
            color: colors.danger,
            onPress: onRevokeInvite,
            disabled: false,
            closeOnPress: false,
          },
        ]
      : []),
  ];

  return (
    <AppSheet visible={visible} onClose={onClose}>
      <AppSheetScaffold
        headerVariant="standard"
        title={t('shared.friendActionsTitle', 'Add or organize')}
        subtitle={t('shared.friendActionsSubtitle', 'Invite friends or create a group.')}
        useHorizontalPadding={false}
        footer={(
          <View style={styles.friendActionsFooter}>
            <SheetFooterButton
              label={t('common.done', 'Done')}
              onPress={onClose}
              style={styles.compactDoneButton}
            />
          </View>
        )}
      >
        <View style={styles.friendActionsList}>
          {actionRows.map((action, index) => (
            <View key={action.key}>
              <Pressable
                accessibilityRole="button"
                disabled={action.disabled}
                onPress={() => {
                  if (action.closeOnPress) {
                    onClose();
                  }
                  action.onPress();
                }}
                style={({ pressed }) => [
                  styles.friendActionOption,
                  { paddingHorizontal: horizontalPadding },
                  pressed ? styles.friendActionOptionPressed : null,
                  action.disabled ? styles.friendActionOptionDisabled : null,
                ]}
              >
                <View style={[styles.friendActionIconBadge, { backgroundColor: `${action.color}18` }]}>
                  <Ionicons name={action.icon} size={18} color={action.color} />
                </View>
                <Text
                  style={[
                    styles.friendActionOptionLabel,
                    { color: action.color === colors.danger ? colors.danger : colors.text },
                  ]}
                >
                  {action.label}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={action.color === colors.danger ? colors.danger : colors.secondaryText}
                />
              </Pressable>
              {index < actionRows.length - 1 ? (
                <View
                  style={[
                    styles.friendActionDivider,
                    {
                      backgroundColor: colors.border,
                      marginLeft: horizontalPadding + 54,
                    },
                  ]}
                />
              ) : null}
            </View>
          ))}
        </View>
      </AppSheetScaffold>
    </AppSheet>
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
  const { colors, isDark } = useTheme();
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
  const [actionFriend, setActionFriend] = useState<FriendConnection | null>(null);
  const [isCreateActionsVisible, setIsCreateActionsVisible] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [nicknameErrorMessage, setNicknameErrorMessage] = useState<string | null>(null);
  const [isSavingNickname, setIsSavingNickname] = useState(false);
  const [editingGroup, setEditingGroup] = useState<FriendGroup | null>(null);
  const [isGroupEditorVisible, setIsGroupEditorVisible] = useState(false);
  const [groupNameDraft, setGroupNameDraft] = useState('');
  const [groupMemberDraft, setGroupMemberDraft] = useState<string[]>([]);
  const [groupErrorMessage, setGroupErrorMessage] = useState<string | null>(null);
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [collapseState, setCollapseState] = useState<CollapseState>(getInitialCollapseState);
  const areGroupsExpanded = collapseState.groupsExpanded;
  const areFriendsExpanded = collapseState.friendsExpanded;

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
  const unreadChatsBadgeLabel =
    unreadChatsCount > 0 ? (unreadChatsCount > 9 ? '9+' : String(unreadChatsCount)) : undefined;
  const hasFriends = friends.length > 0;
  const shouldShowGroupsSection = friendGroups.length > 0;
  const canCreateFirstGroup = friends.length > 1 && !shouldShowGroupsSection;
  const manageSheetHeight = useMemo(() => {
    const headerAndFooterHeight = hasFriends ? 118 : 162;
    const inviteHeight = hasFriends ? 0 : 124;
    const visibleFriendRowLimit = shouldShowGroupsSection ? 6 : 9;
    const groupHeight = shouldShowGroupsSection
      ? 42 + (areGroupsExpanded ? Math.min(friendGroups.length, 3) * 58 : 0)
      : 0;
    const friendRowsHeight = areFriendsExpanded
      ? friends.length > 0
        ? Math.min(friends.length, visibleFriendRowLimit) * 62
        : 106
      : 0;
    const friendHeaderHeight = hasFriends && !shouldShowGroupsSection ? 0 : 44;
    const preferredHeight =
      headerAndFooterHeight + inviteHeight + groupHeight + friendHeaderHeight + friendRowsHeight;

    return Math.min(
      FIXED_SHEET_HEIGHT,
      Math.max(
        hasFriends ? MIN_EXISTING_FRIENDS_SHEET_HEIGHT : MIN_EMPTY_FRIENDS_SHEET_HEIGHT,
        preferredHeight
      )
    );
  }, [
    areFriendsExpanded,
    areGroupsExpanded,
    friendGroups.length,
    friends.length,
    hasFriends,
    shouldShowGroupsSection,
  ]);
  const iosManageSheetDetents = useMemo(() => [{ height: manageSheetHeight }], [manageSheetHeight]);
  const iosManageSheetModifiers = useMemo(
    () => [
      presentationDragIndicator('visible'),
      environment('colorScheme', isDark ? 'dark' : 'light'),
      presentationDetents(iosManageSheetDetents, { selection: { height: manageSheetHeight } }),
    ],
    [iosManageSheetDetents, isDark, manageSheetHeight]
  );

  useEffect(() => {
    let cancelled = false;

    void getPersistentItem(COLLAPSE_STATE_STORAGE_KEY)
      .then((rawValue) => {
        const persistedState = parseCollapseState(rawValue);
        if (!cancelled && persistedState) {
          setCollapseState(persistedState);
        }
      })
      .catch((error) => {
        console.warn('[SharedManageSheet] Failed to load collapse state:', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const updateCollapseState = useCallback((patch: Partial<CollapseState>) => {
    setCollapseState((current) => {
      const nextState = { ...current, ...patch };
      void setPersistentItem(COLLAPSE_STATE_STORAGE_KEY, JSON.stringify(nextState)).catch((error) => {
        console.warn('[SharedManageSheet] Failed to persist collapse state:', error);
      });
      return nextState;
    });
  }, []);

  useEffect(() => {
    if (!visible) {
      setNicknameFriend(null);
      setActionFriend(null);
      setIsCreateActionsVisible(false);
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

  const openFriendActions = (friend: FriendConnection) => {
    setActionFriend(friend);
  };

  const closeFriendActions = () => {
    setActionFriend(null);
  };

  const editActionFriendNickname = (friend: FriendConnection) => {
    setActionFriend(null);
    openNicknameEditor(friend);
  };

  const removeActionFriend = (friendUid: string) => {
    setActionFriend(null);
    onRemoveFriend(friendUid);
  };

  const openCreateActions = () => {
    setIsCreateActionsVisible(true);
  };

  const closeCreateActions = () => {
    setIsCreateActionsVisible(false);
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
        androidSnapPoints={[manageSheetHeight]}
        androidContentContainerStyle={[styles.androidSheetContainer, { height: manageSheetHeight }]}
        fitToContents={false}
        iosGroupModifiers={iosManageSheetModifiers}
      >
        <AppSheetScaffold
          headerVariant="action"
          title={t('shared.manageTitle', 'Friends')}
          overlayHeaderActions
          trailingActions={[
            {
              icon: 'search-outline',
              accessibilityLabel: t('shared.searchByUsernameButton', 'Find by Noto ID'),
              onPress: onOpenFriendSearch,
              testID: 'shared-manage-find-friend-button',
            },
            {
              icon: 'add',
              accessibilityLabel: t('shared.friendActionsTitle', 'Add or organize'),
              onPress: openCreateActions,
              testID: 'shared-manage-actions-button',
            },
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
          ]}
          footer={hasFriends ? undefined : (
            <SheetFooterButton
              label={t('common.done', 'Done')}
              onPress={onClose}
              style={styles.compactDoneButton}
            />
          )}
          useHorizontalPadding={false}
          contentBottomPaddingWhenFooter={0}
          footerTopSpacing={18}
          style={[styles.sheetScaffold, { height: manageSheetHeight }]}
          contentContainerStyle={styles.sheetBody}
        >
          <View style={[styles.fixedContent, { paddingHorizontal: horizontalPadding }]}>
            {!hasFriends ? (
              <InviteActionsCard
                activeInvite={activeInvite}
                creatingInvite={creatingInvite}
                hasFriends={hasFriends}
                onCreateInvite={onCreateInvite}
                onShareInvite={onShareInvite}
                onRevokeInvite={onRevokeInvite}
              />
            ) : null}
            {shouldShowGroupsSection ? (
              <>
                <GroupsSectionHeader
                  count={friendGroups.length}
                  expanded={areGroupsExpanded}
                  onToggle={() => updateCollapseState({ groupsExpanded: !areGroupsExpanded })}
                  onCreateGroup={() => openGroupEditor(null)}
                />
                {areGroupsExpanded ? (
                  <Animated.View
                    entering={COLLAPSIBLE_ENTERING}
                    exiting={COLLAPSIBLE_EXITING}
                    layout={COLLAPSIBLE_LAYOUT_TRANSITION}
                    style={styles.groupList}
                  >
                    {friendGroups.map((group) => (
                      <GroupRow
                        key={group.id}
                        group={group}
                        memberCount={group.memberUserIds.length}
                        onPress={openGroupEditor}
                      />
                    ))}
                  </Animated.View>
                ) : null}
              </>
            ) : null}
            {hasFriends && !shouldShowGroupsSection ? null : (
              <FriendsSectionHeader
                count={friends.length}
                expanded={areFriendsExpanded}
                onToggle={() => updateCollapseState({ friendsExpanded: !areFriendsExpanded })}
                onCreateGroup={canCreateFirstGroup ? () => openGroupEditor(null) : undefined}
                compactTop={!areGroupsExpanded || !shouldShowGroupsSection}
              />
            )}
          </View>
          {areFriendsExpanded || (hasFriends && !shouldShowGroupsSection) ? (
            <Animated.View
              entering={COLLAPSIBLE_ENTERING}
              exiting={COLLAPSIBLE_EXITING}
              layout={COLLAPSIBLE_LAYOUT_TRANSITION}
              style={styles.listShell}
            >
              <FriendsList<FriendConnection>
                data={friends}
                keyExtractor={(item) => item.userId}
                renderItem={({ item }) => (
                  <FriendRow
                    friend={item}
                    friendFallback={friendFallback}
                    connectedCopyTemplate={connectedCopyTemplate}
                    locale={i18n.language}
                    onManageFriend={openFriendActions}
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
            </Animated.View>
          ) : null}
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
      <FriendActionsSheet
        friend={actionFriend}
        friendFallback={friendFallback}
        connectedCopyTemplate={connectedCopyTemplate}
        locale={i18n.language}
        onClose={closeFriendActions}
        onEditNickname={editActionFriendNickname}
        onRemoveFriend={removeActionFriend}
      />
      <FriendCreateActionsSheet
        visible={isCreateActionsVisible}
        activeInvite={activeInvite}
        creatingInvite={creatingInvite}
        canCreateGroup={friends.length > 1}
        onClose={closeCreateActions}
        onCreateInvite={onCreateInvite}
        onShareInvite={onShareInvite}
        onRevokeInvite={onRevokeInvite}
        onCreateGroup={() => openGroupEditor(null)}
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
    paddingBottom: 30,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  sectionHeaderTop: {
    marginTop: 16,
  },
  sectionHeaderCompactTop: {
    marginTop: 16,
  },
  groupsHeaderTop: {
    marginTop: 14,
  },
  sectionToggle: {
    minWidth: 0,
    minHeight: 34,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  sectionTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
    flexShrink: 1,
  },
  inviteCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 11,
  },
  inviteCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  inviteCardIcon: {
    width: 30,
    height: 30,
    borderRadius: 11,
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
  inviteCompactCard: {
    minHeight: 66,
    borderRadius: 17,
    borderWidth: 1,
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inviteCompactIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  inviteCompactTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  inviteCompactBody: {
    ...Typography.body,
    marginTop: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  compactInviteAction: {
    minWidth: 68,
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  compactInviteActionText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  compactRevokeAction: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  inviteActionsRow: {
    marginTop: 9,
    flexDirection: 'row',
    gap: 8,
  },
  primaryInviteAction: {
    flex: 1,
    minWidth: 0,
    minHeight: 38,
    borderRadius: 999,
    paddingHorizontal: 12,
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
    minHeight: 38,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
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
    minWidth: 25,
    height: 25,
    borderRadius: 13,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countPillText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
  },
  addGroupButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineGroupAction: {
    minHeight: 30,
    maxWidth: 116,
    borderRadius: 15,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    flexShrink: 0,
  },
  inlineGroupActionText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
    flexShrink: 1,
  },
  groupList: {
    gap: 6,
    marginBottom: 1,
  },
  groupRow: {
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  groupIcon: {
    width: 34,
    height: 34,
    borderRadius: 13,
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
    gap: 9,
    minHeight: 62,
    paddingVertical: 7,
    paddingHorizontal: 2,
    borderRadius: 16,
  },
  friendRowPressed: {
    opacity: 0.78,
  },
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  compactDoneButton: {
    minHeight: 48,
    borderRadius: 14,
  },
  friendActionsList: {
    width: '100%',
  },
  friendActionOption: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  friendActionOptionPressed: {
    opacity: 0.82,
  },
  friendActionOptionDisabled: {
    opacity: 0.5,
  },
  friendActionIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendActionOptionLabel: {
    flex: 1,
    ...Typography.body,
    fontWeight: '600',
  },
  friendActionDivider: {
    height: StyleSheet.hairlineWidth,
  },
  friendActionsFooter: {
    marginTop: 16,
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
