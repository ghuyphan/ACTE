import { BottomSheet, Group, Host, RNHostView } from '@expo/ui/swift-ui';
import { environment, presentationDragIndicator } from '@expo/ui/swift-ui/modifiers';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import PrimaryButton from '../../components/ui/PrimaryButton';
import { Layout, Shadows, Typography } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { useSharedFeedStore } from '../../hooks/useSharedFeed';
import { useTheme } from '../../hooks/useTheme';
import { getSharedFeedErrorMessage } from '../../services/sharedFeedService';
import { isOlderIOS } from '../../utils/platform';

function JoinSheetBody({
  user,
  isAuthAvailable,
  inviteValue,
  joining,
  bottomPadding,
  onChangeInvite,
  onSubmit,
  onClose,
  onGoToAuth,
}: {
  user: ReturnType<typeof useAuth>['user'];
  isAuthAvailable: boolean;
  inviteValue: string;
  joining: boolean;
  bottomPadding: number;
  onChangeInvite: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  onGoToAuth: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <View style={[styles.content, { paddingBottom: bottomPadding }]}>
      <View style={styles.headerRow}>
        <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
          <Ionicons
            name={user ? 'link-outline' : 'person-circle-outline'}
            size={20}
            color={colors.primary}
          />
        </View>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [
            styles.closeButton,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Ionicons name="close" size={18} color={colors.text} />
        </Pressable>
      </View>

      <Text style={[styles.title, { color: colors.text }]}>
        {t('shared.joinTitle', 'Join a friend')}
      </Text>
      <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
        {user
          ? t('shared.joinBody', 'Paste the invite link to connect and start sharing on Home.')
          : isAuthAvailable
            ? t('shared.joinSignInBody', 'Sign in first so we can connect you to this friend.')
            : t('shared.unavailableBody', 'This build does not have shared social enabled right now.')}
      </Text>

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
  const { colors, isDark } = useTheme();
  const { user, isAuthAvailable } = useAuth();
  const { acceptFriendInvite } = useSharedFeedStore();
  const router = useRouter();
  const [inviteValue, setInviteValue] = useState('');
  const [joining, setJoining] = useState(false);
  const [isPresented, setIsPresented] = useState(true);
  const dismissTargetRef = useRef<'tabs' | 'auth'>('tabs');
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

  const finishDismiss = useCallback(() => {
    const target = dismissTargetRef.current;
    router.replace((target === 'auth' ? '/auth' : '/(tabs)') as any);
  }, [router]);

  const dismissTo = useCallback((target: 'tabs' | 'auth' = 'tabs') => {
    dismissTargetRef.current = target;

    if (Platform.OS === 'ios') {
      setIsPresented(false);
      return;
    }

    finishDismiss();
  }, [finishDismiss]);

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
        router.replace('/(tabs)' as any);
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

  if (Platform.OS === 'ios') {
    return (
      <View pointerEvents={isPresented ? 'auto' : 'none'} style={StyleSheet.absoluteFill}>
        <Host style={StyleSheet.absoluteFill} colorScheme={isDark ? 'dark' : 'light'}>
          <BottomSheet
            isPresented={isPresented}
            onIsPresentedChange={(next) => {
              setIsPresented(next);
              if (!next) {
                finishDismiss();
              }
            }}
            fitToContents
          >
            <Group modifiers={[presentationDragIndicator('visible'), environment('colorScheme', isDark ? 'dark' : 'light')]}>
              <RNHostView matchContents>
                <KeyboardAvoidingView behavior="padding">
                  <View
                    style={[
                      styles.iosContainer,
                      isOlderIOS
                        ? {
                            backgroundColor: colors.card,
                            borderTopLeftRadius: 10,
                            borderTopRightRadius: 10,
                          }
                        : null,
                    ]}
                  >
                    <JoinSheetBody
                      user={user}
                      isAuthAvailable={isAuthAvailable}
                      inviteValue={inviteValue}
                      joining={joining}
                      bottomPadding={24}
                      onChangeInvite={setInviteValue}
                      onSubmit={() => {
                        void handleJoin();
                      }}
                      onClose={() => dismissTo('tabs')}
                      onGoToAuth={() => dismissTo('auth')}
                    />
                  </View>
                </KeyboardAvoidingView>
              </RNHostView>
            </Group>
          </BottomSheet>
        </Host>
      </View>
    );
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => dismissTo('tabs')}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={() => dismissTo('tabs')} />
        <View style={[styles.androidSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <JoinSheetBody
            user={user}
            isAuthAvailable={isAuthAvailable}
            inviteValue={inviteValue}
            joining={joining}
            bottomPadding={20}
            onChangeInvite={setInviteValue}
            onSubmit={() => {
              void handleJoin();
            }}
            onClose={() => dismissTo('tabs')}
            onGoToAuth={() => dismissTo('auth')}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  iosContainer: {
    backgroundColor: 'transparent',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
    padding: Layout.screenPadding,
  },
  androidSheet: {
    borderRadius: 28,
    borderWidth: 1,
    ...Shadows.floating,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    width: 46,
    height: 46,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: 18,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    ...Typography.body,
    marginTop: 10,
  },
  formBlock: {
    marginTop: 22,
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
