import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import AppSheet from '../../sheets/AppSheet';
import AppSheetScaffold from '../../sheets/AppSheetScaffold';
import FriendInviteJoinBody from '../../friends/FriendInviteJoinBody';
import { useAuth } from '../../../hooks/useAuth';
import { useFriendInviteJoin } from '../../../hooks/useFriendInviteJoin';
import { useTheme } from '../../../hooks/useTheme';

function buildReturnToJoinHref(
  inviteId: string | undefined,
  invite: string | undefined,
  fallbackInviteValue: string
) {
  const queryParams: string[] = [];
  const normalizedInviteId = inviteId?.trim();
  const normalizedInvite = invite?.trim() || fallbackInviteValue.trim();

  if (normalizedInviteId) {
    queryParams.push(`inviteId=${encodeURIComponent(normalizedInviteId)}`);
  }

  if (normalizedInvite) {
    queryParams.push(`invite=${encodeURIComponent(normalizedInvite)}`);
  }

  return queryParams.length > 0 ? `/friends/join?${queryParams.join('&')}` : '/friends/join';
}

export default function FriendJoinScreen() {
  const { inviteId, invite } = useLocalSearchParams<{ inviteId?: string; invite?: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { user, isAuthAvailable } = useAuth();
  const router = useRouter();
  const [inviteValue, setInviteValue] = useState('');
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
      router.replace(
        {
          pathname: '/auth',
          params: {
            returnTo: buildReturnToJoinHref(inviteId, invite, inviteValue),
          },
        } as any
      );
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
  }, [invite, inviteId, inviteValue, router]);

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

  const { joining, joinInvite } = useFriendInviteJoin({
    inviteValue,
    onRequireAuth: () => dismissTo('auth'),
    onJoined: () => {
      router.replace({
        pathname: '/',
        params: {
          openSharedManageAt: String(Date.now()),
        },
      } as any);
    },
  });

  useEffect(() => {
    if (!user || autoAttemptedRef.current || !inviteValue.trim()) {
      return;
    }

    autoAttemptedRef.current = true;
    void joinInvite(inviteValue);
  }, [inviteValue, joinInvite, user]);

  return (
    <AppSheet
      visible={isPresented}
      onClose={() => {
        setIsPresented(false);
        scheduleDismiss(40);
      }}
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
          <FriendInviteJoinBody
            user={user}
            isAuthAvailable={isAuthAvailable}
            inviteValue={inviteValue}
            joining={joining}
            bottomPadding={Platform.OS === 'ios' ? 0 : 4}
            onChangeInvite={setInviteValue}
            onSubmit={() => {
              void joinInvite();
            }}
            onGoToAuth={() => dismissTo('auth')}
          />
        </AppSheetScaffold>
      </KeyboardAvoidingView>
    </AppSheet>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 46,
    height: 46,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
