import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Layout } from '../../../constants/theme';
import type { ThemeColors } from '../../../hooks/useTheme';
import ProfileAvatar from './ProfileAvatar';
import {
  buildProfileSections,
  type ProfileIconKey,
  type ProfileRowModel,
  type ProfileTrailingActionIconKey,
} from './profileScreenSections';
import { useProfileScreenModel } from './useProfileScreenModel';
import UsernameEditSheet from './UsernameEditSheet';

function getAndroidIconName(icon: ProfileIconKey): React.ComponentProps<typeof Ionicons>['name'] {
  switch (icon) {
    case 'name':
      return 'person-outline';
    case 'username':
      return 'at-outline';
    case 'email':
      return 'mail-outline';
    case 'signIn':
      return 'log-in-outline';
    case 'signOut':
      return 'log-out-outline';
    case 'deleteAccount':
      return 'trash-outline';
  }
}

function getAndroidTrailingActionIconName(icon: ProfileTrailingActionIconKey): React.ComponentProps<typeof Ionicons>['name'] {
  switch (icon) {
    case 'copy':
      return 'copy-outline';
    case 'check':
      return 'checkmark-outline';
  }
}

function SectionTitle({ colors, title }: { colors: ThemeColors; title: string }) {
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

function CardDivider({ colors }: { colors: ThemeColors }) {
  return <View style={[styles.cardDivider, { backgroundColor: colors.border }]} />;
}

function ProfileListItem({
  colors,
  row,
}: {
  colors: ThemeColors;
  row: ProfileRowModel;
}) {
  const iconColor = row.destructive ? colors.danger : colors.primary;
  const rippleColor = row.destructive ? `${colors.danger}12` : `${colors.text}0D`;
  const content = (
    <>
      <View
        style={[
          styles.rowIcon,
          { backgroundColor: row.destructive ? `${colors.danger}12` : colors.primarySoft },
        ]}
      >
        <Ionicons name={getAndroidIconName(row.icon)} size={20} color={iconColor} />
      </View>

      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, { color: row.destructive ? colors.danger : colors.text }]}>{row.title}</Text>
        {row.subtitle ? (
          <Text style={[styles.rowSubtitle, { color: colors.secondaryText }]}>{row.subtitle}</Text>
        ) : null}
      </View>

      {row.value || row.onPress || row.loading || row.trailingAction ? (
        <View style={styles.rowTrailing}>
          {row.value ? (
            <Text numberOfLines={1} style={[styles.rowValue, { color: colors.secondaryText }]}>
              {row.value}
            </Text>
          ) : null}
          {row.loading ? (
            <ActivityIndicator size="small" color={row.destructive ? colors.danger : colors.primary} />
          ) : null}
          {row.onPress && !row.loading ? (
            <Ionicons
              name="chevron-forward"
              size={18}
              color={row.destructive ? colors.danger : colors.secondaryText}
            />
          ) : null}
          {row.trailingAction ? (
            <Pressable
              accessibilityLabel={row.trailingAction.accessibilityLabel}
              accessibilityRole="button"
              android_ripple={{ color: `${colors.primary}14`, borderless: true }}
              hitSlop={8}
              onPress={(event) => {
                event.stopPropagation();
                row.trailingAction?.onPress();
              }}
              style={({ pressed }) => [
                styles.trailingAction,
                {
                  backgroundColor:
                    row.trailingAction?.icon === 'check' ? colors.primarySoft : 'transparent',
                },
                pressed ? styles.trailingActionPressed : null,
              ]}
            >
              <Ionicons
                name={getAndroidTrailingActionIconName(row.trailingAction.icon)}
                size={18}
                color={row.trailingAction.icon === 'check' ? colors.primary : colors.secondaryText}
              />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </>
  );

  if (!row.onPress) {
    return <View style={styles.row}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      android_ripple={{ color: rippleColor }}
      onPress={row.onPress}
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
  const model = useProfileScreenModel();
  const { signedInSections, signedOutCta } = buildProfileSections(model);

  return (
    <View style={[styles.container, { backgroundColor: model.colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: false,
          headerShadowVisible: false,
          title: model.t('profile.title', 'Profile'),
          headerTintColor: model.colors.text,
          headerTitleAlign: 'left',
          headerStyle: {
            backgroundColor: model.colors.background,
          },
          headerTitleStyle: [
            styles.stackHeaderTitle,
            {
              color: model.colors.text,
            },
          ],
        }}
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: 16, paddingBottom: model.insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {model.user ? (
          <>
            <View style={styles.firstSection}>
              <SurfaceCard colors={model.colors}>
                <View style={styles.hero}>
                  <View
                    style={[
                      styles.avatarFrame,
                      {
                        backgroundColor: model.colors.primarySoft,
                        borderColor: `${model.colors.primary}24`,
                      },
                    ]}
                  >
                    <ProfileAvatar
                      avatarLabel={model.avatarLabel}
                      avatarUrl={model.avatarUrl}
                      accessibilityLabel={model.t('profile.avatarChangeA11y', 'Change avatar')}
                      colors={model.colors}
                      disabled={!model.canEditAvatar}
                      isLoading={model.isUpdatingAvatar}
                      size={56}
                      labelFontSize={22}
                      onPress={model.handleChangeAvatar}
                    />
                  </View>

                  <View style={styles.heroCopy}>
                    <Text style={[styles.heroName, { color: model.colors.text }]} numberOfLines={1}>
                      {model.profileName}
                    </Text>
                    {model.profileSecondaryLabel ? (
                      <Text style={[styles.heroEmail, { color: model.colors.secondaryText }]} numberOfLines={1}>
                        {model.profileSecondaryLabel}
                      </Text>
                    ) : null}
                  </View>
                  <MembershipBadge colors={model.colors} isPlus={model.tier === 'plus'} label={model.membershipLabel} />
                </View>
              </SurfaceCard>
            </View>

            {signedInSections.map((section) => (
              <View key={section.key} style={styles.section}>
                <SectionTitle colors={model.colors} title={section.title} />
                <SurfaceCard colors={model.colors}>
                  {section.items.map((row, index) => (
                    <React.Fragment key={row.key}>
                      {index > 0 ? <CardDivider colors={model.colors} /> : null}
                      <ProfileListItem colors={model.colors} row={row} />
                    </React.Fragment>
                  ))}
                </SurfaceCard>
              </View>
            ))}
          </>
        ) : (
          <View style={styles.firstSection}>
            <SurfaceCard colors={model.colors} highlighted>
              <View style={styles.emptyState}>
                <View style={[styles.emptyIconShell, { backgroundColor: model.colors.primarySoft }]}>
                  <Ionicons name="person-outline" size={34} color={model.colors.primary} />
                </View>
                <Text style={[styles.emptyTitle, { color: model.colors.text }]}>
                  {model.t('profile.signedOutTitle', 'No account connected')}
                </Text>
                <Text style={[styles.emptyBody, { color: model.colors.secondaryText }]}>
                  {model.isAuthAvailable
                    ? model.t(
                        'profile.signedOutMsg',
                        'Sign in to back up your notes and keep them synced across your devices.'
                      )
                    : model.t(
                        'profile.unavailableMsg',
                        'Account sign-in is unavailable right now, but your notes stay safely on this device.'
                      )}
                </Text>
              </View>
              {signedOutCta ? (
                <>
                  <CardDivider colors={model.colors} />
                  <ProfileListItem colors={model.colors} row={signedOutCta} />
                </>
              ) : null}
            </SurfaceCard>
          </View>
        )}
      </ScrollView>
      <UsernameEditSheet
        visible={model.isUsernameSheetVisible}
        value={model.usernameDraft}
        errorMessage={model.usernameErrorMessage}
        helperText={model.usernameHelperText}
        isSaving={model.isSavingUsername}
        onChangeValue={model.setUsernameDraft}
        onClose={model.closeUsernameEditor}
        onSave={model.saveUsername}
        title={model.t('profile.usernameSheetTitle', 'Choose your username')}
        subtitle={model.t('profile.usernameSheetSubtitle', 'This will be your short in-app name.')}
        saveLabel={model.t('profile.usernameSave', 'Save username')}
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
    maxWidth: 172,
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
  trailingAction: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trailingActionPressed: {
    opacity: 0.72,
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
    marginTop: 18,
    fontSize: 21,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
  },
  emptyBody: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    fontFamily: 'Noto Sans',
  },
});
