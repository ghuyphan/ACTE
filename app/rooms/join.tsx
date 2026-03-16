import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import PrimaryButton from '../../components/ui/PrimaryButton';
import { Layout, Typography } from '../../constants/theme';
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
      const message = getRoomErrorMessage(error);
      Alert.alert(t('rooms.joinFailedTitle', 'Could not join room'), message);
    } finally {
      setJoining(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>
        {t('rooms.joinPrompt', 'Join an invite-only room')}
      </Text>
      <Text style={[styles.body, { color: colors.secondaryText }]}>
        {t('rooms.joinBody', 'Paste the invite link someone shared with you.')}
      </Text>
      <TextInput
        value={inviteValue}
        onChangeText={setInviteValue}
        placeholder={t('rooms.joinPlaceholder', 'https://... or invite token')}
        placeholderTextColor={colors.secondaryText}
        style={[
          styles.input,
          styles.multilineInput,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            color: colors.text,
          },
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
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Layout.screenPadding,
  },
  title: {
    ...Typography.screenTitle,
    marginTop: 12,
  },
  body: {
    ...Typography.body,
    marginTop: 8,
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  multilineInput: {
    minHeight: 132,
    textAlignVertical: 'top',
  },
});
