import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import PrimaryButton from '../ui/PrimaryButton';
import type { ThemeColors } from '../../hooks/useTheme';
import { Layout, Typography } from '../../constants/theme';
import { useProfileScreenModel } from './useProfileScreenModel';

function SectionTitle({
  colors,
  title,
}: {
  colors: ThemeColors;
  title: string;
}) {
  return <Text style={[styles.sectionTitle, { color: colors.secondaryText }]}>{title}</Text>;
}

function Card({
  children,
  colors,
}: {
  children: React.ReactNode;
  colors: ThemeColors;
}) {
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      {children}
    </View>
  );
}

function CardDivider({ colors }: { colors: ThemeColors }) {
  return <View style={[styles.cardDivider, { backgroundColor: colors.border }]} />;
}

function DetailRow({
  colors,
  label,
  value,
}: {
  colors: ThemeColors;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowCopy}>
        <Text style={[styles.rowLabel, { color: colors.secondaryText }]}>{label}</Text>
        <Text style={[styles.rowValue, { color: colors.text }]}>{value}</Text>
      </View>
    </View>
  );
}

function LinkRow({
  colors,
  label,
  onPress,
  destructive = false,
}: {
  colors: ThemeColors;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.linkRow, pressed ? styles.rowPressed : null]}>
      <Text style={[styles.linkLabel, { color: destructive ? colors.danger : colors.text }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={destructive ? colors.danger : colors.secondaryText} />
    </Pressable>
  );
}

export default function ProfileScreenAndroid() {
  const {
    avatarLabel,
    colors,
    insets,
    isAuthAvailable,
    isDeletingAccount,
    isSigningOut,
    membershipLabel,
    openAccountDeletionHelpLink,
    openPrivacyPolicyLink,
    openSignIn,
    openSupportLink,
    profileName,
    providerLabel,
    showAccountDeletionLink,
    showPrivacyPolicyLink,
    showSupportLink,
    syncSummary,
    syncValue,
    t,
    tier,
    user,
    handleDeleteAccount,
    handleSignOut,
  } = useProfileScreenModel();

  const contentTopInset = insets.top + 72;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: contentTopInset, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {user ? (
          <>
            <Card colors={colors}>
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
                    <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
                      {profileName}
                    </Text>
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
                    <Text style={[styles.email, { color: colors.secondaryText }]} numberOfLines={1}>
                      {user.email}
                    </Text>
                  ) : null}
                  <Text style={[styles.heroMeta, { color: colors.secondaryText }]}>
                    {providerLabel}
                  </Text>
                </View>
              </View>
            </Card>

            <View style={styles.section}>
              <SectionTitle colors={colors} title={t('profile.accountTitle', 'Connected account')} />
              <Card colors={colors}>
                <DetailRow colors={colors} label={t('profile.name', 'Name')} value={user.displayName || t('profile.noName', 'Noto account')} />
                <CardDivider colors={colors} />
                <DetailRow colors={colors} label={t('profile.membership', 'Membership')} value={membershipLabel} />
                {user.email ? (
                  <>
                    <CardDivider colors={colors} />
                    <DetailRow colors={colors} label={t('profile.email', 'Email')} value={user.email} />
                  </>
                ) : null}
                <CardDivider colors={colors} />
                <DetailRow colors={colors} label={t('profile.provider', 'Sign-in method')} value={providerLabel} />
                <CardDivider colors={colors} />
                <DetailRow colors={colors} label={t('profile.sync', 'Sync')} value={syncValue} />
                {syncSummary ? (
                  <>
                    <CardDivider colors={colors} />
                    <Text style={[styles.hint, { color: colors.secondaryText }]}>{syncSummary}</Text>
                  </>
                ) : null}
              </Card>
            </View>

            {(showPrivacyPolicyLink || showSupportLink || showAccountDeletionLink) ? (
              <View style={styles.section}>
                <SectionTitle colors={colors} title={t('profile.legalTitle', 'Privacy & support')} />
                <Card colors={colors}>
                  {showPrivacyPolicyLink ? (
                    <LinkRow
                      colors={colors}
                      label={t('settings.privacyPolicy', 'Privacy Policy')}
                      onPress={openPrivacyPolicyLink}
                    />
                  ) : null}
                  {showPrivacyPolicyLink && (showSupportLink || showAccountDeletionLink) ? <CardDivider colors={colors} /> : null}
                  {showSupportLink ? (
                    <LinkRow
                      colors={colors}
                      label={t('settings.support', 'Support')}
                      onPress={openSupportLink}
                    />
                  ) : null}
                  {showSupportLink && showAccountDeletionLink ? <CardDivider colors={colors} /> : null}
                  {showAccountDeletionLink ? (
                    <LinkRow
                      colors={colors}
                      label={t('settings.accountDeletion', 'Account deletion help')}
                      onPress={openAccountDeletionHelpLink}
                    />
                  ) : null}
                </Card>
              </View>
            ) : null}

            <View style={styles.section}>
              <SectionTitle colors={colors} title={t('profile.logout', 'Log out')} />
              <Card colors={colors}>
                <View style={styles.actions}>
                  <PrimaryButton
                    label={t('profile.logout', 'Log out')}
                    onPress={handleSignOut}
                    loading={isSigningOut && !isDeletingAccount}
                    variant="neutral"
                    style={styles.fullWidthButton}
                  />
                  <PrimaryButton
                    label={t('profile.deleteAccount', 'Delete account')}
                    onPress={handleDeleteAccount}
                    loading={isDeletingAccount}
                    variant="secondary"
                    style={styles.fullWidthButton}
                  />
                </View>
              </Card>
            </View>
          </>
        ) : (
          <>
            <Card colors={colors}>
              <View style={[styles.avatarFallback, styles.signedOutAvatar, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="person-outline" size={30} color={colors.primary} />
              </View>
              <Text style={[styles.name, { color: colors.text }]}>{t('profile.signedOutTitle', 'No account connected')}</Text>
              {!isAuthAvailable ? (
                <Text style={[styles.hint, { color: colors.secondaryText }]}>
                  {t(
                    'profile.unavailableMsg',
                    'Account sign-in is unavailable right now, but your notes stay safely on this device.'
                  )}
                </Text>
              ) : null}
            </Card>

            {isAuthAvailable ? (
              <PrimaryButton
                label={t('settings.login', 'Sign In')}
                onPress={openSignIn}
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
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginLeft: 4,
    fontFamily: 'System',
  },
  card: {
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
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
  signedOutAvatar: {
    marginTop: 20,
    marginHorizontal: 20,
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
  heroMeta: {
    ...Typography.pill,
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
  row: {
    minHeight: 60,
    paddingHorizontal: 20,
    paddingVertical: 14,
    justifyContent: 'center',
  },
  rowCopy: {
    gap: 4,
  },
  rowLabel: {
    ...Typography.pill,
    fontSize: 13,
  },
  rowValue: {
    ...Typography.body,
    fontSize: 16,
  },
  linkRow: {
    minHeight: 58,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  linkLabel: {
    ...Typography.button,
    flex: 1,
  },
  rowPressed: {
    opacity: 0.84,
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 20,
  },
  hint: {
    ...Typography.body,
    fontSize: 14,
    lineHeight: 21,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  actions: {
    padding: 20,
    gap: 12,
  },
  fullWidthButton: {
    width: '100%',
  },
});
