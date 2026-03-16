import { Ionicons } from '@expo/vector-icons';
import { GlassView } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Layout, Shadows, Typography } from '../../../constants/theme';
import { useRoomsStore } from '../../../hooks/useRooms';
import { useTheme } from '../../../hooks/useTheme';
import { getRoomErrorMessage, RoomDetails } from '../../../services/roomService';
import { isOlderIOS } from '../../../utils/platform';

function SectionShell({
  children,
  index,
}: {
  children: React.ReactNode;
  index: number;
}) {
  return (
    <Animated.View entering={FadeInUp.delay(index * 70).springify().damping(18).mass(0.8)} style={styles.sectionRow}>
      {children}
    </Animated.View>
  );
}

export default function RoomSettingsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const roomsStore = useRoomsStore();
  const [details, setDetails] = useState<RoomDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [renaming, setRenaming] = useState('');

  const softInputBackground = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
  const glassOverlay = isDark ? 'rgba(18,18,24,0.64)' : 'rgba(255,255,255,0.74)';
  const glassFallback = isDark ? 'rgba(18,18,24,0.92)' : 'rgba(255,255,255,0.94)';

  useEffect(() => {
    if (typeof id !== 'string') {
      return;
    }

    setLoading(true);
    void roomsStore
      .getRoomDetails(id, true)
      .then((nextDetails) => {
        setDetails(nextDetails);
        setRenaming(nextDetails?.room.name ?? '');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id, roomsStore]);

  const refresh = async () => {
    if (typeof id !== 'string') {
      return;
    }
    const nextDetails = await roomsStore.getRoomDetails(id, true);
    setDetails(nextDetails);
    setRenaming(nextDetails?.room.name ?? '');
  };

  const handleRename = async () => {
    if (typeof id !== 'string') {
      return;
    }

    setSavingName(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await roomsStore.renameRoom(id, renaming);
      await refresh();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert(t('rooms.renameFailedTitle', 'Could not rename room'), getRoomErrorMessage(error));
    } finally {
      setSavingName(false);
    }
  };

  const handleCreateOrShareInvite = async () => {
    if (typeof id !== 'string' || !details) {
      return;
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const invite = details.activeInvite ?? (await roomsStore.createInvite(id));
      await Share.share({ message: invite.url });
      await refresh();
    } catch (error) {
      Alert.alert(t('rooms.inviteFailedTitle', 'Could not prepare invite'), getRoomErrorMessage(error));
    }
  };

  const handleRevokeInvite = async () => {
    if (typeof id !== 'string' || !details?.activeInvite) {
      return;
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await roomsStore.revokeInvite(id, details.activeInvite.id);
      await refresh();
    } catch (error) {
      Alert.alert(t('rooms.inviteFailedTitle', 'Could not prepare invite'), getRoomErrorMessage(error));
    }
  };

  const handleRemoveMember = (memberUserId: string) => {
    if (typeof id !== 'string') {
      return;
    }

    Alert.alert(
      t('rooms.removeMemberTitle', 'Remove member'),
      t('rooms.removeMemberBody', 'This person will lose access to the room.'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('rooms.removeMemberConfirm', 'Remove'),
          style: 'destructive',
          onPress: () => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            void roomsStore.removeMember(id, memberUserId).then(() => refresh());
          },
        },
      ]
    );
  };

  if (loading || !details) {
    return (
      <View style={[styles.loadingScreen, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const isOwner = details.room.currentUserRole === 'owner';

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Animated.View
        entering={FadeInDown.springify().damping(18).mass(0.8)}
        style={[styles.headerWrap, { top: insets.top + Layout.floatingGap }]}
        pointerEvents="box-none"
      >
        <View
          style={[
            styles.headerPanel,
            {
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.92)',
            },
          ]}
        >
          <GlassView
            style={StyleSheet.absoluteFillObject}
            glassEffectStyle="regular"
            colorScheme={isDark ? 'dark' : 'light'}
          />
          <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: glassOverlay }]} />
          {isOlderIOS ? (
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFillObject,
                {
                  borderRadius: 30,
                  backgroundColor: glassFallback,
                },
              ]}
            />
          ) : null}
          <View style={styles.headerContent}>
            <Text style={[styles.headerEyebrow, { color: colors.primary }]}>
              {t('rooms.settingsTitle', 'Room Settings')}
            </Text>
            <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
              {details.room.name}
            </Text>
            <Text style={[styles.headerBody, { color: colors.secondaryText }]}>
              {isOwner
                ? t('rooms.settingsOwnerBody', 'Manage invite access, rename the room, and keep the membership tidy.')
                : t('rooms.settingsMemberBody', 'You can view the room details here while the owner manages access.')}
            </Text>
          </View>
        </View>
      </Animated.View>

      <View
        style={{
          paddingTop: insets.top + 146,
          paddingBottom: insets.bottom + 24,
        }}
      >
        <SectionShell index={1}>
          <View
            style={[
              styles.settingsCard,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.72)',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.88)',
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: colors.secondaryText }]}>
              {t('rooms.roomNameLabel', 'Room name')}
            </Text>
            <TextInput
              value={renaming}
              onChangeText={setRenaming}
              editable={isOwner}
              placeholder={t('rooms.roomNamePlaceholder', 'Weekend getaway')}
              placeholderTextColor={colors.secondaryText}
              style={[
                styles.input,
                {
                  backgroundColor: softInputBackground,
                  color: colors.text,
                  opacity: isOwner ? 1 : 0.75,
                },
              ]}
            />
            {isOwner ? (
              <Pressable
                onPress={() => {
                  void handleRename();
                }}
                style={({ pressed }) => [
                  styles.softAction,
                  {
                    backgroundColor: softInputBackground,
                    opacity: pressed ? 0.92 : 1,
                    transform: [{ scale: pressed ? 0.985 : 1 }],
                  },
                ]}
              >
                <Text style={[styles.softActionText, { color: colors.text }]}>
                  {savingName ? t('common.loading', 'Loading') : t('rooms.saveNameButton', 'Save room name')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </SectionShell>

        <SectionShell index={2}>
          <View
            style={[
              styles.settingsCard,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.72)',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.88)',
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: colors.secondaryText }]}>
              {t('rooms.inviteSectionTitle', 'Invite link')}
            </Text>
            <Text style={[styles.bodyText, { color: colors.text }]}>
              {details.activeInvite?.url ?? t('rooms.noInviteYet', 'No active invite link yet.')}
            </Text>
            {isOwner ? (
              <View style={styles.actionStack}>
                <Pressable
                  onPress={() => {
                    void handleCreateOrShareInvite();
                  }}
                  style={({ pressed }) => [
                    styles.primaryAction,
                    {
                      backgroundColor: colors.primary,
                      opacity: pressed ? 0.92 : 1,
                      transform: [{ scale: pressed ? 0.985 : 1 }],
                    },
                  ]}
                >
                  <Ionicons name="share-outline" size={18} color="#1C1C1E" />
                  <Text style={styles.primaryActionText}>
                    {details.activeInvite
                      ? t('rooms.shareInviteButton', 'Share invite')
                      : t('rooms.createInviteButton', 'Create invite')}
                  </Text>
                </Pressable>

                {details.activeInvite ? (
                  <Pressable
                    onPress={() => {
                      void handleRevokeInvite();
                    }}
                    style={({ pressed }) => [
                      styles.destructiveAction,
                      {
                        backgroundColor: isDark ? 'rgba(255,69,58,0.16)' : 'rgba(255,59,48,0.1)',
                        opacity: pressed ? 0.92 : 1,
                        transform: [{ scale: pressed ? 0.985 : 1 }],
                      },
                    ]}
                  >
                    <Ionicons name="close-circle-outline" size={18} color={colors.danger} />
                    <Text style={[styles.destructiveActionText, { color: colors.danger }]}>
                      {t('rooms.revokeInviteButton', 'Revoke')}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        </SectionShell>

        <SectionShell index={3}>
          <View
            style={[
              styles.settingsCard,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.72)',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.88)',
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: colors.secondaryText }]}>
              {t('rooms.membersTitle', 'Members')}
            </Text>
            <View style={styles.memberList}>
              {details.members.map((member) => (
                <View
                  key={member.userId}
                  style={[
                    styles.memberRow,
                    {
                      backgroundColor: softInputBackground,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.memberBadge,
                      {
                        backgroundColor: member.role === 'owner' ? colors.primarySoft : softInputBackground,
                      },
                    ]}
                  >
                    <Ionicons
                      name={member.role === 'owner' ? 'star-outline' : 'person-outline'}
                      size={16}
                      color={member.role === 'owner' ? colors.primary : colors.secondaryText}
                    />
                  </View>
                  <View style={styles.memberCopy}>
                    <Text style={[styles.memberName, { color: colors.text }]}>
                      {member.displayNameSnapshot ?? t('rooms.unknownAuthor', 'Someone')}
                    </Text>
                    <Text style={[styles.memberMeta, { color: colors.secondaryText }]}>
                      {member.role === 'owner' ? t('rooms.ownerLabel', 'Owner') : t('rooms.memberLabel', 'Member')}
                    </Text>
                  </View>
                  {isOwner && member.role !== 'owner' ? (
                    <Pressable
                      onPress={() => handleRemoveMember(member.userId)}
                      style={({ pressed }) => [
                        styles.memberRemove,
                        {
                          backgroundColor: isDark ? 'rgba(255,69,58,0.16)' : 'rgba(255,59,48,0.1)',
                          opacity: pressed ? 0.92 : 1,
                          transform: [{ scale: pressed ? 0.97 : 1 }],
                        },
                      ]}
                    >
                      <Ionicons name="person-remove-outline" size={16} color={colors.danger} />
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        </SectionShell>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screen: {
    flex: 1,
  },
  headerWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 20,
  },
  headerPanel: {
    overflow: 'hidden',
    borderRadius: 30,
    borderWidth: 1,
    ...Shadows.floating,
  },
  headerContent: {
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  headerEyebrow: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  headerTitle: {
    marginTop: 6,
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  headerBody: {
    ...Typography.body,
    marginTop: 8,
  },
  sectionRow: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  settingsCard: {
    borderRadius: 30,
    borderWidth: 1,
    padding: 18,
    ...Shadows.card,
  },
  sectionTitle: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    minHeight: 56,
    borderRadius: 18,
    paddingHorizontal: 14,
    fontSize: 16,
    marginTop: 12,
  },
  softAction: {
    minHeight: 50,
    marginTop: 12,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  softActionText: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '700',
  },
  bodyText: {
    ...Typography.body,
    marginTop: 12,
  },
  actionStack: {
    gap: 10,
    marginTop: 14,
  },
  primaryAction: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  primaryActionText: {
    color: '#1C1C1E',
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '800',
  },
  destructiveAction: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  destructiveActionText: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '700',
  },
  memberList: {
    gap: 10,
    marginTop: 14,
  },
  memberRow: {
    borderRadius: 22,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  memberBadge: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberCopy: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
  },
  memberMeta: {
    ...Typography.pill,
    marginTop: 4,
  },
  memberRemove: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
