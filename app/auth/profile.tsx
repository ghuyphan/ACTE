import { useHeaderHeight } from '@react-navigation/elements';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { useMemo, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PrimaryButton from '../../components/ui/PrimaryButton';
import { Layout, Typography } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { useConnectivity } from '../../hooks/useConnectivity';
import { useNotes } from '../../hooks/useNotes';
import { useSubscription } from '../../hooks/useSubscription';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import { useTheme } from '../../hooks/useTheme';
import { deleteAllNotesForScope, getAllNotesForScope } from '../../services/database';
import { clearGeofenceRegions } from '../../services/geofenceService';
import {
  hasAccountDeletionLink,
  hasPrivacyPolicyLink,
  hasSupportLink,
  openAccountDeletionHelp,
  openPrivacyPolicy,
  openSupport,
} from '../../services/legalLinks';
import { getNotePhotoUri } from '../../services/photoStorage';

function ProfileRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.detailRow, { borderTopColor: colors.border }]}>
      <Text style={[styles.detailLabel, { color: colors.secondaryText }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function getProviderLabel(providerId: string, fallback: string) {
  switch (providerId) {
    case 'google.com':
      return 'Google';
    case 'password':
      return fallback;
    default:
      return providerId;
  }
}

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { user, isAuthAvailable, deleteAccount, signOut } = useAuth();
  const { isOnline } = useConnectivity();
  const { refreshNotes } = useNotes();
  const { tier } = useSubscription();
  const { blockedCount, failedCount, pendingCount, status: syncStatus, lastSyncedAt, lastMessage } = useSyncStatus();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const fallbackName = t('settings.notSignedIn', 'Not signed in');
  const profileName = user?.displayName || user?.email || fallbackName;
  const avatarLabel = useMemo(() => {
    const base = user?.displayName || user?.email || 'C';
    return base.trim().charAt(0).toUpperCase();
  }, [user?.displayName, user?.email]);

  const providerLabel = useMemo(() => {
    if (!user) {
      return t('profile.providerEmail', 'Email');
    }

    const labels = user.providerData
      .map((provider) => provider.providerId)
      .filter(Boolean)
      .map((providerId) => getProviderLabel(providerId, t('profile.providerEmail', 'Email')));

    if (labels.length === 0) {
      return t('profile.providerEmail', 'Email');
    }

    return Array.from(new Set(labels)).join(', ');
  }, [t, user]);

  const syncSummary = useMemo(() => {
    if (!user) {
      return null;
    }

    if (syncStatus === 'syncing') {
      return t('profile.syncingNow', 'Syncing your notes now.');
    }

    if (!isOnline && pendingCount > 0) {
      return t('profile.syncPendingOffline', 'Your notes are saved locally and will sync when you are back online.');
    }

    if (syncStatus === 'success' && lastSyncedAt) {
      return t('profile.lastSynced', 'Last synced {{date}}', {
        date: new Date(lastSyncedAt).toLocaleString(i18n.language, {
          day: 'numeric',
          month: 'short',
          hour: 'numeric',
          minute: '2-digit',
        }),
      });
    }

    if (syncStatus === 'error') {
      return (
        lastMessage ??
        t('profile.syncRetryHint', 'We could not sync right now. We will try again when the app is active.')
      );
    }

    if (blockedCount > 0) {
      return t('profile.syncBlockedHint', 'Some notes need attention before sync can finish.');
    }

    if (failedCount > 0) {
      return t('profile.syncRetryHint', 'We could not sync right now. We will try again when the app is active.');
    }

    return t('profile.autoSyncOn', 'Your notes sync automatically while you are signed in.');
  }, [blockedCount, failedCount, i18n.language, isOnline, lastMessage, lastSyncedAt, pendingCount, syncStatus, t, user]);

  const performSignOut = async () => {
    setIsSigningOut(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/(tabs)/settings');
    
    setTimeout(() => {
      signOut().catch((error) => {
        console.warn('Sign out failed asynchronously:', error);
      });
    }, 150);
  };

  const handleSignOut = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      t('profile.logoutConfirmTitle', 'Log out of Noto?'),
      t('profile.logoutConfirmMsg', 'Your notes will remain safely synced. You can sign back in anytime.'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('profile.logout', 'Log out'),
          style: 'destructive',
          onPress: performSignOut,
        },
      ]
    );
  };

  const handleOpenPrivacyPolicy = () => {
    void openPrivacyPolicy();
  };

  const handleOpenSupport = () => {
    void openSupport();
  };

  const handleDeleteAccount = () => {
    if (!user) {
      return;
    }

    const deletingUserScope = user.uid;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      t('profile.deleteAccountConfirmTitle', 'Delete your Noto account?'),
      t(
        'profile.deleteAccountConfirmMsg',
        'This permanently deletes your account, cloud sync data, shared posts, invites, and notes stored for this account. This cannot be undone.'
      ),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('profile.deleteAccount', 'Delete account'),
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeletingAccount(true);
              const result = await deleteAccount();

              if (result.status !== 'success') {
                if (hasAccountDeletionLink()) {
                  Alert.alert(
                    t('profile.deleteAccountNeedsSupportTitle', 'Need help deleting your account?'),
                    result.message ??
                      t(
                        'profile.deleteAccountNeedsSupportMsg',
                        'This build could not finish the deletion automatically. You can continue from our deletion page or contact support.'
                      ),
                    [
                      { text: t('common.cancel', 'Cancel'), style: 'cancel' },
                      {
                        text: t('profile.deleteAccountHelp', 'Open deletion help'),
                        onPress: () => {
                          void openAccountDeletionHelp();
                        },
                      },
                    ]
                  );
                } else {
                  Alert.alert(
                    t('profile.deleteAccountFailedTitle', 'Could not delete account'),
                    result.message ??
                      t(
                        'profile.deleteAccountFailed',
                        'We could not delete your account right now. Please try again in a moment.'
                      )
                  );
                }
                return;
              }

              const scopedNotes = await getAllNotesForScope(deletingUserScope);
              await deleteAllNotesForScope(deletingUserScope);

              for (const note of scopedNotes) {
                const photoUri = getNotePhotoUri(note);
                if (note.type !== 'photo' || !photoUri) {
                  continue;
                }

                try {
                  const fileInfo = await FileSystem.getInfoAsync(photoUri);
                  if (fileInfo.exists) {
                    await FileSystem.deleteAsync(photoUri, { idempotent: true });
                  }
                } catch (error) {
                  console.warn('Failed to delete account photo file:', error);
                }
              }

              await clearGeofenceRegions().catch(() => undefined);
              await refreshNotes(false).catch(() => undefined);
              router.replace('/(tabs)/settings');
              Alert.alert(
                t('profile.deleteAccountSuccessTitle', 'Account deleted'),
                t(
                  'profile.deleteAccountSuccessMsg',
                  'Your Noto account and synced data have been deleted from this device and the cloud.'
                )
              );
            } finally {
              setIsDeletingAccount(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + 12, paddingBottom: insets.bottom + 32 },
        ]}
      >
        <Text style={[styles.title, { color: colors.text }]}>{t('profile.title', 'Profile')}</Text>
        <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
          {t('profile.description', 'Manage the account connected to Noto.')}
        </Text>

        {user ? (
          <>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.heroRow}>
                {user.photoURL ? (
                  <Image source={{ uri: user.photoURL }} style={styles.avatarImage} />
                ) : (
                  <View style={[styles.avatarFallback, { backgroundColor: colors.primarySoft }]}>
                    <Text style={[styles.avatarLabel, { color: colors.primary }]}>{avatarLabel}</Text>
                  </View>
                )}
                <View style={styles.heroCopy}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.name, { color: colors.text }]}>{profileName}</Text>
                    {tier === 'plus' ? (
                      <View
                        style={[
                          styles.plusBadge,
                          {
                            backgroundColor: colors.primarySoft,
                            borderColor: colors.primary + '33',
                          },
                        ]}
                      >
                        <Text style={[styles.plusBadgeText, { color: colors.primary }]}>
                          {t('profile.plusBadge', 'Noto Plus')}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  {user.email ? (
                    <Text style={[styles.email, { color: colors.secondaryText }]}>{user.email}</Text>
                  ) : null}
                </View>
              </View>

              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {t('profile.accountTitle', 'Connected account')}
              </Text>
              <ProfileRow
                label={t('profile.name', 'Name')}
                value={user.displayName || t('profile.noName', 'Noto account')}
              />
              {user.email ? (
                <ProfileRow label={t('profile.email', 'Email')} value={user.email} />
              ) : null}
              <ProfileRow
                label={t('profile.membership', 'Membership')}
                value={tier === 'plus' ? t('settings.plusTitle', 'Noto Plus') : t('settings.plusInactive', 'Standard')}
              />
              <ProfileRow label={t('profile.provider', 'Sign-in method')} value={providerLabel} />
              <ProfileRow label={t('profile.sync', 'Sync')} value={t('profile.autoSyncShort', 'Auto sync on')} />
              {syncSummary ? (
                <Text style={[styles.hint, { color: colors.secondaryText }]}>{syncSummary}</Text>
              ) : null}
            </View>

            {(hasPrivacyPolicyLink() || hasSupportLink()) ? (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  {t('profile.legalTitle', 'Privacy & support')}
                </Text>
                {hasPrivacyPolicyLink() ? (
                  <PrimaryButton
                    label={t('settings.privacyPolicy', 'Privacy Policy')}
                    onPress={handleOpenPrivacyPolicy}
                    variant="secondary"
                  />
                ) : null}
                {hasSupportLink() ? (
                  <PrimaryButton
                    label={t('settings.support', 'Support')}
                    onPress={handleOpenSupport}
                    variant="secondary"
                  />
                ) : null}
              </View>
            ) : null}

            <PrimaryButton
              label={t('profile.logout', 'Log out')}
              onPress={() => {
                void handleSignOut();
              }}
              loading={isSigningOut && !isDeletingAccount}
              variant="destructive"
            />
            <PrimaryButton
              label={t('profile.deleteAccount', 'Delete account')}
              onPress={handleDeleteAccount}
              loading={isDeletingAccount}
              variant="secondary"
            />
          </>
        ) : (
          <>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {t('profile.signedOutTitle', 'No account connected')}
              </Text>
              {!isAuthAvailable ? (
                <Text style={[styles.hint, { color: colors.secondaryText }]}>
                  {t(
                    'profile.unavailableMsg',
                    'Account sign-in is unavailable right now, but your notes stay safely on this device.'
                  )}
                </Text>
              ) : null}
            </View>

            {isAuthAvailable ? (
              <PrimaryButton
                label={t('settings.login', 'Sign In')}
                onPress={() => router.replace('/auth')}
                variant="neutral"
              />
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Layout.screenPadding,
    gap: 20,
  },
  title: {
    ...Typography.screenTitle,
  },
  subtitle: {
    ...Typography.body,
    marginTop: -8,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    gap: 16,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  heroCopy: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 24,
  },
  avatarFallback: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    ...Typography.heroSubtitle,
    fontSize: 28,
    lineHeight: 32,
  },
  name: {
    ...Typography.button,
    fontSize: 20,
    flexShrink: 1,
  },
  plusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  plusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
    fontFamily: 'System',
  },
  email: {
    ...Typography.body,
  },
  cardTitle: {
    ...Typography.button,
  },
  detailRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
    gap: 4,
  },
  detailLabel: {
    ...Typography.pill,
    fontSize: 13,
  },
  detailValue: {
    ...Typography.body,
  },
  hint: {
    ...Typography.body,
    fontSize: 14,
    lineHeight: 21,
  },
});
