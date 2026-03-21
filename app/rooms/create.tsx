import { Ionicons } from '@expo/vector-icons';
import { GlassView } from '../../components/ui/GlassView';
import OfflineNotice from '../../components/ui/OfflineNotice';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Layout, Shadows, Typography } from '../../constants/theme';
import { useConnectivity } from '../../hooks/useConnectivity';
import { useRoomsStore } from '../../hooks/useRooms';
import { useTheme } from '../../hooks/useTheme';
import { getRoomErrorMessage } from '../../services/roomService';
import { isOlderIOS } from '../../utils/platform';

export default function CreateRoomScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const { isOnline } = useConnectivity();
  const { createRoom } = useRoomsStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const glassOverlay = isDark ? 'rgba(18,18,24,0.64)' : 'rgba(255,255,255,0.74)';
  const glassFallback = isDark ? 'rgba(18,18,24,0.92)' : 'rgba(255,255,255,0.94)';
  const softInputBackground = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
  const canSubmit = Boolean(name.trim()) && !saving && isOnline;

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert(
        t('rooms.createErrorTitle', 'Room name needed'),
        t('rooms.createErrorBody', 'Give this room a name before creating it.')
      );
      return;
    }

    setSaving(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const room = await createRoom(name);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/rooms/${room.id}` as any);
    } catch (error) {
      Alert.alert(t('rooms.createFailedTitle', 'Could not create room'), getRoomErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

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
            {t('rooms.createTitle', 'Create Room')}
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('rooms.createHeroTitle', 'Build a private space that feels close')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
            {t(
              'rooms.createBody',
              'Rooms are invite-only and keep your shared memories separate from your personal notes.'
            )}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(80).springify().damping(18).mass(0.8)} style={styles.formRow}>
          {!isOnline ? (
            <View style={styles.noticeRow}>
              <OfflineNotice
                title={t('rooms.offlineCreateTitle', 'Room creation is offline for now')}
                body={t('rooms.offlineCreateBody', 'You can still browse cached rooms, but creating a new room needs a connection.')}
              />
            </View>
          ) : null}
          <View
            style={[
              styles.formCard,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.72)',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.88)',
              },
            ]}
          >
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: colors.primarySoft,
                },
              ]}
            >
              <Ionicons name="sparkles-outline" size={20} color={colors.primary} />
            </View>

            <Text style={[styles.cardTitle, { color: colors.text }]}>
              {t('rooms.roomNameLabel', 'Room name')}
            </Text>
            <Text style={[styles.cardBody, { color: colors.secondaryText }]}>
              {t('rooms.createPrompt', 'Pick a name that feels like a place your people will instantly recognize.')}
            </Text>

            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('rooms.roomNamePlaceholder', 'Weekend getaway')}
              placeholderTextColor={colors.secondaryText}
              style={[
                styles.input,
                {
                  backgroundColor: softInputBackground,
                  color: colors.text,
                },
              ]}
              autoFocus
              maxLength={60}
            />

            <View style={styles.hintRow}>
              <Text style={[styles.hintText, { color: colors.secondaryText }]}>
                {t('rooms.nameHint', 'Invite links and members can be managed after creation.')}
              </Text>
              <Text style={[styles.counter, { color: colors.secondaryText }]}>{name.length}/60</Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      <KeyboardAvoidingView
        pointerEvents="box-none"
        style={styles.footerHost}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
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
                  {t('rooms.createButton', 'Create room')}
                </Text>
                <Text style={[styles.footerBody, { color: colors.secondaryText }]}>
                  {t('rooms.createFooterBody', 'Start the room now, then invite everyone from the settings screen.')}
                </Text>
              </View>

              <Pressable
                onPress={() => {
                  void handleCreate();
                }}
                disabled={!canSubmit}
                style={({ pressed }) => [
                  styles.primaryAction,
                  {
                    backgroundColor: colors.primary,
                    opacity: !canSubmit ? 0.55 : pressed ? 0.92 : 1,
                    transform: [{ scale: pressed ? 0.985 : 1 }],
                  },
                ]}
              >
                <Ionicons name="add-circle-outline" size={18} color="#1C1C1E" />
                <Text style={styles.primaryActionText}>
                  {saving ? t('common.loading', 'Loading') : t('rooms.createButton', 'Create room')}
                </Text>
              </Pressable>
            </View>
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
  formRow: {
    paddingHorizontal: 12,
  },
  noticeRow: {
    marginBottom: 12,
  },
  formCard: {
    borderRadius: 30,
    borderWidth: 1,
    padding: 22,
    ...Shadows.card,
  },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    marginTop: 18,
    fontSize: 19,
    lineHeight: 23,
    fontWeight: '800',
  },
  cardBody: {
    ...Typography.body,
    marginTop: 8,
  },
  input: {
    minHeight: 60,
    borderRadius: 20,
    paddingHorizontal: 16,
    fontSize: 16,
    marginTop: 18,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  hintText: {
    ...Typography.body,
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  counter: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
  },
  footerHost: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
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
