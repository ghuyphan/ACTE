import { Ionicons } from '@expo/vector-icons';
import { GlassView } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
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
import { useAuth } from '../../hooks/useAuth';
import { useSharedFeedStore } from '../../hooks/useSharedFeed';
import { useTheme } from '../../hooks/useTheme';
import { getSharedFeedErrorMessage } from '../../services/sharedFeedService';
import { isOlderIOS } from '../../utils/platform';

export default function FriendJoinScreen() {
  const { invite } = useLocalSearchParams<{ invite?: string }>();
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const { user, isAuthAvailable } = useAuth();
  const { acceptFriendInvite } = useSharedFeedStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [inviteValue, setInviteValue] = useState('');
  const [joining, setJoining] = useState(false);
  const autoAttemptedRef = useRef(false);

  const glassOverlay = isDark ? 'rgba(18,18,24,0.64)' : 'rgba(255,255,255,0.74)';
  const glassFallback = isDark ? 'rgba(18,18,24,0.92)' : 'rgba(255,255,255,0.94)';
  const softInputBackground = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';

  useEffect(() => {
    if (typeof invite === 'string' && invite.trim()) {
      setInviteValue(invite);
    }
  }, [invite]);

  useEffect(() => {
    if (!user || autoAttemptedRef.current || !inviteValue.trim()) {
      return;
    }

    autoAttemptedRef.current = true;
    void handleJoin(inviteValue);
  }, [inviteValue, user]);

  const handleJoin = async (value = inviteValue) => {
    if (!value.trim()) {
      Alert.alert(
        t('shared.joinErrorTitle', 'Invite needed'),
        t('shared.joinErrorBody', 'Paste a valid invite link to connect.')
      );
      return;
    }

    if (!user) {
      router.push('/auth');
      return;
    }

    setJoining(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await acceptFriendInvite(value);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        t('shared.joinSuccessTitle', 'You’re connected'),
        t('shared.joinSuccessBody', 'You can now share moments from Home.')
      );
      router.replace('/(tabs)' as any);
    } catch (error) {
      Alert.alert(t('shared.joinFailedTitle', 'Could not join'), getSharedFeedErrorMessage(error));
    } finally {
      setJoining(false);
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
            {t('shared.joinTitle', 'Join Friends')}
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('shared.joinHeroTitle', 'Step into the shared feed from one link')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
            {t('shared.joinBody', 'Accept an invite to start sharing moments together.')}
          </Text>
        </Animated.View>

        {!user ? (
          <Animated.View entering={FadeInUp.delay(80).springify().damping(18).mass(0.8)} style={styles.formRow}>
            <View
              style={[
                styles.formCard,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.72)',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.88)',
                },
              ]}
            >
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {t('shared.signInTitle', 'Sign in to share with friends')}
              </Text>
              <Text style={[styles.cardBody, { color: colors.secondaryText }]}>
                {isAuthAvailable
                  ? t('shared.signInBody', 'Connect your account to start a private shared feed with friends.')
                  : t('shared.unavailableBody', 'This build does not have shared social enabled right now.')}
              </Text>
              {isAuthAvailable ? (
                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push('/auth');
                  }}
                  style={({ pressed }) => [
                    styles.primaryAction,
                    {
                      backgroundColor: colors.primary,
                      opacity: pressed ? 0.92 : 1,
                      transform: [{ scale: pressed ? 0.985 : 1 }],
                    },
                  ]}
                >
                  <Ionicons name="person-circle-outline" size={18} color="#1C1C1E" />
                  <Text style={styles.primaryActionText}>{t('shared.signInButton', 'Sign in')}</Text>
                </Pressable>
              ) : null}
            </View>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInUp.delay(80).springify().damping(18).mass(0.8)} style={styles.formRow}>
            <View
              style={[
                styles.formCard,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.72)',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.88)',
                },
              ]}
            >
              <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="share-social-outline" size={20} color={colors.primary} />
              </View>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {t('shared.joinButton', 'Join friend feed')}
              </Text>
              <Text style={[styles.cardBody, { color: colors.secondaryText }]}>
                {t('shared.joinPrompt', 'Paste the invite link your friend sent and Home will start showing shared moments.')}
              </Text>
              <TextInput
                value={inviteValue}
                onChangeText={setInviteValue}
                placeholder={t('shared.joinPlaceholder', 'Paste the full invite link')}
                placeholderTextColor={colors.secondaryText}
                style={[
                  styles.input,
                  {
                    backgroundColor: softInputBackground,
                    color: colors.text,
                  },
                ]}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
                textAlignVertical="top"
              />
            </View>
          </Animated.View>
        )}
      </ScrollView>

      {user ? (
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
                    {t('shared.joinButton', 'Join friend feed')}
                  </Text>
                  <Text style={[styles.footerBody, { color: colors.secondaryText }]}>
                    {t('shared.joinFooterBody', 'Once this invite is accepted, the Home shared strip will start filling in automatically.')}
                  </Text>
                </View>

                <Pressable
                  onPress={() => {
                    void handleJoin();
                  }}
                  disabled={!inviteValue.trim() || joining}
                  style={({ pressed }) => [
                    styles.primaryAction,
                    {
                      backgroundColor: colors.primary,
                      opacity: !inviteValue.trim() || joining ? 0.55 : pressed ? 0.92 : 1,
                      transform: [{ scale: pressed ? 0.985 : 1 }],
                    },
                  ]}
                >
                  {joining ? (
                    <ActivityIndicator color="#1C1C1E" />
                  ) : (
                    <>
                      <Ionicons name="enter-outline" size={18} color="#1C1C1E" />
                      <Text style={styles.primaryActionText}>
                        {t('shared.joinButton', 'Join friend feed')}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      ) : null}
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
    minHeight: 150,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    marginTop: 18,
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
    marginTop: 18,
  },
  primaryActionText: {
    color: '#1C1C1E',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
});
