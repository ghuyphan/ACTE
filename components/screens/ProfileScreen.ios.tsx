import {
  Button,
  Host,
  HStack,
  Image as SwiftUIImage,
  List,
  RNHostView,
  Section,
  Spacer,
  Text as SwiftUIText,
  VStack,
} from '@expo/ui/swift-ui';
import {
  backgroundOverlay,
  cornerRadius,
  font,
  foregroundStyle,
  frame,
  multilineTextAlignment,
  padding,
  scrollContentBackground,
} from '@expo/ui/swift-ui/modifiers';
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useProfileScreenModel } from './useProfileScreenModel';

function KeyValueRow({
  colors,
  label,
  value,
}: {
  colors: ReturnType<typeof useProfileScreenModel>['colors'];
  label: string;
  value: string;
}) {
  return (
    <HStack>
      <SwiftUIText modifiers={[foregroundStyle(colors.text)]}>{label}</SwiftUIText>
      <Spacer />
      <SwiftUIText modifiers={[foregroundStyle(colors.secondaryText), multilineTextAlignment('trailing')]}>
        {value}
      </SwiftUIText>
    </HStack>
  );
}

export default function ProfileScreenIOS() {
  const {
    avatarLabel,
    avatarUrl,
    colors,
    isAuthAvailable,
    isDark,
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Host style={styles.container} colorScheme={isDark ? 'dark' : 'light'}>
        <List modifiers={[scrollContentBackground('hidden')]}>
          {user ? (
            <>
              <Section>
                <HStack modifiers={[padding({ top: 4, bottom: 4 })]}>
                  <RNHostView matchContents>
                    <View style={styles.avatarHost}>
                      {avatarUrl ? (
                        <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                      ) : (
                        <View style={[styles.avatarFallback, { backgroundColor: colors.primarySoft }]}>
                          <Text style={[styles.avatarLabel, { color: colors.primary }]}>{avatarLabel}</Text>
                        </View>
                      )}
                    </View>
                  </RNHostView>
                  <VStack alignment="leading" modifiers={[padding({ leading: 12 })]}>
                    <SwiftUIText modifiers={[foregroundStyle(colors.text), font({ size: 20, weight: 'semibold' })]}>
                      {profileName}
                    </SwiftUIText>
                    {user.email ? (
                      <SwiftUIText modifiers={[foregroundStyle(colors.secondaryText), font({ size: 14 })]}>
                        {user.email}
                      </SwiftUIText>
                    ) : null}
                  </VStack>
                  <Spacer />
                  {tier === 'plus' ? (
                    <SwiftUIText
                      modifiers={[
                        foregroundStyle(colors.primary),
                        backgroundOverlay({ color: colors.primary + '14' }),
                        cornerRadius(999),
                        font({ size: 12, weight: 'semibold' }),
                        padding({ top: 6, bottom: 6, leading: 10, trailing: 10 }),
                      ]}
                    >
                      {t('profile.plusBadge', 'Noto Plus')}
                    </SwiftUIText>
                  ) : null}
                </HStack>
              </Section>

              <Section
                title={t('profile.accountTitle', 'Connected account')}
                footer={
                  syncSummary ? (
                    <SwiftUIText
                      modifiers={[
                        foregroundStyle(colors.secondaryText),
                        font({ size: 13 }),
                        multilineTextAlignment('leading'),
                        padding({ top: 8 }),
                      ]}
                    >
                      {syncSummary}
                    </SwiftUIText>
                  ) : undefined
                }
              >
                <KeyValueRow colors={colors} label={t('profile.name', 'Name')} value={user.displayName || t('profile.noName', 'Noto account')} />
                {user.email ? (
                  <KeyValueRow colors={colors} label={t('profile.email', 'Email')} value={user.email} />
                ) : null}
                <KeyValueRow colors={colors} label={t('profile.membership', 'Membership')} value={membershipLabel} />
                <KeyValueRow colors={colors} label={t('profile.provider', 'Sign-in method')} value={providerLabel} />
                <KeyValueRow colors={colors} label={t('profile.sync', 'Sync')} value={syncValue} />
              </Section>

              {(showPrivacyPolicyLink || showSupportLink || showAccountDeletionLink) ? (
                <Section title={t('profile.legalTitle', 'Privacy & support')}>
                  {showPrivacyPolicyLink ? (
                    <Button onPress={openPrivacyPolicyLink}>
                      <HStack>
                        <SwiftUIText modifiers={[foregroundStyle(colors.text)]}>
                          {t('settings.privacyPolicy', 'Privacy Policy')}
                        </SwiftUIText>
                        <Spacer />
                        <SwiftUIImage systemName="arrow.up.right" color={colors.secondaryText} size={14} />
                      </HStack>
                    </Button>
                  ) : null}
                  {showSupportLink ? (
                    <Button onPress={openSupportLink}>
                      <HStack>
                        <SwiftUIText modifiers={[foregroundStyle(colors.text)]}>
                          {t('settings.support', 'Support')}
                        </SwiftUIText>
                        <Spacer />
                        <SwiftUIImage systemName="arrow.up.right" color={colors.secondaryText} size={14} />
                      </HStack>
                    </Button>
                  ) : null}
                  {showAccountDeletionLink ? (
                    <Button onPress={openAccountDeletionHelpLink}>
                      <HStack>
                        <SwiftUIText modifiers={[foregroundStyle(colors.text)]}>
                          {t('settings.accountDeletion', 'Account deletion help')}
                        </SwiftUIText>
                        <Spacer />
                        <SwiftUIImage systemName="arrow.up.right" color={colors.secondaryText} size={14} />
                      </HStack>
                    </Button>
                  ) : null}
                </Section>
              ) : null}

              <Section title={t('profile.actionsTitle', 'Actions')}>
                <Button onPress={handleSignOut}>
                  <HStack>
                    <SwiftUIText modifiers={[foregroundStyle(colors.text)]}>
                      {isSigningOut && !isDeletingAccount
                        ? t('profile.logout', 'Log out')
                        : t('profile.logout', 'Log out')}
                    </SwiftUIText>
                  </HStack>
                </Button>
                <Button onPress={handleDeleteAccount}>
                  <HStack>
                    <SwiftUIText modifiers={[foregroundStyle(colors.danger)]}>
                      {isDeletingAccount
                        ? t('profile.deleteAccount', 'Delete account')
                        : t('profile.deleteAccount', 'Delete account')}
                    </SwiftUIText>
                  </HStack>
                </Button>
              </Section>
            </>
          ) : (
            <>
              <Section>
                <VStack alignment="leading" modifiers={[padding({ top: 8, bottom: 8 })]}>
                  <HStack
                    modifiers={[
                      frame({ width: 48, height: 48, alignment: 'center' }),
                      backgroundOverlay({ color: colors.primary + '18' }),
                      cornerRadius(24),
                    ]}
                  >
                    <SwiftUIImage systemName="person.crop.circle.badge.exclamationmark" color={colors.primary} size={26} />
                  </HStack>
                  <SwiftUIText modifiers={[foregroundStyle(colors.text), font({ size: 20, weight: 'semibold' }), padding({ top: 12 })]}>
                    {t('profile.signedOutTitle', 'No account connected')}
                  </SwiftUIText>
                  {!isAuthAvailable ? (
                    <SwiftUIText
                      modifiers={[
                        foregroundStyle(colors.secondaryText),
                        font({ size: 14 }),
                        multilineTextAlignment('leading'),
                        padding({ top: 8 }),
                      ]}
                    >
                      {t(
                        'profile.unavailableMsg',
                        'Account sign-in is unavailable right now, but your notes stay safely on this device.'
                      )}
                    </SwiftUIText>
                  ) : null}
                </VStack>
              </Section>

              {isAuthAvailable ? (
                <Section title={t('settings.accountEntry', 'Account')}>
                  <Button onPress={openSignIn}>
                    <HStack>
                      <SwiftUIText modifiers={[foregroundStyle(colors.text)]}>
                        {t('settings.login', 'Sign In')}
                      </SwiftUIText>
                      <Spacer />
                      <SwiftUIImage systemName="chevron.right" color={colors.secondaryText} size={14} />
                    </HStack>
                  </Button>
                </Section>
              ) : null}
            </>
          )}
        </List>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  avatarHost: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'System',
  },
});
