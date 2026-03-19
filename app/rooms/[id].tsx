import { Ionicons } from '@expo/vector-icons';
import { GlassView } from '../../components/ui/GlassView';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  LinearTransition,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Layout, Radii, Shadows, Typography } from '../../constants/theme';
import { useRoomsStore } from '../../hooks/useRooms';
import { useTheme } from '../../hooks/useTheme';
import { RoomPost } from '../../services/roomCache';
import { getRoomErrorMessage, RoomDetails } from '../../services/roomService';
import { isOlderIOS } from '../../utils/platform';

function RoomPostCard({ post, index }: { post: RoomPost; index: number }) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();

  return (
    <Animated.View entering={FadeInUp.delay(index * 70).springify().damping(18).mass(0.8)}>
      <View style={styles.timelineRow}>
        <View
          style={[
            styles.postCard,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.72)',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.88)',
            },
          ]}
        >
          <View style={styles.postHeader}>
            <View style={styles.postHeaderCopy}>
              <Text style={[styles.postAuthor, { color: colors.text }]}>
                {post.authorDisplayName ?? t('rooms.unknownAuthor', 'Someone')}
              </Text>
              <View style={styles.postMetaRow}>
                {post.placeName ? (
                  <View
                    style={[
                      styles.postMetaChip,
                      {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                      },
                    ]}
                  >
                    <Ionicons name="location-outline" size={13} color={colors.primary} />
                    <Text style={[styles.postMetaText, { color: colors.text }]}>{post.placeName}</Text>
                  </View>
                ) : null}
                <View
                  style={[
                    styles.postMetaChip,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                    },
                  ]}
                >
                  <Ionicons name="time-outline" size={13} color={colors.primary} />
                  <Text style={[styles.postMetaText, { color: colors.text }]}>
                    {new Date(post.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            </View>
            <View
              style={[
                styles.postTypeBadge,
                {
                  backgroundColor: post.type === 'photo' ? colors.primarySoft : 'rgba(82,133,255,0.14)',
                },
              ]}
            >
              <Ionicons
                name={post.type === 'photo' ? 'image-outline' : 'chatbubble-ellipses-outline'}
                size={14}
                color={post.type === 'photo' ? colors.primary : '#5285FF'}
              />
            </View>
          </View>

          {post.type === 'photo' && post.photoLocalUri ? (
            <Image
              source={{ uri: post.photoLocalUri }}
              style={styles.postImage}
              contentFit="cover"
              transition={200}
            />
          ) : null}

          <Text style={[styles.postText, { color: colors.text }]}>
            {post.text || t('rooms.sharePhotoLabel', 'Photo memory')}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

export default function RoomDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getRoomDetails } = useRoomsStore();
  const [details, setDetails] = useState<RoomDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [draftPlace, setDraftPlace] = useState('');
  const [draftPhotoUri, setDraftPhotoUri] = useState<string | null>(null);
  const [composerExpanded, setComposerExpanded] = useState(false);
  const roomsStore = useRoomsStore();
  const draftInputRef = useRef<TextInput>(null);

  const glassOverlay = isDark ? 'rgba(18,18,24,0.64)' : 'rgba(255,255,255,0.74)';
  const glassFallback = isDark ? 'rgba(18,18,24,0.92)' : 'rgba(255,255,255,0.94)';
  const softInputBackground = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';

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

  const refreshDetails = async (forceRefresh = false) => {
    if (typeof id !== 'string') {
      return;
    }

    const refreshed = await getRoomDetails(id, forceRefresh);
    setDetails(refreshed);
  };

  const handlePickPhoto = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

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
      setComposerExpanded(true);
      setDraftPhotoUri(result.assets[0]?.uri ?? null);
    }
  };

  const handlePost = async () => {
    if (typeof id !== 'string') {
      return;
    }

    setPosting(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await roomsStore.createRoomPost(id, {
        text: draftText,
        placeName: draftPlace.trim() || null,
        photoLocalUri: draftPhotoUri,
      });
      await refreshDetails(true);
      setDraftText('');
      setDraftPlace('');
      setDraftPhotoUri(null);
      setComposerExpanded(false);
      Keyboard.dismiss();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert(t('rooms.postFailedTitle', 'Could not post to room'), getRoomErrorMessage(error));
    } finally {
      setPosting(false);
    }
  };

  const handleOpenSettings = () => {
    if (!details) {
      return;
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/rooms/${details.room.id}/settings` as any);
  };

  const handleExpandComposer = () => {
    setComposerExpanded(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    requestAnimationFrame(() => {
      draftInputRef.current?.focus();
    });
  };

  const handleCollapseComposer = () => {
    setComposerExpanded(false);
    Keyboard.dismiss();
  };

  const canPost = Boolean(draftText.trim() || draftPhotoUri);

  if (loading || !details) {
    return (
      <View style={[styles.screen, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const composerBottomOffset = insets.bottom + 12;
  const contentTopPadding = 132;
  const contentBottomPadding = insets.bottom + (composerExpanded ? 360 : 154);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList
        data={details.posts}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: contentTopPadding,
          paddingBottom: contentBottomPadding,
        }}
        ListHeaderComponent={
          <View style={styles.timelineIntro}>
            <Text style={[styles.timelineEyebrow, { color: colors.primary }]}>
              {t('rooms.timelineTitle', 'Timeline')}
            </Text>
            <Text style={[styles.timelineTitle, { color: colors.text }]}>
              {details.posts.length === 0
                ? t('rooms.emptyTimelineTitle', 'Your room is ready for its first memory')
                : t('rooms.timelineReadyTitle', 'Shared memories live here')}
            </Text>
            <Text style={[styles.timelineBody, { color: colors.secondaryText }]}>
              {details.posts.length === 0
                ? t('rooms.noPostsYet', 'No shared memories yet. Start the room with your first post.')
                : t('rooms.timelineBody', 'Everything shared in this room flows together in one private timeline.')}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.timelineRow}>
            <View
              style={[
                styles.emptyCard,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.72)',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.88)',
                },
              ]}
            >
              <View
                style={[
                  styles.emptyIconWrap,
                  {
                    backgroundColor: colors.primarySoft,
                  },
                ]}
              >
                <Ionicons name="images-outline" size={24} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {t('rooms.noPostsYet', 'No shared memories yet. Start the room with your first post.')}
              </Text>
            </View>
          </View>
        }
        renderItem={({ item, index }) => <RoomPostCard post={item} index={index} />}
      />

      <Animated.View
        entering={FadeInDown.springify().damping(18).mass(0.8)}
        style={styles.topPanelWrap}
        pointerEvents="box-none"
      >
        <View
          style={[
            styles.topPanel,
            {
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.92)',
            },
          ]}
        >
          <GlassView
            style={StyleSheet.absoluteFillObject}
            glassEffectStyle="regular"
            colorScheme={isDark ? 'dark' : 'light'}
          />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              {
                backgroundColor: glassOverlay,
              },
            ]}
          />
          {isOlderIOS ? (
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFillObject,
                {
                  borderRadius: 30,
                  backgroundColor: glassFallback,
                },
              ]}
            />
          ) : null}
          <View style={styles.topPanelContent}>
            <View style={styles.topPanelCopy}>
              <Text style={[styles.topPanelTitle, { color: colors.text }]} numberOfLines={1}>
                {details.room.name}
              </Text>
              <View style={styles.topPanelMetaRow}>
                <View
                  style={[
                    styles.topPanelMetaChip,
                    {
                      backgroundColor: softInputBackground,
                    },
                  ]}
                >
                  <Ionicons name="people-outline" size={14} color={colors.primary} />
                  <Text style={[styles.topPanelMetaText, { color: colors.text }]}>
                    {t('rooms.memberCount', '{{count}} members', { count: details.room.memberCount })}
                  </Text>
                </View>
                <View
                  style={[
                    styles.topPanelMetaChip,
                    {
                      backgroundColor: softInputBackground,
                    },
                  ]}
                >
                  <Ionicons name="sparkles-outline" size={14} color={colors.primary} />
                  <Text style={[styles.topPanelMetaText, { color: colors.text }]}>
                    {t('rooms.postCount', '{{count}} posts', { count: details.posts.length })}
                  </Text>
                </View>
              </View>
            </View>

            <Pressable
              onPress={handleOpenSettings}
              style={({ pressed }) => [
                styles.settingsButton,
                {
                  backgroundColor: softInputBackground,
                  opacity: pressed ? 0.92 : 1,
                  transform: [{ scale: pressed ? 0.96 : 1 }],
                },
              ]}
            >
              <Ionicons name="settings-outline" size={18} color={colors.primary} />
            </Pressable>
          </View>
        </View>
      </Animated.View>

      <KeyboardAvoidingView
        pointerEvents="box-none"
        style={styles.composerHost}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View
          entering={FadeInDown.delay(90).springify().damping(18).mass(0.8)}
          layout={LinearTransition.springify().damping(20)}
          style={[styles.composerWrap, { bottom: composerBottomOffset }]}
          pointerEvents="box-none"
        >
          <View
            style={[
              styles.composerPanel,
              {
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.92)',
              },
            ]}
          >
            <GlassView
              style={StyleSheet.absoluteFillObject}
              glassEffectStyle="regular"
              colorScheme={isDark ? 'dark' : 'light'}
            />
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFillObject,
                {
                  backgroundColor: glassOverlay,
                },
              ]}
            />
            {isOlderIOS ? (
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFillObject,
                  {
                    borderRadius: 30,
                    backgroundColor: glassFallback,
                  },
                ]}
              />
            ) : null}

            <Animated.View layout={LinearTransition.springify().damping(20)} style={styles.composerContent}>
              <View style={styles.composerTopRow}>
                <View
                  style={[
                    styles.composerInputShell,
                    {
                      backgroundColor: softInputBackground,
                    },
                  ]}
                >
                  <Ionicons name="create-outline" size={18} color={colors.primary} />
                  <TextInput
                    ref={draftInputRef}
                    value={draftText}
                    onChangeText={setDraftText}
                    onFocus={() => setComposerExpanded(true)}
                    placeholder={t('rooms.composePlaceholder', 'Write a shared memory...')}
                    placeholderTextColor={colors.secondaryText}
                    multiline
                    style={[
                      styles.composeInput,
                      composerExpanded ? styles.composeInputExpanded : styles.composeInputCollapsed,
                      { color: colors.text },
                    ]}
                    textAlignVertical="top"
                  />
                </View>

                <Pressable
                  onPress={() => {
                    void handlePickPhoto();
                  }}
                  style={({ pressed }) => [
                    styles.composerIconButton,
                    {
                      backgroundColor: softInputBackground,
                      opacity: pressed ? 0.92 : 1,
                      transform: [{ scale: pressed ? 0.96 : 1 }],
                    },
                  ]}
                >
                  <Ionicons
                    name={draftPhotoUri ? 'images' : 'image-outline'}
                    size={18}
                    color={colors.primary}
                  />
                </Pressable>
              </View>

              {composerExpanded ? (
                <Animated.View
                  entering={FadeInUp.springify().damping(18).mass(0.8)}
                  layout={LinearTransition.springify().damping(20)}
                  style={styles.composerExpandedContent}
                >
                  <TextInput
                    value={draftPlace}
                    onChangeText={setDraftPlace}
                    onFocus={() => setComposerExpanded(true)}
                    placeholder={t('rooms.composePlacePlaceholder', 'Place name (optional)')}
                    placeholderTextColor={colors.secondaryText}
                    style={[
                      styles.placeInput,
                      {
                        backgroundColor: softInputBackground,
                        color: colors.text,
                      },
                    ]}
                  />

                  {draftPhotoUri ? (
                    <View style={styles.previewWrap}>
                      <Image
                        source={{ uri: draftPhotoUri }}
                        style={styles.previewImage}
                        contentFit="cover"
                        transition={200}
                      />
                      <Pressable
                        onPress={() => {
                          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setDraftPhotoUri(null);
                        }}
                        style={styles.previewRemove}
                      >
                        <Ionicons name="close-circle" size={26} color="#FFFFFF" />
                      </Pressable>
                    </View>
                  ) : null}

                  <View style={styles.composerActions}>
                    <Pressable
                      onPress={handleCollapseComposer}
                      style={({ pressed }) => [
                        styles.composerSecondaryAction,
                        {
                          backgroundColor: softInputBackground,
                          opacity: pressed ? 0.92 : 1,
                          transform: [{ scale: pressed ? 0.985 : 1 }],
                        },
                      ]}
                    >
                      <Ionicons name="chevron-down" size={18} color={colors.text} />
                      <Text style={[styles.composerSecondaryText, { color: colors.text }]}>
                        {t('common.done', 'Done')}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        void handlePost();
                      }}
                      disabled={!canPost || posting}
                      style={({ pressed }) => [
                        styles.composerPrimaryAction,
                        {
                          backgroundColor: colors.primary,
                          opacity: !canPost || posting ? 0.55 : pressed ? 0.92 : 1,
                          transform: [{ scale: pressed ? 0.985 : 1 }],
                        },
                      ]}
                    >
                      {posting ? (
                        <ActivityIndicator color="#1C1C1E" />
                      ) : (
                        <>
                          <Ionicons name="arrow-up-circle-outline" size={18} color="#1C1C1E" />
                          <Text style={styles.composerPrimaryText}>
                            {t('rooms.postButton', 'Post')}
                          </Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                </Animated.View>
              ) : (
                <Pressable
                  onPress={handleExpandComposer}
                  style={({ pressed }) => [
                    styles.collapsedHintRow,
                    {
                      opacity: pressed ? 0.92 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.collapsedHintText, { color: colors.secondaryText }]}>
                    {t('rooms.composeHint', 'Tap to add a photo, place, or note to the room')}
                  </Text>
                  <Ionicons name="chevron-up" size={16} color={colors.secondaryText} />
                </Pressable>
              )}
            </Animated.View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineIntro: {
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: 18,
  },
  timelineEyebrow: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  timelineTitle: {
    marginTop: 8,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  timelineBody: {
    ...Typography.body,
    marginTop: 8,
  },
  topPanelWrap: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    zIndex: 20,
  },
  topPanel: {
    borderRadius: 30,
    borderWidth: 1,
    overflow: 'hidden',
    ...Shadows.floating,
  },
  topPanelContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  topPanelCopy: {
    flex: 1,
  },
  topPanelTitle: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  topPanelMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  topPanelMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  topPanelMetaText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
  },
  settingsButton: {
    width: 46,
    height: 46,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineRow: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  postCard: {
    borderRadius: 30,
    borderWidth: 1,
    padding: 18,
    ...Shadows.card,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  postHeaderCopy: {
    flex: 1,
  },
  postAuthor: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  postMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  postMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  postMetaText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
  },
  postTypeBadge: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postImage: {
    width: '100%',
    height: 220,
    borderRadius: 24,
    marginTop: 16,
  },
  postText: {
    ...Typography.body,
    marginTop: 14,
  },
  emptyCard: {
    borderRadius: 30,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    ...Shadows.card,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '700',
    textAlign: 'center',
  },
  composerHost: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  composerWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 30,
  },
  composerPanel: {
    borderRadius: 30,
    borderWidth: 1,
    overflow: 'hidden',
    ...Shadows.floating,
  },
  composerContent: {
    padding: 12,
    gap: 10,
  },
  composerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  composerInputShell: {
    flex: 1,
    minHeight: 56,
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  composeInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    paddingTop: 0,
    paddingBottom: 0,
  },
  composeInputCollapsed: {
    minHeight: 24,
    maxHeight: 24,
  },
  composeInputExpanded: {
    minHeight: 96,
  },
  composerIconButton: {
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerExpandedContent: {
    gap: 10,
  },
  placeInput: {
    minHeight: 54,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
  },
  previewWrap: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 190,
  },
  previewRemove: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  composerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  composerSecondaryAction: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  composerPrimaryAction: {
    flex: 1.1,
    minHeight: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  composerSecondaryText: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '700',
  },
  composerPrimaryText: {
    color: '#1C1C1E',
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '800',
  },
  collapsedHintRow: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 4,
  },
  collapsedHintText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 17,
  },
});
