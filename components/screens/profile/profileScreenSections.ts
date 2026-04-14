import type { useProfileScreenModel } from './useProfileScreenModel';

export type ProfileIconKey =
  | 'name'
  | 'username'
  | 'email'
  | 'signIn'
  | 'signOut'
  | 'deleteAccount';

export type ProfileTrailingActionIconKey = 'copy' | 'check';

export type ProfileRowModel = {
  key: string;
  icon: ProfileIconKey;
  title: string;
  subtitle?: string | null;
  value?: string | null;
  onPress?: () => void;
  trailingAction?: {
    accessibilityLabel: string;
    icon: ProfileTrailingActionIconKey;
    onPress: () => void;
  };
  destructive?: boolean;
  loading?: boolean;
};

export type ProfileSectionModel = {
  key: string;
  title: string;
  items: ProfileRowModel[];
};

type ProfileScreenModel = ReturnType<typeof useProfileScreenModel>;

export function buildProfileSections(model: ProfileScreenModel): {
  signedInSections: ProfileSectionModel[];
  signedOutCta: ProfileRowModel | null;
} {
  const signedInSections: ProfileSectionModel[] = [];

  if (model.user) {
    const accountItems: ProfileRowModel[] = [
      {
        key: 'name',
        icon: 'name',
        title: model.t('profile.name', 'Name'),
        value: model.user.displayName || model.t('profile.noName', 'Noto account'),
      },
    ];

    if (model.user.username) {
      accountItems.push({
        key: 'username',
        icon: 'username',
        title: model.t('profile.username', 'Username'),
        value: `@${model.user.username}`,
        trailingAction: {
          accessibilityLabel: model.isUsernameCopied
            ? model.t('profile.usernameCopied', 'Noto ID copied')
            : model.t('profile.copyUsername', 'Copy Noto ID'),
          icon: model.isUsernameCopied ? 'check' : 'copy',
          onPress: model.copyUsername,
        },
        subtitle: model.canEditUsername
          ? model.t('profile.usernameEditCta', 'Choose your permanent username')
          : undefined,
        onPress: model.canEditUsername ? model.openUsernameEditor : undefined,
      });
    } else if (model.user.email) {
      accountItems.push({
        key: 'email',
        icon: 'email',
        title: model.t('profile.email', 'Email'),
        value: model.user.email,
      });
    }

    signedInSections.push({
      key: 'account',
      title: model.t('profile.accountTitle', 'Connected account'),
      items: accountItems,
    });

    signedInSections.push({
      key: 'actions',
      title: model.t('profile.actionsTitle', 'Actions'),
      items: [
        {
          key: 'sign-out',
          icon: 'signOut',
          title: model.t('profile.logout', 'Log out'),
          onPress: model.handleSignOut,
          loading: model.isSigningOut && !model.isDeletingAccount,
        },
        {
          key: 'delete-account',
          icon: 'deleteAccount',
          title: model.t('profile.deleteAccount', 'Delete account'),
          onPress: model.handleDeleteAccount,
          loading: model.isDeletingAccount,
          destructive: true,
        },
      ],
    });
  }

  return {
    signedInSections,
    signedOutCta: model.isAuthAvailable
      ? {
          key: 'sign-in',
          icon: 'signIn',
          title: model.t('settings.login', 'Sign In'),
          onPress: model.openSignIn,
        }
      : null,
  };
}
