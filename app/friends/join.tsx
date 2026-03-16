import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PrimaryButton from '../../components/ui/PrimaryButton';
import { Layout, Shadows, Typography } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { useSharedFeedStore } from '../../hooks/useSharedFeed';
import { useTheme } from '../../hooks/useTheme';
import { getSharedFeedErrorMessage } from '../../services/sharedFeedService';

export default function FriendJoinScreen() {
  const { inviteId, invite } = useLocalSearchParams<{ inviteId?: string; invite?: string }>();
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const { user, isAuthAvailable } = useAuth();
  const { acceptFriendInvite } = useSharedFeedStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [inviteValue, setInviteValue] = useState('');
  const [joining, setJoining] = useState(false);
  const autoAttemptedRef = useRef(false);

  useEffect(() => {
    if (typeof inviteId === 'string' && inviteId.trim() && typeof invite === 'string' && invite.trim()) {
      setInviteValue(
        Linking.createURL('/friends/join', {
          queryParams: {
            inviteId: inviteId.trim(),
            invite: invite.trim(),
          },
        })
      );
      return;
    }

    if (typeof invite === 'string' && invite.trim()) {
      setInviteValue(invite.trim());
    }
  }, [invite, inviteId]);

  const handleJoin = useCallback(
    async (value = inviteValue) => {
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
          t('shared.joinSuccessTitle', "You're connected"),
          t('shared.joinSuccessBody', 'You can now share notes with this friend from Home.')
        );
        router.replace('/(tabs)' as any);
      } catch (error) {
        Alert.alert(t('shared.joinFailedTitle', 'Could not join'), getSharedFeedErrorMessage(error));
      } finally {
        setJoining(false);
      }
    },
    [acceptFriendInvite, inviteValue, router, t, user]
  );

  useEffect(() => {
    if (!user || autoAttemptedRef.current || !inviteValue.trim()) {
      return;
    }

    autoAttemptedRef.current = true;
    void handleJoin(inviteValue);
  }, [handleJoin, inviteValue, user]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 28,
          paddingBottom: insets.bottom + 28,
          paddingHorizontal: Layout.screenPadding,
        }}
      >
        <Animated.View entering={FadeInUp.springify().damping(18).mass(0.8)} style={styles.content}>
          <View style={styles.header}>
            <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="people-outline" size={22} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>{t('shared.joinTitle', 'Join a friend')}</Text>
            <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
              {t('shared.joinBody', 'Paste the invite link to connect and start sharing on Home.')}
            </Text>
          </View>

          <View
            style={[
              styles.card,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : colors.card,
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : colors.border,
              },
            ]}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              {user
                ? t('shared.joinCardTitle', 'Invite link')
                : t('shared.signInTitle', 'Sign in to connect with friends')}
            </Text>
            <Text style={[styles.cardBody, { color: colors.secondaryText }]}>
              {user
                ? t('shared.joinPrompt', 'Paste the invite link your friend sent.')
                : isAuthAvailable
                  ? t('shared.joinSignInBody', 'Sign in first so we can connect you to this friend.')
                  : t('shared.unavailableBody', 'This build does not have shared social enabled right now.')}
            </Text>

            {user ? (
              <TextInput
                value={inviteValue}
                onChangeText={setInviteValue}
                placeholder={t('shared.joinPlaceholder', 'Paste the full invite link')}
                placeholderTextColor={colors.secondaryText}
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                    color: colors.text,
                  },
                ]}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            ) : null}

            <PrimaryButton
              label={user ? t('shared.joinButton', 'Continue') : t('shared.signInButton', 'Sign in')}
              onPress={() => {
                if (user) {
                  void handleJoin();
                  return;
                }

                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/auth');
              }}
              loading={user ? joining : false}
              disabled={user ? !inviteValue.trim() : !isAuthAvailable}
              leadingIcon={
                <Ionicons
                  name={user ? 'enter-outline' : 'person-circle-outline'}
                  size={18}
                  color="#1C1C1E"
                />
              }
              style={styles.primaryAction}
            />
          </View>

          {user && inviteValue.trim() ? (
            <Text style={[styles.helperText, { color: colors.secondaryText }]}>
              {t('shared.joinFooterBody', 'We’ll connect you as soon as this invite checks out.')}
            </Text>
          ) : null}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: 18,
  },
  header: {
    alignItems: 'center',
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: 16,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.body,
    marginTop: 10,
    textAlign: 'center',
  },
  card: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 22,
    ...Shadows.card,
  },
  cardTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
  },
  cardBody: {
    ...Typography.body,
    marginTop: 8,
  },
  input: {
    minHeight: 56,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    marginTop: 18,
  },
  primaryAction: {
    width: '100%',
    marginTop: 18,
  },
  helperText: {
    ...Typography.body,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});
