import { Ionicons } from '@expo/vector-icons';
import { GlassView } from '../../components/ui/GlassView';
import * as Haptics from 'expo-haptics';
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
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Layout, Radii, Shadows, Typography } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { useRoomsStore } from '../../hooks/useRooms';
import { useTheme } from '../../hooks/useTheme';
import { RoomSummary } from '../../services/roomCache';
import { isOlderIOS } from '../../utils/platform';

function FloatingActionButton({
  icon,
  label,
  subtitle,
  onPress,
  variant = 'primary',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
}) {
  const { colors, isDark } = useTheme();
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      style={({ pressed }) => [
        styles.footerAction,
        {
          backgroundColor: isPrimary
            ? colors.primary
            : isDark
              ? 'rgba(255,255,255,0.08)'
              : 'rgba(255,255,255,0.66)',
          borderColor: isPrimary ? 'transparent' : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.05)',
          opacity: pressed ? 0.92 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
      ]}
      onPress={onPress}
    >
      <View
        style={[
          styles.footerActionIcon,
          {
            backgroundColor: isPrimary ? 'rgba(28,28,30,0.14)' : colors.primarySoft,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={18}
          color={isPrimary ? '#1C1C1E' : colors.primary}
        />
      </View>
      <View style={styles.footerActionCopy}>
        <Text
          style={[
            styles.footerActionLabel,
            { color: isPrimary ? '#1C1C1E' : colors.text },
          ]}
        >
          {label}
        </Text>
        <Text
          style={[
            styles.footerActionSubtitle,
            { color: isPrimary ? 'rgba(28,28,30,0.72)' : colors.secondaryText },
          ]}
        >
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

function RoomListItem({
  item,
  index,
  onPress,
}: {
  item: RoomSummary;
  index: number;
  onPress: () => void;
}) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();

  return (
    <Animated.View entering={FadeInUp.delay(index * 70).springify().damping(18).mass(0.8)}>
      <View style={styles.roomRowPadding}>
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [
            styles.roomCard,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.72)',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.88)',
              opacity: pressed ? 0.94 : 1,
              transform: [{ scale: pressed ? 0.992 : 1 }],
            },
          ]}
        >
          <View
            style={[
              styles.roomBadge,
              {
                backgroundColor: item.currentUserRole === 'owner' ? colors.primary : colors.primarySoft,
              },
            ]}
          >
            <Ionicons
              name={item.currentUserRole === 'owner' ? 'sparkles-outline' : 'people-outline'}
              size={22}
              color={item.currentUserRole === 'owner' ? '#1C1C1E' : colors.primary}
            />
          </View>

          <View style={styles.roomContent}>
            <View style={styles.roomTitleRow}>
              <Text style={[styles.roomName, { color: colors.text }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.secondaryText} />
            </View>

            <Text style={[styles.roomPreview, { color: colors.secondaryText }]} numberOfLines={2}>
              {item.lastPostPreview ??
                t('rooms.noPostsYet', 'No shared memories yet. Start the room with your first post.')}
            </Text>

            <View style={styles.metaRow}>
              <View
                style={[
                  styles.metaChip,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                  },
                ]}
              >
                <Ionicons name="people-outline" size={14} color={colors.primary} />
                <Text style={[styles.metaText, { color: colors.text }]}>
                  {t('rooms.memberCount', '{{count}} members', { count: item.memberCount })}
                </Text>
              </View>

              <View
                style={[
                  styles.metaChip,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                  },
                ]}
              >
                <Ionicons
                  name={item.currentUserRole === 'owner' ? 'home-outline' : 'person-outline'}
                  size={14}
                  color={colors.primary}
                />
                <Text style={[styles.metaText, { color: colors.text }]}>
                  {item.currentUserRole === 'owner'
                    ? t('rooms.ownerRole', 'Owner')
                    : t('rooms.memberRole', 'Member')}
                </Text>
              </View>
            </View>
          </View>
        </Pressable>
      </View>
    </Animated.View>
  );
}

export default function RoomsTabScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { rooms, loading, enabled, roomsReady, refreshRooms } = useRoomsStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const topPanelOverlay = isDark ? 'rgba(18,18,24,0.6)' : 'rgba(255,255,255,0.72)';
  const footerOverlay = isDark ? 'rgba(18,18,24,0.66)' : 'rgba(255,255,255,0.74)';
  const footerFallback = isDark ? 'rgba(18,18,24,0.9)' : 'rgba(255,255,255,0.94)';

  useEffect(() => {
    if (user && enabled) {
      void refreshRooms().catch(() => undefined);
    }
  }, [enabled, refreshRooms, user]);

  const emitLightHaptic = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleNavigate = (path: '/rooms/create' | '/rooms/join') => {
    emitLightHaptic();
    router.push(path as any);
  };

  const handleOpenRoom = (roomId: string) => {
    emitLightHaptic();
    router.push(`/rooms/${roomId}` as any);
  };

  const renderHeader = () => (
    <Animated.View
      entering={FadeInDown.springify().damping(18).mass(0.8)}
      style={[styles.floatingHeaderWrap, { top: insets.top + Layout.floatingGap }]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.floatingPanel,
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
              backgroundColor: topPanelOverlay,
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
                backgroundColor: isDark ? 'rgba(28,28,30,0.9)' : 'rgba(255,255,255,0.94)',
              },
            ]}
          />
        ) : null}

        <View style={styles.headerContent}>
          <View style={styles.headerCopy}>
            <Text style={[styles.headerEyebrow, { color: colors.primary }]}>
              {t('tabs.rooms', 'Rooms')}
            </Text>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {t('rooms.title', 'Rooms')}
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.secondaryText }]}>
              {t('rooms.subtitle', 'Private shared spaces for your favorite people.')}
            </Text>
          </View>

          <View
            style={[
              styles.headerStatPill,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
              },
            ]}
          >
            <Text style={[styles.headerStatValue, { color: colors.text }]}>{rooms.length}</Text>
            <Text style={[styles.headerStatLabel, { color: colors.secondaryText }]}>
              {t('rooms.activeLabel', 'Active')}
            </Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );

  const renderBottomActions = () => {
    if (!enabled || !user) {
      return null;
    }

    return (
      <Animated.View
        entering={FadeInDown.delay(90).springify().damping(18).mass(0.8)}
        style={[styles.footerWrap, { bottom: insets.bottom + 14 }]}
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
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              {
                backgroundColor: footerOverlay,
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
                  backgroundColor: footerFallback,
                },
              ]}
            />
          ) : null}
          <View style={styles.footerContent}>
            <FloatingActionButton
              icon="add-circle-outline"
              label={t('rooms.createButton', 'Create room')}
              subtitle={t('rooms.createFooterHint', 'Start a new private circle')}
              onPress={() => handleNavigate('/rooms/create')}
            />
            <FloatingActionButton
              icon="enter-outline"
              label={t('rooms.joinButton', 'Join invite')}
              subtitle={t('rooms.joinFooterHint', 'Open a shared invite link')}
              onPress={() => handleNavigate('/rooms/join')}
              variant="secondary"
            />
          </View>
        </View>
      </Animated.View>
    );
  };

  if (!enabled) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        {renderHeader()}
        <View style={[styles.centerState, { paddingTop: insets.top + 132 }]}>
          <View
            style={[
              styles.stateCard,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.72)',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.88)',
              },
            ]}
          >
            <Text style={[styles.stateTitle, { color: colors.text }]}>
              {t('rooms.unavailableTitle', 'Rooms unavailable')}
            </Text>
            <Text style={[styles.stateBody, { color: colors.secondaryText }]}>
              {t('rooms.unavailableBody', 'This build does not have shared rooms enabled yet.')}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        {renderHeader()}
        <View style={[styles.centerState, { paddingTop: insets.top + 132, paddingBottom: insets.bottom + 32 }]}>
          <View
            style={[
              styles.stateCard,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.72)',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.88)',
              },
            ]}
          >
            <Text style={[styles.stateTitle, { color: colors.text }]}>
              {t('rooms.signInTitle', 'Sign in to use rooms')}
            </Text>
            <Text style={[styles.stateBody, { color: colors.secondaryText }]}>
              {t('rooms.signInBody', 'Rooms are private shared spaces for the people closest to you.')}
            </Text>
            <Pressable
              onPress={() => {
                emitLightHaptic();
                router.push('/auth');
              }}
              style={({ pressed }) => [
                styles.stateButton,
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.92 : 1,
                  transform: [{ scale: pressed ? 0.985 : 1 }],
                },
              ]}
            >
              <Ionicons name="person-circle-outline" size={18} color="#1C1C1E" />
              <Text style={styles.stateButtonText}>{t('rooms.signInCta', 'Sign in')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  const contentTopPadding = insets.top + 136;
  const contentBottomPadding = insets.bottom + 184;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList
        data={rooms}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: contentTopPadding,
          paddingBottom: contentBottomPadding,
        }}
        refreshing={loading}
        onRefresh={() => {
          void refreshRooms();
        }}
        ListHeaderComponent={
          <View style={styles.listLead}>
            <Text style={[styles.listLeadEyebrow, { color: colors.primary }]}>
              {t('rooms.spacesLabel', 'Shared spaces')}
            </Text>
            <Text style={[styles.listLeadTitle, { color: colors.text }]}>
              {loading && !roomsReady
                ? t('rooms.loadingTitle', 'Loading your rooms')
                : rooms.length === 0
                  ? t('rooms.emptyTitle', 'No rooms yet')
                  : t('rooms.timelineTitle', 'Recent activity')}
            </Text>
            <Text style={[styles.listLeadBody, { color: colors.secondaryText }]}>
              {loading && !roomsReady
                ? t('rooms.loadingBody', 'Refreshing your private spaces now.')
                : rooms.length === 0
                  ? t('rooms.emptyBody', 'Create your first private room or join one from an invite link.')
                  : t('rooms.listBody', 'Rooms you post in will rise back to the top automatically.')}
            </Text>
          </View>
        }
        ListEmptyComponent={
          loading && !roomsReady ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <View style={styles.roomRowPadding}>
              <View
                style={[
                  styles.emptyPanel,
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
                  <Ionicons name="sparkles-outline" size={24} color={colors.primary} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  {t('rooms.emptyTitle', 'No rooms yet')}
                </Text>
                <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>
                  {t('rooms.emptyBody', 'Create your first private room or join one from an invite link.')}
                </Text>
              </View>
            </View>
          )
        }
        renderItem={({ item, index }) => (
          <RoomListItem
            item={item}
            index={index}
            onPress={() => handleOpenRoom(item.id)}
          />
        )}
      />

      {renderHeader()}
      {renderBottomActions()}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  floatingHeaderWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 30,
  },
  floatingPanel: {
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1,
    ...Shadows.floating,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 14,
  },
  headerCopy: {
    flex: 1,
  },
  headerEyebrow: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  headerTitle: {
    marginTop: 4,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    ...Typography.body,
    marginTop: 6,
  },
  headerStatPill: {
    minWidth: 74,
    borderRadius: Radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerStatValue: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '800',
  },
  headerStatLabel: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '600',
  },
  listLead: {
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: 18,
  },
  listLeadEyebrow: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  listLeadTitle: {
    marginTop: 8,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  listLeadBody: {
    ...Typography.body,
    marginTop: 8,
  },
  roomRowPadding: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  roomCard: {
    borderRadius: 30,
    borderWidth: 1,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    ...Shadows.card,
  },
  roomBadge: {
    width: 54,
    height: 54,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomContent: {
    flex: 1,
  },
  roomTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  roomName: {
    flex: 1,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  roomPreview: {
    ...Typography.body,
    marginTop: 8,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  metaText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
  },
  footerWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 40,
  },
  footerPanel: {
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1,
    ...Shadows.floating,
  },
  footerContent: {
    padding: 12,
    gap: 10,
  },
  footerAction: {
    minHeight: 74,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  footerActionIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerActionCopy: {
    flex: 1,
  },
  footerActionLabel: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  footerActionSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '500',
  },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  stateCard: {
    borderRadius: 32,
    borderWidth: 1,
    padding: 24,
    ...Shadows.card,
  },
  stateTitle: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  stateBody: {
    ...Typography.body,
    marginTop: 10,
  },
  stateButton: {
    marginTop: 18,
    minHeight: Layout.buttonHeight,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    ...Shadows.button,
  },
  stateButtonText: {
    color: '#1C1C1E',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  loadingState: {
    paddingTop: 48,
    alignItems: 'center',
  },
  emptyPanel: {
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
    marginTop: 18,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyBody: {
    ...Typography.body,
    marginTop: 8,
    textAlign: 'center',
  },
});
