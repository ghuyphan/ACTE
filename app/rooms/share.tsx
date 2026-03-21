import { Ionicons } from '@expo/vector-icons';
import { GlassView } from '../../components/ui/GlassView';
import OfflineNotice from '../../components/ui/OfflineNotice';
import * as Haptics from 'expo-haptics';
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
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  LinearTransition,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Layout, Shadows, Typography } from '../../constants/theme';
import { useConnectivity } from '../../hooks/useConnectivity';
import { useNotesStore } from '../../hooks/useNotes';
import { useRoomsStore } from '../../hooks/useRooms';
import { useTheme } from '../../hooks/useTheme';
import { Note } from '../../services/database';
import { RoomSummary } from '../../services/roomCache';
import { getRoomErrorMessage } from '../../services/roomService';
import { formatNoteTextWithEmoji } from '../../services/noteTextPresentation';
import { isOlderIOS } from '../../utils/platform';

function SelectableRoomCard({
  room,
  index,
  selected,
  onPress,
}: {
  room: RoomSummary;
  index: number;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const progress = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(selected ? 1 : 0, { duration: 220 });
  }, [progress, selected]);

  const animatedCardStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [
        isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.72)',
        isDark ? 'rgba(255,193,7,0.18)' : 'rgba(255,193,7,0.16)',
      ]
    ),
    borderColor: interpolateColor(
      progress.value,
      [0, 1],
      [
        isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.88)',
        colors.primary,
      ]
    ),
  }));

  const animatedDotStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(progress.value, [0, 1], [colors.border, colors.primary]),
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      ['rgba(0,0,0,0)', isDark ? 'rgba(255,193,7,0.22)' : 'rgba(255,193,7,0.16)']
    ),
    transform: [{ scale: withTiming(selected ? 1 : 0.96, { duration: 220 }) }],
  }));

  const animatedCheckStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.82 + progress.value * 0.18 }],
  }));

  return (
    <Animated.View entering={FadeInUp.delay(index * 70).springify().damping(18).mass(0.8)}>
      <View style={styles.roomRow}>
        <Pressable onPress={onPress}>
          <Animated.View style={[styles.roomCard, animatedCardStyle]} layout={LinearTransition.springify().damping(20)}>
            <Animated.View style={[styles.selectionDot, animatedDotStyle]}>
              <Animated.View style={animatedCheckStyle}>
                <Ionicons name="checkmark" size={14} color={colors.primary} />
              </Animated.View>
            </Animated.View>

            <View style={styles.roomCopy}>
              <Text style={[styles.roomTitle, { color: colors.text }]}>{room.name}</Text>
              <Text style={[styles.roomMeta, { color: colors.secondaryText }]}>
                {t('rooms.memberCount', '{{count}} members', { count: room.memberCount })}
              </Text>
            </View>

            <View
              style={[
                styles.roomChevronWrap,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                },
              ]}
            >
              <Ionicons name="chevron-forward" size={16} color={selected ? colors.primary : colors.secondaryText} />
            </View>
          </Animated.View>
        </Pressable>
      </View>
    </Animated.View>
  );
}

export default function ShareToRoomScreen() {
  const { noteId } = useLocalSearchParams<{ noteId?: string }>();
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const { isOnline } = useConnectivity();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { rooms, roomsReady, shareNoteToRoom } = useRoomsStore();
  const { getNoteById } = useNotesStore();
  const [note, setNote] = useState<Note | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const glassOverlay = isDark ? 'rgba(18,18,24,0.64)' : 'rgba(255,255,255,0.74)';
  const glassFallback = isDark ? 'rgba(18,18,24,0.92)' : 'rgba(255,255,255,0.94)';

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
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await shareNoteToRoom(selectedRoomId, note);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/rooms/${selectedRoomId}` as any);
    } catch (error) {
      Alert.alert(t('rooms.shareFailedTitle', 'Could not share note'), getRoomErrorMessage(error));
    } finally {
      setSharing(false);
    }
  };

  const handleSelectRoom = (roomId: string) => {
    setSelectedRoomId(roomId);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  if (!roomsReady || !note) {
    return (
      <View style={[styles.loadingScreen, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: insets.top + 108,
          paddingBottom: insets.bottom + 184,
        }}
      >
        <Animated.View entering={FadeInUp.springify().damping(18).mass(0.8)} style={styles.sectionIntro}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>
            {t('rooms.shareTitle', 'Share to Room')}
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('rooms.shareHeroTitle', 'Send this memory somewhere it belongs')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
            {t('rooms.sharePrompt', 'Choose a room for this memory')}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(60).springify().damping(18).mass(0.8)} style={styles.previewRow}>
          <View
            style={[
              styles.previewCard,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.72)',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.88)',
              },
            ]}
          >
            <Text style={[styles.previewLabel, { color: colors.primary }]}>
              {t('rooms.notePreviewLabel', 'Memory preview')}
            </Text>
            <Text style={[styles.notePreview, { color: colors.text }]}>
              {note.type === 'text' ? formatNoteTextWithEmoji(note.content, note.moodEmoji) : t('rooms.sharePhotoLabel', 'Photo memory')}
            </Text>
          </View>
        </Animated.View>

        {rooms.length === 0 ? (
          <Animated.View entering={FadeInUp.delay(120).springify().damping(18).mass(0.8)} style={styles.roomRow}>
            <View
              style={[
                styles.emptyCard,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.72)',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.88)',
                },
              ]}
            >
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {t('rooms.emptyTitle', 'No rooms yet')}
              </Text>
              <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>
                {t('rooms.shareEmptyRooms', 'Create a room first, then come back to share this note.')}
              </Text>
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/rooms/create');
                }}
                style={({ pressed }) => [
                  styles.emptyAction,
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.92 : 1,
                    transform: [{ scale: pressed ? 0.985 : 1 }],
                  },
                ]}
              >
                <Ionicons name="add-circle-outline" size={18} color="#1C1C1E" />
                <Text style={styles.emptyActionText}>{t('rooms.createButton', 'Create room')}</Text>
              </Pressable>
            </View>
          </Animated.View>
        ) : (
          <View>
            {!isOnline ? (
              <View style={styles.noticeRow}>
                <OfflineNotice
                  title={t('rooms.offlineShareTitle', 'Sharing to a room is offline for now')}
                  body={t('rooms.offlineShareBody', 'Your note is still saved locally. Share it to a room after you reconnect.')}
                />
              </View>
            ) : null}
            {rooms.map((room, index) => (
              <SelectableRoomCard
                key={room.id}
                room={room}
                index={index}
                selected={selectedRoomId === room.id}
                onPress={() => handleSelectRoom(room.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {rooms.length > 0 ? (
        <Animated.View
          entering={FadeInDown.delay(120).springify().damping(18).mass(0.8)}
          style={[styles.footerWrap, { bottom: insets.bottom + 12 }]}
          pointerEvents="box-none"
        >
          <View
            style={[
              styles.footerPanel,
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
            <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: glassOverlay }]} />
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

            <View style={styles.footerContent}>
              <View style={styles.footerCopy}>
                <Text style={[styles.footerTitle, { color: colors.text }]}>
                  {selectedRoomId
                    ? t('rooms.shareReadyTitle', 'Ready to share')
                    : t('rooms.shareSelectionTitle', 'Choose a room')}
                </Text>
                <Text style={[styles.footerBody, { color: colors.secondaryText }]}>
                  {selectedRoomId
                    ? t('rooms.shareReadyBody', 'This memory will appear in the selected room timeline right away.')
                    : t('rooms.shareSelectionBody', 'Select a room to activate sharing.')}
                </Text>
              </View>

              <Pressable
                onPress={() => {
                  void handleShare();
                }}
                disabled={!selectedRoomId || sharing || !isOnline}
                style={({ pressed }) => [
                  styles.primaryAction,
                  {
                    backgroundColor: colors.primary,
                    opacity: !selectedRoomId || sharing ? 0.55 : pressed ? 0.92 : 1,
                    transform: [{ scale: pressed ? 0.985 : 1 }],
                  },
                ]}
              >
                <Ionicons name="arrow-up-circle-outline" size={18} color="#1C1C1E" />
                <Text style={styles.primaryActionText}>
                  {sharing ? t('common.loading', 'Loading') : t('rooms.shareConfirm', 'Share to room')}
                </Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screen: {
    flex: 1,
  },
  sectionIntro: {
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: 18,
  },
  eyebrow: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 8,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    ...Typography.body,
    marginTop: 10,
  },
  previewRow: {
    paddingHorizontal: 12,
    paddingBottom: 14,
  },
  noticeRow: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  previewCard: {
    borderRadius: 30,
    borderWidth: 1,
    padding: 20,
    ...Shadows.card,
  },
  previewLabel: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  notePreview: {
    ...Typography.body,
    marginTop: 10,
  },
  roomRow: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  roomCard: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    ...Shadows.card,
  },
  selectionDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomCopy: {
    flex: 1,
  },
  roomTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  roomMeta: {
    ...Typography.pill,
    marginTop: 4,
  },
  roomChevronWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    borderRadius: 30,
    borderWidth: 1,
    padding: 22,
    ...Shadows.card,
  },
  emptyTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
  },
  emptyBody: {
    ...Typography.body,
    marginTop: 8,
  },
  emptyAction: {
    minHeight: 54,
    marginTop: 18,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyActionText: {
    color: '#1C1C1E',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  footerWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
  },
  footerPanel: {
    overflow: 'hidden',
    borderRadius: 30,
    borderWidth: 1,
    ...Shadows.floating,
  },
  footerContent: {
    padding: 14,
    gap: 14,
  },
  footerCopy: {
    paddingHorizontal: 4,
  },
  footerTitle: {
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '800',
  },
  footerBody: {
    ...Typography.body,
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
  },
  primaryAction: {
    minHeight: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  primaryActionText: {
    color: '#1C1C1E',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
});
