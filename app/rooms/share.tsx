import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import PrimaryButton from '../../components/ui/PrimaryButton';
import { Layout, Typography } from '../../constants/theme';
import { useNotesStore } from '../../hooks/useNotes';
import { useRoomsStore } from '../../hooks/useRooms';
import { useTheme } from '../../hooks/useTheme';
import { Note } from '../../services/database';
import { getRoomErrorMessage } from '../../services/roomService';

export default function ShareToRoomScreen() {
  const { noteId } = useLocalSearchParams<{ noteId?: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { rooms, roomsReady, shareNoteToRoom } = useRoomsStore();
  const { getNoteById } = useNotesStore();
  const [note, setNote] = useState<Note | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (typeof noteId !== 'string') {
      return;
    }

    void getNoteById(noteId).then((nextNote) => {
      setNote(nextNote);
    });
  }, [getNoteById, noteId]);

  const handleShare = async () => {
    if (!selectedRoomId || !note) {
      return;
    }

    setSharing(true);
    try {
      await shareNoteToRoom(selectedRoomId, note);
      router.replace(`/rooms/${selectedRoomId}` as any);
    } catch (error) {
      const message = getRoomErrorMessage(error);
      Alert.alert(t('rooms.shareFailedTitle', 'Could not share note'), message);
    } finally {
      setSharing(false);
    }
  };

  if (!roomsReady || !note) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>
        {t('rooms.sharePrompt', 'Choose a room for this memory')}
      </Text>
      <Text style={[styles.body, { color: colors.secondaryText }]}>
        {note.type === 'text'
          ? note.content
          : t('rooms.sharePhotoLabel', 'Photo memory')}
      </Text>

      {rooms.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>
            {t('rooms.shareEmptyRooms', 'Create a room first, then come back to share this note.')}
          </Text>
          <PrimaryButton
            label={t('rooms.createButton', 'Create room')}
            onPress={() => router.push('/rooms/create')}
          />
        </View>
      ) : (
        <>
          <View style={styles.roomList}>
            {rooms.map((room) => {
              const isSelected = selectedRoomId === room.id;
              return (
                <Pressable
                  key={room.id}
                  onPress={() => setSelectedRoomId(room.id)}
                  style={[
                    styles.roomOption,
                    {
                      backgroundColor: colors.card,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.roomOptionTitle, { color: colors.text }]}>{room.name}</Text>
                  <Text style={[styles.roomOptionMeta, { color: colors.secondaryText }]}>
                    {t('rooms.memberCount', '{{count}} members', { count: room.memberCount })}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <PrimaryButton
            label={t('rooms.shareConfirm', 'Share to room')}
            onPress={() => {
              void handleShare();
            }}
            disabled={!selectedRoomId}
            loading={sharing}
          />
        </>
      )}
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
  title: {
    ...Typography.screenTitle,
    marginTop: 12,
  },
  body: {
    ...Typography.body,
    marginTop: 8,
    marginBottom: 20,
  },
  roomList: {
    gap: 12,
    marginBottom: 16,
  },
  roomOption: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
  },
  roomOptionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  roomOptionMeta: {
    marginTop: 6,
    fontSize: 13,
  },
  emptyWrap: {
    gap: 16,
  },
  emptyBody: {
    ...Typography.body,
  },
});
