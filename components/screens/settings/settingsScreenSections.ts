import type { useSettingsScreenModel } from './useSettingsScreenModel';

export type SettingsIconKey =
  | 'account'
  | 'sync'
  | 'notifications'
  | 'plus'
  | 'language'
  | 'palette'
  | 'theme'
  | 'haptics'
  | 'notes'
  | 'trash'
  | 'privacy'
  | 'support'
  | 'accountDeletion'
  | 'version'
  | 'plusUnavailable';

export type SettingsRowModel = {
  key: string;
  icon: SettingsIconKey;
  title: string;
  subtitle?: string | null;
  value?: string | null;
  onPress?: () => void;
  destructive?: boolean;
  disabled?: boolean;
  external?: boolean;
  showChevron?: boolean;
  accessibilityHint?: string;
};

export type SettingsSectionModel = {
  key: string;
  title: string;
  items: SettingsRowModel[];
};

export type SettingsAboutModel = {
  brandName: string;
  tagline: string;
  versionLabel: string;
  versionValue: string;
  plusUnavailableMessage: string | null;
};

type SettingsScreenModel = ReturnType<typeof useSettingsScreenModel>;

const SETTINGS_BRAND_NAME = 'ノート';

export function buildSettingsSections(model: SettingsScreenModel): {
  sections: SettingsSectionModel[];
  about: SettingsAboutModel;
} {
  const sections: SettingsSectionModel[] = [
    {
      key: 'account',
      title: model.t('settings.account', 'Backup & Sync'),
      items: [
        {
          key: 'account',
          icon: 'account',
          title: model.t('settings.accountEntry', 'Account'),
          subtitle: model.accountHint,
          value: model.accountValue,
          onPress: model.isAuthAvailable ? model.openAccountScreen : undefined,
          showChevron: model.isAuthAvailable,
        },
        ...(model.showSyncEntry
          ? [
              {
                key: 'sync',
                icon: 'sync',
                title: model.t('settings.autoSync', 'Auto sync'),
                subtitle: !model.user ? model.t('settings.syncSignedOutHint', 'Sign in to enable backup.') : null,
                value: model.syncValue,
                onPress: model.openSyncScreen,
              } satisfies SettingsRowModel,
            ]
          : []),
        ...(model.showSocialPushEntry
          ? [
              {
                key: 'friend-activity-notifications',
                icon: 'notifications',
                title: model.t('settings.friendActivityNotifications', 'Friend activity notifications'),
                subtitle:
                  model.socialPushValue === model.t('settings.friendActivityNotificationsNeedsSettings', 'Needs settings')
                    ? model.t('settings.friendActivityNotificationsSettingsShortHint', 'Enable notifications in system settings.')
                    : null,
                value: model.socialPushValue,
                onPress: model.openSocialPushSettings,
              } satisfies SettingsRowModel,
            ]
          : []),
        {
          key: 'plus',
          icon: 'plus',
          title: model.t('settings.plusTitle', 'Noto Plus'),
          subtitle: model.isPurchaseAvailable ? model.plusHint : null,
          value:
            model.isPurchaseAvailable
              ? model.tier === 'plus'
                ? model.t('settings.plusActive', 'Plus')
                : model.plusValue
              : model.t('settings.unavailableShort', 'Unavailable'),
          onPress: model.openPlusScreen,
        },
      ],
    },
    {
      key: 'appearance',
      title: model.t('settings.appearance', 'Appearance'),
      items: [
        {
          key: 'language',
          icon: 'language',
          title: model.t('settings.language', 'Language'),
          value: model.languageLabel,
          onPress: () => model.openSettingsSheet('language'),
        },
        {
          key: 'app-theme',
          icon: 'palette',
          title: model.t('settings.appTheme', 'App Theme'),
          value: model.appThemeLabel,
          onPress: () => model.openSettingsSheet('appTheme'),
        },
        {
          key: 'theme',
          icon: 'theme',
          title: model.t('settings.theme', 'Theme'),
          value: model.themeLabel,
          onPress: () => model.openSettingsSheet('theme'),
        },
        {
          key: 'haptics',
          icon: 'haptics',
          title: model.t('settings.haptics', 'Haptics'),
          value: model.hapticsValue,
          onPress: () => model.openSettingsSheet('haptics'),
        },
      ],
    },
    {
      key: 'notes',
      title: model.t('settings.notes', 'Notes'),
      items: [
        {
          key: 'notes-count',
          icon: 'notes',
          title: model.t('settings.noteCount', 'Saved Notes'),
          value: model.noteCountLabel,
        },
        {
          key: 'clear-all',
          icon: 'trash',
          title: model.t('settings.clearAll', 'Clear All Notes'),
          subtitle:
            model.notes.length > 0
              ? model.t('settings.clearAllShortHint', 'Deletes memories saved on this device.')
              : model.t('settings.clearAllEmptyHint', 'Nothing to clear.'),
          onPress: model.promptClearAll,
          destructive: model.notes.length > 0,
          disabled: model.notes.length === 0,
          showChevron: false,
        },
      ],
    },
  ];

  const legalItems: SettingsRowModel[] = [];
  if (model.showPrivacyPolicyLink) {
    legalItems.push({
      key: 'privacy-policy',
      icon: 'privacy',
      title: model.t('settings.privacyPolicy', 'Privacy Policy'),
      onPress: model.openPrivacyPolicyLink,
      external: true,
      showChevron: false,
    });
  }

  if (model.showSupportLink) {
    legalItems.push({
      key: 'support',
      icon: 'support',
      title: model.t('settings.support', 'Support'),
      onPress: model.openSupportLink,
      external: true,
      showChevron: false,
    });
  }

  if (model.showAccountDeletionLink) {
    legalItems.push({
      key: 'account-deletion',
      icon: 'accountDeletion',
      title: model.t('settings.accountDeletion', 'Account deletion help'),
      onPress: model.openAccountDeletionHelpLink,
      external: true,
      showChevron: false,
    });
  }

  if (legalItems.length > 0) {
    sections.push({
      key: 'support',
      title: model.t('settings.legal', 'Privacy & Support'),
      items: legalItems,
    });
  }

  return {
    sections,
    about: {
      brandName: SETTINGS_BRAND_NAME,
      tagline: model.t('settings.about', 'So you never forget what she likes 💛'),
      versionLabel: model.t('settings.version', 'Version'),
      versionValue: model.appVersion,
      plusUnavailableMessage: model.isPurchaseAvailable
        ? null
        : model.t('settings.plusUnavailable', 'Plus is coming soon to this build.'),
    },
  };
}
