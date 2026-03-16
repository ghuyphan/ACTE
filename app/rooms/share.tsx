import { Ionicons } from '@expo/vector-icons';
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
import {
  RoomCard,
  RoomHeader,
  RoomScreen,
  RoomSection,
} from '../../components/rooms/RoomScaffold';
import PrimaryButton from '../../components/ui/PrimaryButton';
import { Typography } from '../../constants/theme';
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
      Alert.alert(t('rooms.shareFailedTitle', 'Could not share note'), getRoomErrorMessage(error));
    } finally {
      setSharing(false);
    }
  };

  if (!roomsReady || !note) {
    return (
      <RoomScreen contentContainerStyle={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </RoomScreen>
    );
  }

  return (
    <RoomScreen scroll contentContainerStyle={styles.content}>
      <RoomHeader
        title={t('rooms.shareTitle', 'Share to Room')}
        subtitle={t('rooms.sharePrompt', 'Choose a room for this memory')}
      />

      <RoomSection title={t('rooms.shareTitle', 'Share to Room')}>
        <RoomCard>
          <Text style={[styles.notePreview, { color: colors.text }]}>
            {note.type === 'text' ? note.content : t('rooms.sharePhotoLabel', 'Photo memory')}
          </Text>
        </RoomCard>
      </RoomSection>

      {rooms.length === 0 ? (
        <RoomSection title={t('rooms.emptyTitle', 'No rooms yet')}>
          <RoomCard>
            <Text style={[styles.emptyText, { color: colors.secondaryText }]}>
              {t('rooms.shareEmptyRooms', 'Create a room first, then come back to share this note.')}
            </Text>
            <PrimaryButton
              label={t('rooms.createButton', 'Create room')}
              onPress={() => router.push('/rooms/create')}
              style={styles.topButton}
            />
          </RoomCard>
        </RoomSection>
      ) : (
        <RoomSection title={t('rooms.shareSelectionTitle', 'Choose a room')}>
          <View style={styles.roomList}>
            {rooms.map((room) => {
              const isSelected = selectedRoomId === room.id;
              return (
                <Pressable key={room.id} onPress={() => setSelectedRoomId(room.id)}>
                  <RoomCard>
                    <View style={styles.optionRow}>
                      <View
                        style={[
                          styles.selectionDot,
                          { borderColor: isSelected ? colors.primary : colors.border },
                        ]}
                      >
                        {isSelected ? (
                          <View style={[styles.selectionDotInner, { backgroundColor: colors.primary }]} />
                        ) : null}
                      </View>
                      <View style={styles.optionCopy}>
                        <Text style={[styles.optionTitle, { color: colors.text }]}>{room.name}</Text>
                        <Text style={[styles.optionMeta, { color: colors.secondaryText }]}>
                          {t('rooms.memberCount', '{{count}} members', { count: room.memberCount })}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.secondaryText} />
                    </View>
                  </RoomCard>
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
        </RoomSection>
      )}
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
  notePreview: {
    ...Typography.body,
  },
  emptyText: {
    ...Typography.body,
  },
  topButton: {
    marginTop: 14,
  },
  roomList: {
    gap: 12,
    marginBottom: 16,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectionDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  selectionDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  optionCopy: {
    flex: 1,
    paddingRight: 12,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  optionMeta: {
    ...Typography.pill,
    marginTop: 4,
  },
});
