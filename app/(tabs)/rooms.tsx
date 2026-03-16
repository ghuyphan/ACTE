import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  RoomCard,
  RoomHeader,
  RoomScreen,
} from '../../components/rooms/RoomScaffold';
import PrimaryButton from '../../components/ui/PrimaryButton';
import { Typography } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { useRoomsStore } from '../../hooks/useRooms';
import { useTheme } from '../../hooks/useTheme';

export default function RoomsTabScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { rooms, loading, enabled, roomsReady, refreshRooms } = useRoomsStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (user && enabled) {
      void refreshRooms().catch(() => undefined);
    }
  }, [enabled, refreshRooms, user]);

  if (!enabled) {
    return (
      <RoomScreen contentContainerStyle={[styles.content, styles.center]}>
        <RoomHeader
          title={t('rooms.unavailableTitle', 'Rooms unavailable')}
          subtitle={t('rooms.unavailableBody', 'This build does not have shared rooms enabled yet.')}
        />
      </RoomScreen>
    );
  }

  if (!user) {
    return (
      <RoomScreen contentContainerStyle={[styles.content, styles.center]}>
        <RoomHeader
          title={t('rooms.signInTitle', 'Sign in to use rooms')}
          subtitle={t('rooms.signInBody', 'Rooms are private shared spaces for the people closest to you.')}
          footer={
            <PrimaryButton
              label={t('rooms.signInCta', 'Sign in')}
              onPress={() => router.push('/auth')}
            />
          }
        />
      </RoomScreen>
    );
  }

  const header = (
    <View style={[styles.content, { paddingTop: insets.top + 8 }]}>
      <RoomHeader
        title={t('rooms.title', 'Rooms')}
        subtitle={t('rooms.subtitle', 'Private shared spaces for your favorite people.')}
      />
      <RoomCard>
        <View style={styles.actionsRow}>
          <PrimaryButton
            label={t('rooms.createButton', 'Create room')}
            onPress={() => router.push('/rooms/create')}
            style={styles.actionButton}
          />
          <PrimaryButton
            label={t('rooms.joinButton', 'Join invite')}
            onPress={() => router.push('/rooms/join')}
            variant="secondary"
            style={styles.actionButton}
          />
        </View>
      </RoomCard>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        {t('rooms.title', 'Rooms')}
      </Text>
    </View>
  );

  if (!roomsReady || loading) {
    return (
      <RoomScreen contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}>
        <RoomHeader
          title={t('rooms.title', 'Rooms')}
          subtitle={t('rooms.subtitle', 'Private shared spaces for your favorite people.')}
        />
        <RoomCard>
          <View style={styles.actionsRow}>
            <PrimaryButton
              label={t('rooms.createButton', 'Create room')}
              onPress={() => router.push('/rooms/create')}
              style={styles.actionButton}
            />
            <PrimaryButton
              label={t('rooms.joinButton', 'Join invite')}
              onPress={() => router.push('/rooms/join')}
              variant="secondary"
              style={styles.actionButton}
            />
          </View>
        </RoomCard>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </RoomScreen>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList
        data={rooms}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshing={loading}
        onRefresh={() => {
          void refreshRooms();
        }}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View style={styles.content}>
            <RoomCard>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {t('rooms.emptyTitle', 'No rooms yet')}
              </Text>
              <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>
                {t('rooms.emptyBody', 'Create your first private room or join one from an invite link.')}
              </Text>
            </RoomCard>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.content}>
            <Pressable onPress={() => router.push(`/rooms/${item.id}` as any)}>
              <RoomCard>
                <View style={styles.roomRow}>
                  <View style={[styles.roomBadge, { backgroundColor: colors.primarySoft }]}>
                    <Ionicons
                      name={item.currentUserRole === 'owner' ? 'home-outline' : 'people-outline'}
                      size={18}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.roomCopy}>
                    <Text style={[styles.roomName, { color: colors.text }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={[styles.roomPreview, { color: colors.secondaryText }]} numberOfLines={2}>
                      {item.lastPostPreview ??
                        t('rooms.noPostsYet', 'No shared memories yet. Start the room with your first post.')}
                    </Text>
                    <Text style={[styles.roomMeta, { color: colors.secondaryText }]}>
                      {t('rooms.memberCount', '{{count}} members', { count: item.memberCount })}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.secondaryText} />
                </View>
              </RoomCard>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    gap: 14,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  actionButton: {
    flex: 1,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptyBody: {
    ...Typography.body,
    marginTop: 6,
  },
  roomRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roomBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  roomCopy: {
    flex: 1,
    paddingRight: 12,
  },
  roomName: {
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '700',
  },
  roomPreview: {
    ...Typography.body,
    marginTop: 4,
  },
  roomMeta: {
    ...Typography.pill,
    marginTop: 8,
  },
});
