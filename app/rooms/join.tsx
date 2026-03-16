import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, TextInput } from 'react-native';
import {
  RoomCard,
  RoomHeader,
  RoomScreen,
  RoomSection,
} from '../../components/rooms/RoomScaffold';
import PrimaryButton from '../../components/ui/PrimaryButton';
import { useRoomsStore } from '../../hooks/useRooms';
import { useTheme } from '../../hooks/useTheme';
import { getRoomErrorMessage } from '../../services/roomService';

export default function JoinRoomScreen() {
  const { invite } = useLocalSearchParams<{ invite?: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { joinRoomByInvite } = useRoomsStore();
  const router = useRouter();
  const [inviteValue, setInviteValue] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (typeof invite === 'string' && invite.trim()) {
      setInviteValue(invite);
    }
  }, [invite]);

  const handleJoin = async () => {
    if (!inviteValue.trim()) {
      Alert.alert(t('rooms.joinErrorTitle', 'Invite needed'), t('rooms.joinErrorBody', 'Paste an invite link or token to join this room.'));
      return;
    }

    setJoining(true);
    try {
      const room = await joinRoomByInvite(inviteValue);
      router.replace(`/rooms/${room.id}` as any);
    } catch (error) {
      Alert.alert(t('rooms.joinFailedTitle', 'Could not join room'), getRoomErrorMessage(error));
    } finally {
      setJoining(false);
    }
  };

  return (
    <RoomScreen scroll contentContainerStyle={styles.content}>
      <RoomHeader
        title={t('rooms.joinTitle', 'Join Room')}
        subtitle={t('rooms.joinBody', 'Paste the invite link someone shared with you.')}
      />
      <RoomSection title={t('rooms.joinButton', 'Join invite')}>
        <RoomCard>
          <TextInput
            value={inviteValue}
            onChangeText={setInviteValue}
            placeholder={t('rooms.joinPlaceholder', 'Paste the full invite link')}
            placeholderTextColor={colors.secondaryText}
            style={[
              styles.input,
              styles.multilineInput,
              { backgroundColor: colors.background, borderColor: colors.border, color: colors.text },
            ]}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
          />
          <PrimaryButton
            label={t('rooms.joinButton', 'Join invite')}
            onPress={() => {
              void handleJoin();
            }}
            loading={joining}
            leadingIcon={<Ionicons name="enter-outline" size={18} color="#1C1C1E" />}
          />
        </RoomCard>
      </RoomSection>
    </RoomScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 18,
  },
  input: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 14,
  },
  multilineInput: {
    minHeight: 132,
    textAlignVertical: 'top',
  },
});
