import { Ionicons } from '@expo/vector-icons';
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
import {
  RoomCard,
  RoomHeader,
  RoomScreen,
  RoomSection,
} from '../../../components/rooms/RoomScaffold';
import PrimaryButton from '../../../components/ui/PrimaryButton';
import { Typography } from '../../../constants/theme';
import { useRoomsStore } from '../../../hooks/useRooms';
import { useTheme } from '../../../hooks/useTheme';
import { getRoomErrorMessage, RoomDetails } from '../../../services/roomService';

export default function RoomSettingsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const roomsStore = useRoomsStore();
  const [details, setDetails] = useState<RoomDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [renaming, setRenaming] = useState('');

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
    try {
      await roomsStore.renameRoom(id, renaming);
      await refresh();
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
            void roomsStore.removeMember(id, memberUserId).then(() => refresh());
          },
        },
      ]
    );
  };

  if (loading || !details) {
    return (
      <RoomScreen contentContainerStyle={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </RoomScreen>
    );
  }

  const isOwner = details.room.currentUserRole === 'owner';

  return (
    <RoomScreen scroll contentContainerStyle={styles.content}>
      <RoomHeader
        title={t('rooms.settingsTitle', 'Room Settings')}
        subtitle={details.room.name}
      />

      <RoomSection title={t('rooms.roomNameLabel', 'Room name')}>
        <RoomCard>
          <TextInput
            value={renaming}
            onChangeText={setRenaming}
            editable={isOwner}
            placeholder={t('rooms.roomNamePlaceholder', 'Weekend getaway')}
            placeholderTextColor={colors.secondaryText}
            style={[
              styles.input,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.text,
                opacity: isOwner ? 1 : 0.7,
              },
            ]}
          />
          {isOwner ? (
            <PrimaryButton
              label={t('rooms.saveNameButton', 'Save room name')}
              onPress={() => {
                void handleRename();
              }}
              loading={savingName}
            />
          ) : null}
        </RoomCard>
      </RoomSection>

      <RoomSection title={t('rooms.inviteSectionTitle', 'Invite link')}>
        <RoomCard>
          <Text style={[styles.bodyText, { color: colors.secondaryText }]}>
            {details.activeInvite?.url ?? t('rooms.noInviteYet', 'No active invite link yet.')}
          </Text>
          {isOwner ? (
            <View style={styles.actionsRow}>
              <PrimaryButton
                label={
                  details.activeInvite
                    ? t('rooms.shareInviteButton', 'Share invite')
                    : t('rooms.createInviteButton', 'Create invite')
                }
                onPress={() => {
                  void handleCreateOrShareInvite();
                }}
                style={styles.actionButton}
              />
              {details.activeInvite ? (
                <PrimaryButton
                  label={t('rooms.revokeInviteButton', 'Revoke')}
                  onPress={() => {
                    void handleRevokeInvite();
                  }}
                  variant="secondary"
                  style={styles.actionButton}
                />
              ) : null}
            </View>
          ) : null}
        </RoomCard>
      </RoomSection>

      <RoomSection title={t('rooms.membersTitle', 'Members')}>
        <View style={styles.membersList}>
          {details.members.map((member) => (
            <RoomCard key={member.userId}>
              <View style={styles.memberRow}>
                <View style={styles.memberCopy}>
                  <Text style={[styles.memberName, { color: colors.text }]}>
                    {member.displayNameSnapshot ?? t('rooms.unknownAuthor', 'Someone')}
                  </Text>
                  <Text style={[styles.memberMeta, { color: colors.secondaryText }]}>
                    {member.role === 'owner' ? t('rooms.ownerLabel', 'Owner') : t('rooms.memberLabel', 'Member')}
                  </Text>
                </View>
                {isOwner && member.role !== 'owner' ? (
                  <Pressable onPress={() => handleRemoveMember(member.userId)} style={styles.removeButton}>
                    <Ionicons name="person-remove-outline" size={18} color={colors.danger} />
                  </Pressable>
                ) : null}
              </View>
            </RoomCard>
          ))}
        </View>
      </RoomSection>
    </RoomScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 18,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  bodyText: {
    ...Typography.body,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  actionButton: {
    flex: 1,
  },
  membersList: {
    gap: 12,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberCopy: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '700',
  },
  memberMeta: {
    ...Typography.pill,
    marginTop: 4,
  },
  removeButton: {
    padding: 6,
  },
});
