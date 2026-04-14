import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '../../../hooks/useHaptics';
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
import FriendInviteJoinBody, { FriendJoinMode } from '../../friends/FriendInviteJoinBody';
import { useAuth } from '../../../hooks/useAuth';
import { useFriendInviteJoin } from '../../../hooks/useFriendInviteJoin';
import { useSharedFeedStore } from '../../../hooks/useSharedFeed';
import { useTheme } from '../../../hooks/useTheme';
import { normalizeUsernameInput } from '../../../services/publicProfileService';
import {
  getSharedFeedErrorMessage,
  normalizeFriendInviteInput,
} from '../../../services/sharedFeedService';
import { showAppAlert } from '../../../utils/alert';

function buildReturnToJoinHref(
  inviteId: string | undefined,
  invite: string | undefined,
  fallbackInviteValue: string,
  mode: FriendJoinMode,
  usernameValue: string
) {
  const queryParams: string[] = [];
  const normalizedInviteId = inviteId?.trim();
  const normalizedInvite = invite?.trim() || normalizeFriendInviteInput(fallbackInviteValue);
  const normalizedUsername = normalizeUsernameInput(usernameValue);

  if (mode === 'invite') {
    if (normalizedInviteId) {
      queryParams.push(`inviteId=${encodeURIComponent(normalizedInviteId)}`);
    }

    if (normalizedInvite) {
      queryParams.push(`invite=${encodeURIComponent(normalizedInvite)}`);
    }
  } else if (normalizedUsername) {
    queryParams.push('mode=username');
    queryParams.push(`username=${encodeURIComponent(normalizedUsername)}`);
  }

  return queryParams.length > 0 ? `/friends/join?${queryParams.join('&')}` : '/friends/join';
}

export default function FriendJoinScreen() {
  const {
    inviteId,
    invite,
    mode: modeParam,
    username,
  } = useLocalSearchParams<{
    inviteId?: string;
    invite?: string;
    mode?: string;
    username?: string;
  }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { user, isAuthAvailable } = useAuth();
  const { findFriendByUsername, addFriendByUsername } = useSharedFeedStore();
  const router = useRouter();
  const [inviteValue, setInviteValue] = useState('');
  const [usernameValue, setUsernameValue] = useState('');
  const [joinMode, setJoinMode] = useState<FriendJoinMode>('username');
  const [searching, setSearching] = useState(false);
  const [addingFriend, setAddingFriend] = useState(false);
  const [searchResult, setSearchResult] = useState<Awaited<ReturnType<typeof findFriendByUsername>> | null>(null);
  const [isPresented, setIsPresented] = useState(true);
  const dismissTargetRef = useRef<'tabs' | 'auth'>('tabs');
  const autoAttemptedRef = useRef(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didFinishDismissRef = useRef(false);

  useEffect(() => {
    const hasInviteId = typeof inviteId === 'string' && inviteId.trim();
    const hasInvite = typeof invite === 'string' && invite.trim();
    const hasUsername = typeof username === 'string' && normalizeUsernameInput(username).length > 0;

    if (hasInviteId && hasInvite) {
      setInviteValue(normalizeFriendInviteInput(
        Linking.createURL('/friends/join', {
          queryParams: {
            inviteId: inviteId!.trim(),
            invite: invite!.trim(),
          },
        })
      ));
      setJoinMode('invite');
      return;
    }

    if (hasInvite) {
      setInviteValue(normalizeFriendInviteInput(invite!.trim()));
      setJoinMode('invite');
      return;
    }

    if (hasUsername) {
      setUsernameValue(normalizeUsernameInput(username!));
      setJoinMode('username');
      return;
    }

    if (modeParam === 'invite') {
      setJoinMode('invite');
      return;
    }

    setJoinMode('username');
  }, [invite, inviteId, modeParam, username]);

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
            returnTo: buildReturnToJoinHref(
              inviteId,
              invite,
              inviteValue,
              joinMode,
              usernameValue
            ),
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
  }, [invite, inviteId, inviteValue, joinMode, router, usernameValue]);

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
    if (!user || autoAttemptedRef.current || !inviteValue.trim() || joinMode !== 'invite') {
      return;
    }

    autoAttemptedRef.current = true;
    void joinInvite(inviteValue);
  }, [inviteValue, joinInvite, joinMode, user]);

  const handleUsernameChange = useCallback((value: string) => {
    setUsernameValue(value);
    setSearchResult((current) => {
      const normalizedValue = normalizeUsernameInput(value);
      if (!current || current.username === normalizedValue) {
        return current;
      }
      return null;
    });
  }, []);

  const handleSearchByUsername = useCallback(async () => {
    const normalizedUsername = normalizeUsernameInput(usernameValue);

    if (!normalizedUsername) {
      showAppAlert(
        t('shared.searchByUsernameMissingTitle', 'Noto ID needed'),
        t('shared.searchByUsernameMissingBody', 'Enter a Noto ID to search.')
      );
      return;
    }

    if (!user) {
      dismissTo('auth');
      return;
    }

    setSearching(true);
    setSearchResult(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const result = await findFriendByUsername(normalizedUsername);
      setSearchResult(result);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      showAppAlert(
        t('shared.searchByUsernameFailedTitle', 'Could not find friend'),
        getSharedFeedErrorMessage(error)
      );
    } finally {
      setSearching(false);
    }
  }, [dismissTo, findFriendByUsername, t, user, usernameValue]);

  const handleAddFriend = useCallback(async () => {
    if (!searchResult) {
      return;
    }

    if (!user) {
      dismissTo('auth');
      return;
    }

    if (searchResult.isSelf || searchResult.alreadyFriends) {
      return;
    }

    setAddingFriend(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await addFriendByUsername(searchResult.username);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAppAlert(
        t('shared.addFriendSuccessTitle', "You're connected"),
        t('shared.addFriendSuccessBody', 'You can now share notes with this friend from Home.')
      );
      router.replace({
        pathname: '/',
        params: {
          openSharedManageAt: String(Date.now()),
        },
      } as any);
    } catch (error) {
      showAppAlert(
        t('shared.addFriendFailedTitle', 'Could not add friend'),
        getSharedFeedErrorMessage(error)
      );
    } finally {
      setAddingFriend(false);
    }
  }, [addFriendByUsername, dismissTo, router, searchResult, t, user]);

  return (
    <AppSheet
      visible={isPresented}
      onClose={() => {
        setIsPresented(false);
        scheduleDismiss(40);
      }}
      androidKeyboardInputMode="adjustPan"
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <AppSheetScaffold
          headerVariant="action"
          title={t('shared.joinTitle', 'Join a friend')}
          subtitle={
            user
              ? joinMode === 'username'
                ? t(
                    'shared.searchByUsernameBody',
                    'Search a Noto ID to connect and start sharing on Home.'
                  )
                : t('shared.joinBody', 'Paste the invite link to connect and start sharing on Home.')
              : isAuthAvailable
                ? t('shared.joinSignInBody', 'Sign in first so we can connect you to this friend.')
                : t('shared.unavailableBody', 'This build does not have shared social enabled right now.')
          }
          headerTop={(
            <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
              <Ionicons
                name={user ? (joinMode === 'username' ? 'search-outline' : 'link-outline') : 'person-circle-outline'}
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
            mode={joinMode}
            inviteValue={inviteValue}
            usernameValue={usernameValue}
            joining={joining}
            searching={searching}
            addingFriend={addingFriend}
            searchResult={searchResult}
            bottomPadding={Platform.OS === 'ios' ? 0 : 4}
            onChangeMode={(nextMode) => {
              setJoinMode(nextMode);
            }}
            onChangeInvite={(nextValue) => {
              setInviteValue(normalizeFriendInviteInput(nextValue));
            }}
            onChangeUsername={handleUsernameChange}
            onSubmitInvite={() => {
              void joinInvite();
            }}
            onSearchByUsername={() => {
              void handleSearchByUsername();
            }}
            onAddFriend={() => {
              void handleAddFriend();
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
