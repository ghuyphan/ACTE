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
import PrimaryButton from '../../components/ui/PrimaryButton';
import { Layout, Typography } from '../../constants/theme';
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
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          {t('rooms.unavailableTitle', 'Rooms unavailable')}
        </Text>
        <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>
          {t('rooms.unavailableBody', 'This build does not have shared rooms enabled yet.')}
        </Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingHorizontal: Layout.screenPadding }]}>
        <View style={[styles.heroIcon, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="people-outline" size={30} color={colors.primary} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          {t('rooms.signInTitle', 'Sign in to use rooms')}
        </Text>
        <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>
          {t('rooms.signInBody', 'Rooms are private shared spaces for the people closest to you.')}
        </Text>
        <PrimaryButton
          label={t('rooms.signInCta', 'Sign in')}
          onPress={() => router.push('/auth')}
          style={styles.primaryButton}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('rooms.title', 'Rooms')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
            {t('rooms.subtitle', 'Private shared spaces for your favorite people.')}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/rooms/join')}
          style={[styles.headerIconButton, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Ionicons name="person-add-outline" size={20} color={colors.primary} />
        </Pressable>
      </View>

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

      {!roomsReady || loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            rooms.length === 0 ? styles.listContentEmpty : null,
            { paddingBottom: insets.bottom + 30 },
          ]}
          refreshing={loading}
          onRefresh={() => {
            void refreshRooms();
          }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={[styles.heroIcon, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="paper-plane-outline" size={26} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {t('rooms.emptyTitle', 'No rooms yet')}
              </Text>
              <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>
                {t('rooms.emptyBody', 'Create your first private room or join one from an invite link.')}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/rooms/${item.id}` as any)}
              style={[
                styles.roomCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={[styles.roomBadge, { backgroundColor: colors.primarySoft }]}>
                <Ionicons
                  name={item.currentUserRole === 'owner' ? 'home-outline' : 'people-outline'}
                  size={18}
                  color={colors.primary}
                />
              </View>
              <View style={styles.roomCardCopy}>
                <Text style={[styles.roomName, { color: colors.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.roomMeta, { color: colors.secondaryText }]} numberOfLines={2}>
                  {item.lastPostPreview ??
                    t('rooms.noPostsYet', 'No shared memories yet. Start the room with your first post.')}
                </Text>
                <Text style={[styles.roomMetaSmall, { color: colors.secondaryText }]}>
                  {t('rooms.memberCount', '{{count}} members', { count: item.memberCount })}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.secondaryText} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Layout.screenPadding,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  headerCopy: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    ...Typography.screenTitle,
    fontSize: 28,
  },
  subtitle: {
    ...Typography.body,
    marginTop: 6,
  },
  headerIconButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
  },
  listContent: {
    gap: 12,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  roomCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  roomBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  roomCardCopy: {
    flex: 1,
    paddingRight: 10,
  },
  roomName: {
    fontSize: 17,
    fontWeight: '700',
  },
  roomMeta: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
  },
  roomMetaSmall: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  heroIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyBody: {
    ...Typography.body,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 320,
  },
  primaryButton: {
    marginTop: 20,
    minWidth: 180,
  },
});
