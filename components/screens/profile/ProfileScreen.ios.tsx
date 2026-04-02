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
import { StyleSheet, View } from 'react-native';
import ProfileAvatar from './ProfileAvatar';
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

function MembershipBadge({
  colors,
  isPlus,
  label,
}: {
  colors: ReturnType<typeof useProfileScreenModel>['colors'];
  isPlus: boolean;
  label: string;
}) {
  return (
    <SwiftUIText
      modifiers={[
        foregroundStyle(isPlus ? colors.primary : colors.secondaryText),
        backgroundOverlay({ color: isPlus ? colors.primary + '14' : colors.border + '99' }),
        cornerRadius(999),
        font({ size: 12, weight: 'semibold' }),
        padding({ top: 6, bottom: 6, leading: 10, trailing: 10 }),
      ]}
    >
      {label}
    </SwiftUIText>
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
    showAccountDeletionLink,
    showPrivacyPolicyLink,
    showSupportLink,
    t,
    tier,
    user,
    handleDeleteAccount,
    handleSignOut,
  } = useProfileScreenModel();
  const topContentPadding = 16;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Host style={styles.container} colorScheme={isDark ? 'dark' : 'light'}>
        <List modifiers={[scrollContentBackground('hidden')]}>
          {user ? (
            <>
              <Section>
                <HStack modifiers={[padding({ top: topContentPadding, bottom: 4 })]}>
                  <RNHostView matchContents>
                    <View style={styles.avatarHost}>
                      <ProfileAvatar
                        avatarLabel={avatarLabel}
                        avatarUrl={avatarUrl}
                        colors={colors}
                        size={48}
                        labelFontSize={20}
                      />
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
                  <MembershipBadge colors={colors} isPlus={tier === 'plus'} label={membershipLabel} />
                </HStack>
              </Section>

              <Section
                title={t('profile.accountTitle', 'Connected account')}
              >
                <KeyValueRow colors={colors} label={t('profile.name', 'Name')} value={user.displayName || t('profile.noName', 'Noto account')} />
                {user.email ? (
                  <KeyValueRow colors={colors} label={t('profile.email', 'Email')} value={user.email} />
                ) : null}
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
                <VStack alignment="leading" modifiers={[padding({ top: topContentPadding, bottom: 8 })]}>
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
});
