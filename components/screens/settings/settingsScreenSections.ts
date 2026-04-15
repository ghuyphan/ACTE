import type { useSettingsScreenModel } from './useSettingsScreenModel';

export type SettingsIconKey =
  | 'account'
  | 'sync'
  | 'notifications'
  | 'plus'
  | 'language'
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
  external?: boolean;
  showChevron?: boolean;
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
                subtitle: model.socialPushHint,
                value: model.socialPushValue,
                onPress: model.openSocialPushSettings,
              } satisfies SettingsRowModel,
            ]
          : []),
        {
          key: 'plus',
          icon: 'plus',
          title: model.t('settings.plusTitle', 'Noto Plus'),
          subtitle: model.plusHint,
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
          onPress: () => model.setShowLanguage(true),
        },
        {
          key: 'theme',
          icon: 'theme',
          title: model.t('settings.theme', 'Theme'),
          value: model.themeLabel,
          onPress: () => model.setShowTheme(true),
        },
        {
          key: 'haptics',
          icon: 'haptics',
          title: model.t('settings.haptics', 'Haptics'),
          value: model.hapticsValue,
          onPress: () => model.setShowHaptics(true),
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
          value: `${model.notes.length}`,
        },
        {
          key: 'clear-all',
          icon: 'trash',
          title: model.t('settings.clearAll', 'Clear All Notes'),
          subtitle: model.t(
            'settings.clearAllMsg',
            'All your food notes will be permanently deleted. This action cannot be undone.'
          ),
          onPress: model.promptClearAll,
          destructive: true,
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
      subtitle: model.t(
        'settings.privacyPolicyHint',
        'Review how Noto handles your data and permissions.'
      ),
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
      subtitle: model.t(
        'settings.supportHint',
        'Contact support if sign-in, sync, or account issues need a hand.'
      ),
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
      subtitle: model.t(
        'settings.accountDeletionHint',
        'Open the external deletion page or support contact for your store listing.'
      ),
      onPress: model.openAccountDeletionHelpLink,
      external: true,
      showChevron: false,
    });
  }

  if (legalItems.length > 0) {
    sections.push({
      key: 'support',
      title: model.t('settings.supportTitle', 'Support'),
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
