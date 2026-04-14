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
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import ProfileAvatar from './ProfileAvatar';
import {
  buildProfileSections,
  type ProfileIconKey,
  type ProfileRowModel,
  type ProfileTrailingActionIconKey,
} from './profileScreenSections';
import { useProfileScreenModel } from './useProfileScreenModel';
import UsernameEditSheet from './UsernameEditSheet';

function getIOSSymbolName(icon: ProfileIconKey) {
  switch (icon) {
    case 'name':
      return 'person';
    case 'username':
      return 'at';
    case 'email':
      return 'envelope';
    case 'signIn':
      return 'arrow.right.circle';
    case 'signOut':
      return 'rectangle.portrait.and.arrow.right';
    case 'deleteAccount':
      return 'trash';
  }
}

function getIOSTrailingActionSymbolName(icon: ProfileTrailingActionIconKey) {
  switch (icon) {
    case 'copy':
      return 'doc.on.doc';
    case 'check':
      return 'checkmark';
  }
}

function KeyValueRow({
  colors,
  row,
}: {
  colors: ReturnType<typeof useProfileScreenModel>['colors'];
  row: ProfileRowModel;
}) {
  const iconColor = row.destructive ? colors.danger : colors.primary;
  const content = (
    <HStack>
      <HStack
        modifiers={[
          frame({ width: 28, height: 28, alignment: 'center' }),
          backgroundOverlay({ color: row.destructive ? `${colors.danger}18` : `${colors.primary}18` }),
          cornerRadius(999),
          padding({ trailing: 12 }),
        ]}
      >
        {row.loading ? (
          <RNHostView matchContents>
            <View style={styles.rowSpinner}>
              <ActivityIndicator size="small" color={iconColor} />
            </View>
          </RNHostView>
        ) : (
          <SwiftUIImage systemName={getIOSSymbolName(row.icon)} color={iconColor} size={14} />
        )}
      </HStack>
      <SwiftUIText modifiers={[foregroundStyle(row.destructive ? colors.danger : colors.text)]}>
        {row.title}
      </SwiftUIText>
      <Spacer />
      {row.value ? (
        <SwiftUIText modifiers={[foregroundStyle(colors.secondaryText), multilineTextAlignment('trailing')]}>
          {row.value}
        </SwiftUIText>
      ) : row.onPress ? (
        <SwiftUIImage
          systemName="chevron.right"
          color={row.destructive ? colors.danger : colors.secondaryText}
          size={14}
        />
      ) : null}
      {row.trailingAction ? (
        <Button onPress={row.trailingAction.onPress}>
          <HStack
            modifiers={[
              frame({ width: 28, height: 28, alignment: 'center' }),
              backgroundOverlay({
                color: row.trailingAction.icon === 'check' ? `${colors.primary}18` : 'transparent',
              }),
              cornerRadius(8),
            ]}
          >
            <SwiftUIImage
              systemName={getIOSTrailingActionSymbolName(row.trailingAction.icon)}
              color={row.trailingAction.icon === 'check' ? colors.primary : colors.secondaryText}
              size={14}
            />
          </HStack>
        </Button>
      ) : null}
    </HStack>
  );

  if (!row.onPress) {
    return content;
  }

  return <Button onPress={row.onPress}>{content}</Button>;
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
        backgroundOverlay({ color: isPlus ? `${colors.primary}14` : `${colors.border}99` }),
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
  const model = useProfileScreenModel();
  const { signedInSections, signedOutCta } = buildProfileSections(model);

  return (
    <View style={[styles.container, { backgroundColor: model.colors.background }]}>
      <Host style={styles.container} colorScheme={model.isDark ? 'dark' : 'light'}>
        <List modifiers={[scrollContentBackground('hidden')]}>
          {model.user ? (
            <>
              <Section>
                <HStack modifiers={[padding({ top: 16, bottom: 4 })]}>
                  <RNHostView matchContents>
                    <View style={styles.avatarHost}>
                      <ProfileAvatar
                        avatarLabel={model.avatarLabel}
                        avatarUrl={model.avatarUrl}
                        accessibilityLabel={model.t('profile.avatarChangeA11y', 'Change avatar')}
                        colors={model.colors}
                        disabled={!model.canEditAvatar}
                        isLoading={model.isUpdatingAvatar}
                        size={48}
                        labelFontSize={20}
                        onPress={model.handleChangeAvatar}
                      />
                    </View>
                  </RNHostView>
                  <VStack alignment="leading" modifiers={[padding({ leading: 12 })]}>
                    <SwiftUIText modifiers={[foregroundStyle(model.colors.text), font({ size: 20, weight: 'semibold' })]}>
                      {model.profileName}
                    </SwiftUIText>
                    {model.profileSecondaryLabel ? (
                      <SwiftUIText modifiers={[foregroundStyle(model.colors.secondaryText), font({ size: 14 })]}>
                        {model.profileSecondaryLabel}
                      </SwiftUIText>
                    ) : null}
                  </VStack>
                  <Spacer />
                  <MembershipBadge colors={model.colors} isPlus={model.tier === 'plus'} label={model.membershipLabel} />
                </HStack>
              </Section>

              {signedInSections.map((section) => (
                <Section key={section.key} title={section.title}>
                  {section.items.map((row) => (
                    <KeyValueRow key={row.key} colors={model.colors} row={row} />
                  ))}
                </Section>
              ))}
            </>
          ) : (
            <>
              <Section>
                <VStack alignment="leading" modifiers={[padding({ top: 16, bottom: 8 })]}>
                  <HStack
                    modifiers={[
                      frame({ width: 48, height: 48, alignment: 'center' }),
                      backgroundOverlay({ color: `${model.colors.primary}18` }),
                      cornerRadius(24),
                    ]}
                  >
                    <SwiftUIImage systemName="person.crop.circle.badge.exclamationmark" color={model.colors.primary} size={26} />
                  </HStack>
                  <SwiftUIText modifiers={[foregroundStyle(model.colors.text), font({ size: 20, weight: 'semibold' }), padding({ top: 12 })]}>
                    {model.t('profile.signedOutTitle', 'No account connected')}
                  </SwiftUIText>
                  <SwiftUIText
                    modifiers={[
                      foregroundStyle(model.colors.secondaryText),
                      font({ size: 14 }),
                      multilineTextAlignment('leading'),
                      padding({ top: 8 }),
                    ]}
                  >
                    {model.isAuthAvailable
                      ? model.t(
                          'profile.signedOutMsg',
                          'Sign in to back up your notes and keep them synced across your devices.'
                        )
                      : model.t(
                          'profile.unavailableMsg',
                          'Account sign-in is unavailable right now, but your notes stay safely on this device.'
                        )}
                  </SwiftUIText>
                </VStack>
              </Section>

              {signedOutCta ? (
                <Section title={model.t('settings.accountEntry', 'Account')}>
                  <KeyValueRow colors={model.colors} row={signedOutCta} />
                </Section>
              ) : null}
            </>
          )}
        </List>
      </Host>
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
  avatarHost: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowSpinner: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
