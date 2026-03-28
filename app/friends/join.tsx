import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AppSheet from '../../components/AppSheet';
import AppSheetScaffold from '../../components/AppSheetScaffold';
import PrimaryButton from '../../components/ui/PrimaryButton';
import { Typography } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { useSharedFeedStore } from '../../hooks/useSharedFeed';
import { useTheme } from '../../hooks/useTheme';
import { getSharedFeedErrorMessage } from '../../services/sharedFeedService';

function JoinSheetBody({
  user,
  isAuthAvailable,
  inviteValue,
  joining,
  bottomPadding,
  onChangeInvite,
  onSubmit,
  onGoToAuth,
}: {
  user: ReturnType<typeof useAuth>['user'];
  isAuthAvailable: boolean;
  inviteValue: string;
  joining: boolean;
  bottomPadding: number;
  onChangeInvite: (value: string) => void;
  onSubmit: () => void;
  onGoToAuth: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <View style={[styles.content, { paddingBottom: bottomPadding }]}>
      {user ? (
        <View style={styles.formBlock}>
          <Text style={[styles.fieldLabel, { color: colors.secondaryText }]}>
            {t('shared.joinCardTitle', 'Invite link')}
          </Text>
          <TextInput
            value={inviteValue}
            onChangeText={onChangeInvite}
            placeholder={t('shared.joinPlaceholder', 'Paste the full invite link')}
            placeholderTextColor={colors.secondaryText}
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </View>
      ) : null}

      <PrimaryButton
        label={user ? t('shared.joinButton', 'Continue') : t('shared.signInButton', 'Sign in')}
        onPress={() => {
          if (user) {
            onSubmit();
            return;
          }

          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onGoToAuth();
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

      {user && inviteValue.trim() ? (
        <View
          style={[
            styles.helperCard,
            {
              backgroundColor: colors.primarySoft,
              borderColor: colors.primary + '22',
            },
          ]}
        >
          <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
          <Text style={[styles.helperText, { color: colors.text }]}>
            {t('shared.joinFooterBody', 'We’ll connect you as soon as this invite checks out.')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default function FriendJoinScreen() {
  const { inviteId, invite } = useLocalSearchParams<{ inviteId?: string; invite?: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { user, isAuthAvailable } = useAuth();
  const { acceptFriendInvite } = useSharedFeedStore();
  const router = useRouter();
  const [inviteValue, setInviteValue] = useState('');
  const [joining, setJoining] = useState(false);
  const [isPresented, setIsPresented] = useState(true);
  const dismissTargetRef = useRef<'tabs' | 'auth'>('tabs');
  const autoAttemptedRef = useRef(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didFinishDismissRef = useRef(false);

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

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, []);

  const finishDismiss = useCallback(() => {
    if (didFinishDismissRef.current) {
      return;
    }

    didFinishDismissRef.current = true;
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }

    const target = dismissTargetRef.current;
    if (target === 'auth') {
      router.replace('/auth' as any);
      return;
    }

    if (router.canDismiss()) {
      router.dismiss();
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/' as any);
  }, [router]);

  const scheduleDismiss = useCallback((delay: number) => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
    }

    dismissTimerRef.current = setTimeout(() => {
      dismissTimerRef.current = null;
      finishDismiss();
    }, delay);
  }, [finishDismiss]);

  const dismissTo = useCallback((target: 'tabs' | 'auth' = 'tabs') => {
    if (didFinishDismissRef.current) {
      return;
    }

    dismissTargetRef.current = target;
    setIsPresented(false);
    scheduleDismiss(260);
  }, [scheduleDismiss]);

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
        dismissTo('auth');
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
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/' as any);
        }
      } catch (error) {
        Alert.alert(t('shared.joinFailedTitle', 'Could not join'), getSharedFeedErrorMessage(error));
      } finally {
        setJoining(false);
      }
    },
    [acceptFriendInvite, dismissTo, inviteValue, router, t, user]
  );

  useEffect(() => {
    if (!user || autoAttemptedRef.current || !inviteValue.trim()) {
      return;
    }

    autoAttemptedRef.current = true;
    void handleJoin(inviteValue);
  }, [handleJoin, inviteValue, user]);

  return (
    <AppSheet
      visible={isPresented}
      onClose={() => {
        setIsPresented(false);
        scheduleDismiss(40);
      }}
    >
      <KeyboardAvoidingView behavior="padding">
        <AppSheetScaffold
          headerVariant="action"
          title={t('shared.joinTitle', 'Join a friend')}
          subtitle={
            user
              ? t('shared.joinBody', 'Paste the invite link to connect and start sharing on Home.')
              : isAuthAvailable
                ? t('shared.joinSignInBody', 'Sign in first so we can connect you to this friend.')
                : t('shared.unavailableBody', 'This build does not have shared social enabled right now.')
          }
          headerTop={(
            <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
              <Ionicons
                name={user ? 'link-outline' : 'person-circle-outline'}
                size={20}
                color={colors.primary}
              />
            </View>
          )}
          trailingAction={{
            icon: 'close',
            accessibilityLabel: t('common.close', 'Close'),
            onPress: () => dismissTo('tabs'),
          }}
        >
          <JoinSheetBody
            user={user}
            isAuthAvailable={isAuthAvailable}
            inviteValue={inviteValue}
            joining={joining}
            bottomPadding={Platform.OS === 'ios' ? 0 : 4}
            onChangeInvite={setInviteValue}
            onSubmit={() => {
              void handleJoin();
            }}
            onGoToAuth={() => dismissTo('auth')}
          />
        </AppSheetScaffold>
      </KeyboardAvoidingView>
    </AppSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 18,
  },
  badge: {
    width: 46,
    height: 46,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formBlock: {
    gap: 8,
  },
  fieldLabel: {
    ...Typography.pill,
    fontSize: 13,
  },
  input: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...Typography.body,
  },
  primaryAction: {
    width: '100%',
    marginTop: 22,
  },
  helperCard: {
    marginTop: 16,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  helperText: {
    ...Typography.body,
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
