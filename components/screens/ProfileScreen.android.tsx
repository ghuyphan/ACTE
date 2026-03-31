import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ThemeColors } from '../../hooks/useTheme';
import { Layout } from '../../constants/theme';
import ProfileAvatar from './ProfileAvatar';
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

function SurfaceCard({
  children,
  colors,
  highlighted = false,
}: {
  children: React.ReactNode;
  colors: ThemeColors;
  highlighted?: boolean;
}) {
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: highlighted ? colors.card : colors.surface,
          borderColor: highlighted ? `${colors.primary}20` : colors.border,
        },
      ]}
    >
      {children}
    </View>
  );
}

function CardDivider({
  colors,
}: {
  colors: ThemeColors;
}) {
  return <View style={[styles.cardDivider, { backgroundColor: colors.border }]} />;
}

function ProfileListItem({
  colors,
  icon,
  title,
  subtitle,
  value,
  onPress,
  destructive = false,
  external = false,
}: {
  colors: ThemeColors;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle?: string | null;
  value?: string | null;
  onPress?: () => void;
  destructive?: boolean;
  external?: boolean;
}) {
  const iconColor = destructive ? colors.danger : colors.primary;
  const rippleColor = destructive ? `${colors.danger}12` : `${colors.text}0D`;
  const trailingIconName: React.ComponentProps<typeof Ionicons>['name'] = external
    ? 'open-outline'
    : 'chevron-forward';

  const content = (
    <>
      <View
        style={[
          styles.rowIcon,
          { backgroundColor: destructive ? `${colors.danger}12` : colors.primarySoft },
        ]}
      >
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>

      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, { color: destructive ? colors.danger : colors.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.rowSubtitle, { color: colors.secondaryText }]}>{subtitle}</Text>
        ) : null}
      </View>

      {value || onPress ? (
        <View style={styles.rowTrailing}>
          {value ? (
            <Text numberOfLines={1} style={[styles.rowValue, { color: colors.secondaryText }]}>
              {value}
            </Text>
          ) : null}
          {onPress ? (
            <Ionicons
              name={trailingIconName}
              size={18}
              color={destructive ? colors.danger : colors.secondaryText}
            />
          ) : null}
        </View>
      ) : null}
    </>
  );

  if (!onPress) {
    return <View style={styles.row}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      android_ripple={{ color: rippleColor }}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
    >
      {content}
    </Pressable>
  );
}

function ActionButton({
  colors,
  icon,
  label,
  onPress,
  loading = false,
  variant = 'tonal',
  destructive = false,
}: {
  colors: ThemeColors;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'tonal' | 'text' | 'filled';
  destructive?: boolean;
}) {
  const isFilled = variant === 'filled';
  const isText = variant === 'text';
  const backgroundColor = isText
    ? 'transparent'
    : destructive
      ? `${colors.danger}12`
      : isFilled
        ? colors.primary
        : colors.primarySoft;
  const borderColor = isText ? 'transparent' : destructive ? `${colors.danger}22` : 'transparent';
  const labelColor = destructive
    ? colors.danger
    : isFilled
      ? '#1C1C1E'
      : colors.text;
  const rippleColor = destructive ? `${colors.danger}12` : `${colors.text}0D`;

  return (
    <Pressable
      accessibilityRole="button"
      android_ripple={{ color: rippleColor }}
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        {
          backgroundColor,
          borderColor,
          opacity: loading ? 0.72 : 1,
        },
        isText ? styles.actionButtonTextVariant : null,
        pressed && styles.buttonPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={labelColor} />
      ) : (
        <View style={styles.actionButtonContent}>
          <Ionicons name={icon} size={18} color={labelColor} />
          <Text style={[styles.actionButtonLabel, { color: labelColor }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

function MembershipBadge({
  colors,
  isPlus,
  label,
}: {
  colors: ThemeColors;
  isPlus: boolean;
  label: string;
}) {
  return (
    <View
      style={[
        styles.membershipBadge,
        {
          backgroundColor: isPlus ? colors.primarySoft : colors.surface,
          borderColor: isPlus ? `${colors.primary}26` : colors.border,
        },
      ]}
    >
      <Text style={[styles.membershipBadgeText, { color: isPlus ? colors.primary : colors.secondaryText }]}>
        {label}
      </Text>
    </View>
  );
}

export default function ProfileScreenAndroid() {
  const {
    avatarLabel,
    avatarUrl,
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
    showAccountDeletionLink,
    showPrivacyPolicyLink,
    showSupportLink,
    t,
    tier,
    user,
    handleDeleteAccount,
    handleSignOut,
  } = useProfileScreenModel();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: false,
          headerShadowVisible: false,
          title: t('profile.title', 'Profile'),
          headerTintColor: colors.text,
          headerTitleAlign: 'left',
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTitleStyle: [
            styles.stackHeaderTitle,
            {
              color: colors.text,
            },
          ],
        }}
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: 12, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {user ? (
          <>
            <SurfaceCard colors={colors} highlighted>
              <View style={styles.hero}>
                <View style={[styles.avatarFrame, { backgroundColor: colors.primarySoft, borderColor: `${colors.primary}24` }]}>
                  <ProfileAvatar
                    avatarLabel={avatarLabel}
                    avatarUrl={avatarUrl}
                    colors={colors}
                    size={84}
                    labelFontSize={30}
                  />
                </View>

                <View style={styles.heroCopy}>
                  <Text style={[styles.heroName, { color: colors.text }]} numberOfLines={2}>
                    {profileName}
                  </Text>
                  {user.email ? (
                    <Text style={[styles.heroEmail, { color: colors.secondaryText }]} numberOfLines={1}>
                      {user.email}
                    </Text>
                  ) : null}
                  <MembershipBadge colors={colors} isPlus={tier === 'plus'} label={membershipLabel} />
                  <Text style={[styles.heroDescription, { color: colors.secondaryText }]}>
                    {t('profile.description', 'Manage the account connected to Noto.')}
                  </Text>
                </View>
              </View>
            </SurfaceCard>

            <View style={styles.section}>
              <SectionTitle colors={colors} title={t('profile.accountTitle', 'Connected account')} />
              <SurfaceCard colors={colors}>
                <ProfileListItem
                  colors={colors}
                  icon="person-outline"
                  title={t('profile.name', 'Name')}
                  value={user.displayName || t('profile.noName', 'Noto account')}
                />
                {user.email ? <CardDivider colors={colors} /> : null}
                {user.email ? (
                  <ProfileListItem
                    colors={colors}
                    icon="mail-outline"
                    title={t('profile.email', 'Email')}
                    value={user.email}
                  />
                ) : null}
                <CardDivider colors={colors} />
                <ProfileListItem
                  colors={colors}
                  icon="sparkles-outline"
                  title={t('profile.membership', 'Membership')}
                  value={membershipLabel}
                />
                <CardDivider colors={colors} />
                <ProfileListItem
                  colors={colors}
                  icon="cloud-done-outline"
                  title={t('profile.sync', 'Sync')}
                  subtitle={t('profile.autoSyncOn', 'Your notes sync automatically while you are signed in.')}
                  value={t('profile.autoSyncShort', 'Auto sync on')}
                />
              </SurfaceCard>
            </View>

            {showPrivacyPolicyLink || showSupportLink || showAccountDeletionLink ? (
              <View style={styles.section}>
                <SectionTitle colors={colors} title={t('profile.legalTitle', 'Privacy & support')} />
                <SurfaceCard colors={colors}>
                  {showPrivacyPolicyLink ? (
                    <ProfileListItem
                      colors={colors}
                      icon="shield-checkmark-outline"
                      title={t('settings.privacyPolicy', 'Privacy Policy')}
                      subtitle={t('settings.privacyPolicyHint', 'Review how Noto handles your data and permissions.')}
                      onPress={openPrivacyPolicyLink}
                      external
                    />
                  ) : null}
                  {showPrivacyPolicyLink && (showSupportLink || showAccountDeletionLink) ? (
                    <CardDivider colors={colors} />
                  ) : null}
                  {showSupportLink ? (
                    <ProfileListItem
                      colors={colors}
                      icon="help-circle-outline"
                      title={t('settings.support', 'Support')}
                      subtitle={t('settings.supportHint', 'Contact support if you need help with sign-in, sync, or account issues.')}
                      onPress={openSupportLink}
                      external
                    />
                  ) : null}
                  {showSupportLink && showAccountDeletionLink ? <CardDivider colors={colors} /> : null}
                  {showAccountDeletionLink ? (
                    <ProfileListItem
                      colors={colors}
                      icon="person-remove-outline"
                      title={t('settings.accountDeletion', 'Account deletion help')}
                      subtitle={t('settings.accountDeletionHint', 'Open the external deletion page or support contact for your store listing.')}
                      onPress={openAccountDeletionHelpLink}
                      external
                    />
                  ) : null}
                </SurfaceCard>
              </View>
            ) : null}

            <View style={styles.section}>
              <SectionTitle colors={colors} title={t('profile.actionsTitle', 'Actions')} />
              <SurfaceCard colors={colors}>
                <View style={styles.actions}>
                  <ActionButton
                    colors={colors}
                    icon="log-out-outline"
                    label={t('profile.logout', 'Log out')}
                    onPress={handleSignOut}
                    loading={isSigningOut && !isDeletingAccount}
                  />
                  <ActionButton
                    colors={colors}
                    icon="trash-outline"
                    label={t('profile.deleteAccount', 'Delete account')}
                    onPress={handleDeleteAccount}
                    loading={isDeletingAccount}
                    variant="text"
                    destructive
                  />
                </View>
              </SurfaceCard>
            </View>
          </>
        ) : (
          <SurfaceCard colors={colors} highlighted>
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconShell, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="person-outline" size={34} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {t('profile.signedOutTitle', 'No account connected')}
              </Text>
              <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>
                {isAuthAvailable
                  ? t('profile.signedOutMsg', 'Sign in to back up your notes and keep them synced across your devices.')
                  : t(
                      'profile.unavailableMsg',
                      'Account sign-in is unavailable right now, but your notes stay safely on this device.'
                    )}
              </Text>

              {isAuthAvailable ? (
                <ActionButton
                  colors={colors}
                  icon="log-in-outline"
                  label={t('settings.login', 'Sign In')}
                  onPress={openSignIn}
                  variant="filled"
                />
              ) : null}
            </View>
          </SurfaceCard>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stackHeaderTitle: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: 'System',
  },
  content: {
    paddingHorizontal: Layout.screenPadding,
    gap: 24,
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
  hero: {
    paddingHorizontal: 20,
    paddingVertical: 22,
    gap: 18,
  },
  avatarFrame: {
    width: 104,
    height: 104,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: {
    gap: 8,
  },
  heroName: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    fontFamily: 'System',
  },
  heroEmail: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
    fontFamily: 'System',
  },
  heroDescription: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'System',
  },
  membershipBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  membershipBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
    fontFamily: 'System',
  },
  row: {
    minHeight: 76,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  rowPressed: {
    opacity: 0.92,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    fontFamily: 'System',
  },
  rowSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'System',
  },
  rowTrailing: {
    maxWidth: 132,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    marginLeft: 8,
  },
  rowValue: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    textAlign: 'right',
    fontFamily: 'System',
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 72,
    marginRight: 18,
  },
  actions: {
    padding: 16,
    gap: 4,
  },
  actionButton: {
    minHeight: 52,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  actionButtonTextVariant: {
    alignSelf: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  actionButtonLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: 'System',
  },
  buttonPressed: {
    opacity: 0.88,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  emptyIconShell: {
    width: 88,
    height: 88,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    marginTop: 18,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: 'System',
  },
  emptyBody: {
    marginTop: 10,
    marginBottom: 20,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    fontFamily: 'System',
  },
});
