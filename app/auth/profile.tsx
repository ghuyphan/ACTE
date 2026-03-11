import { useHeaderHeight } from '@react-navigation/elements';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PrimaryButton from '../../components/ui/PrimaryButton';
import { Layout, Typography } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';

function ProfileRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.detailRow, { borderTopColor: colors.border }]}>
      <Text style={[styles.detailLabel, { color: colors.secondaryText }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { user, isAvailable, signOut } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const fallbackName = t('settings.notSignedIn', 'Not signed in');
  const profileName = user?.displayName || user?.email || fallbackName;
  const avatarLabel = useMemo(() => {
    const base = user?.displayName || user?.email || 'C';
    return base.trim().charAt(0).toUpperCase();
  }, [user?.displayName, user?.email]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      router.replace('/(tabs)/settings');
    } finally {
      setIsSigningOut(false);
    }
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
          {t('profile.description', 'Manage the Google account connected to Charmly.')}
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
                  <Text style={[styles.name, { color: colors.text }]}>{profileName}</Text>
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
                value={user.displayName || t('profile.noName', 'Google account')}
              />
              {user.email ? (
                <ProfileRow label={t('profile.email', 'Email')} value={user.email} />
              ) : null}
              <Text style={[styles.hint, { color: colors.secondaryText }]}>
                {t('profile.syncHint', 'Use Settings to sync your local notes with Firebase.')}
              </Text>
            </View>

            <PrimaryButton
              label={t('profile.logout', 'Log out')}
              onPress={() => {
                void handleSignOut();
              }}
              loading={isSigningOut}
              variant="destructive"
            />
          </>
        ) : (
          <>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {t('profile.signedOutTitle', 'No account connected')}
              </Text>
              <Text style={[styles.hint, { color: colors.secondaryText }]}>
                {isAvailable
                  ? t(
                      'profile.signedOutMsg',
                      'Sign in with Google to connect Firebase sync for this device.'
                    )
                  : t(
                      'settings.localModeDetail',
                      'This build is ready to use offline. Optional sync can be added later without changing your local notes.'
                    )}
              </Text>
            </View>

            {isAvailable ? (
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
