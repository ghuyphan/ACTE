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
import PrimaryButton from '../../../components/ui/PrimaryButton';
import { Layout, Typography } from '../../../constants/theme';
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
    void roomsStore.getRoomDetails(id, true)
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
      const message = getRoomErrorMessage(error);
      Alert.alert(t('rooms.renameFailedTitle', 'Could not rename room'), message);
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
      await Share.share({
        message: invite.url,
      });
      await refresh();
    } catch (error) {
      const message = getRoomErrorMessage(error);
      Alert.alert(t('rooms.inviteFailedTitle', 'Could not prepare invite'), message);
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
      const message = getRoomErrorMessage(error);
      Alert.alert(t('rooms.inviteFailedTitle', 'Could not prepare invite'), message);
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
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const isOwner = details.room.currentUserRole === 'owner';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
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
            backgroundColor: colors.card,
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

      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t('rooms.inviteSectionTitle', 'Invite link')}
        </Text>
        <Text style={[styles.sectionBody, { color: colors.secondaryText }]}>
          {details.activeInvite?.url ?? t('rooms.noInviteYet', 'No active invite link yet.')}
        </Text>
        {isOwner ? (
          <View style={styles.actionRow}>
            <PrimaryButton
              label={details.activeInvite ? t('rooms.shareInviteButton', 'Share invite') : t('rooms.createInviteButton', 'Create invite')}
              onPress={() => {
                void handleCreateOrShareInvite();
              }}
              style={styles.rowButton}
            />
            {details.activeInvite ? (
              <PrimaryButton
                label={t('rooms.revokeInviteButton', 'Revoke')}
                onPress={() => {
                  void handleRevokeInvite();
                }}
                variant="secondary"
                style={styles.rowButton}
              />
            ) : null}
          </View>
        ) : null}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 20 }]}>
        {t('rooms.membersTitle', 'Members')}
      </Text>
      <View style={styles.membersList}>
        {details.members.map((member) => (
          <View
            key={member.userId}
            style={[styles.memberRow, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={styles.memberCopy}>
              <Text style={[styles.memberName, { color: colors.text }]}>
                {member.displayNameSnapshot ?? t('rooms.unknownAuthor', 'Someone')}
              </Text>
              <Text style={[styles.memberMeta, { color: colors.secondaryText }]}>
                {member.role === 'owner' ? t('rooms.ownerLabel', 'Owner') : t('rooms.memberLabel', 'Member')}
              </Text>
            </View>
            {isOwner && member.role !== 'owner' ? (
              <Pressable onPress={() => handleRemoveMember(member.userId)}>
                <Ionicons name="person-remove-outline" size={20} color={colors.danger} />
              </Pressable>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Layout.screenPadding,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  sectionBody: {
    ...Typography.body,
  },
  input: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  sectionCard: {
    marginTop: 18,
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  rowButton: {
    flex: 1,
  },
  membersList: {
    gap: 12,
  },
  memberRow: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
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
    marginTop: 4,
    fontSize: 13,
  },
});
