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
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import PrimaryButton from '../../components/ui/PrimaryButton';
import { Layout, Typography } from '../../constants/theme';
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
        const message = getRoomErrorMessage(error);
        Alert.alert(t('rooms.loadFailedTitle', 'Could not open room'), message);
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

    if (result.canceled || !result.assets?.length) {
      return;
    }

    setDraftPhotoUri(result.assets[0]?.uri ?? null);
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
      const message = getRoomErrorMessage(error);
      Alert.alert(t('rooms.postFailedTitle', 'Could not post to room'), message);
    } finally {
      setPosting(false);
    }
  };

  if (loading || !details) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: colors.text }]}>{details.room.name}</Text>
          <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
            {t('rooms.memberCount', '{{count}} members', { count: details.room.memberCount })}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push(`/rooms/${details.room.id}/settings` as any)}
          style={[styles.headerButton, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Ionicons name="settings-outline" size={18} color={colors.primary} />
        </Pressable>
      </View>

      <View style={[styles.composeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t('rooms.composeTitle', 'Post to room')}
        </Text>
        <TextInput
          value={draftText}
          onChangeText={setDraftText}
          placeholder={t('rooms.composePlaceholder', 'Write a shared memory...')}
          placeholderTextColor={colors.secondaryText}
          multiline
          style={[
            styles.composeInput,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              color: colors.text,
            },
          ]}
        />
        <TextInput
          value={draftPlace}
          onChangeText={setDraftPlace}
          placeholder={t('rooms.composePlacePlaceholder', 'Place name (optional)')}
          placeholderTextColor={colors.secondaryText}
          style={[
            styles.placeInput,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              color: colors.text,
            },
          ]}
        />
        {draftPhotoUri ? (
          <View style={styles.previewWrap}>
            <Image source={{ uri: draftPhotoUri }} style={styles.previewImage} contentFit="cover" />
            <Pressable onPress={() => setDraftPhotoUri(null)} style={styles.previewRemove}>
              <Ionicons name="close-circle" size={24} color="#FFFFFF" />
            </Pressable>
          </View>
        ) : null}
        <View style={styles.composeActions}>
          <PrimaryButton
            label={draftPhotoUri ? t('rooms.replacePhoto', 'Replace photo') : t('rooms.addPhoto', 'Add photo')}
            onPress={() => {
              void handlePickPhoto();
            }}
            variant="secondary"
            style={styles.composeActionButton}
          />
          <PrimaryButton
            label={t('rooms.postButton', 'Post')}
            onPress={() => {
              void handlePost();
            }}
            loading={posting}
            style={styles.composeActionButton}
          />
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 18 }]}>
        {t('rooms.timelineTitle', 'Timeline')}
      </Text>
      <View style={styles.timeline}>
        {details.posts.map((post) => (
          <RoomPostCard key={post.id} post={post} />
        ))}
        {details.posts.length === 0 ? (
          <View style={[styles.emptyTimeline, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={[styles.emptyTimelineText, { color: colors.secondaryText }]}>
              {t('rooms.noPostsYet', 'No shared memories yet. Start the room with your first post.')}
            </Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function RoomPostCard({ post }: { post: RoomPost }) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={[styles.postCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.postHeader}>
        <Text style={[styles.postAuthor, { color: colors.text }]}>
          {post.authorDisplayName ?? t('rooms.unknownAuthor', 'Someone')}
        </Text>
        {post.placeName ? (
          <Text style={[styles.postPlace, { color: colors.secondaryText }]}>{post.placeName}</Text>
        ) : null}
      </View>
      {post.type === 'photo' && post.photoLocalUri ? (
        <Image source={{ uri: post.photoLocalUri }} style={styles.postImage} contentFit="cover" />
      ) : null}
      {post.text ? (
        <Text style={[styles.postText, { color: colors.text }]}>{post.text}</Text>
      ) : (
        <Text style={[styles.postPhotoLabel, { color: colors.secondaryText }]}>
          {t('rooms.sharePhotoLabel', 'Photo memory')}
        </Text>
      )}
      <Text style={[styles.postMeta, { color: colors.secondaryText }]}>
        {new Date(post.createdAt).toLocaleString()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Layout.screenPadding,
    paddingBottom: 36,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  headerCopy: {
    flex: 1,
    paddingRight: 12,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  title: {
    ...Typography.screenTitle,
  },
  subtitle: {
    ...Typography.body,
    marginTop: 4,
  },
  composeCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    marginTop: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  composeInput: {
    minHeight: 104,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  placeInput: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    marginTop: 12,
    fontSize: 16,
  },
  previewWrap: {
    marginTop: 12,
    borderRadius: 20,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 220,
  },
  previewRemove: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  composeActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  composeActionButton: {
    flex: 1,
  },
  timeline: {
    gap: 12,
  },
  postCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  postAuthor: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  postPlace: {
    fontSize: 12,
    fontWeight: '600',
  },
  postImage: {
    width: '100%',
    height: 220,
    borderRadius: 18,
    marginBottom: 12,
  },
  postText: {
    ...Typography.body,
  },
  postPhotoLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  postMeta: {
    marginTop: 10,
    fontSize: 12,
  },
  emptyTimeline: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
  },
  emptyTimelineText: {
    ...Typography.body,
    textAlign: 'center',
  },
});
