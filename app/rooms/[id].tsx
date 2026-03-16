import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
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
} from '../../components/rooms/RoomScaffold';
import PrimaryButton from '../../components/ui/PrimaryButton';
import { Radii, Typography } from '../../constants/theme';
import { useRoomsStore } from '../../hooks/useRooms';
import { useTheme } from '../../hooks/useTheme';
import { RoomPost } from '../../services/roomCache';
import { getRoomErrorMessage, RoomDetails } from '../../services/roomService';

export default function RoomDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { getRoomDetails } = useRoomsStore();
  const [details, setDetails] = useState<RoomDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [draftPlace, setDraftPlace] = useState('');
  const [draftPhotoUri, setDraftPhotoUri] = useState<string | null>(null);
  const roomsStore = useRoomsStore();

  useEffect(() => {
    if (typeof id !== 'string') {
      return;
    }

    setLoading(true);
    void getRoomDetails(id)
      .then((nextDetails) => {
        setDetails(nextDetails);
      })
      .catch((error) => {
        Alert.alert(t('rooms.loadFailedTitle', 'Could not open room'), getRoomErrorMessage(error));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [getRoomDetails, id, t]);

  const handlePickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert(
        t('rooms.photoPermissionTitle', 'Photo access needed'),
        t('rooms.photoPermissionBody', 'Allow photo access to post a room memory.')
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.length) {
      setDraftPhotoUri(result.assets[0]?.uri ?? null);
    }
  };

  const handlePost = async () => {
    if (typeof id !== 'string') {
      return;
    }

    setPosting(true);
    try {
      await roomsStore.createRoomPost(id, {
        text: draftText,
        placeName: draftPlace.trim() || null,
        photoLocalUri: draftPhotoUri,
      });
      const refreshed = await getRoomDetails(id, true);
      setDetails(refreshed);
      setDraftText('');
      setDraftPlace('');
      setDraftPhotoUri(null);
    } catch (error) {
      Alert.alert(t('rooms.postFailedTitle', 'Could not post to room'), getRoomErrorMessage(error));
    } finally {
      setPosting(false);
    }
  };

  if (loading || !details) {
    return (
      <RoomScreen contentContainerStyle={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </RoomScreen>
    );
  }

  return (
    <RoomScreen scroll contentContainerStyle={styles.content}>
      <RoomHeader
        title={details.room.name}
        subtitle={t('rooms.memberCount', '{{count}} members', { count: details.room.memberCount })}
        trailing={
          <Pressable
            onPress={() => router.push(`/rooms/${details.room.id}/settings` as any)}
            style={[styles.iconButton, { borderColor: colors.border, backgroundColor: colors.card }]}
          >
            <Ionicons name="settings-outline" size={18} color={colors.primary} />
          </Pressable>
        }
      />

      <RoomSection title={t('rooms.composeTitle', 'Post to room')}>
        <RoomCard>
          <TextInput
            value={draftText}
            onChangeText={setDraftText}
            placeholder={t('rooms.composePlaceholder', 'Write a shared memory...')}
            placeholderTextColor={colors.secondaryText}
            multiline
            style={[
              styles.input,
              styles.textArea,
              { backgroundColor: colors.background, borderColor: colors.border, color: colors.text },
            ]}
          />
          <TextInput
            value={draftPlace}
            onChangeText={setDraftPlace}
            placeholder={t('rooms.composePlacePlaceholder', 'Place name (optional)')}
            placeholderTextColor={colors.secondaryText}
            style={[
              styles.input,
              { backgroundColor: colors.background, borderColor: colors.border, color: colors.text },
            ]}
          />
          {draftPhotoUri ? (
            <View style={[styles.previewWrap, { borderColor: colors.border }]}>
              <Image source={{ uri: draftPhotoUri }} style={styles.previewImage} contentFit="cover" />
              <Pressable onPress={() => setDraftPhotoUri(null)} style={styles.previewRemove}>
                <Ionicons name="close-circle" size={24} color="#FFFFFF" />
              </Pressable>
            </View>
          ) : null}
          <View style={styles.actionsRow}>
            <PrimaryButton
              label={draftPhotoUri ? t('rooms.replacePhoto', 'Replace photo') : t('rooms.addPhoto', 'Add photo')}
              onPress={() => {
                void handlePickPhoto();
              }}
              variant="secondary"
              style={styles.actionButton}
            />
            <PrimaryButton
              label={t('rooms.postButton', 'Post')}
              onPress={() => {
                void handlePost();
              }}
              loading={posting}
              style={styles.actionButton}
            />
          </View>
        </RoomCard>
      </RoomSection>

      <RoomSection title={t('rooms.timelineTitle', 'Timeline')}>
        <View style={styles.timeline}>
          {details.posts.length === 0 ? (
            <RoomCard>
              <Text style={[styles.emptyText, { color: colors.secondaryText }]}>
                {t('rooms.noPostsYet', 'No shared memories yet. Start the room with your first post.')}
              </Text>
            </RoomCard>
          ) : (
            details.posts.map((post) => <RoomPostCard key={post.id} post={post} />)
          )}
        </View>
      </RoomSection>
    </RoomScreen>
  );
}

function RoomPostCard({ post }: { post: RoomPost }) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <RoomCard style={styles.postCard}>
      <View style={styles.postHeader}>
        <View style={styles.postHeaderCopy}>
          <Text style={[styles.postAuthor, { color: colors.text }]}>
            {post.authorDisplayName ?? t('rooms.unknownAuthor', 'Someone')}
          </Text>
          {post.placeName ? (
            <Text style={[styles.postPlace, { color: colors.secondaryText }]}>{post.placeName}</Text>
          ) : null}
        </View>
        <Text style={[styles.postTime, { color: colors.secondaryText }]}>
          {new Date(post.createdAt).toLocaleDateString()}
        </Text>
      </View>
      {post.type === 'photo' && post.photoLocalUri ? (
        <Image source={{ uri: post.photoLocalUri }} style={styles.postImage} contentFit="cover" />
      ) : null}
      <Text style={[styles.postText, { color: colors.text }]}>
        {post.text || t('rooms.sharePhotoLabel', 'Photo memory')}
      </Text>
    </RoomCard>
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
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: {
    minHeight: 104,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  previewWrap: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: Radii.card,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 200,
  },
  previewRemove: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
  },
  timeline: {
    gap: 12,
  },
  emptyText: {
    ...Typography.body,
  },
  postCard: {
    padding: 14,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  postHeaderCopy: {
    flex: 1,
  },
  postAuthor: {
    fontSize: 15,
    fontWeight: '700',
  },
  postPlace: {
    ...Typography.pill,
    marginTop: 4,
  },
  postTime: {
    ...Typography.pill,
  },
  postImage: {
    width: '100%',
    height: 220,
    borderRadius: 18,
    marginTop: 12,
  },
  postText: {
    ...Typography.body,
    marginTop: 12,
  },
});
