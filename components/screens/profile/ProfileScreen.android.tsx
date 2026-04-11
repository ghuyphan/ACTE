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
import type { ThemeColors } from '../../../hooks/useTheme';
import { Layout } from '../../../constants/theme';
import ProfileAvatar from './ProfileAvatar';
import UsernameEditSheet from './UsernameEditSheet';
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
  loading = false,
}: {
  colors: ThemeColors;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle?: string | null;
  value?: string | null;
  onPress?: () => void;
  destructive?: boolean;
  external?: boolean;
  loading?: boolean;
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

      {value || onPress || loading ? (
        <View style={styles.rowTrailing}>
          {value ? (
            <Text numberOfLines={1} style={[styles.rowValue, { color: colors.secondaryText }]}>
              {value}
            </Text>
          ) : null}
          {loading ? (
            <ActivityIndicator size="small" color={destructive ? colors.danger : colors.primary} />
          ) : null}
          {onPress && !loading ? (
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
    canEditUsername,
    closeUsernameEditor,
    insets,
    isAuthAvailable,
    isDeletingAccount,
    isSigningOut,
    isSavingUsername,
    isUsernameSheetVisible,
    membershipLabel,
    openSignIn,
    openUsernameEditor,
    profileName,
    profileSecondaryLabel,
    saveUsername,
    setUsernameDraft,
    t,
    tier,
    usernameDraft,
    usernameErrorMessage,
    usernameHelperText,
    user,
    handleDeleteAccount,
    handleSignOut,
  } = useProfileScreenModel();
  const contentTopInset = 16;

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
          { paddingTop: contentTopInset, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {user ? (
          <>
            <View style={styles.firstSection}>
              <SurfaceCard colors={colors}>
                <View style={styles.hero}>
                  <View
                    style={[
                      styles.avatarFrame,
                      {
                        backgroundColor: colors.primarySoft,
                        borderColor: `${colors.primary}24`,
                      },
                    ]}
                  >
                    <ProfileAvatar
                      avatarLabel={avatarLabel}
                      avatarUrl={avatarUrl}
                      colors={colors}
                      size={56}
                      labelFontSize={22}
                    />
                  </View>

                  <View style={styles.heroCopy}>
                    <Text style={[styles.heroName, { color: colors.text }]} numberOfLines={1}>
                      {profileName}
                    </Text>
                    {profileSecondaryLabel ? (
                      <Text style={[styles.heroEmail, { color: colors.secondaryText }]} numberOfLines={1}>
                        {profileSecondaryLabel}
                      </Text>
                    ) : null}
                  </View>
                  <MembershipBadge colors={colors} isPlus={tier === 'plus'} label={membershipLabel} />
                </View>
              </SurfaceCard>
            </View>
            <View style={styles.section}>
              <SectionTitle colors={colors} title={t('profile.accountTitle', 'Connected account')} />
              <SurfaceCard colors={colors}>
                <ProfileListItem
                  colors={colors}
                  icon="person-outline"
                  title={t('profile.name', 'Name')}
                  value={user.displayName || t('profile.noName', 'Noto account')}
                />
                {user.username ? <CardDivider colors={colors} /> : null}
                {user.username ? (
                  <>
                    <ProfileListItem
                      colors={colors}
                      icon="at-outline"
                      title={t('profile.username', 'Username')}
                      value={`@${user.username}`}
                      subtitle={
                        canEditUsername
                          ? t('profile.usernameEditCta', 'Choose your permanent username')
                          : undefined
                      }
                      onPress={canEditUsername ? openUsernameEditor : undefined}
                    />
                  </>
                ) : null}
                {!user.username && user.email ? (
                  <ProfileListItem
                    colors={colors}
                    icon="mail-outline"
                    title={t('profile.email', 'Email')}
                    value={user.email}
                  />
                ) : null}
              </SurfaceCard>
            </View>

            <View style={styles.section}>
              <SectionTitle colors={colors} title={t('profile.actionsTitle', 'Actions')} />
              <SurfaceCard colors={colors}>
                <ProfileListItem
                  colors={colors}
                  icon="log-out-outline"
                  title={t('profile.logout', 'Log out')}
                  onPress={handleSignOut}
                  loading={isSigningOut && !isDeletingAccount}
                />
                <CardDivider colors={colors} />
                <ProfileListItem
                  colors={colors}
                  icon="trash-outline"
                  title={t('profile.deleteAccount', 'Delete account')}
                  onPress={handleDeleteAccount}
                  loading={isDeletingAccount}
                  destructive
                />
              </SurfaceCard>
            </View>
          </>
        ) : (
          <View style={styles.firstSection}>
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
              </View>
              {isAuthAvailable ? (
                <>
                  <CardDivider colors={colors} />
                  <ProfileListItem
                    colors={colors}
                    icon="log-in-outline"
                    title={t('settings.login', 'Sign In')}
                    onPress={openSignIn}
                  />
                </>
              ) : null}
            </SurfaceCard>
          </View>
        )}
      </ScrollView>
      <UsernameEditSheet
        visible={isUsernameSheetVisible}
        value={usernameDraft}
        errorMessage={usernameErrorMessage}
        helperText={usernameHelperText}
        isSaving={isSavingUsername}
        onChangeValue={setUsernameDraft}
        onClose={closeUsernameEditor}
        onSave={saveUsername}
        title={t('profile.usernameSheetTitle', 'Choose your username')}
        subtitle={t('profile.usernameSheetSubtitle', 'This will be your short in-app name.')}
        saveLabel={t('profile.usernameSave', 'Save username')}
      />
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
    fontFamily: 'Noto Sans',
  },
  content: {
    paddingHorizontal: Layout.screenPadding,
    gap: 20,
  },
  firstSection: {
    marginTop: 24,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginLeft: 4,
    fontFamily: 'Noto Sans',
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  hero: {
    paddingHorizontal: 18,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarFrame: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: {
    flex: 1,
    gap: 4,
  },
  heroName: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
  },
  heroEmail: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '500',
    fontFamily: 'Noto Sans',
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
    fontFamily: 'Noto Sans',
  },
  row: {
    minHeight: 64,
    paddingHorizontal: 18,
    paddingVertical: 12,
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
    fontFamily: 'Noto Sans',
  },
  rowSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Noto Sans',
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
    fontFamily: 'Noto Sans',
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 72,
    marginRight: 18,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  emptyIconShell: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: 'Noto Sans',
  },
  emptyBody: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    fontFamily: 'Noto Sans',
  },
});
