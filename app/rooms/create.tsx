import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import PrimaryButton from '../../components/ui/PrimaryButton';
import { Layout, Typography } from '../../constants/theme';
import { useRoomsStore } from '../../hooks/useRooms';
import { useTheme } from '../../hooks/useTheme';
import { getRoomErrorMessage } from '../../services/roomService';

export default function CreateRoomScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { createRoom } = useRoomsStore();
  const router = useRouter();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert(t('rooms.createErrorTitle', 'Room name needed'), t('rooms.createErrorBody', 'Give this room a name before creating it.'));
      return;
    }

    setSaving(true);
    try {
      const room = await createRoom(name);
      router.replace(`/rooms/${room.id}` as any);
    } catch (error) {
      const message = getRoomErrorMessage(error);
      Alert.alert(t('rooms.createFailedTitle', 'Could not create room'), message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>
        {t('rooms.createPrompt', 'Start a private room for your people.')}
      </Text>
      <Text style={[styles.body, { color: colors.secondaryText }]}>
        {t('rooms.createBody', 'Rooms are invite-only and keep your shared memories separate from your personal notes.')}
      </Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={t('rooms.roomNamePlaceholder', 'Weekend getaway')}
        placeholderTextColor={colors.secondaryText}
        style={[
          styles.input,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            color: colors.text,
          },
        ]}
        autoFocus
        maxLength={60}
      />
      <PrimaryButton
        label={t('rooms.createButton', 'Create room')}
        onPress={() => {
          void handleCreate();
        }}
        loading={saving}
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
    minHeight: 56,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 16,
  },
});
