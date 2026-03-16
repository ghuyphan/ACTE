import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
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
      Alert.alert(t('rooms.createFailedTitle', 'Could not create room'), getRoomErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <RoomScreen scroll contentContainerStyle={styles.content}>
      <RoomHeader
        title={t('rooms.createTitle', 'Create Room')}
        subtitle={t('rooms.createBody', 'Rooms are invite-only and keep your shared memories separate from your personal notes.')}
      />
      <RoomSection title={t('rooms.roomNameLabel', 'Room name')}>
        <RoomCard>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t('rooms.roomNamePlaceholder', 'Weekend getaway')}
            placeholderTextColor={colors.secondaryText}
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            autoFocus
            maxLength={60}
          />
          <PrimaryButton
            label={t('rooms.createButton', 'Create room')}
            onPress={() => {
              void handleCreate();
            }}
            loading={saving}
            leadingIcon={<Ionicons name="add-circle-outline" size={18} color="#1C1C1E" />}
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
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    fontSize: 16,
    marginBottom: 14,
  },
});
